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
    "2026-09-22-foodland-b6": 'Christie will be kicking off our morning movement Tuesday and Thursday mornings. Please come bring a friend, enjoy a free coffee and get that body moving and warmed up for the day at The IPM!',
    "2026-09-22-foodland-b7": "If you feel overwhelmed by the noise in the world on how to properly raise your child the Aaniin Collective will guide you on the journey to confident parenting.",
    "2026-09-22-foodland-b9": "A local garden centre and nursery near Walkerton owned and operated by Jeff Davis.",
    "2026-09-22-foodland-b11": "For 30 years Sleepers Bed Gallery has been Kincardine Ontario’s trusted local sleep experts helping our community find the right sleep solutions through personalized service, expert knowledge, and genuine passion for better sleep.",
    "2026-09-22-foodland-b14": "Greenock Collective",
    "2026-09-22-foodland-b18": "Liesemer Home Hardware",
    "2026-09-22-foodland-b21": "Fashion",
    "2026-09-22-foodland-b23": "Local makeup artist. Providing makeover contest with makeup.",
    "2026-09-22-foodland-b25": "Family-owned independent boutique in downtown Kincardine. Dressing makeover contestant.",
    "2026-09-22-foodland-b28": "The Space Between\nAlicia Gibbons",
    "2026-09-22-foodland-b30": "Amanda Butchart",
    "2026-09-22-foodland-b32": 'Jessica Connor — The WOMB Bruce County\nCo-Owner of The WOMB Bruce County and full spectrum doula. She is a Fertility, Birth, and Postpartum Doula, Holistic Reproductive Practitioner, and Fertility Coach.\n\nRebecca Grubb — The WOMB Bruce County\nRebecca is a Registered Pelvic Health Physiotherapist and a Perinatal Health Advocate.',
    "2026-09-22-harleys-c7": "DK Salon is a locally owned hair salon, operated by Jenna Freiburger, offering professional hairstyling in a welcoming, personalized setting.",
    "2026-09-22-quality-homes-d7": "Locally owned hair and beauty salon downtown Walkerton, offering hair and nail services.",
    "2026-09-22-quality-homes-d18": "Local makeup artist. Providing makeover contest with makeup.",
    "2026-09-22-quality-homes-d14": 'Jenna is a Reiki Master who will be demonstrating the benefits of cupping when used as an energetic and emotional release.',
    "2026-09-22-quality-homes-d22": 'Chelsea is the founder and Lead Instructor of All Bodies Studios—a growing, community-focused Pilates brand built on the belief that every body deserves to move with confidence, feel strong, and belong in the room.',
    "2026-09-22-quality-homes-d30": "West Shore",
    "2026-09-23-quality-homes-g10": 'Liza is a registered Reflexologist and will be speaking on the benefits of holistic healing and putting your health and wellness into your own hands.',
    "2026-09-23-foodland-e7": 'Liza is a registered Reflexologist and will be speaking on the benefits of holistic healing and putting your health and wellness into your own hands.',
    "2026-09-23-harleys-f13": 'Personalized Support for Your Family’s Needs at Every Stage',
    "2026-09-23-foodland-e9": 'Personalized Support for Your Family’s Needs at Every Stage',
    "2026-09-23-foodland-e12": 'Susan is an artist, Certified Master Creativity Coach and passionate arts facilitator who shares the powerful role creativity can play in our well-being with stories from her work and a hands-on experience for everyone to enjoy.',
    "2026-09-23-foodland-e14": "Ruth is a personal development coach who teaches through the lens of spiritual development. A professional interior designer and expert in energy within the home, she explores the powerful connection between our spaces, our energy, and how we feel. She is a collector of experiences, an avid learner, and a natural connector. Ruth is based out of Lucknow, ON.",
    "2026-09-23-foodland-e16": "Laurie Convay is a passionate advocate for creating cleaner, healthier homes through simple and sustainable choices. As a representative with ENJO Canada, she helps people discover a different way to clean—using innovative natural fibres and water to reduce the need for traditional cleaning products. Laurie is passionate about helping families create homes that feel fresh, safe, and healthy, while making everyday cleaning a little simpler. Laurie is based out of Tiverton, ON.",
    "2026-09-23-foodland-e18": "Angela is the creative force behind Upstaged Design in Hanover, Ontario, and an interior designer who believes your home should feel unmistakably like you. Known for embracing colour, personality, and a little bit of fun, Angela creates spaces that feel collected, welcoming, and full of life—proving that great design doesn’t have to mean playing it safe.",
    "2026-09-23-foodland-e21": "Heather is the creative hands behind Willow Home, a furniture refinisher based in Walkerton, Ontario. With a love for seeing the beauty and potential in pieces others may overlook, she gives furniture a second chance through thoughtful refinishing and restoration. Heather believes a home is made more meaningful by pieces with a story—and sometimes, the best pieces are the ones given new life.",
    "2026-09-23-foodland-e26": "Sadie is the owner of Lake Huron Home in Kincardine, Ontario. With a passion for warm, welcoming spaces and a strong belief in supporting Canadian makers, she loves helping people create homes filled with quality, comfort, and pieces made to last.",
    "2026-09-23-foodland-e28": "Locally loved women’s clothing boutique, offering stylish, versatile fashions for women of all ages and sizes.",
    "2026-09-23-foodland-e30": "“Lets create TOGETHER. Your own UNIQUE hat, choose a color/finish/style. Create a MEMORY. Tell your STORY, and hold it close. Then wear it PROUDLY.”",
    "2026-09-23-foodland-e32": "Independent beauty consultant providing personalized beauty and skin care guidance.",
    "2026-09-23-harleys-f7": "Mark Grubb",
    "2026-09-23-harleys-f10": "Independent beauty consultant providing personalized beauty and skin care guidance.",
    "2026-09-23-harleys-f16": "“Lets create TOGETHER. Your own UNIQUE hat, choose a color/finish/style. Create a MEMORY. Tell your STORY, and hold it close. Then wear it PROUDLY.”",
    "2026-09-23-harleys-f21": "by Lauriss",
    "2026-09-23-quality-homes-g16": 'Bailey is a local Independent Dental Hygienist and Myofunctional Therapist who will be presenting on what Myofunctional therapy is and how it can benefit your life today.',
    "2026-09-23-quality-homes-g13": "Labour of Love",
    "2026-09-23-quality-homes-g22": "Locally owned hair and beauty salon downtown Walkerton, offering hair and nail services.",
    "2026-09-24-foodland-h6": 'Christie will be kicking off our morning movement Tuesday and Thursday mornings. Please come bring a friend, enjoy a free coffee and get that body moving and warmed up for the day at The IPM!',
    "2026-09-24-foodland-h7": "Bridal and formal wear boutique, specializing in beautiful, timeless styles for life’s special occasions.",
    "2026-09-24-foodland-h9": "Locally owned men’s clothing boutique in downtown Walkerton, offering quality clothing for casual, business casual, and formal occasions.",
    "2026-09-24-foodland-h11": "Family-owned jewelry store serving the communities since 1977, with a strong focus on quality craftsmanship and personalized service.",
    "2026-09-24-foodland-h14": 'Perimenopause is a natural transition, not something to fear. Join Registered Nutritional Therapist Hannah Greig to understand the changes your body is designed to experience, why symptoms can arise, and how to support yourself through these years with greater ease, confidence and grace.',
    "2026-09-24-foodland-h16": "George Harpur",
    "2026-09-24-foodland-h18": 'Ashley is a Reiki Master and Teacher, Meditation Coach, Breathwork Specialist, ALL Game Guide and International Retreat Leader & Speaker who will be speaking and sharing how reiki and other modalities can help you release what is no longer serving, start living in your soul’s purpose and build a life that with catch you!',
    "2026-09-24-foodland-h20": "Home and Garden",
    "2026-09-24-foodland-h25": "Southampton Olive Oil",
    "2026-09-24-foodland-h31": "Greenock Collective",
    "2026-09-24-harleys-i12": 'Susan is an artist, Certified Master Creativity Coach and passionate arts facilitator who shares the powerful role creativity can play in our well-being with stories from her work and a hands-on experience for everyone to enjoy.',
    "2026-09-24-harleys-i7": "Brenda Kreamer",
    "2026-09-24-harleys-i24": "Independent beauty consultant providing personalized beauty and skin care guidance.",
    "2026-09-24-harleys-i21": 'Ashley is a Reiki Master and Teacher, Meditation Coach, Breathwork Specialist, ALL Game Guide and International Retreat Leader & Speaker who will be speaking and sharing how reiki and other modalities can help you release what is no longer serving, start living in your soul’s purpose and build a life that with catch you!',
    "2026-09-24-quality-homes-j19": 'Offering inclusive therapeutic art experiences for all ages through workshops and community programs that inspire people to rediscover creativity as an essential part of life; encouraging self-expression, exploration, imagination, and joy, while reminding us that creativity is not something we leave behind in childhood, but an important part of who we are and something we can continue to nurture throughout our lives.',
    "2026-09-24-quality-homes-j7": "Locally owned hair and beauty salon downtown Walkerton, offering hair and nail services.",
    "2026-09-24-quality-homes-j12": "Guest House",
    "2026-09-24-quality-homes-j14": "Guest House",
    "2026-09-25-harleys-l16": 'Michelle is an aesthetician and local spa owner who will be preforming a relaxing facial massage sequence with lymphatic activation.',
    "2026-09-25-harleys-l27": 'Recharge your body at the cellular level with IncREDible Light—consistent red light therapy for long-term pain relief and vitality for humans and pets alike.',
    "2026-09-25-foodland-k6": "Freezer Fitness",
    "2026-09-25-foodland-k7": "Fire Cider & Honey",
    "2026-09-25-foodland-k11": "Jennifer Dunsmoor",
    "2026-09-25-foodland-k14": "Offering goddess inspired facials, facial waxing, and makeup artistry. A natural, feminine, peaceful, beauty studio with a strong connection to nature.",
    "2026-09-25-foodland-k16": "Modern women’s fashion boutique in downtown Walkerton, offering trendy, yet timeless clothing, denim, footwear, jewelry and lifestyle pieces.",
    "2026-09-25-foodland-k18": "Locally owned men’s clothing boutique in downtown Walkerton, offering quality clothing for casual, business casual, and formal occasions.",
    "2026-09-25-foodland-k21": 'Movement is Medicine - together with the Freezer Fitness team, exploring the opportunity for every age, body and ability to confidently move and recover.',
    "2026-09-25-foodland-k31": "Carrie Lynn Floral",
    "2026-09-25-harleys-l22": 'Sara will demonstrate three unique Eminence Organic facials and explore why choosing organic skincare is more than a passing trend—it’s a thoughtful, results-driven approach to caring for your skin and the planet.',
    "2026-09-25-quality-homes-m15": "Flowers by Uss",
    "2026-09-25-quality-homes-m23": "Offering goddess inspired facials, facial waxing, and makeup artistry. A natural, feminine, peaceful, beauty studio with a strong connection to nature.",
    "2026-09-26-foodland-o8": "Doors open 9:00 AM",
    "2026-09-26-foodland-o18": "Doors open 12:30 PM",
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
    part_names = manifest.get("event_parts") or []
    if part_names:
        events = []
        for rel in part_names:
            part_path = path.parent / rel
            part_data = json.loads(part_path.read_text(encoding="utf-8"))
            events.extend(part_data if isinstance(part_data, list) else part_data.get("events", []))
        manifest["events"] = events
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
