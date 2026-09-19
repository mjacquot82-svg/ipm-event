import asyncio
from datetime import datetime, timedelta, timezone

from backend.itinerary_reminders import SupabaseItineraryReminderRepository, is_t30_eligible, provider_readiness


def test_t30_uses_current_start_and_rejects_late_or_started_events():
    now = datetime(2026, 9, 22, 14, tzinfo=timezone.utc)
    old_start = now + timedelta(minutes=30)
    new_start = now + timedelta(hours=1, minutes=30)
    starred = now - timedelta(days=1)
    assert is_t30_eligible(starts_at=old_start, starred_at=starred, now=now)
    assert is_t30_eligible(starts_at=new_start, starred_at=starred, now=now)
    assert not is_t30_eligible(starts_at=old_start, starred_at=now + timedelta(seconds=1), now=now)
    assert not is_t30_eligible(starts_at=now, starred_at=starred, now=now)


def test_provider_readiness_requires_push_token_and_opt_in():
    assert provider_readiness(None) == ("unknown", False)
    assert provider_readiness({"preferences": {"subscriptionStatus": "optIn"}}) == ("optOut", False)
    assert provider_readiness({"pushToken": {"data": "token"}, "preferences": {"subscriptionStatus": "optIn"}}) == ("optIn", True)
    assert provider_readiness({"pushToken": {"data": "token"}, "preferences": {"subscriptionStatus": "optOut"}}) == ("softOptOut", True)


def test_reconcile_readiness_uses_authenticated_bound_installation():
    class Storage:
        async def request(self, method, path, params=None, json=None, headers=None):
            assert method == "PATCH"
            assert path == "/itinerary_reminder_installations"
            assert params == {"id": "eq.registration-a"}
            assert json["provider_deliverable"] is True
            return [{"id": "registration-a", **json}]

    class Provider:
        async def get_installation(self, installation_id):
            assert installation_id == "A" * 40
            return {"preferences": {"subscriptionStatus": "optIn"},
                    "pushToken": {"data": "provider-token"}}

    result = asyncio.run(SupabaseItineraryReminderRepository(Storage(), "event").reconcile_readiness(
        {"id": "registration-a", "wonderpush_installation_id": "A" * 40},
        Provider(), checked_at=datetime.now(timezone.utc)))
    assert result["provider_deliverable"] is True
