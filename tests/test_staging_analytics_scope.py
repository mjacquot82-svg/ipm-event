"""The organizer event is deployment-owned, not the legacy analytics storage label."""

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from backend import server
from backend.notification_health import build_health
from backend.platform_services import EventService
from tests.test_analytics_reporting import fixture_repository


PATHS = ("summary?range=7d", "traffic?range=7d", "content?range=7d", "live",
         "notification-health", "notifications")


class SessionCollection:
    def __init__(self, event_id):
        self.event_id = event_id

    async def find_one(self, query):
        if query["token_hash"] != server.hash_session_token("test-session"):
            return None
        return {"user_id": "test-owner", "event_id": self.event_id}


class UserCollection:
    def __init__(self, event_id):
        self.event_id = event_id

    async def find_one(self, query):
        assert query == {"id": "test-owner", "event_id": self.event_id, "is_active": True}
        return {"id": "test-owner", "event_id": self.event_id, "role": "Owner"}


class RegistrationRepository:
    async def adoption_summary(self):
        return dict(registered_devices=0, enabled_devices=0, deliverable_devices=0,
                    stale_deliverable_devices=0, never_checked_devices=0,
                    oldest_provider_check_at=None, newest_provider_check_at=None,
                    snapshot_at=datetime.now(timezone.utc).isoformat())


@pytest.mark.parametrize("organizer_event,expected", [("ipm-staging", 200), ("ipm-2026", 403), ("unrelated", 403)])
def test_staging_analytics_uses_authenticated_deployment_event(monkeypatch, organizer_event, expected):
    import backend.notification_health as health

    class Database:
        organizer_sessions = SessionCollection(organizer_event)
        organizer_users = UserCollection(organizer_event)

    monkeypatch.setattr(server, "db", Database())
    monkeypatch.setattr(server, "event_service", EventService("ipm-staging"))
    monkeypatch.setattr(server, "analytics_reporting_repository", fixture_repository())
    monkeypatch.setattr(server, "notification_registration_repository", RegistrationRepository())

    async def report(repository):
        return build_health([], {})

    monkeypatch.setattr(health, "health_report", report)
    client = TestClient(server.app)
    for path in PATHS:
        assert client.get("/api/admin/analytics/" + path).status_code == 401
    client.cookies.set(server.ADMIN_SESSION_COOKIE_NAME, "test-session")
    for path in PATHS:
        response = client.get("/api/admin/analytics/" + path)
        assert response.status_code == expected, (path, response.text)
        if expected == 403:
            assert response.json() == {"detail": "Analytics are unavailable for this event"}
        else:
            assert "visitorId" not in response.text and "sessionId" not in response.text
            if path == "notification-health":
                assert response.headers["cache-control"] == "no-store"
                assert response.json()["repair_history"] == "NOT_RECORDED"


def test_default_deployment_still_rejects_staging_organizer(monkeypatch):
    monkeypatch.setattr(server, "event_service", EventService("ipm-2026"))
    monkeypatch.setattr(server, "analytics_reporting_repository", object())
    with pytest.raises(server.HTTPException) as exc:
        server.require_analytics_reporting_repository({"event_id": "ipm-staging"})
    assert exc.value.status_code == 403


def test_staging_missing_storage_is_not_hidden(monkeypatch):
    monkeypatch.setattr(server, "event_service", EventService("ipm-staging"))
    monkeypatch.setattr(server, "analytics_reporting_repository", None)
    with pytest.raises(server.HTTPException) as exc:
        server.require_analytics_reporting_repository({"event_id": "ipm-staging"})
    assert exc.value.status_code == 503
    assert exc.value.detail == "Analytics reporting storage is not configured"
