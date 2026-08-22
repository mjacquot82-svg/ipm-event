#!/usr/bin/env python3
"""Insert-only, staging-only importer for the approved 2026 Parade Week schedule."""

from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime
import hashlib
import json
from pathlib import Path
import sys
from typing import Any
from urllib import error, parse, request
from zoneinfo import ZoneInfo

STAGING_PROJECT_REF = "hooiqjcbcbwzjjvnwyxf"
STAGING_EVENT_SLUG = "ipm-staging"
STAGING_EVENT_NAME = "IPM Staging"
PRODUCTION_PROJECT_REF = "hppboivlpqkfhhzfftuu"
PRODUCTION_EVENT_SLUG = "ipm-2026"
PRODUCTION_PROJECT_NAME = "JDS Event Platform"
SOURCE = "ipm_parade_week_2026_poster"
EXPECTED_TOTAL = 5
EXPECTED_PREEXISTING_TOTAL = 146
EXPECTED_FINAL_TOTAL = 151
CATEGORY = "Parade Week"
LOCATION = "Parade route coming soon"
EXPECTED_EXISTING_COUNTS = {
    "MNP Lifestyles Tent Events": 107,
    "CKNX Centennial Pavilion (GFO Stage) Lounge": 16,
    "Ontario Mutuals Main Stage - In the Britespan Building": 17,
    "The Bruce RV Park - Nightly Entertainment": 6,
}
MANIFEST_PATH = Path(__file__).parent / "import_manifests" / "ipm_parade_week_2026.json"
POSTER_PATH = Path(__file__).parents[1] / "data" / "parade.jpg"
COMPARE_FIELDS = (
    "title", "description", "starts_at", "ends_at", "timezone", "category",
    "location_name", "days_active", "source", "external_id", "status", "sort_order",
)


class ImportSafetyError(RuntimeError):
    pass


def load_manifest(path: Path = MANIFEST_PATH, poster_path: Path = POSTER_PATH) -> dict[str, Any]:
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if manifest.get("source") != SOURCE or manifest.get("timezone") != "America/Toronto":
        raise ImportSafetyError("Manifest source/timezone safety check failed")
    if not poster_path.is_file():
        raise ImportSafetyError(f"Authoritative poster is missing: {poster_path}")
    if hashlib.sha256(poster_path.read_bytes()).hexdigest() != manifest.get("source_image_sha256"):
        raise ImportSafetyError("Authoritative poster checksum differs from reviewed source")
    events = manifest.get("events", [])
    if len(events) != EXPECTED_TOTAL:
        raise ImportSafetyError("Manifest must contain exactly five events")
    if Counter(row.get("category") for row in events) != Counter({CATEGORY: EXPECTED_TOTAL}):
        raise ImportSafetyError("Every event must use the Parade Week category")
    identities = [row.get("external_id") for row in events]
    if len(set(identities)) != EXPECTED_TOTAL or None in identities:
        raise ImportSafetyError("External identities are missing or duplicated")
    for row in events:
        if row.get("location_name") != LOCATION:
            raise ImportSafetyError("Every event must use the approved temporary location")
        if row.get("end_time") is not None:
            raise ImportSafetyError("Parade Week end times must remain null")
        if not row.get("description"):
            raise ImportSafetyError("Every event must retain its approved description")
    return manifest


def parse_local(date_text: str, time_text: str, timezone_name: str) -> str:
    parsed = datetime.strptime(f"{date_text} {time_text}", "%Y-%m-%d %I:%M %p")
    return parsed.replace(tzinfo=ZoneInfo(timezone_name)).isoformat()


def desired_rows(manifest: dict[str, Any], event_id: str) -> list[dict[str, Any]]:
    timezone_name = manifest["timezone"]
    return [{
        "event_id": event_id,
        "title": item["title"],
        "description": item["description"],
        "starts_at": parse_local(item["date"], item["start_time"], timezone_name),
        "ends_at": None,
        "timezone": timezone_name,
        "category": item["category"],
        "location_name": item["location_name"],
        "days_active": item["days_active"],
        "source": SOURCE,
        "external_id": item["external_id"],
        "status": "published",
        "sort_order": 1100 + index,
    } for index, item in enumerate(manifest["events"])]


def normalize_timestamp(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).isoformat()
    except ValueError:
        return value


def rows_equal(existing: dict[str, Any], desired: dict[str, Any]) -> bool:
    for field in COMPARE_FIELDS:
        left, right = existing.get(field), desired.get(field)
        if field in ("starts_at", "ends_at") and left is not None and right is not None:
            if datetime.fromisoformat(normalize_timestamp(left)).timestamp() != datetime.fromisoformat(normalize_timestamp(right)).timestamp():
                return False
        elif left != right:
            return False
    return True


def classify(existing: list[dict[str, Any]], wanted: list[dict[str, Any]]) -> dict[str, list[Any]]:
    by_identity: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for row in existing:
        if row.get("external_id"):
            by_identity.setdefault((row.get("source"), row["external_id"]), []).append(row)
    result: dict[str, list[Any]] = {"INSERT": [], "UPDATE": [], "UNCHANGED": [], "CONFLICT": []}
    for wanted_row in wanted:
        matches = by_identity.get((SOURCE, wanted_row["external_id"]), [])
        collisions = [row for row in existing if row.get("external_id") == wanted_row["external_id"] and row.get("source") != SOURCE]
        if collisions or len(matches) > 1:
            result["CONFLICT"].append({"desired": wanted_row, "matches": matches, "collisions": collisions})
        elif not matches:
            result["INSERT"].append(wanted_row)
        elif rows_equal(matches[0], wanted_row):
            result["UNCHANGED"].append(matches[0])
        else:
            result["UPDATE"].append({"existing": matches[0], "desired": wanted_row})
    return result


def fingerprint(rows: list[dict[str, Any]]) -> str:
    canonical = json.dumps(sorted(rows, key=lambda row: str(row.get("id"))), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def verify_existing_approved(rows: list[dict[str, Any]]) -> None:
    if len(rows) != EXPECTED_PREEXISTING_TOTAL:
        raise ImportSafetyError(f"Expected 146 approved records; found {len(rows)}")
    counts = Counter(row.get("category") for row in rows)
    if dict(counts) != EXPECTED_EXISTING_COUNTS:
        raise ImportSafetyError(f"Existing category counts differ: {dict(counts)}")
    if any(row.get("source") == SOURCE for row in rows):
        raise ImportSafetyError("Parade Week source unexpectedly exists before first import")


class SupabaseRest:
    def __init__(self, project_ref: str, key: str):
        self.project_url = f"https://{project_ref}.supabase.co"
        self.key = key

    def call(self, method: str, path: str, *, params: dict[str, str] | None = None, body: Any = None) -> Any:
        url = f"{self.project_url}/rest/v1{path}"
        if params:
            url += "?" + parse.urlencode(params, safe=".*,()")
        data = None if body is None else json.dumps(body).encode()
        req = request.Request(url, data=data, method=method, headers={
            "apikey": self.key, "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json", "Prefer": "return=representation",
        })
        try:
            with request.urlopen(req, timeout=30) as response:
                payload = response.read()
        except error.HTTPError as exc:
            detail = exc.read().decode(errors="replace")
            raise ImportSafetyError(f"Supabase request failed ({exc.code}): {detail[:300]}") from exc
        return json.loads(payload) if payload else None


def service_key_from_stdin() -> str:
    document = json.load(sys.stdin)
    keys = document.get("api_keys", document) if isinstance(document, dict) else document
    for item in keys:
        if item.get("name") in {"service_role", "secret"} or item.get("type") in {"service_role", "secret"}:
            value = item.get("api_key") or item.get("key")
            if value:
                return value
    raise ImportSafetyError("No service-role API key was provided")


def target_guard(target: str, project_ref: str, event_slug: str) -> str:
    approved = {
        "staging": (STAGING_PROJECT_REF, STAGING_EVENT_SLUG, STAGING_EVENT_NAME),
        "production": (PRODUCTION_PROJECT_REF, PRODUCTION_EVENT_SLUG, PRODUCTION_PROJECT_NAME),
    }
    if target not in approved:
        raise ImportSafetyError("Target must be explicitly staging or production")
    expected_project, expected_event, target_name = approved[target]
    if (project_ref, event_slug) != (expected_project, expected_event):
        raise ImportSafetyError(f"{target.title()} target does not match its approved project/event pair")
    other_target = "production" if target == "staging" else "staging"
    other_project, other_event, _ = approved[other_target]
    if project_ref == other_project or event_slug == other_event:
        raise ImportSafetyError(f"{target.title()} mode explicitly refuses {other_target}")
    return target_name


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--target", choices=("staging", "production"), required=True)
    parser.add_argument("--api-keys-json-stdin", action="store_true")
    parser.add_argument("--backup", type=Path, required=True)
    parser.add_argument("--project-ref", required=True)
    parser.add_argument("--event-slug", required=True)
    args = parser.parse_args()
    target_name = target_guard(args.target, args.project_ref, args.event_slug)
    if not args.api_keys_json_stdin:
        raise ImportSafetyError("Use --api-keys-json-stdin; credentials must not be command-line arguments")
    manifest = load_manifest()
    client = SupabaseRest(args.project_ref, service_key_from_stdin())
    events = client.call("GET", "/events", params={"select": "id,slug,name,timezone", "slug": f"eq.{args.event_slug}"})
    if len(events) != 1 or events[0].get("slug") != args.event_slug:
        raise ImportSafetyError(f"Target is not exactly the approved {args.target} event")
    if events[0].get("timezone") != "America/Toronto":
        raise ImportSafetyError(f"{args.target.title()} event timezone is not America/Toronto")
    event_id = events[0]["id"]
    existing = client.call("GET", "/schedule_items", params={"select": "*", "event_id": f"eq.{event_id}"})
    args.backup.write_text(json.dumps(existing, indent=2), encoding="utf-8")
    wanted = desired_rows(manifest, event_id)
    result = classify(existing, wanted)
    summary = {key.lower(): len(value) for key, value in result.items()}
    print(json.dumps({"mode": "apply" if args.apply else "dry-run", "target": args.target,
                      "project_ref": args.project_ref, "project": target_name, "event_slug": args.event_slug,
                      "backup": str(args.backup), "existing_count": len(existing),
                      "existing_fingerprint": fingerprint(existing), **summary}, indent=2))
    if result["CONFLICT"] or result["UPDATE"]:
        raise ImportSafetyError("Conflicts or updates detected; insert-only importer refuses to write")
    if not args.apply:
        if not result["UNCHANGED"]:
            verify_existing_approved(existing)
        return 0
    verify_existing_approved(existing)
    if len(result["INSERT"]) != EXPECTED_TOTAL or result["UNCHANGED"]:
        raise ImportSafetyError("Apply requires exactly 5 inserts and 0 unchanged")
    before_fingerprint = fingerprint(existing)
    client.call("POST", "/schedule_items", body=result["INSERT"])
    verified = client.call("GET", "/schedule_items", params={"select": "*", "event_id": f"eq.{event_id}"})
    if len(verified) != EXPECTED_FINAL_TOTAL:
        raise ImportSafetyError(f"Expected 151 records after import; found {len(verified)}")
    final = classify(verified, wanted)
    if len(final["UNCHANGED"]) != EXPECTED_TOTAL or any(final[key] for key in ("INSERT", "UPDATE", "CONFLICT")):
        raise ImportSafetyError("Post-import Parade Week verification failed")
    non_parade = [row for row in verified if row.get("source") != SOURCE]
    if len(non_parade) != EXPECTED_PREEXISTING_TOTAL or fingerprint(non_parade) != before_fingerprint:
        raise ImportSafetyError("Existing 146 approved records changed during import")
    counts = Counter(row.get("category") for row in verified)
    expected_counts = {**EXPECTED_EXISTING_COUNTS, CATEGORY: EXPECTED_TOTAL}
    if dict(counts) != expected_counts:
        raise ImportSafetyError(f"Final category counts differ: {dict(counts)}")
    print(json.dumps({"inserted": EXPECTED_TOTAL, "verified_parade": EXPECTED_TOTAL,
                      "verified_existing_unchanged": EXPECTED_PREEXISTING_TOTAL,
                      "final_total": EXPECTED_FINAL_TOTAL, "status": "ok"}, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ImportSafetyError as exc:
        print(f"IMPORT STOPPED: {exc}", file=sys.stderr)
        raise SystemExit(2)
