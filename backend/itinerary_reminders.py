"""Staging-gated, device-scoped itinerary reminder targeting foundation."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import asyncio
import hashlib
import hmac
from typing import Any
from zoneinfo import ZoneInfo

import httpx
try:
    from backend.reminder_scale import ProviderCircuitBreaker, SlidingWindowRateLimiter, classify_provider_failure
except ModuleNotFoundError:
    from reminder_scale import ProviderCircuitBreaker, SlidingWindowRateLimiter, classify_provider_failure


REMINDER_TYPE = "itinerary_t30"
TORONTO = ZoneInfo("America/Toronto")


def _safe_int(value: Any) -> int | None:
    try: return int(value) if value is not None else None
    except (TypeError, ValueError): return None


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

    async def assign_batch(self, *, now: datetime, schedule_item_id: str,
        delivery_ids: list[str], idempotency_key: str) -> dict[str, Any]:
        event_id = await self._event_id()
        rows = await self.client.request("POST", "/rpc/assign_itinerary_reminder_batch", json={
            "p_now": now.astimezone(timezone.utc).isoformat(), "p_event_id": event_id,
            "p_schedule_item_id": schedule_item_id, "p_delivery_ids": delivery_ids,
            "p_idempotency_key": idempotency_key,
        })
        return rows[0]

    async def finish_batch(self, batch_id: str, delivery_ids: list[str], *, status: str,
        now: datetime, provider_result: dict[str, Any] | None = None,
        error_message: str | None = None, retry_at: datetime | None = None) -> None:
        provider_result = provider_result or {}
        rate = provider_result.get("rate_limit") or {}
        await self.client.request("POST", "/rpc/finish_itinerary_reminder_batch", json={
            "p_now": now.isoformat(), "p_batch_id": batch_id, "p_delivery_ids": delivery_ids,
            "p_status": status, "p_provider_delivery_id": provider_result.get("provider_delivery_id"),
            "p_provider_http_status": provider_result.get("status_code"),
            "p_error_message": error_message[:1000] if error_message else None,
            "p_next_attempt_at": retry_at.isoformat() if retry_at else None,
            "p_rate_limit_limit": _safe_int(rate.get("x-ratelimit-limit")),
            "p_rate_limit_remaining": _safe_int(rate.get("x-ratelimit-remaining")),
            "p_rate_limit_reset_seconds": _safe_int(rate.get("x-ratelimit-reset")),
            "p_retry_after_seconds": _safe_int(rate.get("retry-after")),
        })

    async def close_stale_claims(self, now: datetime, *, synthetic: bool = False) -> None:
        table = "/itinerary_reminder_synthetic_deliveries" if synthetic else "/itinerary_reminder_deliveries"
        cutoff = (now - timedelta(minutes=2)).astimezone(timezone.utc).isoformat()
        await self.client.request("PATCH", table, params={"status": "eq.claimed", "claimed_at": f"lt.{cutoff}"},
            json={"status": "delivery_unknown", "updated_at": now.astimezone(timezone.utc).isoformat(),
                "error_message": "Worker claim expired before a provider outcome was recorded"},
            headers={"Prefer": "return=minimal"})

    async def prepare_synthetic_fixture(self, registration_id: str, *, starts_at: datetime,
        starred_at: datetime, starred: bool = True, fixture_key: str = "device_isolation_t30",
        title: str = "IPM Reminder Demo Event") -> dict[str, Any]:
        event_id = await self._event_id()
        rows = await self.client.request("POST", "/itinerary_reminder_synthetic_events", json={
            "event_id": event_id, "fixture_key": fixture_key, "title": title,
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

    async def batch_metrics(self, now: datetime) -> dict[str, int]:
        event_id = await self._event_id()
        rows = await self.client.request("POST", "/rpc/itinerary_reminder_batch_metrics", json={
            "p_now": now.astimezone(timezone.utc).isoformat(), "p_event_id": event_id})
        return {key: int(value or 0) for key, value in (rows[0] if rows else {}).items()}

    async def synthetic_fixture_status(self, fixture_key: str) -> dict[str, Any] | None:
        event_id = await self._event_id()
        events = await self.client.request("GET", "/itinerary_reminder_synthetic_events", params={
            "select": "id,fixture_key,title,starts_at,status,created_at,updated_at",
            "event_id": f"eq.{event_id}", "fixture_key": f"eq.{fixture_key}", "limit": "1",
        })
        if not events: return None
        fixture = events[0]
        stars = await self.client.request("GET", "/itinerary_reminder_synthetic_stars", params={
            "select": "registration_id,starred_at",
            "synthetic_event_id": f"eq.{fixture['id']}",
        }) or []
        registrations = {row["id"]: row.get("test_device_label") for row in
            await self.client.request("GET", "/itinerary_reminder_installations", params={
                "select": "id,test_device_label", "event_id": f"eq.{event_id}"}) or []}
        deliveries = await self.client.request("GET", "/itinerary_reminder_synthetic_deliveries", params={
            "select": "registration_id,status,claimed_at,provider_accepted_at,provider_delivery_id,attempt_count",
            "synthetic_event_id": f"eq.{fixture['id']}",
        }) or []
        authorizations = await self.client.request("GET", "/itinerary_reminder_synthetic_authorizations", params={
            "select": "registration_id,created_at,expires_at,consumed_at,reminder_type",
            "synthetic_event_id": f"eq.{fixture['id']}",
        }) or []
        by_label = {"A": [], "B": []}
        for star in stars:
            label = registrations.get(star["registration_id"])
            if label in by_label: by_label[label].append(star["starred_at"])
        return {key: fixture[key] for key in ("fixture_key", "title", "starts_at", "status", "created_at", "updated_at")} | {
            "device_a_association_count": len(by_label["A"]),
            "device_a_associated_at": min(by_label["A"]) if by_label["A"] else None,
            "device_b_association_count": len(by_label["B"]),
            "delivery_count": len(deliveries),
            "delivery_statuses": sorted({row["status"] for row in deliveries}),
            "provider_call_recorded": any(row.get("provider_delivery_id") for row in deliveries),
            "provider_call_count": sum(int(row.get("attempt_count") or 0) for row in deliveries
                if row.get("status") != "claimed"),
            "authorization_count": len(authorizations),
            "authorization_status": ("consumed" if authorizations and authorizations[0].get("consumed_at")
                else "unused") if authorizations else "none",
            "authorization_created_at": authorizations[0].get("created_at") if authorizations else None,
            "authorization_expires_at": authorizations[0].get("expires_at") if authorizations else None,
            "authorization_consumed_at": authorizations[0].get("consumed_at") if authorizations else None,
        }

    async def synthetic_fixture_by_key(self, fixture_key: str) -> dict[str, Any] | None:
        event_id = await self._event_id()
        rows = await self.client.request("GET", "/itinerary_reminder_synthetic_events", params={
            "select": "*", "event_id": f"eq.{event_id}", "fixture_key": f"eq.{fixture_key}", "limit": "1"})
        return rows[0] if rows else None

    async def registration_by_id(self, registration_id: str) -> dict[str, Any] | None:
        event_id = await self._event_id()
        rows = await self.client.request("GET", "/itinerary_reminder_installations", params={
            "select": "*", "event_id": f"eq.{event_id}", "id": f"eq.{registration_id}", "limit": "1"})
        return rows[0] if rows else None

    async def authorize_synthetic_fixture(self, *, fixture_id: str, registration_id: str,
        authorized_by: str, now: datetime) -> dict[str, Any]:
        event_id = await self._event_id()
        rows = await self.client.request("POST", "/itinerary_reminder_synthetic_authorizations", json={
            "event_id": event_id, "synthetic_event_id": fixture_id, "registration_id": registration_id,
            "reminder_type": REMINDER_TYPE, "created_at": now.astimezone(timezone.utc).isoformat(),
            "expires_at": (now + timedelta(minutes=15)).astimezone(timezone.utc).isoformat(),
            "authorized_by": authorized_by[:200],
        }, headers={"Prefer": "return=representation"})
        return rows[0]

    async def claim_authorized_synthetic(self, *, now: datetime, fixture_id: str,
        registration_id: str) -> list[dict[str, Any]]:
        event_id = await self._event_id()
        return await self.client.request("POST", "/rpc/claim_authorized_synthetic_itinerary_reminder", json={
            "p_now": now.astimezone(timezone.utc).isoformat(), "p_event_id": event_id,
            "p_synthetic_event_id": fixture_id, "p_registration_id": registration_id,
        }) or []


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

    async def send_claim_batch(self, *, claims: list[dict[str, Any]], title: str,
        message: str, target_url: str, idempotency_key: str,
        expiration_time: str) -> dict[str, Any]:
        if not claims or len(claims) > 10000: raise ValueError("Invalid exact claim batch size")
        event_keys = {(claim["schedule_item_id"], claim["title"],
            (claim.get("location_name") or "").strip(), str(claim["starts_at"])) for claim in claims}
        targets = [claim["wonderpush_installation_id"] for claim in claims]
        if len(event_keys) != 1 or len(set(targets)) != len(targets):
            raise ValueError("Exact claim batch must contain one event payload and unique installations")
        return await self.provider.send_installations(installation_ids=targets, title=title,
            message=message, target_url=target_url, idempotency_key=idempotency_key,
            expiration_time=expiration_time)


class ItineraryReminderEngine:
    """Shared T-30 path; normal reminders batch exact claims by event payload."""

    def __init__(self, repository: SupabaseItineraryReminderRepository, provider: Any, *,
        delivery_enabled: bool = False, batch_size: int = 250, concurrency: int = 20,
        max_sends_per_second: int = 10, max_targets_per_request: int = 10000,
        target_url: str = ""):
        self.repository, self.provider = repository, provider
        self.delivery_enabled = delivery_enabled
        self.batch_size = max(1, min(batch_size, 10000))
        self.concurrency = max(1, min(concurrency, 100))
        self.rate_limiter = SlidingWindowRateLimiter(max_sends_per_second)
        self.circuit_breaker = ProviderCircuitBreaker()
        self.max_sends_per_second = max(1, max_sends_per_second)
        self.max_targets_per_request = max(1, min(max_targets_per_request, 10000))
        self.target_url = target_url

    async def _bounded(self, rows: list[dict[str, Any]], operation) -> None:
        for offset in range(0, len(rows), self.concurrency):
            await asyncio.gather(*(operation(row) for row in rows[offset:offset + self.concurrency]))

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

        await self._bounded(candidates, refresh)
        result = {"synthetic": synthetic, "kill_switch_enabled": not self.delivery_enabled,
            "candidate_registrations": len(candidates), "suppressed_installation_unreachable": unreachable,
            "claimed": 0, "provider_accepted": 0, "provider_failed": 0, "delivery_unknown": 0,
            "provider_429": 0, "provider_5xx": 0, "send_rate_limit": self.max_sends_per_second,
            "concurrency": self.concurrency, "circuit_breaker": self.circuit_breaker.state,
            "provider_requests": 0, "exact_target_batches": 0}
        if not self.delivery_enabled:
            return result
        if not self.circuit_breaker.allow():
            result["circuit_breaker"] = "open"
            return result
        claims = await self.repository.claim_due_batch(now, synthetic=synthetic, limit=self.batch_size)
        result["claimed"] = len(claims)
        targeter = InstallationTargetedWonderPush(self.repository, self.provider)

        if not synthetic and claims:
            groups: dict[tuple[str, str, str, str], list[dict[str, Any]]] = {}
            for claim in claims:
                key = (claim["schedule_item_id"], claim["title"],
                    (claim.get("location_name") or "").strip(), str(claim["starts_at"]))
                groups.setdefault(key, []).append(claim)
            batches: list[list[dict[str, Any]]] = []
            for key in sorted(groups):
                group = sorted(groups[key], key=lambda item: item["wonderpush_installation_id"])
                batches.extend(group[offset:offset + self.max_targets_per_request]
                    for offset in range(0, len(group), self.max_targets_per_request))

            async def deliver_batch(batch_claims: list[dict[str, Any]]) -> None:
                async with semaphore:
                    if not self.circuit_breaker.allow():
                        for claim in batch_claims:
                            await self.repository.finish_delivery(claim["delivery_id"], status="provider_failed",
                                error_message="Provider circuit breaker is open", retry_at=now + timedelta(minutes=1))
                        result["provider_failed"] += len(batch_claims)
                        return
                    digest = hashlib.sha256("|".join(sorted(claim["delivery_id"] for claim in batch_claims)).encode()).hexdigest()[:48]
                    idempotency_key = f"ipm-t30-{digest}"
                    audit = await self.repository.assign_batch(now=now,
                        schedule_item_id=batch_claims[0]["schedule_item_id"],
                        delivery_ids=[claim["delivery_id"] for claim in batch_claims],
                        idempotency_key=idempotency_key)
                    batch_id = audit["batch_id"]
                    await self.rate_limiter.acquire()
                    location = (batch_claims[0].get("location_name") or "").strip()
                    message = f"{batch_claims[0]['title']} starts in 30 minutes"
                    if location: message += f" at {location}"
                    message += "."
                    result["provider_requests"] += 1
                    result["exact_target_batches"] += 1
                    try:
                        provider_result = await targeter.send_claim_batch(claims=batch_claims,
                            title="IPM — Starting Soon", message=message, target_url=self.target_url,
                            idempotency_key=idempotency_key, expiration_time="10 minutes")
                    except Exception as exc:
                        status, failure_kind = classify_provider_failure(exc)
                        retry_seconds = _safe_int(getattr(exc, "headers", {}).get("retry-after"))
                        if failure_kind == "429": await self.rate_limiter.defer(retry_seconds or 60)
                        retry_at = now + timedelta(seconds=retry_seconds or 60) if status == "provider_failed" else None
                        await self.repository.finish_batch(batch_id,
                            [claim["delivery_id"] for claim in batch_claims], status=status, now=now,
                            error_message=str(exc), retry_at=retry_at)
                        result[status] += len(batch_claims)
                        if failure_kind == "429": result["provider_429"] += 1
                        if failure_kind == "5xx": result["provider_5xx"] += 1
                        self.circuit_breaker.record(False)
                        return
                    await self.repository.finish_batch(batch_id,
                        [claim["delivery_id"] for claim in batch_claims], status="provider_accepted",
                        now=now, provider_result=provider_result)
                    rate = provider_result.get("rate_limit") or {}
                    remaining = _safe_int(rate.get("x-ratelimit-remaining"))
                    reset = _safe_int(rate.get("x-ratelimit-reset"))
                    limit = _safe_int(rate.get("x-ratelimit-limit"))
                    if remaining == 0 and reset and limit:
                        await self.rate_limiter.defer(max(1, reset / limit))
                    result["provider_accepted"] += len(batch_claims)
                    self.circuit_breaker.record(True)

            await self._bounded(batches, deliver_batch)
            result["circuit_breaker"] = self.circuit_breaker.state
            return result

        async def deliver(claim: dict[str, Any]) -> None:
            async with semaphore:
                if not self.circuit_breaker.allow():
                    await self.repository.finish_delivery(claim["delivery_id"], status="provider_failed",
                        synthetic=synthetic, error_message="Provider circuit breaker is open",
                        retry_at=now + timedelta(minutes=1))
                    result["provider_failed"] += 1
                    return
                await self.rate_limiter.acquire()
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
                    status, failure_kind = classify_provider_failure(exc)
                    retry_at = now + timedelta(minutes=1) if status == "provider_failed" else None
                    await self.repository.finish_delivery(claim["delivery_id"], status=status,
                        synthetic=synthetic, error_message=text, retry_at=retry_at)
                    result[status] += 1
                    if failure_kind == "429": result["provider_429"] += 1
                    if failure_kind == "5xx": result["provider_5xx"] += 1
                    self.circuit_breaker.record(False)
                    return
                await self.repository.finish_delivery(claim["delivery_id"], status="provider_accepted",
                    synthetic=synthetic, provider_delivery_id=provider_id)
                result["provider_accepted"] += 1
                self.circuit_breaker.record(True)

        await self._bounded(claims, deliver)
        result["circuit_breaker"] = self.circuit_breaker.state
        return result

    async def run_authorized_synthetic(self, *, now: datetime, fixture_id: str,
        registration_id: str) -> dict[str, Any]:
        """One authorization can admit one synthetic claim while the global kill switch stays on."""
        result = {"synthetic": True, "fixture_scoped_authorization": True,
            "global_kill_switch_enabled": not self.delivery_enabled, "claimed": 0,
            "provider_accepted": 0, "provider_failed": 0, "delivery_unknown": 0,
            "provider_call_count": 0}
        registration = await self.repository.registration_by_id(registration_id)
        if not registration or registration.get("test_device_label") != "A": return result
        try:
            installation = await self.provider.get_installation(registration["wonderpush_installation_id"])
            reachability, has_token = provider_readiness(installation)
        except Exception:
            reachability, has_token = "unknown", False
        await self.repository.set_readiness(registration_id, reachability=reachability,
            has_push_token=has_token, checked_at=now)
        if not self.circuit_breaker.allow():
            result["circuit_breaker"] = "open"
            return result
        claims = await self.repository.claim_authorized_synthetic(now=now,
            fixture_id=fixture_id, registration_id=registration_id)
        result["claimed"] = len(claims)
        if not claims: return result
        # The atomic RPC can return at most one exact fixture/registration claim.
        claim = claims[0]
        targeter = InstallationTargetedWonderPush(self.repository, self.provider)
        location = (claim.get("location_name") or "").strip()
        message = f"{claim['title']} starts in 30 minutes"
        if location: message += f" at {location}"
        message += "."
        result["provider_call_count"] = 1
        await self.rate_limiter.acquire()
        try:
            provider_id = await targeter.send(installation_id=claim["wonderpush_installation_id"],
                title="IPM — Starting Soon", message=message, target_url=self.target_url)
        except Exception as exc:
            text = str(exc)
            status, _failure_kind = classify_provider_failure(exc)
            await self.repository.finish_delivery(claim["delivery_id"], status=status,
                synthetic=True, error_message=text, retry_at=None)
            self.circuit_breaker.record(False)
            result[status] = 1
            return result
        await self.repository.finish_delivery(claim["delivery_id"], status="provider_accepted",
            synthetic=True, provider_delivery_id=provider_id)
        result["provider_accepted"] = 1
        self.circuit_breaker.record(True)
        result["provider_delivery_id"] = provider_id
        return result
