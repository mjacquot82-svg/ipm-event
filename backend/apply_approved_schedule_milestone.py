#!/usr/bin/env python3
"""Dry-run-first, field-limited production Schedule milestone updater."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any

try:
    from backend.import_mnp_lifestyles_schedule import SOURCE, SupabaseRest, service_key_from_stdin
except ModuleNotFoundError:  # Direct execution from the backend directory.
    from import_mnp_lifestyles_schedule import SOURCE, SupabaseRest, service_key_from_stdin

PROJECT_REF = "hppboivlpqkfhhzfftuu"
EVENT_SLUG = "ipm-2026"
MANIFEST_PATH = Path(__file__).parent / "import_manifests" / "mnp_lifestyles_2026.json"
FOODLAND_OLD = "Foodland - Stage"
FOODLAND_NEW = "Foodland - Main Stage"
EXPECTED_FOODLAND_COUNT = 52
APPROVED_BLURB_IDS = {
    "2026-09-22-harleys-c7",
    "2026-09-22-quality-homes-d7",
    "2026-09-23-foodland-e30",
    "2026-09-23-harleys-f10",
    "2026-09-23-harleys-f16",
    "2026-09-23-quality-homes-g22",
    "2026-09-24-foodland-h9",
    "2026-09-24-harleys-i24",
    "2026-09-24-quality-homes-j7",
    "2026-09-25-foodland-k16",
    "2026-09-25-quality-homes-m23",
}
PROTECTED_FIELDS = (
    "id", "event_id", "title", "starts_at", "ends_at", "timezone", "category",
    "days_active", "source", "external_id", "status", "sort_order",
)


class MilestoneSafetyError(RuntimeError):
    pass


def desired_updates() -> tuple[set[str], dict[str, str]]:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    rows = manifest.get("events", [])
    foodland_ids = {
        row["external_id"] for row in rows if row.get("location_name") == FOODLAND_NEW
    }
    if len(foodland_ids) != EXPECTED_FOODLAND_COUNT:
        raise MilestoneSafetyError("Authoritative Foodland target count is not 52")
    by_id = {row.get("external_id"): row for row in rows}
    blurbs = {}
    for external_id in APPROVED_BLURB_IDS:
        row = by_id.get(external_id)
        if not row or not row.get("description"):
            raise MilestoneSafetyError(f"Approved blurb is missing for {external_id}")
        blurbs[external_id] = row["description"]
    return foodland_ids, blurbs


def build_patch(row: dict[str, Any], foodland_ids: set[str], blurbs: dict[str, str]) -> dict[str, str]:
    external_id = row.get("external_id")
    patch: dict[str, str] = {}
    if external_id in foodland_ids:
        current = row.get("location_name")
        if current == FOODLAND_OLD:
            patch["location_name"] = FOODLAND_NEW
        elif current != FOODLAND_NEW:
            raise MilestoneSafetyError(f"Unexpected Foodland location for {external_id}")
    if external_id in blurbs:
        desired = blurbs[external_id]
        current = row.get("description")
        if current == desired:
            pass
        elif current in (None, ""):
            patch["description"] = desired
        else:
            raise MilestoneSafetyError(f"Refusing to overwrite an existing description for {external_id}")
    return patch


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--api-keys-json-stdin", action="store_true")
    args = parser.parse_args()
    if not args.api_keys_json_stdin:
        raise MilestoneSafetyError("Use --api-keys-json-stdin")
    client = SupabaseRest(PROJECT_REF, service_key_from_stdin())
    events = client.call("GET", "/events", params={
        "select": "id,slug,name,timezone", "slug": f"eq.{EVENT_SLUG}",
    })
    if len(events) != 1 or events[0].get("slug") != EVENT_SLUG or events[0].get("timezone") != "America/Toronto":
        raise MilestoneSafetyError("Production event identity check failed")
    event_id = events[0]["id"]
    rows = client.call("GET", "/schedule_items", params={"select": "*", "event_id": f"eq.{event_id}"})
    foodland_ids, blurbs = desired_updates()
    by_id: dict[str, dict[str, Any]] = {}
    duplicate_ids = set()
    for row in rows:
        external_id = row.get("external_id")
        if not external_id:
            continue
        if external_id in by_id:
            duplicate_ids.add(external_id)
        by_id[external_id] = row
    if duplicate_ids:
        raise MilestoneSafetyError(f"Duplicate stable event identities: {', '.join(sorted(duplicate_ids))}")
    targets = foodland_ids | set(blurbs)
    missing = sorted(external_id for external_id in targets if external_id not in by_id)
    if missing:
        raise MilestoneSafetyError(f"Stable production event identities are missing: {', '.join(missing)}")
    changes = []
    protected = {}
    for external_id in sorted(targets):
        row = by_id[external_id]
        patch = build_patch(row, foodland_ids, blurbs)
        protected[external_id] = {field: row.get(field) for field in PROTECTED_FIELDS}
        if patch:
            changes.append({"id": row["id"], "external_id": external_id, "patch": patch})
    summary = {
        "mode": "apply" if args.apply else "dry-run",
        "project_ref": PROJECT_REF,
        "event_slug": EVENT_SLUG,
        "foodland_targets": len(foodland_ids),
        "blurb_targets": len(blurbs),
        "rows_requiring_patch": len(changes),
        "location_field_updates": sum("location_name" in change["patch"] for change in changes),
        "description_field_updates": sum("description" in change["patch"] for change in changes),
        "external_ids": [change["external_id"] for change in changes],
    }
    print(json.dumps(summary, indent=2))
    if not args.apply:
        return 0
    for change in changes:
        client.call("PATCH", "/schedule_items", params={
            "id": f"eq.{change['id']}", "event_id": f"eq.{event_id}",
        }, body=change["patch"])
    verified = client.call("GET", "/schedule_items", params={"select": "*", "event_id": f"eq.{event_id}"})
    verified_by_id = {row.get("external_id"): row for row in verified if row.get("external_id")}
    for external_id in targets:
        row = verified_by_id.get(external_id)
        if not row or build_patch(row, foodland_ids, blurbs):
            raise MilestoneSafetyError(f"Post-write value verification failed for {external_id}")
        if {field: row.get(field) for field in PROTECTED_FIELDS} != protected[external_id]:
            raise MilestoneSafetyError(f"Protected field changed for {external_id}")
    print(json.dumps({"verified": len(targets), "status": "ok"}, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except MilestoneSafetyError as exc:
        print(f"UPDATE STOPPED: {exc}", file=sys.stderr)
        raise SystemExit(2)
