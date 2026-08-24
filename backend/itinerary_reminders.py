"""Staging-gated, device-scoped itinerary reminder targeting foundation."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import asyncio
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
    return start > current and starred < start - timedelta(minutes=30)


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
        event_id = await self._event_id()
        rows = await self.client.request("POST", "/rpc/claim_due_itinerary_reminders", json={
            "p_now": now.astimezone(timezone.utc).isoformat(), "p_event_id": event_id, "p_limit": 250,
        })
        return rows or []

    async def due_registrations(self, now: datetime, *, synthetic: bool = False,
        limit: int = 1000) -> list[dict[str, Any]]:
        name = "list_due_synthetic_itinerary_reminder_registrations" if synthetic else "list_due_itinerary_reminder_registrations"
        event_id = await self._event_id()
        return await self.client.request("POST", f"/rpc/{name}", json={
            "p_now": now.astimezone(timezone.utc).isoformat(), "p_event_id": event_id, "p_limit": limit,
        }) or []

    async def claim_due_batch(self, now: datetime, *, synthetic: bool = False,
        limit: int = 250) -> list[dict[str, Any]]:
        name = "claim_due_synthetic_itinerary_reminders" if synthetic else "claim_due_itinerary_reminders"
        event_id = await self._event_id()
        return await self.client.request("POST", f"/rpc/{name}", json={
            "p_now": now.astimezone(timezone.utc).isoformat(), "p_event_id": event_id, "p_limit": limit,
        }) or []

    async def finish_delivery(self, delivery_id: str, *, status: str, synthetic: bool = False,
        provider_delivery_id: str | None = None, error_message: str | None = None,
        retry_at: datetime | None = None) -> None:
        table = "/itinerary_reminder_synthetic_deliveries" if synthetic else "/itinerary_reminder_deliveries"
        now = datetime.now(timezone.utc).isoformat()
        body: dict[str, Any] = {"status": status, "updated_at": now,
            "provider_delivery_id": provider_delivery_id,
            "error_message": error_message[:1000] if error_message else None}
        if status == "provider_accepted": body["provider_accepted_at"] = now
        if status == "provider_failed": body.update({"failed_at": now,
            "next_attempt_at": retry_at.astimezone(timezone.utc).isoformat() if retry_at else None})
        await self.client.request("PATCH", table, params={"id": f"eq.{delivery_id}"},
            json=body, headers={"Prefer": "return=minimal"})

    async def close_stale_claims(self, now: datetime, *, synthetic: bool = False) -> None:
        table = "/itinerary_reminder_synthetic_deliveries" if synthetic else "/itinerary_reminder_deliveries"
        cutoff = (now - timedelta(minutes=2)).astimezone(timezone.utc).isoformat()
        await self.client.request("PATCH", table, params={"status": "eq.claimed", "claimed_at": f"lt.{cutoff}"},
            json={"status": "delivery_unknown", "updated_at": now.astimezone(timezone.utc).isoformat(),
                "error_message": "Worker claim expired before a provider outcome was recorded"},
            headers={"Prefer": "return=minimal"})

    async def prepare_synthetic_fixture(self, registration_id: str, *, starts_at: datetime,
        starred_at: datetime, starred: bool = True) -> dict[str, Any]:
        event_id = await self._event_id()
        rows = await self.client.request("POST", "/itinerary_reminder_synthetic_events", json={
            "event_id": event_id, "fixture_key": "device_isolation_t30", "title": "IPM Reminder Demo Event",
            "location_name": None, "starts_at": starts_at.astimezone(timezone.utc).isoformat(), "status": "published",
        }, params={"on_conflict": "event_id,fixture_key"},
            headers={"Prefer": "resolution=merge-duplicates,return=representation"})
        fixture = rows[0]
        await self.client.request("DELETE", "/itinerary_reminder_synthetic_stars", params={
            "synthetic_event_id": f"eq.{fixture['id']}", "registration_id": f"eq.{registration_id}"})
        if starred:
            await self.client.request("POST", "/itinerary_reminder_synthetic_stars", json={
                "registration_id": registration_id, "synthetic_event_id": fixture["id"],
                "starred_at": starred_at.astimezone(timezone.utc).isoformat(),
            }, headers={"Prefer": "return=minimal"})
        return fixture

    async def operational_metrics(self, now: datetime) -> dict[str, int]:
        event_id = await self._event_id()
        rows = await self.client.request("POST", "/rpc/itinerary_reminder_operational_metrics", json={
            "p_now": now.astimezone(timezone.utc).isoformat(), "p_event_id": event_id})
        return {key: int(value or 0) for key, value in (rows[0] if rows else {}).items()}


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


class ItineraryReminderEngine:
    """Shared real/synthetic T-30 execution path; each provider call targets one installation."""

    def __init__(self, repository: SupabaseItineraryReminderRepository, provider: Any, *,
        delivery_enabled: bool = False, batch_size: int = 250, concurrency: int = 20,
        target_url: str = ""):
        self.repository, self.provider = repository, provider
        self.delivery_enabled = delivery_enabled
        self.batch_size = max(1, min(batch_size, 1000))
        self.concurrency = max(1, min(concurrency, 100))
        self.target_url = target_url

    async def run(self, *, now: datetime, synthetic: bool = False) -> dict[str, Any]:
        await self.repository.close_stale_claims(now, synthetic=synthetic)
        candidates = await self.repository.due_registrations(now, synthetic=synthetic,
            limit=self.batch_size * 4)
        semaphore = asyncio.Semaphore(self.concurrency)
        unreachable = 0

        async def refresh(candidate: dict[str, Any]) -> None:
            nonlocal unreachable
            async with semaphore:
                try:
                    installation = await self.provider.get_installation(candidate["wonderpush_installation_id"])
                    reachability, has_token = provider_readiness(installation)
                except Exception:
                    reachability, has_token = "unknown", False
                await self.repository.set_readiness(candidate["registration_id"], reachability=reachability,
                    has_push_token=has_token, checked_at=now)
                if reachability != "optIn" or not has_token: unreachable += 1

        await asyncio.gather(*(refresh(candidate) for candidate in candidates))
        result = {"synthetic": synthetic, "kill_switch_enabled": not self.delivery_enabled,
            "candidate_registrations": len(candidates), "suppressed_installation_unreachable": unreachable,
            "claimed": 0, "provider_accepted": 0, "provider_failed": 0, "delivery_unknown": 0}
        if not self.delivery_enabled:
            return result
        claims = await self.repository.claim_due_batch(now, synthetic=synthetic, limit=self.batch_size)
        result["claimed"] = len(claims)
        targeter = InstallationTargetedWonderPush(self.repository, self.provider)

        async def deliver(claim: dict[str, Any]) -> None:
            async with semaphore:
                location = (claim.get("location_name") or "").strip()
                message = f"{claim['title']} starts in 30 minutes"
                if location: message += f" at {location}"
                message += "."
                try:
                    provider_id = await targeter.send(installation_id=claim["wonderpush_installation_id"],
                        title="IPM — Starting Soon", message=message, target_url=self.target_url)
                except Exception as exc:
                    # A timeout/network loss may have reached the provider; never retry that ambiguity.
                    text = str(exc)
                    rejected = "rejected" in text.lower()
                    status = "provider_failed" if rejected else "delivery_unknown"
                    retry_at = now + timedelta(minutes=1) if rejected else None
                    await self.repository.finish_delivery(claim["delivery_id"], status=status,
                        synthetic=synthetic, error_message=text, retry_at=retry_at)
                    result[status] += 1
                    return
                await self.repository.finish_delivery(claim["delivery_id"], status="provider_accepted",
                    synthetic=synthetic, provider_delivery_id=provider_id)
                result["provider_accepted"] += 1

        await asyncio.gather(*(deliver(claim) for claim in claims))
        return result
