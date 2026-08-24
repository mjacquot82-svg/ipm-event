import asyncio
from datetime import datetime, timezone

import httpx

from backend.itinerary_reminders import ItineraryReminderEngine, ProviderReadinessSynchronizer
from backend.platform_services import WonderPushClient
from tests.test_reminder_batching import BatchProvider, BatchRepository


def test_wonderpush_installation_listing_uses_cursor_and_updated_since(monkeypatch):
    calls = []
    class FakeClient:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def get(self, url, params=None):
            calls.append((url, params))
            if len(calls) == 1:
                return httpx.Response(200, json={"data": [{"id": "a"}],
                    "pagination": {"next": "https://management-api.wonderpush.com/cursor/next"}})
            return httpx.Response(200, json={"data": [{"id": "b"}],
                "pagination": {"next": None}})
    monkeypatch.setattr("backend.platform_services.httpx.AsyncClient", FakeClient)
    rows, pages = asyncio.run(WonderPushClient(access_token="secret").list_installations(
        updated_since=datetime(2026, 8, 24, tzinfo=timezone.utc)))
    assert [row["id"] for row in rows] == ["a", "b"] and pages == 2
    assert calls[0][1]["limit"] == 1000 and calls[0][1]["sort"] == "none"
    assert calls[0][1]["updateDateFrom"].startswith("2026-08-24")
    assert calls[1][1] is None


class MirrorRepository:
    def __init__(self): self.applied = None
    async def registered_installation_ids(self): return {"registered-a", "registered-b"}
    async def apply_readiness_refresh(self, **values):
        self.applied = values
        return {"updated_count": len(values["rows"]), "missing_count": 0}
    async def record_readiness_refresh_failure(self, **values): self.failure = values
    async def evaluate_readiness_alert(self, *args): return {"alert_open": False}


class MirrorProvider:
    async def list_installations(self, **kwargs):
        return ([
            {"id": "registered-a", "updateDate": "2026-08-24T00:00:00Z",
             "preferences": {"subscriptionStatus": "optIn"}, "pushToken": {"data": "redacted"}},
            {"id": "unrelated", "preferences": {}, "pushToken": {"data": "redacted"}},
        ], 3)


def test_refresh_intersects_registered_ids_and_persists_no_token():
    repository = MirrorRepository()
    result = asyncio.run(ProviderReadinessSynchronizer(repository, MirrorProvider()).refresh(
        now=datetime(2026, 8, 24, tzinfo=timezone.utc)))
    assert result["provider_requests"] == 3 and result["registered_installations_matched"] == 1
    assert repository.applied["full_refresh"] is True
    assert repository.applied["rows"] == [{"installation_id": "registered-a",
        "reachability": "optIn", "has_push_token": True, "subscription_state": "optIn",
        "provider_updated_at": "2026-08-24T00:00:00Z"}]
    assert "redacted" not in str(repository.applied)


def test_t30_scheduler_makes_zero_provider_readiness_lookups():
    class NoLookupProvider(BatchProvider):
        async def get_installation(self, installation_id):
            raise AssertionError("T-30 critical path must use the durable readiness mirror")
    repository, provider = BatchRepository(10000), NoLookupProvider()
    result = asyncio.run(ItineraryReminderEngine(repository, provider, delivery_enabled=True,
        batch_size=10000, max_sends_per_second=1000).run(
            now=datetime(2026, 9, 22, 14, tzinfo=timezone.utc)))
    assert result["provider_readiness_requests"] == 0
    assert result["claimed"] == 10000 and result["provider_requests"] == 1


def test_kill_switch_makes_no_readiness_or_delivery_provider_calls():
    class NoProviderCalls(BatchProvider):
        async def get_installation(self, installation_id): raise AssertionError("no lookup")
        async def send_installations(self, **values): raise AssertionError("no delivery")
    result = asyncio.run(ItineraryReminderEngine(BatchRepository(10000), NoProviderCalls(),
        delivery_enabled=False).run(now=datetime(2026, 9, 22, 14, tzinfo=timezone.utc)))
    assert result["provider_readiness_requests"] == 0 and result["provider_requests"] == 0


def test_mirror_schema_has_freshness_missing_and_observability_guards():
    source = open("supabase/migrations/20260824000800_provider_readiness_mirror.sql",
        encoding="utf-8").read()
    assert "provider_verification_source" in source
    assert "wonderpush_list_full_missing" in source
    assert "provider_deliverable=false" in source
    assert "claim_due_itinerary_reminders_cached" in source
    assert "p_provider_readiness_max_age_seconds" in source
    assert "upcoming_t30_lacking_fresh_readiness" in source
    assert "revoke all on function" in source
    locking = open("supabase/migrations/20260824001100_skip_locked_reminder_claims.sql",
        encoding="utf-8").read()
    assert locking.count("for update of registration skip locked") == 2
