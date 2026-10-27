from datetime import datetime, timezone

import pytest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend import volunteer_orders as vo


class FakeCursor:
    def __init__(self, docs): self.docs = docs
    def sort(self, *a): return self
    async def to_list(self, n): return [dict(d) for d in self.docs]


class FakeCollection:
    def __init__(self): self.docs = []
    async def insert_one(self, doc): self.docs.append({k: v for k, v in doc.items()})
    def find(self, *a): return FakeCursor(self.docs)
    async def delete_one(self, query):
        before = len(self.docs)
        self.docs = [d for d in self.docs if d.get("id") != query.get("id")]
        return type("R", (), {"deleted_count": before - len(self.docs)})()


def make_client(monkeypatch, closes="2099-01-01T00:00"):
    monkeypatch.setenv("VOLUNTEER_ORDER_PASSWORD", "vol-pass")
    monkeypatch.setenv("VOLUNTEER_ORDER_ADMIN_PASSWORD", "admin-pass")
    monkeypatch.setenv("VOLUNTEER_ORDER_CLOSES_AT", closes)
    col = FakeCollection()
    app = FastAPI()
    app.include_router(vo.build_router(lambda: {vo.COLLECTION: col}), prefix="/api")
    return TestClient(app), col


ORDER = {"name": "Pat", "contact": "pat@example.com", "quantities": {"colored_logo": 2, "short_etched": 1}}


def test_default_close_is_end_of_nov_15_toronto(monkeypatch):
    monkeypatch.delenv("VOLUNTEER_ORDER_CLOSES_AT", raising=False)
    assert vo.closes_at().isoformat() == "2026-11-16T00:00:00-05:00"
    assert vo.closes_at().astimezone(timezone.utc).isoformat() == "2026-11-16T05:00:00+00:00"


@pytest.mark.parametrize("override", [None, "2026-11-16T00:00", "2026-11-16T00:00:00-05:00", "2026-11-16T05:00:00+00:00"])
@pytest.mark.parametrize("instant, expected_open", [
    ("2026-11-16T04:59:59.999999+00:00", True),
    ("2026-11-16T05:00:00+00:00", False),
    ("2026-11-16T05:00:00.000001+00:00", False),
])
def test_exact_cutoff_matches_status_unlock_and_order(monkeypatch, override, instant, expected_open):
    client, col = make_client(monkeypatch)
    if override is None:
        monkeypatch.delenv("VOLUNTEER_ORDER_CLOSES_AT")
    else:
        monkeypatch.setenv("VOLUNTEER_ORDER_CLOSES_AT", override)
    now = datetime.fromisoformat(instant)

    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return now.astimezone(tz)

    monkeypatch.setattr(vo, "datetime", Clock)
    h = {"X-Volunteer-Password": "vol-pass"}
    status = client.get("/api/volunteer-glasses/status").json()
    info = client.post("/api/volunteer-glasses/unlock", headers=h).json()
    assert status["open"] is info["open"] is expected_open
    assert datetime.fromisoformat(status["closes_at"]) == vo.closes_at()
    assert info["set_size"] == 2 and info["price_per_set_cents"] == 1600
    assert len(info["styles"]) == 3
    response = client.post("/api/volunteer-glasses/orders", headers=h, json=ORDER)
    assert response.status_code == (201 if expected_open else 403)
    assert len(col.docs) == (1 if expected_open else 0)


def test_local_environment_override_uses_toronto_dst(monkeypatch):
    monkeypatch.setenv("VOLUNTEER_ORDER_CLOSES_AT", "2026-07-15T00:00")
    assert vo.closes_at().isoformat() == "2026-07-15T00:00:00-04:00"


def test_wrong_or_missing_password_rejected(monkeypatch):
    client, col = make_client(monkeypatch)
    assert client.post("/api/volunteer-glasses/unlock", headers={"X-Volunteer-Password": "nope"}).status_code == 401
    assert client.post("/api/volunteer-glasses/orders", json=ORDER).status_code == 401
    assert col.docs == []


def test_unconfigured_password_disables_feature(monkeypatch):
    client, _ = make_client(monkeypatch)
    monkeypatch.delenv("VOLUNTEER_ORDER_PASSWORD")
    assert client.post("/api/volunteer-glasses/unlock", headers={"X-Volunteer-Password": ""}).status_code == 503


def test_order_stored_with_total(monkeypatch):
    client, col = make_client(monkeypatch)
    r = client.post("/api/volunteer-glasses/orders", json=ORDER, headers={"X-Volunteer-Password": "vol-pass"})
    assert r.status_code == 201 and r.json()["total_cents"] == 4800
    assert col.docs[0]["quantities"] == {"colored_logo": 2, "large_etched": 0, "short_etched": 1}


def test_invalid_quantities_rejected(monkeypatch):
    client, _ = make_client(monkeypatch)
    h = {"X-Volunteer-Password": "vol-pass"}
    for q in [{}, {"colored_logo": 0}, {"colored_logo": -1}, {"mixed": 1}, {"colored_logo": 999}]:
        assert client.post("/api/volunteer-glasses/orders", json={**ORDER, "quantities": q}, headers=h).status_code == 422


def test_closed_preorder_rejects_server_side(monkeypatch):
    client, col = make_client(monkeypatch, closes="2020-01-01T00:00")
    r = client.post("/api/volunteer-glasses/orders", json=ORDER, headers={"X-Volunteer-Password": "vol-pass"})
    assert r.status_code == 403 and col.docs == []
    assert client.get("/api/volunteer-glasses/status").json()["open"] is False


def test_admin_list_and_csv(monkeypatch):
    client, col = make_client(monkeypatch)
    h = {"X-Volunteer-Password": "vol-pass"}
    client.post("/api/volunteer-glasses/orders", json=ORDER, headers=h)
    client.post("/api/volunteer-glasses/orders", json={**ORDER, "quantities": {"large_etched": 3}}, headers=h)
    assert client.get("/api/volunteer-glasses/admin/orders", headers={"X-Admin-Password": "vol-pass"}).status_code == 401
    data = client.get("/api/volunteer-glasses/admin/orders", headers={"X-Admin-Password": "admin-pass"}).json()
    assert data["summary"] == {"sets_by_style": {"colored_logo": 2, "large_etched": 3, "short_etched": 1}, "total_sets": 6, "total_cents": 9600}
    csv_text = client.get("/api/volunteer-glasses/admin/orders.csv", headers={"X-Admin-Password": "admin-pass"}).text
    assert csv_text.splitlines()[-1] == "TOTAL,,,2,3,1,6,96.00,"


def test_admin_delete_order(monkeypatch):
    client, col = make_client(monkeypatch)
    h = {"X-Volunteer-Password": "vol-pass"}
    keep = client.post("/api/volunteer-glasses/orders", json=ORDER, headers=h).json()["id"]
    gone = client.post("/api/volunteer-glasses/orders", json={**ORDER, "name": "TEST"}, headers=h).json()["id"]
    url = f"/api/volunteer-glasses/admin/orders/{gone}"
    assert client.delete(url).status_code == 401
    assert client.delete(url, headers={"X-Admin-Password": "vol-pass"}).status_code == 401
    assert len(col.docs) == 2
    r = client.delete(url, headers={"X-Admin-Password": "admin-pass"})
    assert r.status_code == 200 and r.json() == {"deleted": gone}
    assert [d["id"] for d in col.docs] == [keep]
    data = client.get("/api/volunteer-glasses/admin/orders", headers={"X-Admin-Password": "admin-pass"}).json()
    assert data["summary"]["total_sets"] == 3


def test_admin_delete_missing_order_404(monkeypatch):
    client, _ = make_client(monkeypatch)
    r = client.delete("/api/volunteer-glasses/admin/orders/nope", headers={"X-Admin-Password": "admin-pass"})
    assert r.status_code == 404


def test_admin_delete_unconfigured_503(monkeypatch):
    client, _ = make_client(monkeypatch)
    monkeypatch.delenv("VOLUNTEER_ORDER_ADMIN_PASSWORD")
    assert client.delete("/api/volunteer-glasses/admin/orders/x", headers={"X-Admin-Password": ""}).status_code == 503
