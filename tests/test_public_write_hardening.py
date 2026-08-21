import asyncio
from datetime import datetime
from types import SimpleNamespace

import httpx
import pytest

from backend import server


VALID_TOKEN = "ExpoPushToken[abcdefghijklmnopqrstuvwxyz]"
VALID_SOS = {
    "name": "Jordan Example", "sex": "Unknown", "age": "12", "glasses": False,
    "last_location": "Main entrance", "reporter_token": "reporter_token_123456",
}


class Cursor:
    def __init__(self, rows): self.rows = rows; self.requested_length = None
    async def to_list(self, length): self.requested_length = length; return self.rows[:length]


class Collection:
    def __init__(self, rows=None, fail_insert=False):
        self.rows = list(rows or []); self.fail_insert = fail_insert; self.updates = []; self.inserts = []
    async def insert_one(self, row):
        if self.fail_insert: raise RuntimeError("database unavailable")
        self.inserts.append(dict(row)); self.rows.append(dict(row)); return SimpleNamespace(inserted_id=row.get("id"))
    async def find_one(self, query):
        return next((row for row in self.rows if all(row.get(key) == value for key, value in query.items())), None)
    async def update_one(self, query, update, upsert=False):
        self.updates.append((query, update, upsert))
        row = await self.find_one(query)
        if row:
            row.update(update.get("$set", {})); return SimpleNamespace(modified_count=1)
        if upsert:
            self.rows.append({**query, **update.get("$set", {})}); return SimpleNamespace(modified_count=0, upserted_id="new")
        return SimpleNamespace(modified_count=0)
    async def delete_one(self, query):
        row = await self.find_one(query)
        if not row: return SimpleNamespace(deleted_count=0)
        self.rows.remove(row); return SimpleNamespace(deleted_count=1)
    def find(self, query=None):
        query = query or {}
        return Cursor([row for row in self.rows if all(row.get(key) == value for key, value in query.items())])


class Database:
    def __init__(self, *, reports=None, tokens=None, fail_report_insert=False):
        self.sos_reports = Collection(reports, fail_insert=fail_report_insert)
        self.push_tokens = Collection(tokens)
        self.user_starred_events = Collection()
        self.status_checks = Collection()


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    server.public_write_rate_limiter.entries.clear()
    yield
    server.public_write_rate_limiter.entries.clear()
    server.app.dependency_overrides.clear()


async def request(app, method, path, **kwargs):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        return await client.request(method, path, **kwargs)


def test_valid_sos_is_saved_and_reports_bounded_delivery_status(monkeypatch):
    database = Database(tokens=[{"push_token": VALID_TOKEN}])
    provider_calls = []
    async def delivery(*args, **kwargs): provider_calls.append(kwargs); return {"status": "accepted", "attempted": 1, "succeeded": 1}
    monkeypatch.setattr(server, "db", database)
    monkeypatch.setattr(server, "broadcast_sos_notification", delivery)
    response = asyncio.run(request(server.app, "POST", "/api/sos/report", json=VALID_SOS))
    assert response.status_code == 200
    assert response.json()["notification_status"] == "accepted"
    assert response.json()["reporter_token"] == VALID_SOS["reporter_token"]
    assert database.sos_reports.inserts[0]["reporter_token"] == VALID_SOS["reporter_token"]
    assert len(provider_calls) == 1


def test_sos_validation_body_limit_and_rate_limit_precede_work(monkeypatch):
    database = Database(); monkeypatch.setattr(server, "db", database)
    async def delivery(*args, **kwargs): raise AssertionError("provider must not be called")
    monkeypatch.setattr(server, "broadcast_sos_notification", delivery)
    assert asyncio.run(request(server.app, "POST", "/api/sos/report", json={"name": "Only"})).status_code == 422
    oversized = {**VALID_SOS, "description": "x" * 17000}
    assert asyncio.run(request(server.app, "POST", "/api/sos/report", json=oversized)).status_code == 413
    for _ in range(3):
        monkeypatch.setattr(server, "broadcast_sos_notification", lambda *args, **kwargs: asyncio.sleep(0, result={"status": "no_recipients", "attempted": 0, "succeeded": 0}))
        assert asyncio.run(request(server.app, "POST", "/api/sos/report", json=VALID_SOS)).status_code == 200
    assert asyncio.run(request(server.app, "POST", "/api/sos/report", json=VALID_SOS)).status_code == 429
    assert len(database.sos_reports.inserts) == 3


def test_sos_provider_and_database_failures_are_truthful(monkeypatch):
    database = Database(); monkeypatch.setattr(server, "db", database)
    async def failed(*args, **kwargs): return {"status": "failed", "attempted": 1, "succeeded": 0}
    monkeypatch.setattr(server, "broadcast_sos_notification", failed)
    response = asyncio.run(request(server.app, "POST", "/api/sos/report", json=VALID_SOS))
    assert response.status_code == 200 and response.json()["notification_status"] == "failed"
    failing_database = Database(fail_report_insert=True); monkeypatch.setattr(server, "db", failing_database)
    called = False
    async def should_not_run(*args, **kwargs):
        nonlocal called; called = True
    monkeypatch.setattr(server, "broadcast_sos_notification", should_not_run)
    assert asyncio.run(request(server.app, "POST", "/api/sos/report", json={**VALID_SOS, "reporter_token": "different_token_12345"})).status_code == 500
    assert called is False


def test_cancellation_requires_matching_reporter_token_and_never_fans_out_when_unauthorized(monkeypatch):
    report = {"id": "report-1", "name": "Jordan", "status": "active", "reporter_token": "correct_token_123456"}
    database = Database(reports=[report]); monkeypatch.setattr(server, "db", database)
    calls = []
    async def delivery(*args, **kwargs): calls.append(1); return {"status": "accepted", "attempted": 1, "succeeded": 1}
    monkeypatch.setattr(server, "broadcast_sos_notification", delivery)
    for suffix in ("", "?reporter_token=wrong_token_123456"):
        response = asyncio.run(request(server.app, "POST", f"/api/sos/cancel/report-1{suffix}"))
        assert response.status_code == 404
        assert report["status"] == "active" and calls == []
    response = asyncio.run(request(server.app, "POST", "/api/sos/cancel/report-1?reporter_token=correct_token_123456"))
    assert response.status_code == 200 and report["status"] == "resolved" and calls == [1]


def test_expo_fanout_is_one_client_and_at_most_fifty_bounded_batches(monkeypatch):
    tokens = [{"push_token": f"ExpoPushToken[token{i:05d}abcdefghij]"} for i in range(6000)]
    database = Database(tokens=tokens); clients = []
    class HttpClient:
        def __init__(self, **kwargs): self.calls = []; clients.append(self)
        async def __aenter__(self): return self
        async def __aexit__(self, *args): return None
        async def post(self, url, json, headers): self.calls.append(json); return SimpleNamespace(status_code=200)
    monkeypatch.setattr(httpx, "AsyncClient", HttpClient)
    result = asyncio.run(server.broadcast_sos_notification(database, title="Alert", body="Body", data={}))
    assert result == {"status": "accepted", "attempted": 50, "succeeded": 50}
    assert len(clients) == 1 and len(clients[0].calls) == 50
    assert all(len(batch) <= 100 for batch in clients[0].calls)


def test_push_and_starred_validation_upsert_and_abuse_bounds(monkeypatch):
    database = Database(); monkeypatch.setattr(server, "db", database)
    valid_push = {"push_token": VALID_TOKEN, "device_id": "Mélanie’s iPhone"}
    assert asyncio.run(request(server.app, "POST", "/api/register-push-token", json=valid_push)).status_code == 200
    assert asyncio.run(request(server.app, "POST", "/api/register-push-token", json=valid_push)).status_code == 200
    assert len(database.push_tokens.rows) == 1
    for _ in range(8):
        assert asyncio.run(request(server.app, "POST", "/api/register-push-token", json=valid_push)).status_code == 200
    assert asyncio.run(request(server.app, "POST", "/api/register-push-token", json=valid_push)).status_code == 429
    server.public_write_rate_limiter.entries.clear()
    for payload in ({"push_token": "bad", "device_id": "phone"}, {**valid_push, "extra": True}):
        assert asyncio.run(request(server.app, "POST", "/api/register-push-token", json=payload)).status_code == 422
    valid_starred = {"push_token": VALID_TOKEN, "starred_event_ids": ["gs_1_opening", "event-2"]}
    assert asyncio.run(request(server.app, "POST", "/api/update-starred-events", json=valid_starred)).status_code == 200
    for payload in ({**valid_starred, "starred_event_ids": [f"event-{i}" for i in range(201)]}, {**valid_starred, "starred_event_ids": ["bad id!"]}, {**valid_starred, "extra": True}):
        assert asyncio.run(request(server.app, "POST", "/api/update-starred-events", json=payload)).status_code == 422


def test_status_is_strict_bounded_and_rate_limited(monkeypatch):
    database = Database(); monkeypatch.setattr(server, "db", database)
    assert asyncio.run(request(server.app, "POST", "/api/status", json={"client_name": "native-app/1.0"})).status_code == 200
    assert asyncio.run(request(server.app, "POST", "/api/status", json={"client_name": "ok", "arbitrary": "field"})).status_code == 422
    assert asyncio.run(request(server.app, "POST", "/api/status", json={"client_name": "x" * 101})).status_code == 422
    server.public_write_rate_limiter.entries.clear()
    for index in range(30):
        assert asyncio.run(request(server.app, "POST", "/api/status", json={"client_name": f"client-{index}"})).status_code == 200
    assert asyncio.run(request(server.app, "POST", "/api/status", json={"client_name": "blocked"})).status_code == 429


def test_test_alert_requires_authorized_organizer(monkeypatch):
    database = Database(); monkeypatch.setattr(server, "db", database)
    assert asyncio.run(request(server.app, "POST", "/api/sos/test-alert")).status_code == 401
    assert asyncio.run(request(server.app, "DELETE", "/api/sos/test-alert/alert-1")).status_code == 401
    assert asyncio.run(request(server.app, "POST", "/api/sos/resolve/report-1", json={"pin": "2026"})).status_code == 401
    async def scheduler(): return {"role": "Schedule", "event_id": "ipm-2026"}
    server.app.dependency_overrides[server.get_current_organizer_user] = scheduler
    assert asyncio.run(request(server.app, "POST", "/api/sos/test-alert")).status_code == 403
    async def owner(): return {"role": "Owner", "event_id": "ipm-2026"}
    server.app.dependency_overrides[server.get_current_organizer_user] = owner
    assert asyncio.run(request(server.app, "POST", "/api/sos/test-alert")).status_code == 200


def test_rate_limiter_memory_is_bounded_and_windows_expire(monkeypatch):
    limiter = server.BoundedRateLimiter(max_keys=3)
    for index in range(10): assert limiter.check(str(index), limit=1, window_seconds=60)
    assert len(limiter.entries) == 3
    clock = iter([100.0, 100.0, 102.0])
    monkeypatch.setattr(server.time, "monotonic", lambda: next(clock))
    limiter = server.BoundedRateLimiter(max_keys=3)
    assert limiter.check("shared-nat", limit=1, window_seconds=1)
    assert not limiter.check("shared-nat", limit=1, window_seconds=1)
    assert limiter.check("shared-nat", limit=1, window_seconds=1)
