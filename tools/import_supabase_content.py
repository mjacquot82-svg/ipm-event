#!/usr/bin/env python3
"""Import event schedule and vendor CSV content directly into Supabase."""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


TITLE_ALIASES = ("Name", "Title", "Event Title", "Event Name", "Activity", "Program")
TORONTO_TIMEZONE = ZoneInfo("America/Toronto")


@dataclass
class ImportResult:
    imported: int
    skipped: int
    errors: list[str]


class SupabaseError(RuntimeError):
    pass


class SupabaseClient:
    def __init__(self, url: str, service_role_key: str):
        self.url = url.rstrip("/")
        self.service_role_key = service_role_key

    @property
    def rest_url(self) -> str:
        return f"{self.url}/rest/v1"

    @property
    def headers(self) -> dict[str, str]:
        return {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json",
        }

    def request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, str] | None = None,
        payload: Any | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> Any:
        url = f"{self.rest_url}{path}"
        if params:
            url = f"{url}?{urlencode(params)}"

        data = None
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")

        request = Request(
            url,
            data=data,
            method=method,
            headers={**self.headers, **(extra_headers or {})},
        )

        try:
            with urlopen(request, timeout=30) as response:
                body = response.read()
                if not body:
                    return None
                return json.loads(body.decode("utf-8"))
        except HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise SupabaseError(f"Supabase {method} {path} failed with HTTP {exc.code}: {body}") from exc
        except URLError as exc:
            raise SupabaseError(f"Supabase {method} {path} failed: {exc.reason}") from exc

    def resolve_event_id(self, event_slug: str) -> str:
        rows = self.request(
            "GET",
            "/events",
            params={
                "select": "id,slug",
                "slug": f"eq.{event_slug}",
                "limit": "1",
            },
        )
        if rows:
            return rows[0]["id"]
        raise SupabaseError(f"Event slug not found in Supabase events table: {event_slug}")

    def replace_rows(self, table: str, event_id: str, rows: list[dict[str, Any]]) -> None:
        self.request("DELETE", f"/{table}", params={"event_id": f"eq.{event_id}"})
        if rows:
            self.request(
                "POST",
                f"/{table}",
                payload=rows,
                extra_headers={"Prefer": "return=minimal"},
            )


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        fail(f"{name} is required")
    return value


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    if not path.exists():
        fail(f"CSV file does not exist: {path}")
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            fail(f"CSV file has no header row: {path}")
        return list(reader.fieldnames), list(reader)


def value(row: dict[str, str], field: str) -> str:
    return (row.get(field) or "").strip()


def first_value(row: dict[str, str], fields: tuple[str, ...]) -> str:
    for field in fields:
        current = value(row, field)
        if current:
            return current
    return ""


def parse_datetime(date_value: str, time_value: str) -> str | None:
    if not date_value or not time_value:
        return None

    raw_value = f"{date_value.strip()} {time_value.strip()}"
    formats = (
        "%Y-%m-%d %I:%M %p",
        "%Y-%m-%d %I %p",
        "%Y-%m-%d %H:%M",
        "%m/%d/%Y %I:%M %p",
        "%m/%d/%Y %H:%M",
        "%B %d, %Y %I:%M %p",
    )
    for format_string in formats:
        try:
            parsed = datetime.strptime(raw_value, format_string)
            return parsed.replace(tzinfo=TORONTO_TIMEZONE).isoformat()
        except ValueError:
            continue
    return None


def optional_float(raw_value: str, *, row_number: int, field: str, errors: list[str]) -> float | None:
    if not raw_value:
        return None
    try:
        return float(raw_value)
    except ValueError:
        errors.append(f"row {row_number}: {field} must be a number")
        return None


def optional_int(raw_value: str, *, row_number: int, field: str, errors: list[str], default: int) -> int:
    if not raw_value:
        return default
    try:
        return int(raw_value)
    except ValueError:
        errors.append(f"row {row_number}: {field} must be an integer")
        return default


def prepare_schedule_rows(path: Path, event_id: str) -> tuple[list[dict[str, Any]], ImportResult]:
    headers, csv_rows = read_csv(path)
    errors: list[str] = []
    imported_rows: list[dict[str, Any]] = []
    skipped = 0

    if not any(header in headers for header in TITLE_ALIASES):
        errors.append(f"missing schedule title column; accepted columns: {', '.join(TITLE_ALIASES)}")
    for required in ("Start Date", "Event Start", "Event End"):
        if required not in headers:
            errors.append(f"missing required schedule column: {required}")

    if errors:
        return [], ImportResult(imported=0, skipped=0, errors=errors)

    for index, row in enumerate(csv_rows, start=2):
        if all(not (cell or "").strip() for cell in row.values()):
            skipped += 1
            continue

        row_errors: list[str] = []
        title = first_value(row, TITLE_ALIASES)
        start_date = value(row, "Start Date")
        start_time = value(row, "Event Start")
        end_time = value(row, "Event End")

        if not title:
            row_errors.append(f"row {index}: title is required")
        if not start_date:
            row_errors.append(f"row {index}: Start Date is required")
        if not start_time:
            row_errors.append(f"row {index}: Event Start is required")
        if not end_time:
            row_errors.append(f"row {index}: Event End is required")

        starts_at = parse_datetime(start_date, start_time)
        ends_at = parse_datetime(start_date, end_time)
        if start_date and start_time and not starts_at:
            row_errors.append(f"row {index}: could not parse start datetime '{start_date} {start_time}'")
        if start_date and end_time and not ends_at:
            row_errors.append(f"row {index}: could not parse end datetime '{start_date} {end_time}'")

        latitude = optional_float(value(row, "Lat"), row_number=index, field="Lat", errors=row_errors)
        longitude = optional_float(value(row, "Long"), row_number=index, field="Long", errors=row_errors)

        if row_errors:
            errors.extend(row_errors)
            continue

        imported_rows.append(
            {
                "event_id": event_id,
                "title": title,
                "description": value(row, "Description"),
                "starts_at": starts_at,
                "ends_at": ends_at,
                "category": value(row, "Category") or "Event",
                "latitude": latitude,
                "longitude": longitude,
                "days_active": value(row, "Days_Active"),
                "location_name": value(row, "Location") or None,
                "source": "admin",
                "status": "published",
            }
        )

    return imported_rows, ImportResult(imported=len(imported_rows), skipped=skipped, errors=errors)


def prepare_vendor_rows(path: Path, event_id: str) -> tuple[list[dict[str, Any]], ImportResult]:
    headers, csv_rows = read_csv(path)
    errors: list[str] = []
    imported_rows: list[dict[str, Any]] = []
    skipped = 0

    if "Name" not in headers:
        errors.append("missing required vendor column: Name")
        return [], ImportResult(imported=0, skipped=0, errors=errors)

    for index, row in enumerate(csv_rows, start=2):
        if all(not (cell or "").strip() for cell in row.values()):
            skipped += 1
            continue

        row_errors: list[str] = []
        name = value(row, "Name")
        if not name:
            row_errors.append(f"row {index}: Name is required")

        priority = optional_int(value(row, "priority"), row_number=index, field="priority", errors=row_errors, default=99)
        if row_errors:
            errors.extend(row_errors)
            continue

        imported_rows.append(
            {
                "event_id": event_id,
                "name": name,
                "type": value(row, "Type"),
                "description": value(row, "Description"),
                "location": value(row, "Location"),
                "hours_of_operation": value(row, "Hours of Operation"),
                "days_of_operation": value(row, "Days of Operation"),
                "priority": priority,
                "source": "admin",
                "status": "published",
            }
        )

    return imported_rows, ImportResult(imported=len(imported_rows), skipped=skipped, errors=errors)


def print_result(label: str, result: ImportResult) -> None:
    print(f"{label}: imported={result.imported} skipped={result.skipped} errors={len(result.errors)}")
    for error in result.errors:
        print(f"  - {error}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import schedule and vendor CSV content directly into Supabase.")
    parser.add_argument("--event", required=True, help="Event slug, for example ipm-2026")
    parser.add_argument("--schedule", help="Path to schedule CSV")
    parser.add_argument("--vendors", help="Path to vendors CSV")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.schedule and not args.vendors:
        fail("At least one of --schedule or --vendors is required")

    supabase_url = require_env("SUPABASE_URL")
    service_role_key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    client = SupabaseClient(supabase_url, service_role_key)

    print(f"Resolving event slug: {args.event}")
    try:
        event_id = client.resolve_event_id(args.event)
    except SupabaseError as exc:
        fail(str(exc))
    print(f"Resolved event id: {event_id}")

    prepared: list[tuple[str, str, list[dict[str, Any]], ImportResult]] = []

    if args.schedule:
        rows, result = prepare_schedule_rows(Path(args.schedule), event_id)
        print_result("Schedule validation", result)
        prepared.append(("Schedule", "schedule_items", rows, result))

    if args.vendors:
        rows, result = prepare_vendor_rows(Path(args.vendors), event_id)
        print_result("Vendor validation", result)
        prepared.append(("Vendors", "vendors", rows, result))

    validation_errors = [error for _, _, _, result in prepared for error in result.errors]
    if validation_errors:
        fail("Validation failed. No Supabase data was modified.")

    for label, table, rows, result in prepared:
        print(f"Replacing {table} rows for event {args.event}...")
        try:
            client.replace_rows(table, event_id, rows)
        except SupabaseError as exc:
            fail(str(exc))
        print(f"{label}: replaced rows for this event only; imported={result.imported}")

    print("Import completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
