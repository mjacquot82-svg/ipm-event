#!/usr/bin/env python3
"""Staging-only Show Guide schedule patch applier (dry-run by default).

Hard-refuses production project hppboivlpqkfhhzfftuu / ipm-2026.
Requires --api-keys-json-stdin with staging service_role key to --apply.

Frontend staging builds also apply the same logical patch client-side so
staging.theipm.ca can show Lumberjack/Southampton/Lavender fixes without a
DB write. This script is for later syncing staging Supabase when credentials
are available.
"""

from __future__ import annotations

import argparse
from datetime import datetime
import json
from pathlib import Path
import sys
from typing import Any
from zoneinfo import ZoneInfo

try:
    from backend.import_mnp_lifestyles_schedule import SupabaseRest, service_key_from_stdin, ImportSafetyError
except ModuleNotFoundError:
    from import_mnp_lifestyles_schedule import SupabaseRest, service_key_from_stdin, ImportSafetyError

STAGING_PROJECT_REF = "hooiqjcbcbwzjjvnwyxf"
STAGING_EVENT_SLUG = "ipm-staging"
PRODUCTION_PROJECT_REF = "hppboivlpqkfhhzfftuu"
PRODUCTION_EVENT_SLUG = "ipm-2026"
PATCH_PATH = Path(__file__).parent / "import_manifests" / "show_guide_schedule_patch_20260911.json"
TZ = "America/Toronto"
SOURCE = "show_guide_schedule_patch_20260911"
LUMBERJACK_TITLE = "Great Canadian Lumberjack Show"
LUMBERJACK_LOCATION = "1A-35-38"
LAVENDER_TITLE = "Essentially Lavender"


def parse_local(date_text: str, time_text: str) -> str:
    parsed = datetime.strptime(f"{date_text} {time_text}", "%Y-%m-%d %I:%M %p")
    return parsed.replace(tzinfo=ZoneInfo(TZ)).isoformat()


def same_instant(stored: Any, desired_iso: str) -> bool:
    """Compare timestamptz values across UTC vs local ISO forms."""
    if not stored:
        return False
    if stored == desired_iso:
        return True
    try:
        a = datetime.fromisoformat(str(stored).replace("Z", "+00:00"))
        b = datetime.fromisoformat(desired_iso)
        if a.tzinfo is None:
            a = a.replace(tzinfo=ZoneInfo(TZ))
        if b.tzinfo is None:
            b = b.replace(tzinfo=ZoneInfo(TZ))
        return a.astimezone(ZoneInfo("UTC")) == b.astimezone(ZoneInfo("UTC"))
    except Exception:
        return False


def load_patch() -> dict[str, Any]:
    patch = json.loads(PATCH_PATH.read_text(encoding="utf-8"))
    if not patch.get("staging_only"):
        raise ImportSafetyError("Patch is not marked staging_only")
    return patch


def classify(rows: list[dict[str, Any]], patch: dict[str, Any]) -> dict[str, Any]:
    lumberjack = [r for r in rows if r.get("title") == LUMBERJACK_TITLE]
    lavender = [
        r
        for r in rows
        if r.get("title") == LAVENDER_TITLE
        and r.get("location_name") == "The Beyond Wireless Stage"
        and str(r.get("starts_at", "")).startswith("2026-09-24")
    ]
    southampton = [
        r
        for r in rows
        if "southampton" in str(r.get("title", "")).lower()
    ]

    updates: list[dict[str, Any]] = []
    for row in lumberjack:
        if row.get("location_name") != LUMBERJACK_LOCATION:
            updates.append({
                "id": row["id"],
                "patch": {"location_name": LUMBERJACK_LOCATION},
                "why": "lumberjack_location",
            })

    desired_start = parse_local("2026-09-24", "3:15 PM")
    desired_end = parse_local("2026-09-24", "3:30 PM")
    for row in lavender:
        body: dict[str, Any] = {}
        if not same_instant(row.get("starts_at"), desired_start):
            body["starts_at"] = desired_start
        if not same_instant(row.get("ends_at"), desired_end):
            body["ends_at"] = desired_end
        if body:
            updates.append({"id": row["id"], "patch": body, "why": "essentially_lavender"})

    inserts: list[dict[str, Any]] = []
    if not southampton:
        add = patch["decisions"]["southampton_olive_oil"]["event"]
        inserts.append({
            "title": add["title"],
            "description": add.get("description") or None,
            "starts_at": parse_local(add["start_date"], add["start_time"]),
            "ends_at": parse_local(add["start_date"], add["end_time"]),
            "timezone": TZ,
            "category": add["category"],
            "location_name": add["location_name"],
            "days_active": add["days_active"],
            "source": SOURCE,
            "external_id": "2026-09-24-show-guide-southampton-olive-oil",
            "status": "published",
        })

    return {
        "lumberjack_count": len(lumberjack),
        "lavender_count": len(lavender),
        "southampton_existing": len(southampton),
        "updates": updates,
        "inserts": inserts,
        "total_existing": len(rows),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--api-keys-json-stdin", action="store_true")
    parser.add_argument("--project-ref", default=STAGING_PROJECT_REF)
    parser.add_argument("--event-slug", default=STAGING_EVENT_SLUG)
    args = parser.parse_args()

    if args.project_ref == PRODUCTION_PROJECT_REF or args.event_slug == PRODUCTION_EVENT_SLUG:
        raise ImportSafetyError("Refusing production project/event — staging only")
    if args.project_ref != STAGING_PROJECT_REF or args.event_slug != STAGING_EVENT_SLUG:
        raise ImportSafetyError("Only hooiqjcbcbwzjjvnwyxf / ipm-staging is approved")
    if not args.api_keys_json_stdin:
        raise ImportSafetyError("Use --api-keys-json-stdin")

    patch = load_patch()
    client = SupabaseRest(args.project_ref, service_key_from_stdin())
    events = client.call(
        "GET",
        "/events",
        params={"select": "id,slug,name,timezone", "slug": f"eq.{args.event_slug}"},
    )
    if len(events) != 1 or events[0].get("slug") != STAGING_EVENT_SLUG:
        raise ImportSafetyError("Staging event identity check failed")
    if events[0].get("timezone") != TZ:
        raise ImportSafetyError("Staging event timezone is not America/Toronto")
    event_id = events[0]["id"]
    rows = client.call("GET", "/schedule_items", params={"select": "*", "event_id": f"eq.{event_id}"})
    plan = classify(rows, patch)
    print(json.dumps({
        "mode": "apply" if args.apply else "dry-run",
        "project_ref": args.project_ref,
        "event_slug": args.event_slug,
        "lumberjack_count": plan["lumberjack_count"],
        "lavender_count": plan["lavender_count"],
        "southampton_existing": plan["southampton_existing"],
        "update_count": len(plan["updates"]),
        "insert_count": len(plan["inserts"]),
        "total_existing": plan["total_existing"],
        "updates": plan["updates"],
        "inserts": plan["inserts"],
    }, indent=2))

    if plan["lumberjack_count"] != 15:
        raise ImportSafetyError(f"Expected 15 Lumberjack rows, found {plan['lumberjack_count']}")
    if plan["lavender_count"] != 1:
        raise ImportSafetyError(f"Expected 1 Beyond Wireless Lavender row, found {plan['lavender_count']}")

    if not args.apply:
        return 0

    for update in plan["updates"]:
        client.call(
            "PATCH",
            "/schedule_items",
            params={"id": f"eq.{update['id']}", "event_id": f"eq.{event_id}"},
            body=update["patch"],
        )
    for row in plan["inserts"]:
        body = {**row, "event_id": event_id}
        client.call("POST", "/schedule_items", body=body)

    verified = client.call("GET", "/schedule_items", params={"select": "*", "event_id": f"eq.{event_id}"})
    vplan = classify(verified, patch)
    if vplan["lumberjack_count"] != 15:
        raise ImportSafetyError("Post-write lumberjack count failed")
    if any(u["why"] == "lumberjack_location" for u in vplan["updates"]):
        raise ImportSafetyError("Post-write lumberjack location still needs update")
    if any(u["why"] == "essentially_lavender" for u in vplan["updates"]):
        raise ImportSafetyError("Post-write lavender times still need update")
    if vplan["southampton_existing"] < 1:
        raise ImportSafetyError("Post-write Southampton missing")
    if len(verified) < plan["total_existing"]:
        raise ImportSafetyError("Post-write deleted rows — abort condition")
    print(json.dumps({"verified": True, "total": len(verified)}, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ImportSafetyError as exc:
        print(f"APPLY STOPPED: {exc}", file=sys.stderr)
        raise SystemExit(2)
