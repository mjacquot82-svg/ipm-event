from datetime import datetime, timezone
import asyncio
import uuid
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from icalendar import Calendar

from backend.calendar_export import CalendarExportError, generate_calendar, generate_google_calendar_url
from backend import server


NORMAL_ID = "11111111-1111-4111-8111-111111111111"
PARADE_ID = "22222222-2222-4222-8222-222222222222"
CROSS_EVENT_ID = "33333333-3333-4333-8333-333333333333"


def canonical_rows():
    return [
        {
            "id": NORMAL_ID,
            "event_id": "current-event",
            "title": "Café, Music; and Farming \\ Showcase",
            "description": "First line\nSecond line with a long Unicode description — " + "é" * 60,
            "starts_at": "2026-01-15T10:00:00-05:00",
            "ends_at": "2026-01-15T11:30:00-05:00",
            "location_name": "Hall, A; East",
            "updated_at": "2026-01-01T12:00:00Z",
        },
        {
            "id": PARADE_ID,
            "event_id": "current-event",
            "title": "Children’s Parade",
            "description": "A joyful celebration.",
            "starts_at": "2026-09-24T11:00:00-04:00",
            "ends_at": None,
            "location_name": "Parade route coming soon",
            "updated_at": "2026-08-22T12:00:00Z",
        },
    ]


def unfold_lines(payload: bytes):
    text = payload.decode("utf-8")
    return text.replace("\r\n ", "").split("\r\n")


def test_single_event_ics_is_parseable_stable_escaped_folded_and_uses_utc():
    generated_at = datetime(2026, 8, 22, 12, 0, tzinfo=timezone.utc)
    first = generate_calendar([canonical_rows()[0]], "ipm-staging", generated_at=generated_at)
    second = generate_calendar([canonical_rows()[0]], "ipm-staging", generated_at=generated_at)
    assert first == second
    assert first.endswith(b"\r\n")
    assert b"\n" not in first.replace(b"\r\n", b"")
    assert all(len(line) <= 75 for line in first.split(b"\r\n"))
    lines = unfold_lines(first)
    assert f"UID:ipm-staging-{NORMAL_ID}@theipm.ca" in lines
    assert "DTSTART:20260115T150000Z" in lines  # EST -> UTC
    assert "DTEND:20260115T163000Z" in lines
    assert r"SUMMARY:Café\, Music\; and Farming \\ Showcase" in lines
    assert r"LOCATION:Hall\, A\; East" in lines
    parsed = Calendar.from_ical(first)
    events = [component for component in parsed.walk() if component.name == "VEVENT"]
    assert len(events) == 1
    assert str(events[0]["SUMMARY"]) == "Café, Music; and Farming \\ Showcase"
    assert "First line\nSecond line" in str(events[0]["DESCRIPTION"])


def test_multi_event_ics_parses_and_start_only_event_omits_end_and_duration():
    payload = generate_calendar(canonical_rows(), "ipm-staging")
    parsed = Calendar.from_ical(payload)
    events = [component for component in parsed.walk() if component.name == "VEVENT"]
    assert len(events) == 2
    parade = next(event for event in events if str(event["UID"]).startswith("ipm-staging-2222"))
    assert parade.decoded("DTSTART") == datetime(2026, 9, 24, 15, 0, tzinfo=timezone.utc)  # EDT -> UTC
    assert "DTEND" not in parade
    assert "DURATION" not in parade
    assert str(parade["LOCATION"]) == "Parade route coming soon"


def test_google_calendar_url_uses_canonical_utc_range_and_content():
    url = generate_google_calendar_url(canonical_rows()[0])
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    assert parsed.netloc == "calendar.google.com"
    assert query["action"] == ["TEMPLATE"]
    assert query["dates"] == ["20260115T150000Z/20260115T163000Z"]  # EST -> UTC
    assert query["stz"] == ["America/Toronto"]
    assert query["etz"] == ["America/Toronto"]
    assert query["text"] == ["Café, Music; and Farming \\ Showcase"]
    assert query["details"] == [canonical_rows()[0]["description"]]
    assert query["location"] == ["Hall, A; East"]

    edt_row = {
        **canonical_rows()[0],
        "starts_at": "2026-09-22T10:15:00-04:00",
        "ends_at": "2026-09-22T10:45:00-04:00",
    }
    edt_query = parse_qs(urlparse(generate_google_calendar_url(edt_row)).query)
    assert edt_query["dates"] == ["20260922T141500Z/20260922T144500Z"]  # EDT -> UTC


def test_google_calendar_url_refuses_start_only_event():
    with pytest.raises(CalendarExportError, match="authoritative end time"):
        generate_google_calendar_url(canonical_rows()[1])


class FakeCalendarScheduleService:
    def __init__(self):
        self.rows = {row["id"]: row for row in canonical_rows()}

    async def get_calendar_rows(self, schedule_ids):
        # Cross-event and unknown IDs intentionally resolve to no current-event row.
        if any(schedule_id not in self.rows for schedule_id in schedule_ids):
            return []
        return [self.rows[schedule_id] for schedule_id in schedule_ids]


@pytest.fixture
def calendar_service(monkeypatch):
    monkeypatch.setattr(server, "schedule_service", FakeCalendarScheduleService())


def api_request(method, path, **kwargs):
    async def request():
        transport = httpx.ASGITransport(app=server.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.request(method, path, **kwargs)

    return asyncio.run(request())


def test_single_endpoint_returns_no_store_calendar(calendar_service):
    response = api_request("GET", f"/api/schedule/{NORMAL_ID}/calendar")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["content-type"].startswith("text/calendar")
    assert response.headers["content-disposition"].endswith('"ipm-schedule-event.ics"')
    assert len([item for item in Calendar.from_ical(response.content).walk() if item.name == "VEVENT"]) == 1


def test_google_endpoint_redirects_to_canonical_template_without_caching(calendar_service):
    response = api_request("GET", f"/api/schedule/{NORMAL_ID}/calendar/google", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["cache-control"] == "no-store"
    query = parse_qs(urlparse(response.headers["location"]).query)
    assert query["dates"] == ["20260115T150000Z/20260115T163000Z"]
    assert query["text"] == ["Café, Music; and Farming \\ Showcase"]


def test_google_endpoint_refuses_start_only_event(calendar_service):
    response = api_request("GET", f"/api/schedule/{PARADE_ID}/calendar/google", follow_redirects=False)
    assert response.status_code == 422
    assert "authoritative end time" in response.json()["detail"]


@pytest.mark.parametrize("schedule_id", [str(uuid.uuid4()), CROSS_EVENT_ID])
def test_google_endpoint_rejects_unknown_and_cross_event_ids(calendar_service, schedule_id):
    response = api_request("GET", f"/api/schedule/{schedule_id}/calendar/google", follow_redirects=False)
    assert response.status_code == 404


def test_bulk_endpoint_returns_one_multi_event_calendar(calendar_service):
    response = api_request("POST", "/api/schedule/calendar", json={"schedule_ids": [PARADE_ID, NORMAL_ID]})
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert len([item for item in Calendar.from_ical(response.content).walk() if item.name == "VEVENT"]) == 2


@pytest.mark.parametrize("schedule_id", [str(uuid.uuid4()), CROSS_EVENT_ID])
def test_unknown_and_cross_event_ids_are_rejected(calendar_service, schedule_id):
    response = api_request("GET", f"/api/schedule/{schedule_id}/calendar")
    assert response.status_code == 404


def test_bulk_limit_is_enforced_before_lookup(calendar_service):
    ids = [str(uuid.uuid4()) for _ in range(server.CALENDAR_BULK_EXPORT_LIMIT + 1)]
    response = api_request("POST", "/api/schedule/calendar", json={"schedule_ids": ids})
    assert response.status_code == 413
