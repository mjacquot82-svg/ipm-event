#!/usr/bin/env python3
"""One guarded production T-30 cycle; invoked only by the standalone Render cron.

No server import, scheduler loop, broadcast path, or environment-file loading.
Do not execute with live credentials during tests or deployment preparation.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
import logging
import os
import sys

if __package__:
    from .itinerary_reminders import ItineraryReminderEngine, SupabaseItineraryReminderRepository
    from .platform_services import SupabaseContentClient, WonderPushClient
else:
    from itinerary_reminders import ItineraryReminderEngine, SupabaseItineraryReminderRepository
    from platform_services import SupabaseContentClient, WonderPushClient


EVENT = "ipm-2026"
SUPABASE_URL = "https://hppboivlpqkfhhzfftuu.supabase.co"
APP_URL = "https://theipm.ca"
COUNT_FIELDS = (
    "candidate_registrations", "suppressed_installation_unreachable", "claimed",
    "provider_accepted", "provider_failed", "delivery_unknown", "provider_429",
    "provider_5xx", "provider_requests", "exact_target_batches", "send_rate_limit",
    "concurrency", "recovery_released_pre_submit", "recovery_marked_ambiguous",
    "open_operational_alerts",
)


class ProductionGuardError(ValueError):
    """Configuration is absent or does not name the approved production target."""


def require_production_environment() -> tuple[str, str]:
    expected = {
        "ITINERARY_T30_LIVE": "true",
        "DEFAULT_EVENT_ID": EVENT,
        "SUPABASE_URL": SUPABASE_URL,
        "PUBLIC_APP_URL": APP_URL,
    }
    if any(os.environ.get(name, "").strip() != value for name, value in expected.items()):
        raise ProductionGuardError()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    token = os.environ.get("WONDERPUSH_ACCESS_TOKEN", "").strip()
    if not key or not token:
        raise ProductionGuardError()
    return key, token


async def run_once() -> dict:
    # The disabled engine still performs readiness/cleanup writes. Refuse before
    # constructing any clients or invoking it unless every guard passes.
    key, token = require_production_environment()
    client = SupabaseContentClient(supabase_url=SUPABASE_URL, service_role_key=key)
    repository = SupabaseItineraryReminderRepository(client, EVENT)
    provider = WonderPushClient(access_token=token)
    engine = ItineraryReminderEngine(
        repository, provider, delivery_enabled=True, target_url=APP_URL + "/itinerary",
    )
    return await engine.run(now=datetime.now(timezone.utc))


def safe_summary(result: dict) -> dict:
    # Never serialize the entire engine/provider result, identifiers or errors.
    summary = {key: result[key] for key in COUNT_FIELDS
               if type(result.get(key)) is int and result[key] >= 0}
    state = result.get("circuit_breaker")
    summary["circuit_breaker"] = state if isinstance(state, str) and state in {
        "closed", "open", "half_open", "unknown",
    } else "unknown"
    summary["status"] = "partial_failure" if (
        summary.get("provider_failed", 0) or summary.get("delivery_unknown", 0)
    ) else "complete"
    return summary


def main(arguments: list[str] | None = None) -> int:
    # Reject misleading --dry-run/target overrides instead of ignoring them.
    if arguments:
        print(json.dumps({"status": "blocked", "reason": "arguments_not_supported"}), file=sys.stderr)
        return 2
    # HTTPX readiness URLs contain both installation IDs and an access token.
    # This standalone process emits only the allowlisted aggregate below.
    previous_logging_level = logging.root.manager.disable
    logging.disable(logging.CRITICAL)
    try:
        result = safe_summary(asyncio.run(run_once()))
        print(json.dumps(result, sort_keys=True))
        return 1 if result["status"] == "partial_failure" else 0
    except ProductionGuardError:
        print(json.dumps({"status": "blocked", "reason": "production_guard_failed"}), file=sys.stderr)
        return 2
    except Exception:
        # Exception text / traceback may carry Supabase bodies or provider IDs.
        print(json.dumps({"status": "failed", "reason": "engine_cycle_failed"}), file=sys.stderr)
        return 1
    finally:
        logging.disable(previous_logging_level)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
