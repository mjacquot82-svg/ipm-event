import asyncio
from types import SimpleNamespace

import httpx
import pytest
from fastapi import HTTPException

from backend import server
from backend.notification_registrations import (
    SupabaseNotificationRegistrationRepository,
    hash_capability,
    provider_readiness,
)
from backend.platform_services import WonderPushClient, WonderPushError


CAPABILITY = "A" * 43
INSTALLATION_ID = "production/install id"


class FakeSupabaseClient:
    def __init__(self):
        self.row = {
            "id": "registration-1",
            "event_id": "event-production",
            "wonderpush_installation_id": INSTALLATION_ID,
            "capability_hash": hash_capability(CAPABILITY),
            "provider_reachability": "unknown",
            "provider_has_push_token": False,
            "provider_deliverable": False,
            "provider_checked_at": None,
            "reminders_enabled": False,
        }

    async def get_event_id(self, slug):
        assert slug == "ipm-2026"
        return "event-production"

    async def request(self, method, path, params=None, json=None, headers=None):
        assert path == "/notification_installations"
        if method == "GET":
            return [self.row]
        if method == "PATCH":
            assert params == {"id": "eq.registration-1"}
            assert headers == {"Prefer": "return=representation"}
            self.row.update(json)
            return [self.row]
        raise AssertionError(method)


class ReadyProvider:
    async def get_installation(self, installation_id):
        assert installation_id == INSTALLATION_ID
        return {
            "preferences": {"subscriptionStatus": "optIn"},
            "pushToken": {"data": "never-exposed-token"},
        }


def request(capability=CAPABILITY):
    return SimpleNamespace(headers={
        "X-WonderPush-Installation-Id": INSTALLATION_ID,
        "X-Notification-Device-Capability": capability,
    })


def test_production_style_readiness_verifies_provider_and_persists(monkeypatch):
    storage = FakeSupabaseClient()
    repository = SupabaseNotificationRegistrationRepository(storage, "ipm-2026")
    monkeypatch.setattr(server, "notification_registration_repository", repository)
    monkeypatch.setattr(server, "wonderpush_client", ReadyProvider())

    result = asyncio.run(server.verify_notification_readiness(request()))

    assert result["registration_fingerprint"]
    assert result["provider_reachability"] == "optIn"
    assert result["provider_has_push_token"] is True
    assert result["provider_deliverable"] is True
    assert result["provider_checked_at"] is not None
    assert result["reminders_enabled"] is False
    serialized = str(result)
    assert INSTALLATION_ID not in serialized
    assert "never-exposed-token" not in serialized
    assert CAPABILITY not in serialized


@pytest.mark.parametrize(
    ("installation", "expected"),
    [
        ({"preferences": {"subscriptionStatus": "optIn"},
          "pushToken": {"data": "token"}}, ("optIn", True)),
        ({"preferences": {"subscriptionStatus": "optOut"},
          "pushToken": {"data": "token"}}, ("softOptOut", True)),
        ({"preferences": {"subscriptionStatus": "optIn"},
          "pushToken": {}}, ("optOut", False)),
    ],
)
def test_provider_readiness_parses_opt_in_and_push_token(installation, expected):
    assert provider_readiness(installation) == expected


def test_readiness_authorization_remains_protected(monkeypatch):
    repository = SupabaseNotificationRegistrationRepository(
        FakeSupabaseClient(), "ipm-2026")
    monkeypatch.setattr(server, "notification_registration_repository", repository)
    monkeypatch.setattr(server, "wonderpush_client", ReadyProvider())
    with pytest.raises(HTTPException) as rejected:
        asyncio.run(server.verify_notification_readiness(request("B" * 43)))
    assert rejected.value.status_code == 403


def test_provider_failure_returns_safe_bounded_503(monkeypatch):
    class FailingProvider:
        async def get_installation(self, _installation_id):
            raise WonderPushError(
                "WonderPush installation lookup failed (HTTP 401)",
                status_code=401,
                provider_error_message="redacted provider detail",
            )

    repository = SupabaseNotificationRegistrationRepository(
        FakeSupabaseClient(), "ipm-2026")
    monkeypatch.setattr(server, "notification_registration_repository", repository)
    monkeypatch.setattr(server, "wonderpush_client", FailingProvider())
    with pytest.raises(HTTPException) as unavailable:
        asyncio.run(server.verify_notification_readiness(request()))
    assert unavailable.value.status_code == 503
    assert unavailable.value.detail == "Notification readiness is temporarily unavailable"
    assert "redacted provider detail" not in unavailable.value.detail


def test_lookup_url_encodes_installation_and_returns_provider_data(monkeypatch):
    calls = []

    class FakeClient:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def get(self, url, params=None):
            calls.append((url, params))
            return httpx.Response(200, json={
                "preferences": {"subscriptionStatus": "optIn"},
                "pushToken": {"data": "provider-token"},
            })

    monkeypatch.setattr("backend.platform_services.httpx.AsyncClient", FakeClient)
    result = asyncio.run(WonderPushClient(access_token="provider-secret").get_installation(
        INSTALLATION_ID))
    assert calls[0][0].endswith("/production%2Finstall%20id")
    assert calls[0][1] == {"accessToken": "provider-secret", "userId": ""}
    assert provider_readiness(result) == ("optIn", True)


def test_provider_authentication_failure_is_safe_and_bounded(monkeypatch):
    class FakeClient:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def get(self, *args, **kwargs):
            return httpx.Response(401, json={
                "error": {"code": "invalid_token", "message":
                    "access_token=provider-secret installation=production/install id"},
            })

    monkeypatch.setattr("backend.platform_services.httpx.AsyncClient", FakeClient)
    with pytest.raises(WonderPushError) as caught:
        asyncio.run(WonderPushClient(access_token="provider-secret").get_installation(
            INSTALLATION_ID))
    error = caught.value
    assert error.status_code == 401
    assert error.provider_error_code == "invalid_token"
    assert "provider-secret" not in str(error.__dict__)
    assert INSTALLATION_ID not in str(error.__dict__)


@pytest.mark.parametrize("response", [
    httpx.Response(200, text="not-json"),
    httpx.Response(200, json=[{"unexpected": "list"}]),
])
def test_malformed_provider_response_is_safe_and_bounded(monkeypatch, response):
    class FakeClient:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def get(self, *args, **kwargs): return response

    monkeypatch.setattr("backend.platform_services.httpx.AsyncClient", FakeClient)
    with pytest.raises(WonderPushError, match="malformed data") as caught:
        asyncio.run(WonderPushClient(access_token="provider-secret").get_installation(
            INSTALLATION_ID))
    assert "provider-secret" not in str(caught.value)
    assert INSTALLATION_ID not in str(caught.value)


def test_t30_controls_remain_disabled():
    assert server.ITINERARY_REMINDER_SCHEDULER_ENABLED is False
    assert server.ITINERARY_REMINDER_DELIVERY_ENABLED is False
