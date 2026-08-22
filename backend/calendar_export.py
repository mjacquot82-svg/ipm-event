"""RFC 5545 calendar export helpers for canonical Schedule rows."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable

CALENDAR_TIMEZONE = "America/Toronto"
PRODUCT_ID = "-//IPM 2026//Attendee Schedule//EN"


class CalendarExportError(ValueError):
    """Raised when canonical Schedule data cannot be safely exported."""


def _escape_text(value: Any) -> str:
    text = str(value or "")
    return (
        text.replace("\\", "\\\\")
        .replace("\r\n", "\\n")
        .replace("\r", "\\n")
        .replace("\n", "\\n")
        .replace(";", "\\;")
        .replace(",", "\\,")
    )


def _parse_timestamp(value: Any, field: str) -> datetime:
    if not isinstance(value, str) or not value.strip():
        raise CalendarExportError(f"Canonical {field} is missing")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise CalendarExportError(f"Canonical {field} is invalid") from exc
    if parsed.tzinfo is None:
        raise CalendarExportError(f"Canonical {field} must include a timezone offset")
    return parsed.astimezone(timezone.utc)


def _utc_value(value: Any, field: str) -> str:
    return _parse_timestamp(value, field).strftime("%Y%m%dT%H%M%SZ")


def _fold_line(line: str) -> list[str]:
    """Fold a content line to at most 75 UTF-8 octets, excluding CRLF."""
    if not line:
        return [""]
    folded: list[str] = []
    remaining = line
    first = True
    while remaining:
        prefix = "" if first else " "
        limit = 75 - len(prefix.encode("utf-8"))
        size = 0
        split_at = 0
        for index, character in enumerate(remaining):
            char_size = len(character.encode("utf-8"))
            if size + char_size > limit:
                break
            size += char_size
            split_at = index + 1
        if split_at == 0:
            raise CalendarExportError("Unable to fold calendar content safely")
        folded.append(prefix + remaining[:split_at])
        remaining = remaining[split_at:]
        first = False
    return folded


def _event_lines(row: dict[str, Any], event_slug: str, generated_at: datetime) -> list[str]:
    schedule_id = str(row.get("id") or "").strip()
    title = str(row.get("title") or "").strip()
    if not schedule_id or not title:
        raise CalendarExportError("Canonical Schedule identity/title is missing")

    lines = [
        "BEGIN:VEVENT",
        f"UID:{_escape_text(f'{event_slug}-{schedule_id}@theipm.ca')}",
        f"DTSTAMP:{generated_at.astimezone(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
        f"DTSTART:{_utc_value(row.get('starts_at'), 'starts_at')}",
    ]
    if row.get("ends_at"):
        lines.append(f"DTEND:{_utc_value(row['ends_at'], 'ends_at')}")
    lines.append(f"SUMMARY:{_escape_text(title)}")
    if row.get("description"):
        lines.append(f"DESCRIPTION:{_escape_text(row['description'])}")
    if row.get("location_name"):
        lines.append(f"LOCATION:{_escape_text(row['location_name'])}")
    if row.get("updated_at"):
        lines.append(f"LAST-MODIFIED:{_utc_value(row['updated_at'], 'updated_at')}")
    lines.extend(("STATUS:CONFIRMED", "TRANSP:OPAQUE", "END:VEVENT"))
    return lines


def generate_calendar(
    rows: Iterable[dict[str, Any]],
    event_slug: str,
    *,
    generated_at: datetime | None = None,
) -> bytes:
    canonical_rows = sorted(rows, key=lambda row: (str(row.get("starts_at") or ""), str(row.get("id") or "")))
    if not canonical_rows:
        raise CalendarExportError("At least one Schedule event is required")
    timestamp = generated_at or datetime.now(timezone.utc)
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:{PRODUCT_ID}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-TIMEZONE:{CALENDAR_TIMEZONE}",
    ]
    for row in canonical_rows:
        lines.extend(_event_lines(row, event_slug, timestamp))
    lines.append("END:VCALENDAR")
    folded = [physical for logical in lines for physical in _fold_line(logical)]
    return ("\r\n".join(folded) + "\r\n").encode("utf-8")
