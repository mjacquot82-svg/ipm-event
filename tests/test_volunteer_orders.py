from datetime import datetime, timezone

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


def make_client(monkeypatch, closes="2099-01-01T00:00"):
    monkeypatch.setenv("VOLUNTEER_ORDER_PASSWORD", "vol-pass")
    monkeypatch.setenv("VOLUNTEER_ORDER_ADMIN_PASSWORD", "admin-pass")
    monkeypatch.setenv("VOLUNTEER_ORDER_CLOSES_AT", closes)
    col = FakeCollection()
    app = FastAPI()
    app.include_router(vo.build_router(lambda: {vo.COLLECTION: col}), prefix="/api")
    return TestClient(app), col


ORDER = {"name": "Pat", "contact": "pat@example.com", "quantities": {"colored_logo": 2, "short_etched": 1}}


def test_default_close_is_nov_20_toronto(monkeypatch):
    monkeypatch.delenv("VOLUNTEER_ORDER_CLOSES_AT", raising=False)
    assert vo.closes_at().isoformat() == "2026-11-20T23:59:00-05:00"


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
