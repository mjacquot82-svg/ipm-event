"""Capability-scoped attendee WonderPush registration storage."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import hmac
from typing import Any


def hash_capability(capability: str) -> str:
    return hashlib.sha256(capability.encode("utf-8")).hexdigest()


def capability_matches(capability: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_capability(capability), stored_hash)


class SupabaseNotificationRegistrationRepository:
    """Service-role storage; browser clients never receive provider identifiers."""

    def __init__(self, client: Any, event_slug: str):
        self.client = client
        self.event_slug = event_slug

    async def _event_id(self) -> str:
        return await self.client.get_event_id(self.event_slug)

    async def get(self, installation_id: str) -> dict[str, Any] | None:
        event_id = await self._event_id()
        rows = await self.client.request("GET", "/notification_installations", params={
            "select": "*", "event_id": f"eq.{event_id}",
            "wonderpush_installation_id": f"eq.{installation_id}", "limit": "1",
        })
        return rows[0] if rows else None

    async def get_by_capability(self, capability: str) -> dict[str, Any] | None:
        event_id = await self._event_id()
        rows = await self.client.request("GET", "/notification_installations", params={
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
        prior = await self.get_by_capability(capability)
        if prior:
            rows = await self.client.request("PATCH", "/notification_installations",
                params={"id": f"eq.{prior['id']}"}, json={
                    "wonderpush_installation_id": installation_id,
                    "provider_reachability": "unknown", "provider_has_push_token": False,
                    "provider_deliverable": False, "provider_checked_at": None,
                }, headers={"Prefer": "return=representation"})
            return rows[0]
        event_id = await self._event_id()
        rows = await self.client.request("POST", "/notification_installations", json={
            "event_id": event_id, "wonderpush_installation_id": installation_id,
            "capability_hash": hash_capability(capability),
        }, headers={"Prefer": "return=representation"})
        return rows[0]

    async def authorize(self, installation_id: str, capability: str) -> dict[str, Any]:
        registration = await self.get(installation_id)
        if not registration or not capability_matches(capability, registration["capability_hash"]):
            raise PermissionError("Invalid installation credentials")
        return registration

    async def set_readiness(self, registration_id: str, *, reachability: str,
        has_push_token: bool) -> dict[str, Any]:
        rows = await self.client.request("PATCH", "/notification_installations",
            params={"id": f"eq.{registration_id}"}, json={
                "provider_reachability": reachability,
                "provider_has_push_token": has_push_token,
                "provider_deliverable": reachability == "optIn" and has_push_token,
                "provider_checked_at": datetime.now(timezone.utc).isoformat(),
            }, headers={"Prefer": "return=representation"})
        return rows[0]

    async def adoption_summary(self, *, now: datetime | None = None) -> dict[str, Any]:
        event_id = await self._event_id()
        rows = await self.client.request("GET", "/notification_installations", params={
            "select": "provider_reachability,provider_has_push_token,provider_deliverable,provider_checked_at",
            "event_id": f"eq.{event_id}",
        })
        current = now or datetime.now(timezone.utc)
        stale_before = current - timedelta(hours=24)
        checked_at = []
        for row in rows:
            value = row.get("provider_checked_at")
            if value:
                parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
                checked_at.append(parsed.astimezone(timezone.utc))
        deliverable = [row for row in rows if row.get("provider_deliverable") is True]
        stale_deliverable = 0
        for row in deliverable:
            value = row.get("provider_checked_at")
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(timezone.utc) if value else None
            if parsed is None or parsed < stale_before:
                stale_deliverable += 1
        return {
            "registered_devices": len(rows),
            "enabled_devices": sum(row.get("provider_reachability") == "optIn" for row in rows),
            "deliverable_devices": len(deliverable),
            "stale_deliverable_devices": stale_deliverable,
            "never_checked_devices": sum(not row.get("provider_checked_at") for row in rows),
            "oldest_provider_check_at": min(checked_at).isoformat() if checked_at else None,
            "newest_provider_check_at": max(checked_at).isoformat() if checked_at else None,
            "snapshot_at": current.isoformat(),
        }


def provider_readiness(installation: dict[str, Any] | None) -> tuple[str, bool]:
    if not installation:
        return "unknown", False
    preferences = installation.get("preferences") or {}
    push_token = installation.get("pushToken") or {}
    has_push_token = bool(push_token.get("data"))
    subscription = preferences.get("subscriptionStatus")
    reachability = "optOut" if not has_push_token else (
        "softOptOut" if subscription == "optOut" else "optIn")
    return reachability, has_push_token


def public_status(registration: dict[str, Any]) -> dict[str, Any]:
    installation_id = registration["wonderpush_installation_id"]
    fingerprint = hashlib.sha256(installation_id.encode("utf-8")).hexdigest()[:10].upper()
    return {
        "registered": True,
        "registration_fingerprint": fingerprint,
        "provider_reachability": registration.get("provider_reachability", "unknown"),
        "provider_has_push_token": bool(registration.get("provider_has_push_token")),
        "provider_deliverable": bool(registration.get("provider_deliverable")),
        "provider_checked_at": registration.get("provider_checked_at"),
        "reminders_enabled": False,
    }
