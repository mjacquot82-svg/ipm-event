"""Staging-gated, device-scoped itinerary reminder targeting foundation."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import hmac
from typing import Any
from zoneinfo import ZoneInfo

import httpx


REMINDER_TYPE = "itinerary_t30"
TORONTO = ZoneInfo("America/Toronto")


def hash_capability(capability: str) -> str:
    return hashlib.sha256(capability.encode("utf-8")).hexdigest()


def capability_matches(capability: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_capability(capability), stored_hash)


def is_t30_eligible(*, starts_at: datetime, starred_at: datetime, now: datetime) -> bool:
    """A normal T-30 reminder is eligible only if the star existed by T-30."""
    start = starts_at.astimezone(TORONTO)
    current = now.astimezone(TORONTO)
    starred = starred_at.astimezone(TORONTO)
    return start > current and starred <= start - timedelta(minutes=30)


class SupabaseItineraryReminderRepository:
    """Service-role-only storage. Browser callers never access these tables."""

    def __init__(self, client: Any, event_slug: str):
        self.client = client
        self.event_slug = event_slug

    async def _event_id(self) -> str:
        return await self.client.get_event_id(self.event_slug)

    async def get(self, installation_id: str) -> dict[str, Any] | None:
        event_id = await self._event_id()
        rows = await self.client.request("GET", "/itinerary_reminder_installations", params={
            "select": "*", "event_id": f"eq.{event_id}",
            "wonderpush_installation_id": f"eq.{installation_id}", "limit": "1",
        })
        return rows[0] if rows else None

    async def get_by_capability(self, capability: str) -> dict[str, Any] | None:
        event_id = await self._event_id()
        rows = await self.client.request("GET", "/itinerary_reminder_installations", params={
            "select": "*", "event_id": f"eq.{event_id}",
            "capability_hash": f"eq.{hash_capability(capability)}", "limit": "1",
        })
        registration = rows[0] if rows else None
        if not registration or not capability_matches(capability, registration["capability_hash"]):
            return None
        return registration

    async def register(self, installation_id: str, capability: str) -> dict[str, Any]:
        existing = await self.get(installation_id)
        if existing:
            if not capability_matches(capability, existing["capability_hash"]):
                raise PermissionError("Device capability does not match")
            return existing
        prior_for_device = await self.get_by_capability(capability)
        if prior_for_device:
            rows = await self.client.request("PATCH", "/itinerary_reminder_installations",
                params={"id": f"eq.{prior_for_device['id']}"}, json={
                    "wonderpush_installation_id": installation_id,
                    "reminders_enabled": False,
                    "provider_reachability": "unknown",
                    "provider_has_push_token": False,
                    "provider_deliverable": False,
                    "provider_checked_at": None,
                }, headers={"Prefer": "return=representation"})
            return rows[0]
        event_id = await self._event_id()
        rows = await self.client.request("POST", "/itinerary_reminder_installations", json={
            "event_id": event_id, "wonderpush_installation_id": installation_id,
            "capability_hash": hash_capability(capability),
        }, headers={"Prefer": "return=representation"})
        return rows[0]

    async def authorize(self, installation_id: str, capability: str) -> dict[str, Any]:
        registration = await self.get(installation_id)
        if not registration or not capability_matches(capability, registration["capability_hash"]):
            raise PermissionError("Invalid installation credentials")
        return registration

    async def set_enabled(self, registration_id: str, enabled: bool) -> dict[str, Any]:
        rows = await self.client.request("PATCH", "/itinerary_reminder_installations",
            params={"id": f"eq.{registration_id}"}, json={"reminders_enabled": enabled},
            headers={"Prefer": "return=representation"})
        return rows[0]

    async def set_readiness(self, registration_id: str, *, reachability: str,
        has_push_token: bool, checked_at: datetime) -> dict[str, Any]:
        deliverable = reachability == "optIn" and has_push_token
        rows = await self.client.request("PATCH", "/itinerary_reminder_installations",
            params={"id": f"eq.{registration_id}"}, json={
                "provider_reachability": reachability,
                "provider_has_push_token": has_push_token,
                "provider_checked_at": checked_at.astimezone(timezone.utc).isoformat(),
                "provider_deliverable": deliverable,
            }, headers={"Prefer": "return=representation"})
        return rows[0]

    async def set_test_label(self, registration_id: str, label: str) -> dict[str, Any]:
        rows = await self.client.request("PATCH", "/itinerary_reminder_installations",
            params={"id": f"eq.{registration_id}"}, json={"test_device_label": label},
            headers={"Prefer": "return=representation"})
        return rows[0]

    async def test_registrations(self) -> list[dict[str, Any]]:
        event_id = await self._event_id()
        return await self.client.request("GET", "/itinerary_reminder_installations", params={
            "select": "id,wonderpush_installation_id,capability_hash,test_device_label",
            "event_id": f"eq.{event_id}", "test_device_label": "not.is.null",
        })

    async def claim_controlled_test(self, registration_id: str, test_key: str = "initial") -> dict[str, Any] | None:
        event_id = await self._event_id()
        try:
            rows = await self.client.request("POST", "/controlled_targeting_tests", json={
                "event_id": event_id, "registration_id": registration_id, "test_key": test_key, "status": "claimed",
            }, headers={"Prefer": "return=representation"})
            return rows[0]
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 409: return None
            raise

    async def controlled_test(self, test_key: str) -> dict[str, Any] | None:
        event_id = await self._event_id()
        rows = await self.client.request("GET", "/controlled_targeting_tests", params={
            "select": "*", "event_id": f"eq.{event_id}", "test_key": f"eq.{test_key}", "limit": "1",
        })
        return rows[0] if rows else None

    async def finish_controlled_test(self, claim_id: str, *, status: str,
        provider_delivery_id: str | None = None, error_message: str | None = None) -> None:
        body = {"status": status, "provider_delivery_id": provider_delivery_id,
            "error_message": error_message[:1000] if error_message else None}
        if status == "provider_accepted": body["provider_accepted_at"] = datetime.now(timezone.utc).isoformat()
        await self.client.request("PATCH", "/controlled_targeting_tests",
            params={"id": f"eq.{claim_id}"}, json=body, headers={"Prefer": "return=minimal"})

    async def sync_full_set(self, registration: dict[str, Any], schedule_ids: list[str]) -> dict[str, Any]:
        """RPC performs the delete/insert reconciliation in one transaction."""
        result = await self.client.request("POST", "/rpc/sync_itinerary_reminder_stars", json={
            "p_registration_id": registration["id"], "p_schedule_item_ids": schedule_ids,
        })
        return result[0] if isinstance(result, list) and result else {"starred_count": len(schedule_ids)}

    async def claim(self, registration_id: str, schedule_item_id: str) -> dict[str, Any] | None:
        try:
            rows = await self.client.request("POST", "/itinerary_reminder_deliveries", json={
                "registration_id": registration_id, "schedule_item_id": schedule_item_id,
                "reminder_type": REMINDER_TYPE, "status": "claimed",
            }, headers={"Prefer": "return=representation"})
            return rows[0]
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 409:
                return None
            raise

    async def claim_due(self, now: datetime) -> list[dict[str, Any]]:
        """Atomically claim the eventual worker's T-30 window from canonical rows."""
        rows = await self.client.request("POST", "/rpc/claim_due_itinerary_reminders", json={
            "p_now": now.astimezone(timezone.utc).isoformat(),
        })
        return rows or []


def public_status(registration: dict[str, Any]) -> dict[str, Any]:
    reachability = registration.get("provider_reachability") or "unknown"
    return {
        "registered": True,
        "reminders_enabled": bool(registration.get("reminders_enabled")),
        "starred_count": int(registration.get("starred_count", 0)),
        "last_sync_at": registration.get("last_sync_at"),
        "registration_fingerprint": hashlib.sha256(
            registration["wonderpush_installation_id"].encode()).hexdigest()[:10].upper(),
        "provider_reachability": reachability,
        "provider_has_push_token": bool(registration.get("provider_has_push_token")),
        "provider_checked_at": registration.get("provider_checked_at"),
        "provider_deliverable": bool(registration.get("provider_deliverable")),
    }


def provider_readiness(installation: dict[str, Any] | None) -> tuple[str, bool]:
    if installation is None:
        return "unknown", False
    preferences = installation.get("preferences") or {}
    push_token = installation.get("pushToken") or {}
    has_push_token = bool(push_token.get("data"))
    status = preferences.get("subscriptionStatus")
    reachability = "optOut" if not has_push_token else ("softOptOut" if status == "optOut" else "optIn")
    return reachability, has_push_token


def test_device_status(registration: dict[str, Any]) -> dict[str, Any]:
    installation_id = registration["wonderpush_installation_id"]
    return {
        "registered": True,
        "label": registration.get("test_device_label"),
        "fingerprint": hashlib.sha256(installation_id.encode()).hexdigest()[:10].upper(),
    }


class InstallationTargetedWonderPush:
    """Provider boundary that refuses unregistered or multi-installation targets."""

    def __init__(self, repository: SupabaseItineraryReminderRepository, provider: Any):
        self.repository = repository
        self.provider = provider

    async def send(self, *, installation_id: str, title: str, message: str, target_url: str) -> str:
        if not installation_id or installation_id == "@ALL" or "," in installation_id:
            raise ValueError("Exactly one installation is required")
        registration = await self.repository.get(installation_id)
        if not registration:
            raise PermissionError("Installation is not registered for this event")
        if not registration.get("provider_deliverable"):
            raise PermissionError("Installation is not currently provider-reachable")
        return await self.provider.send_one_installation(
            installation_id=installation_id, title=title, message=message, target_url=target_url
        )
