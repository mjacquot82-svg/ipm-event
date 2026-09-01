import asyncio
from datetime import datetime, timedelta, timezone

from backend.notification_registrations import SupabaseNotificationRegistrationRepository
from backend.platform_services import SupabaseNotificationDeliveryService
from backend import server
from fastapi import HTTPException
import pytest


class RegistrationClient:
    def __init__(self, rows):
        self.rows = rows

    async def get_event_id(self, slug):
        return "event-production"

    async def request(self, method, path, params=None, **kwargs):
        assert (method, path) == ("GET", "/notification_installations")
        assert "wonderpush_installation_id" not in params["select"]
        assert "capability_hash" not in params["select"]
        return self.rows


def row(reachability, token, deliverable, checked_at):
    return {
        "provider_reachability": reachability,
        "provider_has_push_token": token,
        "provider_deliverable": deliverable,
        "provider_checked_at": checked_at,
    }


def test_adoption_semantics_freshness_and_zero_state():
    now = datetime(2026, 9, 1, 12, tzinfo=timezone.utc)
    rows = [
        row("optIn", True, True, (now - timedelta(hours=2)).isoformat()),
        row("optIn", True, True, (now - timedelta(hours=25)).isoformat()),
        row("optIn", False, False, (now - timedelta(hours=1)).isoformat()),
        row("softOptOut", True, False, (now - timedelta(hours=1)).isoformat()),
        row("unknown", False, False, None),
    ]
    repository = SupabaseNotificationRegistrationRepository(RegistrationClient(rows), "ipm-2026")
    result = asyncio.run(repository.adoption_summary(now=now))
    assert result["registered_devices"] == 5
    assert result["enabled_devices"] == 3
    assert result["deliverable_devices"] == 2
    assert result["stale_deliverable_devices"] == 1
    assert result["never_checked_devices"] == 1
    assert "installation" not in str(result).lower()
    assert "token" not in str(result).lower()

    empty = SupabaseNotificationRegistrationRepository(RegistrationClient([]), "ipm-2026")
    assert asyncio.run(empty.adoption_summary(now=now))["deliverable_devices"] == 0


class DeliveryClient:
    def __init__(self):
        self.calls = []

    async def get_event_id(self, slug):
        return "event-production"

    async def request(self, method, path, params=None, json=None, headers=None):
        self.calls.append((method, path, params, json))
        if method == "POST":
            return [{"id": "delivery-1", **json}]
        return [{
            "announcement_id": "announcement-a", "status": "sent",
            "sent_at": "2026-09-01T12:00:00+00:00", "audience_device_count": 19,
            "audience_count_basis": "verified_deliverable_registrations",
            "audience_snapshot_at": "2026-09-01T11:59:59+00:00",
            "audience_stale_device_count": 2,
        }]


def test_delivery_snapshot_is_immutable_and_stats_are_announcement_scoped():
    service = SupabaseNotificationDeliveryService(
        supabase_url="https://example.supabase.co", service_role_key="test", event_slug="ipm-2026")
    service.client = DeliveryClient()
    created = asyncio.run(service.create_requested(
        event_id="ipm-2026", announcement_id="announcement-a", audience="everyone",
        requested_by="Jen", target_url="https://theipm.ca/announcements/announcement-a",
        notification_title="Title", notification_message="Message",
        audience_device_count=19, audience_stale_device_count=2,
        audience_snapshot_at="2026-09-01T11:59:59+00:00"))
    assert created["audience_device_count"] == 19
    assert created["audience_count_basis"] == "verified_deliverable_registrations"

    stats = asyncio.run(service.list_announcement_stats(event_id="ipm-2026"))
    assert stats[0]["announcement_id"] == "announcement-a"
    params = service.client.calls[-1][2]
    assert params["event_id"] == "eq.event-production"
    assert params["audience"] == "eq.everyone"
    serialized = str(stats)
    assert "wonderpush_installation_id" not in serialized
    assert "pushToken" not in serialized
    assert "provider_campaign_id" not in params["select"]


def test_historical_delivery_missing_snapshot_remains_unavailable():
    historical = {"audience_device_count": None, "audience_snapshot_at": None}
    assert historical["audience_device_count"] is None
    assert historical["audience_snapshot_at"] is None


def test_delivery_stats_authorization_preserves_communications_and_owner_access(monkeypatch):
    class StatsService:
        async def list_announcement_stats(self, *, event_id):
            assert event_id == "event-production"
            return []

    monkeypatch.setattr(server, "notification_delivery_service", StatsService())
    for role in ("Owner", "Communications"):
        result = asyncio.run(server.list_announcement_delivery_stats({
            "role": role, "event_id": "event-production"
        }))
        assert result.deliveries == []

    with pytest.raises(HTTPException) as rejected:
        asyncio.run(server.list_announcement_delivery_stats({
            "role": "Schedule", "event_id": "event-production"
        }))
    assert rejected.value.status_code == 403
