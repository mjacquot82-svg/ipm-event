import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from backend import server
from backend.notification_registrations import (
    SupabaseNotificationRegistrationRepository,
    hash_capability,
)


CAPABILITY = "A" * 43
OTHER_CAPABILITY = "B" * 43


class FakeClient:
    def __init__(self):
        self.rows = []

    async def get_event_id(self, _slug):
        return "event-production"

    async def request(self, method, path, params=None, json=None, headers=None):
        assert path == "/notification_installations"
        if method == "GET":
            rows = self.rows
            if "wonderpush_installation_id" in params:
                value = params["wonderpush_installation_id"].removeprefix("eq.")
                rows = [row for row in rows if row["wonderpush_installation_id"] == value]
            if "capability_hash" in params:
                value = params["capability_hash"].removeprefix("eq.")
                rows = [row for row in rows if row["capability_hash"] == value]
            return rows[:1]
        if method == "POST":
            row = {"id": "registration-1", "reminders_enabled": False,
                "provider_reachability": "unknown", "provider_has_push_token": False,
                "provider_deliverable": False, "provider_checked_at": None, **json}
            self.rows.append(row)
            return [row]
        if method == "PATCH":
            row = self.rows[0]
            row.update(json)
            return [row]
        raise AssertionError(method)


def repository():
    result = SupabaseNotificationRegistrationRepository(FakeClient(), "ipm-2026")
    return result


def test_registration_is_event_capability_scoped_idempotent_and_disabled():
    repo = repository()
    first = asyncio.run(repo.register("production-installation", CAPABILITY))
    second = asyncio.run(repo.register("production-installation", CAPABILITY))
    assert first == second
    assert first["event_id"] == "event-production"
    assert first["capability_hash"] == hash_capability(CAPABILITY)
    assert first["reminders_enabled"] is False
    assert "capability" not in first


def test_installation_takeover_with_different_capability_is_rejected():
    repo = repository()
    asyncio.run(repo.register("production-installation", CAPABILITY))
    with pytest.raises(PermissionError):
        asyncio.run(repo.register("production-installation", OTHER_CAPABILITY))


def test_capability_can_move_only_its_own_registration_and_resets_readiness():
    repo = repository()
    asyncio.run(repo.register("old-installation", CAPABILITY))
    moved = asyncio.run(repo.register("new-installation", CAPABILITY))
    assert moved["wonderpush_installation_id"] == "new-installation"
    assert moved["provider_deliverable"] is False
    assert moved["reminders_enabled"] is False


def request(headers):
    return SimpleNamespace(headers=headers)


def test_public_registration_requires_both_device_credentials(monkeypatch):
    monkeypatch.setattr(server, "notification_registration_repository", repository())
    with pytest.raises(HTTPException) as missing:
        asyncio.run(server.register_notification_device(request({})))
    assert missing.value.status_code == 400


def test_status_rejects_wrong_capability(monkeypatch):
    repo = repository()
    asyncio.run(repo.register("production-installation", CAPABILITY))
    monkeypatch.setattr(server, "notification_registration_repository", repo)
    headers = {"X-WonderPush-Installation-Id": "production-installation",
        "X-Notification-Device-Capability": OTHER_CAPABILITY}
    with pytest.raises(HTTPException) as rejected:
        asyncio.run(server.notification_registration_status(request(headers)))
    assert rejected.value.status_code == 403


def test_operations_proves_t30_disabled_without_provider_secrets(monkeypatch):
    monkeypatch.setattr(server, "wonderpush_client", object())
    result = asyncio.run(server.notification_registration_operations())
    assert result["provider_configured"] is True
    assert result["scheduler_enabled"] is False
    assert result["delivery_kill_switch"] is True
    assert "access_token" not in result
