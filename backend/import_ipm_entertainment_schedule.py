#!/usr/bin/env python3
"""Insert-only, staging-only importer for the approved 2026 entertainment schedule."""

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
SOURCE = "ipm_entertainment_2026_revised_pdf"
MNP_SOURCE = "mnp_lifestyles_2026_workbook"
EXPECTED_TOTAL = 39
EXPECTED_MNP_TOTAL = 107
CKNX = "CKNX Centennial Pavilion (GFO Stage) Lounge"
ONTARIO = "Ontario Mutuals Main Stage - In the Britespan Building"
BRUCE_RV = "The Bruce RV Park - Nightly Entertainment"
BRUCE_LOCATION = CKNX
ADMISSION_NOTE = (
    "Additional admission required. General IPM admission does not include entry "
    "to The Bruce RV Park entertainment."
)
EXPECTED_COUNTS = {CKNX: 16, ONTARIO: 17, BRUCE_RV: 6}
MANIFEST_PATH = Path(__file__).parent / "import_manifests" / "ipm_entertainment_2026.json"
PDF_PATH = Path(__file__).parents[1] / "data" / "Aug 18, 2026_REVISED (2).pdf"
COMPARE_FIELDS = (
    "title", "description", "starts_at", "ends_at", "timezone", "category",
    "location_name", "days_active", "source", "external_id", "status", "sort_order",
)


class ImportSafetyError(RuntimeError):
    pass


def load_manifest(path: Path = MANIFEST_PATH, pdf_path: Path = PDF_PATH) -> dict[str, Any]:
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if manifest.get("source") != SOURCE or manifest.get("timezone") != "America/Toronto":
        raise ImportSafetyError("Manifest source/timezone safety check failed")
    if not pdf_path.is_file():
        raise ImportSafetyError(f"Authoritative PDF is missing: {pdf_path}")
    digest = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
    if digest != manifest.get("source_pdf_sha256"):
        raise ImportSafetyError("Authoritative PDF checksum differs from reviewed source")
    events = manifest.get("events", [])
    if len(events) != EXPECTED_TOTAL:
        raise ImportSafetyError(f"Manifest must contain exactly {EXPECTED_TOTAL} events")
    counts = Counter(row.get("category") for row in events)
    if dict(counts) != EXPECTED_COUNTS:
        raise ImportSafetyError(f"Category counts are unsafe: {dict(counts)}")
    identities = [row.get("external_id") for row in events]
    if len(set(identities)) != EXPECTED_TOTAL or None in identities:
        raise ImportSafetyError("External identities are missing or duplicated")
    for row in events:
        if row.get("category") == CKNX and row.get("location_name") != CKNX:
            raise ImportSafetyError("CKNX category and location must both include Lounge")
        if row.get("category") == ONTARIO and row.get("location_name") != ONTARIO:
            raise ImportSafetyError("Ontario category/location wording differs")
        is_bruce = row.get("category") == BRUCE_RV
        if is_bruce and row.get("location_name") != BRUCE_LOCATION:
            raise ImportSafetyError("Bruce RV physical location differs")
        if is_bruce != (row.get("description") == ADMISSION_NOTE):
            raise ImportSafetyError("Admission note must appear on only all six Bruce RV events")
        if "The RV Park" in json.dumps(row):
            raise ImportSafetyError("Obsolete RV Park wording is present")
        if row.get("timezone", manifest["timezone"]) != "America/Toronto":
            raise ImportSafetyError("Every row must use America/Toronto")
    closing = next((row for row in events if row["title"] == "Closing Ceremonies"), None)
    if not closing or (closing["date"], closing["start_time"], closing["end_time"]) != (
        "2026-09-26", "4:00 PM", "5:00 PM"
    ):
        raise ImportSafetyError("Closing Ceremonies human override is missing")
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
        "ends_at": parse_local(item["date"], item["end_time"], timezone_name),
        "timezone": timezone_name,
        "category": item["category"],
        "location_name": item["location_name"],
        "days_active": item["days_active"],
        "source": SOURCE,
        "external_id": item["external_id"],
        "status": "published",
        "sort_order": 1000 + index,
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
        if field in ("starts_at", "ends_at"):
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
            raise ImportSafetyError(f"Staging Supabase request failed ({exc.code}): {detail[:300]}") from exc
        return json.loads(payload) if payload else None


def service_key_from_stdin() -> str:
    document = json.load(sys.stdin)
    keys = document.get("api_keys", document) if isinstance(document, dict) else document
    for item in keys:
        if item.get("name") in {"service_role", "secret"} or item.get("type") in {"service_role", "secret"}:
            value = item.get("api_key") or item.get("key")
            if value:
                return value
    raise ImportSafetyError("No staging service-role API key was provided")


def target_guard(project_ref: str, event_slug: str) -> None:
    if project_ref == PRODUCTION_PROJECT_REF or event_slug == PRODUCTION_EVENT_SLUG:
        raise ImportSafetyError("Production/ipm-2026 is explicitly forbidden")
    if (project_ref, event_slug) != (STAGING_PROJECT_REF, STAGING_EVENT_SLUG):
        raise ImportSafetyError("Only the IPM Staging project/event pair is approved")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--api-keys-json-stdin", action="store_true")
    parser.add_argument("--backup", type=Path, required=True)
    parser.add_argument("--project-ref", required=True)
    parser.add_argument("--event-slug", required=True)
    args = parser.parse_args()
    target_guard(args.project_ref, args.event_slug)
    if not args.api_keys_json_stdin:
        raise ImportSafetyError("Use --api-keys-json-stdin; credentials must not be command-line arguments")
    manifest = load_manifest()
    client = SupabaseRest(args.project_ref, service_key_from_stdin())
    events = client.call("GET", "/events", params={"select": "id,slug,name,timezone", "slug": f"eq.{args.event_slug}"})
    if len(events) != 1 or events[0].get("slug") != STAGING_EVENT_SLUG or events[0].get("name") != STAGING_EVENT_NAME:
        raise ImportSafetyError("Target is not exactly the IPM Staging event")
    if events[0].get("timezone") != "America/Toronto":
        raise ImportSafetyError("IPM Staging timezone is not America/Toronto")
    event_id = events[0]["id"]
    existing = client.call("GET", "/schedule_items", params={"select": "*", "event_id": f"eq.{event_id}"})
    args.backup.write_text(json.dumps(existing, indent=2), encoding="utf-8")
    mnp_before = [row for row in existing if row.get("source") == MNP_SOURCE]
    if len(mnp_before) != EXPECTED_MNP_TOTAL:
        raise ImportSafetyError(f"Expected 107 existing MNP records; found {len(mnp_before)}")
    mnp_fingerprint = fingerprint(mnp_before)
    result = classify(existing, desired_rows(manifest, event_id))
    summary = {key.lower(): len(value) for key, value in result.items()}
    print(json.dumps({"mode": "apply" if args.apply else "dry-run", "project": STAGING_EVENT_NAME,
                      "event_slug": args.event_slug, "backup": str(args.backup), **summary}, indent=2))
    if result["CONFLICT"] or result["UPDATE"]:
        raise ImportSafetyError("Conflicts or updates detected; insert-only importer refuses to write")
    if not args.apply:
        return 0
    if not (len(result["INSERT"]) == EXPECTED_TOTAL and not result["UNCHANGED"]):
        raise ImportSafetyError("Apply requires the approved first-run classification: 39 inserts, 0 unchanged")
    client.call("POST", "/schedule_items", body=result["INSERT"])
    verified = client.call("GET", "/schedule_items", params={"select": "*", "event_id": f"eq.{event_id}"})
    final = classify(verified, desired_rows(manifest, event_id))
    if len(final["UNCHANGED"]) != EXPECTED_TOTAL or any(final[key] for key in ("INSERT", "UPDATE", "CONFLICT")):
        raise ImportSafetyError("Post-import entertainment verification failed")
    mnp_after = [row for row in verified if row.get("source") == MNP_SOURCE]
    if len(mnp_after) != EXPECTED_MNP_TOTAL or fingerprint(mnp_after) != mnp_fingerprint:
        raise ImportSafetyError("Existing MNP records changed during import")
    print(json.dumps({"verified_entertainment": EXPECTED_TOTAL, "verified_mnp_unchanged": EXPECTED_MNP_TOTAL,
                      "status": "ok"}, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ImportSafetyError as exc:
        print(f"IMPORT STOPPED: {exc}", file=sys.stderr)
        raise SystemExit(2)
