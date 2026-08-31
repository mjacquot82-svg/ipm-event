#!/usr/bin/env python3
"""Dry-run-first, additive importer for the reviewed 2026 MNP schedule."""

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

APPROVED_TARGETS = {
    "hooiqjcbcbwzjjvnwyxf": "ipm-staging",
    "hppboivlpqkfhhzfftuu": "ipm-2026",
}
SOURCE = "mnp_lifestyles_2026_workbook"
EXPECTED_COUNTS = {"Tuesday": 28, "Wednesday": 27, "Thursday": 27, "Friday": 23, "Saturday": 2}
EXPECTED_TOTAL = 107
APPROVED_DESCRIPTIONS = {
    "2026-09-22-foodland-b6": "Definition Fitness",
    "2026-09-22-foodland-b7": "Aaniin Collective",
    "2026-09-22-foodland-b9": "(1050-1120)",
    "2026-09-22-foodland-b11": "(1125-1145)",
    "2026-09-22-foodland-b14": "Greenock Collective",
    "2026-09-22-foodland-b18": "Liesemer Home Hardware",
    "2026-09-22-foodland-b21": "Fashion",
    "2026-09-22-foodland-b23": "Hayley Wilhem",
    "2026-09-22-foodland-b25": "1510-Makeover",
    "2026-09-22-foodland-b28": "The Space Between\nAlicia Gibbons",
    "2026-09-22-foodland-b30": "Amanada Butchart",
    "2026-09-22-foodland-b32": "Rebecca Grubb & Jess Connor",
    "2026-09-22-harleys-c7": "DK Salon is a locally owned hair salon, operated by Jenna Freiburger, offering professional hairstyling in a welcoming, personalized setting.",
    "2026-09-22-quality-homes-d18": "Hayley Wilhelm",
    "2026-09-22-quality-homes-d22": "Chelsea\nAll Bodies",
    "2026-09-22-quality-homes-d30": "West Shore",
    "2026-09-22-quality-homes-d7": "Locally owned hair and beauty salon downtown Walkerton, offering hair and nail services.",
    "2026-09-23-foodland-e7": "Essential Wellness\nLiza Weltz",
    "2026-09-23-foodland-e9": "Rachel Stroeder",
    "2026-09-23-foodland-e12": "Susan Seitz",
    "2026-09-23-foodland-e14": "Ruth Montgomery (Energy in the Home)",
    "2026-09-23-foodland-e21": "Willow Home",
    "2026-09-23-foodland-e28": "J&H Womens Fashions",
    "2026-09-23-foodland-e30": "“Lets create TOGETHER. Your own UNIQUE hat, choose a color/finish/style. Create a MEMORY. Tell your STORY, and hold it close. Then wear it PROUDLY.”",
    "2026-09-23-foodland-e32": "1655-Makeover",
    "2026-09-23-harleys-f10": "Independent beauty consultant providing personalized beauty and skin care guidance.",
    "2026-09-23-harleys-f16": "“Lets create TOGETHER. Your own UNIQUE hat, choose a color/finish/style. Create a MEMORY. Tell your STORY, and hold it close. Then wear it PROUDLY.”",
    "2026-09-23-harleys-f7": "Mark Grubb",
    "2026-09-23-harleys-f21": "by Lauriss",
    "2026-09-23-quality-homes-g13": "Labour of Love",
    "2026-09-23-quality-homes-g22": "Locally owned hair and beauty salon downtown Walkerton, offering hair and nail services.",
    "2026-09-24-foodland-h6": "Definition Fitness",
    "2026-09-24-foodland-h7": "Pure Elegance",
    "2026-09-24-foodland-h9": "Locally owned men’s clothing boutique in downtown Walkerton, offering quality clothing for casual, business casual, and formal occasions.",
    "2026-09-24-foodland-h11": "1140-Makeover",
    "2026-09-24-foodland-h14": "Hannah Grieg",
    "2026-09-24-foodland-h16": "George Harpur",
    "2026-09-24-foodland-h18": "Ashley Grant",
    "2026-09-24-foodland-h20": "Home and Garden",
    "2026-09-24-foodland-h25": "Southampton Olive Oil",
    "2026-09-24-foodland-h31": "Greenock Collective",
    "2026-09-24-harleys-i7": "Brenda Kreamer",
    "2026-09-24-harleys-i24": "Independent beauty consultant providing personalized beauty and skin care guidance.",
    "2026-09-24-quality-homes-j12": "Guest House",
    "2026-09-24-quality-homes-j14": "Guest House",
    "2026-09-24-quality-homes-j7": "Locally owned hair and beauty salon downtown Walkerton, offering hair and nail services.",
    "2026-09-25-foodland-k6": "Freezer Fitness",
    "2026-09-25-foodland-k7": "Fire Cider & Honey",
    "2026-09-25-foodland-k11": "Jennifer Dunsmoor",
    "2026-09-25-foodland-k14": "Forrest Maiden",
    "2026-09-25-foodland-k16": "Modern women’s fashion boutique in downtown Walkerton, offering trendy, yet timeless clothing, denim, footwear, jewelry and lifestyle pieces.",
    "2026-09-25-foodland-k18": "1325-Makeover",
    "2026-09-25-foodland-k21": "Freezer Fitness\nJackie West, Dianne Zettle, Conor Fischer",
    "2026-09-25-foodland-k31": "Carrie Lynn Floral",
    "2026-09-25-harleys-l22": "Sara Porter\nRemind Wellness",
    "2026-09-25-quality-homes-m15": "Flowers by Uss",
    "2026-09-25-quality-homes-m23": "Offering goddess inspired facials, facial waxing, and makeup artistry. A natural, feminine, peaceful, beauty studio with a strong connection to nature.",
}
MANIFEST_PATH = Path(__file__).parent / "import_manifests" / "mnp_lifestyles_2026.json"
WORKBOOK_PATH = Path(__file__).parents[1] / "data" / "MMP Lifestyle Tent.xlsx"
COMPARE_FIELDS = (
    "title", "description", "starts_at", "ends_at", "timezone", "category",
    "location_name", "days_active", "source", "external_id", "status", "sort_order",
)


class ImportSafetyError(RuntimeError):
    pass


def load_manifest(path: Path = MANIFEST_PATH, workbook_path: Path = WORKBOOK_PATH) -> dict[str, Any]:
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if manifest.get("source") != SOURCE:
        raise ImportSafetyError("Manifest source safety check failed")
    if set(manifest.get("approved_event_slugs", [])) != set(APPROVED_TARGETS.values()):
        raise ImportSafetyError("Manifest approved-target safety check failed")
    if not workbook_path.is_file():
        raise ImportSafetyError(f"Authoritative workbook is missing: {workbook_path}")
    digest = hashlib.sha256(workbook_path.read_bytes()).hexdigest()
    if digest != manifest.get("workbook_sha256"):
        raise ImportSafetyError("Authoritative workbook checksum differs from reviewed source")
    events = manifest.get("events", [])
    counts = Counter(row.get("days_active") for row in events)
    if len(events) != EXPECTED_TOTAL or dict(counts) != EXPECTED_COUNTS:
        raise ImportSafetyError(f"Manifest counts are unsafe: total={len(events)} days={dict(counts)}")
    identities = [row.get("external_id") for row in events]
    if len(set(identities)) != EXPECTED_TOTAL or None in identities:
        raise ImportSafetyError("Manifest external identities are missing or duplicated")
    for row in events:
        if row.get("category") != "MNP Lifestyles Tent Events":
            raise ImportSafetyError("Every row must use the approved category")
        if row.get("timezone") != "America/Toronto":
            raise ImportSafetyError("Every row must use America/Toronto")
        expected_description = APPROVED_DESCRIPTIONS.get(row["external_id"])
        if row.get("description") != expected_description:
            raise ImportSafetyError("An unapproved or missing workbook description is present")
    return manifest


def parse_local(date_text: str, time_text: str, timezone_name: str) -> str:
    parsed = datetime.strptime(f"{date_text} {time_text}", "%Y-%m-%d %I:%M %p")
    return parsed.replace(tzinfo=ZoneInfo(timezone_name)).isoformat()


def desired_rows(manifest: dict[str, Any], event_id: str) -> list[dict[str, Any]]:
    rows = []
    for index, item in enumerate(manifest["events"]):
        rows.append({
            "event_id": event_id,
            "title": item["title"],
            "description": item["description"],
            "starts_at": parse_local(item["date"], item["start_time"], item["timezone"]),
            "ends_at": parse_local(item["date"], item["end_time"], item["timezone"]),
            "timezone": item["timezone"],
            "category": item["category"],
            "location_name": item["location_name"],
            "days_active": item["days_active"],
            "source": SOURCE,
            "external_id": item["external_id"],
            "status": "published",
            "sort_order": index,
        })
    return rows


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
            left, right = normalize_timestamp(left), normalize_timestamp(right)
            if datetime.fromisoformat(left).timestamp() != datetime.fromisoformat(right).timestamp():
                return False
        elif left != right:
            return False
    return True


def classify(existing_rows: list[dict[str, Any]], wanted_rows: list[dict[str, Any]]) -> dict[str, list[Any]]:
    by_identity: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for row in existing_rows:
        external_id = row.get("external_id")
        if external_id:
            by_identity.setdefault((row.get("source"), external_id), []).append(row)
    result: dict[str, list[Any]] = {"INSERT": [], "UPDATE": [], "UNCHANGED": [], "CONFLICT": []}
    for wanted in wanted_rows:
        matches = by_identity.get((SOURCE, wanted["external_id"]), [])
        other_source = [
            row for row in existing_rows
            if row.get("external_id") == wanted["external_id"] and row.get("source") != SOURCE
        ]
        if other_source or len(matches) > 1:
            result["CONFLICT"].append({"desired": wanted, "matches": matches, "other_source": other_source})
        elif not matches:
            result["INSERT"].append(wanted)
        elif rows_equal(matches[0], wanted):
            result["UNCHANGED"].append(matches[0])
        else:
            result["UPDATE"].append({"id": matches[0]["id"], "row": wanted})
    return result


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
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
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


def summarize(result: dict[str, list[Any]], unrelated_count: int) -> dict[str, int]:
    return {key.lower(): len(value) for key, value in result.items()} | {"unrelated_existing": unrelated_count}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Apply the classified inserts/updates")
    parser.add_argument("--api-keys-json-stdin", action="store_true")
    parser.add_argument("--backup", type=Path)
    parser.add_argument("--project-ref", required=True)
    parser.add_argument("--event-slug", required=True)
    args = parser.parse_args()
    if not args.api_keys_json_stdin:
        raise ImportSafetyError("Use --api-keys-json-stdin; credentials must never be command-line arguments")
    if APPROVED_TARGETS.get(args.project_ref) != args.event_slug:
        raise ImportSafetyError("Project/event target pair is not approved")

    manifest = load_manifest()
    client = SupabaseRest(args.project_ref, service_key_from_stdin())
    events = client.call("GET", "/events", params={"select": "id,slug,name,timezone", "slug": f"eq.{args.event_slug}"})
    if len(events) != 1 or events[0].get("slug") != args.event_slug:
        raise ImportSafetyError(f"Exactly one {args.event_slug} event must exist")
    if events[0].get("timezone") != "America/Toronto":
        raise ImportSafetyError("ipm-staging event timezone is not America/Toronto")
    event_id = events[0]["id"]
    existing = client.call("GET", "/schedule_items", params={"select": "*", "event_id": f"eq.{event_id}"})
    if args.backup:
        args.backup.write_text(json.dumps(existing, indent=2), encoding="utf-8")
    wanted = desired_rows(manifest, event_id)
    result = classify(existing, wanted)
    unrelated_count = sum(1 for row in existing if row.get("source") != SOURCE)
    summary = summarize(result, unrelated_count)
    print(json.dumps({"mode": "apply" if args.apply else "dry-run", "project_ref": args.project_ref, "event_slug": args.event_slug, **summary}, indent=2))
    if result["CONFLICT"]:
        raise ImportSafetyError("Identity conflicts detected; refusing to write")
    if not args.apply:
        return 0
    if len(result["INSERT"]) + len(result["UPDATE"]) + len(result["UNCHANGED"]) != EXPECTED_TOTAL:
        raise ImportSafetyError("Classification did not reconcile to 107 rows")
    if result["INSERT"]:
        client.call("POST", "/schedule_items", body=result["INSERT"])
    for update in result["UPDATE"]:
        client.call("PATCH", "/schedule_items", params={"id": f"eq.{update['id']}", "event_id": f"eq.{event_id}"}, body=update["row"])
    verified = client.call("GET", "/schedule_items", params={"select": "*", "event_id": f"eq.{event_id}"})
    verification = classify(verified, wanted)
    if len(verification["UNCHANGED"]) != EXPECTED_TOTAL or any(verification[key] for key in ("INSERT", "UPDATE", "CONFLICT")):
        raise ImportSafetyError("Post-write verification failed")
    print(json.dumps({"verified": EXPECTED_TOTAL, "status": "ok"}, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ImportSafetyError as exc:
        print(f"IMPORT STOPPED: {exc}", file=sys.stderr)
        raise SystemExit(2)
