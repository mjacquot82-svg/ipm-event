from datetime import datetime, timedelta, timezone
import asyncio

import pytest

from backend.itinerary_reminders import InstallationTargetedWonderPush, ItineraryReminderEngine, capability_matches, hash_capability, is_t30_eligible, provider_readiness
from backend.platform_services import WonderPushClient, WonderPushError


def test_capability_is_hashed_and_constant_time_validated():
    capability = "A" * 43
    stored = hash_capability(capability)
    assert stored != capability
    assert capability_matches(capability, stored)
    assert not capability_matches("B" * 43, stored)


def test_t30_eligibility_and_late_star_policy_use_aware_time():
    now = datetime(2026, 9, 22, 14, 0, tzinfo=timezone.utc)
    start = now + timedelta(minutes=30)
    assert is_t30_eligible(starts_at=start, starred_at=now - timedelta(days=1), now=now)
    assert not is_t30_eligible(starts_at=start, starred_at=now + timedelta(seconds=1), now=now)
    assert not is_t30_eligible(starts_at=now, starred_at=now - timedelta(days=1), now=now)


def test_single_installation_provider_has_no_broadcast_fallback(monkeypatch):
    client = WonderPushClient(access_token="test")
    captured = {}
    async def fake_send(*, content, target):
        captured.update(target)
        return "accepted"
    monkeypatch.setattr(client, "_send", fake_send)
    asyncio.run(client.send_one_installation(
        title="Test", message="Only A", target_url="https://staging.example/itinerary",
        installation_id="installation-a",
    ))
    assert captured == {"targetInstallationIds": "installation-a"}
    with pytest.raises(WonderPushError):
        asyncio.run(client.send_one_installation(
            title="Test", message="No broadcast", target_url="https://staging.example",
            installation_id="@ALL",
        ))


def test_targeting_boundary_rejects_another_device():
    class Repository:
        async def get(self, installation_id):
            return {"id": "registered-a", "provider_deliverable": True} if installation_id == "installation-a" else None
    class Provider:
        async def send_one_installation(self, **kwargs):
            return kwargs["installation_id"]
    targeter = InstallationTargetedWonderPush(Repository(), Provider())
    assert asyncio.run(targeter.send(
        installation_id="installation-a", title="Test", message="A", target_url="https://staging.example"
    )) == "installation-a"
    with pytest.raises(PermissionError):
        asyncio.run(targeter.send(
            installation_id="installation-b", title="Test", message="B", target_url="https://staging.example"
        ))


def test_provider_readiness_requires_opt_in_and_push_token():
    assert provider_readiness(None) == ("unknown", False)
    assert provider_readiness({"preferences": {"subscriptionStatus": "optIn"}}) == ("optOut", False)
    assert provider_readiness({"pushToken": {"data": "token"},
        "preferences": {"subscriptionStatus": "optOut"}}) == ("softOptOut", True)
    assert provider_readiness({"pushToken": {"data": "token"},
        "preferences": {"subscriptionStatus": "optIn"}}) == ("optIn", True)


def test_targeting_boundary_rejects_stale_registration():
    class Repository:
        async def get(self, installation_id):
            return {"id": "stale", "provider_deliverable": False}
    class Provider:
        async def send_one_installation(self, **kwargs):
            raise AssertionError("provider must not be called")
    with pytest.raises(PermissionError, match="provider-reachable"):
        asyncio.run(InstallationTargetedWonderPush(Repository(), Provider()).send(
            installation_id="installation-a", title="Test", message="A", target_url="https://staging.example"
        ))


def test_ready_device_send_route_is_single_target_and_honest():
    source = open("backend/server.py", encoding="utf-8").read()
    route = source[source.index('controlled-ready-device-a-send'):]
    assert '"ready_device"' in route
    assert 'message="Ready-device delivery test."' in route
    assert 'device_a.get("reminders_enabled")' in route
    assert 'device_a.get("provider_reachability") != "optIn"' in route
    assert 'device_a.get("provider_has_push_token")' in route
    assert 'status="provider_accepted"' in route
    assert '"physical_delivery": "unknown"' in route
    assert '"device_b_targeted": False' in route
    assert '"broadcast": False' in route
    assert '"automatic_retry": False' in route
    assert "send_everyone" not in route


def test_physical_retest_has_new_atomic_key_and_complete_gate():
    source = open("backend/server.py", encoding="utf-8").read()
    route = source[source.index('controlled-ready-device-a-physical-retest'):]
    assert '"ready_device_physical_retest_20260823"' in route
    assert 'message="Ready-device physical delivery test."' in route
    assert 'preferences.get("subscriptionStatus") == "optIn"' in route
    assert 'preferences.get("osNotificationsVisible") is True' in route
    assert 'device_a.get("reminders_enabled")' in route
    assert 'status="provider_accepted"' in route
    assert '"physical_delivery": "unknown"' in route
    assert '"device_b_targeted": False' in route
    assert '"broadcast": False' in route
    assert '"automatic_retry": False' in route
    assert "send_everyone" not in route


def test_synthetic_status_diagnostic_is_read_only_and_redacted():
    source = open("backend/server.py", encoding="utf-8").read()
    route = source[source.index('synthetic-fixture-status'):source.index('@api_router.put("/itinerary-reminders/synthetic-fixture")')]
    assert "synthetic_fixture_status(fixture_key)" in route
    assert '"notification_sent_by_this_check": False' in route
    assert "wonderpush_installation_id" not in route
    assert "capability_hash" not in route
    assert ".send(" not in route


class FakeEngineRepository:
    def __init__(self):
        self.registration = {"id": "reg-a", "provider_deliverable": True}
        self.claimed = False
        self.finished = []
    async def close_stale_claims(self, now, **kwargs): pass
    async def due_registrations(self, now, **kwargs):
        return [{"registration_id": "reg-a", "wonderpush_installation_id": "installation-a"}]
    async def set_readiness(self, registration_id, **values):
        self.registration["provider_deliverable"] = values["reachability"] == "optIn" and values["has_push_token"]
    async def claim_due_batch(self, now, **kwargs):
        if self.claimed: return []
        self.claimed = True
        return [{"delivery_id": "delivery-a", "registration_id": "reg-a", "schedule_item_id": "event-a",
            "wonderpush_installation_id": "installation-a", "title": "Demo Event",
            "location_name": "Demo Stage", "starts_at": now + timedelta(minutes=30)}]
    async def get(self, installation_id): return self.registration if installation_id == "installation-a" else None
    async def finish_delivery(self, delivery_id, **values): self.finished.append((delivery_id, values))


class FakeAuthorizedRepository(FakeEngineRepository):
    def __init__(self):
        super().__init__()
        self.registration.update({"test_device_label": "A", "wonderpush_installation_id": "installation-a",
            "reminders_enabled": True})
    async def registration_by_id(self, registration_id):
        return self.registration if registration_id == "reg-a" else None
    async def claim_authorized_synthetic(self, **kwargs):
        if self.claimed: return []
        self.claimed = True
        now = kwargs["now"]
        return [{"delivery_id": "delivery-auth", "authorization_id": "authorization-a",
            "registration_id": "reg-a", "synthetic_event_id": "fixture-a",
            "wonderpush_installation_id": "installation-a", "title": "One-Shot Demo",
            "location_name": None, "starts_at": now + timedelta(minutes=30)}]


class FakeEngineProvider:
    def __init__(self): self.sent = []
    async def get_installation(self, installation_id):
        return {"pushToken": {"data": "mock-token"}, "preferences": {"subscriptionStatus": "optIn"}}
    async def send_one_installation(self, **kwargs):
        self.sent.append(kwargs)
        return "mock-accepted"


def test_real_engine_kill_switch_inspects_without_claim_or_send():
    repository, provider = FakeEngineRepository(), FakeEngineProvider()
    result = asyncio.run(ItineraryReminderEngine(repository, provider, delivery_enabled=False).run(
        now=datetime(2026, 9, 22, 14, 0, tzinfo=timezone.utc)))
    assert result["kill_switch_enabled"] is True
    assert result["claimed"] == 0
    assert provider.sent == []


def test_real_engine_targets_one_installation_and_deduplicates_second_run():
    repository, provider = FakeEngineRepository(), FakeEngineProvider()
    engine = ItineraryReminderEngine(repository, provider, delivery_enabled=True,
        target_url="https://staging.theipm.ca/itinerary")
    now = datetime(2026, 9, 22, 14, 0, tzinfo=timezone.utc)
    first = asyncio.run(engine.run(now=now))
    second = asyncio.run(engine.run(now=now))
    assert first["provider_accepted"] == 1 and second["claimed"] == 0
    assert len(provider.sent) == 1
    assert provider.sent[0]["installation_id"] == "installation-a"
    assert provider.sent[0]["title"] == "IPM — Starting Soon"
    assert provider.sent[0]["message"] == "Demo Event starts in 30 minutes at Demo Stage."
    assert repository.finished[0][1]["status"] == "provider_accepted"


def test_provider_timeout_becomes_delivery_unknown_without_automatic_retry():
    class TimeoutProvider(FakeEngineProvider):
        async def send_one_installation(self, **kwargs): raise RuntimeError("request timed out")
    repository = FakeEngineRepository()
    result = asyncio.run(ItineraryReminderEngine(repository, TimeoutProvider(), delivery_enabled=True).run(
        now=datetime(2026, 9, 22, 14, 0, tzinfo=timezone.utc)))
    assert result["delivery_unknown"] == 1
    assert repository.finished[0][1]["retry_at"] is None


def test_definitive_provider_rejection_can_retry_without_duplicate_acceptance():
    class RetryRepository(FakeEngineRepository):
        async def finish_delivery(self, delivery_id, **values):
            await super().finish_delivery(delivery_id, **values)
            if values["status"] == "provider_failed": self.claimed = False
    class RejectOnceProvider(FakeEngineProvider):
        async def send_one_installation(self, **kwargs):
            if not self.sent:
                self.sent.append(kwargs)
                raise RuntimeError("WonderPush rejected the notification (HTTP 503)")
            self.sent.append(kwargs)
            return "accepted-on-safe-retry"
    repository, provider = RetryRepository(), RejectOnceProvider()
    engine = ItineraryReminderEngine(repository, provider, delivery_enabled=True)
    now = datetime(2026, 9, 22, 14, 0, tzinfo=timezone.utc)
    first = asyncio.run(engine.run(now=now))
    second = asyncio.run(engine.run(now=now + timedelta(minutes=1)))
    assert first["provider_failed"] == 1 and second["provider_accepted"] == 1
    assert len(provider.sent) == 2


def test_authorized_synthetic_bypasses_only_global_kill_switch_once():
    repository, provider = FakeAuthorizedRepository(), FakeEngineProvider()
    engine = ItineraryReminderEngine(repository, provider, delivery_enabled=False)
    now = datetime(2026, 9, 22, 14, 0, tzinfo=timezone.utc)
    first = asyncio.run(engine.run_authorized_synthetic(now=now,
        fixture_id="fixture-a", registration_id="reg-a"))
    second = asyncio.run(engine.run_authorized_synthetic(now=now,
        fixture_id="fixture-a", registration_id="reg-a"))
    assert first["global_kill_switch_enabled"] is True
    assert first["claimed"] == 1 and first["provider_call_count"] == 1
    assert second["claimed"] == 0 and second["provider_call_count"] == 0
    assert len(provider.sent) == 1
    assert provider.sent[0]["installation_id"] == "installation-a"
    assert provider.sent[0]["message"] == "One-Shot Demo starts in 30 minutes."


def test_one_shot_schema_is_synthetic_atomic_expiring_and_single_device():
    source = open("supabase/migrations/20260824000100_synthetic_t30_one_shot_authorizations.sql", encoding="utf-8").read()
    assert "references public.itinerary_reminder_synthetic_events" in source
    assert "references public.schedule_items" not in source
    assert "expires_at <= created_at + interval '15 minutes'" in source
    assert "unique(synthetic_event_id, reminder_type)" in source
    assert "authz.consumed_at is null" in source
    assert "authz.synthetic_event_id=p_synthetic_event_id" in source
    assert "authz.registration_id=p_registration_id" in source
    assert "authz.expires_at>p_now" in source
    assert "registration.test_device_label='A'" in source
    assert "item.starts_at>p_now+interval '25 minutes'" in source
    assert "item.starts_at<=p_now+interval '30 minutes'" in source
    assert "registration.provider_checked_at>p_now-interval '15 minutes'" in source
    assert "not exists(select 1 from itinerary_reminder_synthetic_deliveries" in source


def test_one_shot_routes_are_staging_organizer_scoped_without_broadcast():
    source = open("backend/server.py", encoding="utf-8").read()
    route = source[source.index('/admin/itinerary-reminders/synthetic-one-shot/authorize'):]
    assert route.count("if not IS_STAGING_DEPLOYMENT") >= 2
    assert "Depends(get_current_organizer_user)" in route
    assert "require_announcement_manager_role(current_user)" in route
    assert "Global reminder kill switch must remain on" in route
    assert '"device_b_targeted": False' in route
    assert '"broadcast": False' in route
    assert '"automatic_retry": False' in route
    assert "@ALL" not in route
