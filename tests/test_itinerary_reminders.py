from datetime import datetime, timedelta, timezone
import asyncio

import pytest

from backend.itinerary_reminders import InstallationTargetedWonderPush, capability_matches, hash_capability, is_t30_eligible, provider_readiness
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
