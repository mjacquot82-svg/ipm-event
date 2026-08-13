import asyncio
from datetime import UTC, datetime, timedelta
import json

import httpx
import pytest

from backend import server
from backend.analytics import ANALYTICS_EVENT_SCOPE
from backend.analytics_reporting import (
    AnalyticsRangeError,
    build_content,
    build_live,
    build_summary,
    build_traffic,
    content_report,
    reporting_bounds,
    summary_report,
    traffic_report,
    zero_filled_hours,
)


NOW = datetime(2026, 11, 1, 18, tzinfo=UTC)


def event(name, visitor="visitor-a", at=NOW - timedelta(hours=1), **properties):
    return {
        "eventScope": ANALYTICS_EVENT_SCOPE, "visitorId": visitor,
        "sessionId": f"session-{visitor}", "eventName": name,
        "properties": properties, "receivedAt": at,
        "localDate": at.astimezone(__import__("zoneinfo").ZoneInfo("America/Toronto")).date().isoformat(),
        "localHour": at.astimezone(__import__("zoneinfo").ZoneInfo("America/Toronto")).strftime("%H:00"),
    }


class MemoryReportingRepository:
    def __init__(self, visitors=None, sessions=None, events=None, rollups=None):
        self.visitors = visitors or []
        self.sessions = sessions or []
        self.events = events or []
        self.rollups = rollups or []

    async def fetch_visitors(self, scope):
        return [row for row in self.visitors if row.get("eventScope", ANALYTICS_EVENT_SCOPE) == scope]

    async def fetch_sessions(self, scope, start, end):
        return [row for row in self.sessions if row.get("eventScope", ANALYTICS_EVENT_SCOPE) == scope and (start is None or row["startedAt"] >= start) and row["startedAt"] < end]

    async def fetch_events(self, scope, start, end, event_names=None):
        return [row for row in self.events if row.get("eventScope") == scope and (start is None or row["receivedAt"] >= start) and row["receivedAt"] < end and (not event_names or row.get("eventName") in event_names)]

    async def fetch_rollups(self, scope, first_date, last_date):
        return [row for row in self.rollups if row.get("eventScope", ANALYTICS_EVENT_SCOPE) == scope and (first_date is None or row["localDate"] >= first_date) and row["localDate"] <= last_date]

    async def fetch_recent_events(self, scope, cutoff, now):
        return [row for row in self.events if row.get("eventScope") == scope and cutoff <= row["receivedAt"] <= now]

    async def fetch_active_sessions(self, scope, cutoff, now):
        return [row for row in self.sessions if row.get("eventScope", ANALYTICS_EVENT_SCOPE) == scope and row.get("status") == "active" and cutoff <= row["lastActivityAt"] <= now]


def fixture_repository():
    visitors = [
        {"eventScope": ANALYTICS_EVENT_SCOPE, "visitorId": "visitor-a", "firstSeenAt": NOW - timedelta(days=10), "visitCount": 3},
        {"eventScope": ANALYTICS_EVENT_SCOPE, "visitorId": "visitor-b", "firstSeenAt": NOW - timedelta(hours=2), "visitCount": 1},
        {"eventScope": "other-event", "visitorId": "visitor-x", "firstSeenAt": NOW - timedelta(hours=1), "visitCount": 1},
    ]
    sessions = [
        {"eventScope": ANALYTICS_EVENT_SCOPE, "visitorId": "visitor-a", "startedAt": NOW - timedelta(hours=3), "lastActivityAt": NOW - timedelta(minutes=2), "status": "active"},
        {"eventScope": ANALYTICS_EVENT_SCOPE, "visitorId": "visitor-b", "startedAt": NOW - timedelta(hours=2), "lastActivityAt": NOW - timedelta(hours=1), "status": "ended", "durationSeconds": 600},
        {"eventScope": "other-event", "visitorId": "visitor-x", "startedAt": NOW - timedelta(hours=1), "lastActivityAt": NOW, "status": "active"},
    ]
    events = [
        event("session_started", at=NOW - timedelta(hours=3)),
        event("app_launched", at=NOW - timedelta(hours=3), launch_mode="installed_pwa"),
        event("page_viewed", at=NOW - timedelta(minutes=4), page_id="schedule"),
        event("schedule_viewed", source="bottom_nav"),
        event("schedule_event_opened", schedule_item_id="stable-1", category="Shows"),
        event("schedule_event_opened", visitor="visitor-b", schedule_item_id="stable-1", category="Shows"),
        event("schedule_filter_used", filter_type="category", filter_value="Shows"),
        event("schedule_search_used", query_length=4, result_count=0, zero_results=True),
        event("favorite_changed", schedule_item_id="stable-1", action="added"),
        event("favorite_changed", schedule_item_id="stable-1", action="removed"),
        event("map_opened", source="bottom_nav", location_id="gate"),
        event("map_opened", visitor="visitor-b", source="home_quick_action"),
        event("map_opened", source="schedule", location_id="stage"),
        event("vendor_directory_opened"),
        event("vendor_search_used", query_length=2, result_count=0, zero_results=True),
        event("vendor_filter_used", filter_value="food"),
        event("vendor_filter_used", filter_value="indoor"),
        event("queen_archive_opened"),
        event("queen_archive_opened", visitor="visitor-b"),
        event("announcement_list_viewed", unread_count=2),
        event("announcement_impression", announcement_id="notice-1", surface="home"),
        event("announcement_impression", visitor="visitor-b", announcement_id="notice-1", surface="home"),
        event("announcement_opened", announcement_id="notice-1", source="home"),
        event("home_quick_action_clicked", action_id="map", destination_type="internal"),
        event("home_quick_action_clicked", visitor="visitor-b", action_id="map", destination_type="internal"),
        event("outbound_link_clicked", destination_id="tickets", destination_type="ticketing", source="home"),
        {**event("page_viewed", visitor="visitor-x", page_id="home"), "eventScope": "other-event"},
    ]
    rollups = [
        {"eventScope": ANALYTICS_EVENT_SCOPE, "localDate": "2026-11-01", "localHour": "01:00", "eventName": "session_started", "count": 2},
        {"eventScope": ANALYTICS_EVENT_SCOPE, "localDate": "2026-11-01", "localHour": "09:00", "eventName": "page_viewed", "count": 3},
    ]
    return MemoryReportingRepository(visitors, sessions, events, rollups)


def test_ranges_cover_today_7d_30d_all_and_reject_unknown():
    today, _, first, last = reporting_bounds("today", NOW)
    assert first == last and today == datetime(2026, 11, 1, 4, tzinfo=UTC)
    assert (reporting_bounds("7d", NOW)[3] - reporting_bounds("7d", NOW)[2]).days == 6
    assert (reporting_bounds("30d", NOW)[3] - reporting_bounds("30d", NOW)[2]).days == 29
    assert reporting_bounds("all", NOW)[0] is None
    with pytest.raises(AnalyticsRangeError): reporting_bounds("yesterday", NOW)


def test_summary_distinguishes_unique_new_returning_sessions_and_launches():
    repository = fixture_repository()
    payload = asyncio.run(summary_report(repository, "today", NOW))["overview"]
    assert payload["uniqueVisitors"] == 2
    assert payload["newVisitors"] == 1 and payload["returningVisitors"] == 1
    assert payload["sessions"] == 2 and payload["launches"] == 1
    assert payload["installedPwaVisitors"] == 1 and payload["browserOnlyVisitors"] == 0
    assert payload["averageSessionDurationSeconds"] == 600 and payload["sessionDurationSampleSize"] == 1


def test_live_activity_uses_recent_aggregate_window_without_identifiers():
    repository = fixture_repository()
    payload = build_live(asyncio.run(repository.fetch_recent_events(ANALYTICS_EVENT_SCOPE, NOW - timedelta(minutes=30), NOW)), asyncio.run(repository.fetch_active_sessions(ANALYTICS_EVENT_SCOPE, NOW - timedelta(minutes=30), NOW)), NOW)
    assert payload["activeSessions"] == 1
    assert payload["activityLastFiveMinutes"] >= 1
    assert payload["topActivePages"][0]["pageId"] == "schedule"
    encoded = json.dumps(payload, default=str)
    assert "visitor" not in encoded.lower() and "sessionId" not in encoded


def test_traffic_is_zero_filled_toronto_local_and_combines_dst_hour():
    repository = fixture_repository()
    payload = asyncio.run(traffic_report(repository, "today", NOW))["traffic"]
    assert len(payload["todayByHour"]) == 24
    assert payload["todayByHour"][1] == {"hour": "01:00", "sessions": 2}
    assert payload["todayByHour"][2]["sessions"] == 0
    assert payload["selectedRange"]["timezone"] == "America/Toronto"
    spring_start = reporting_bounds("today", datetime(2026, 3, 8, 12, tzinfo=UTC))[0]
    fall_start = reporting_bounds("today", datetime(2026, 11, 1, 12, tzinfo=UTC))[0]
    assert spring_start == datetime(2026, 3, 8, 5, tzinfo=UTC)
    assert fall_start == datetime(2026, 11, 1, 4, tzinfo=UTC)


def test_content_metrics_rankings_adoption_and_intentional_non_metrics():
    payload = asyncio.run(content_report(fixture_repository(), "today", NOW))["content"]
    assert payload["pages"][0]["pageId"] == "schedule" and payload["pages"][0]["uniqueVisitors"] == 1
    assert payload["schedule"]["mostOpenedEvents"][0]["scheduleItemId"] == "stable-1"
    assert payload["schedule"]["zeroResultSearches"] == 1 and payload["schedule"]["mapActions"] == 1
    assert payload["vendors"]["zeroResultSearches"] == 1
    assert {row["filterValue"] for row in payload["vendors"]["filters"]} == {"food", "indoor"}
    assert payload["map"]["opens"] == 3
    assert {row["source"]: row["count"] for row in payload["map"]["sources"]}["home_quick_action"] == 1
    assert payload["queenOfTheFurrow"] == {"archiveOpens": 2, "uniqueArchiveVisitors": 2}
    assert payload["announcements"]["ranking"][0]["openImpressionRate"] == 50.0
    assert payload["quickActions"]["actions"][0]["actionId"] == "map"
    assert payload["outboundLinks"]["destinations"][0]["destinationId"] == "tickets"
    assert any(row["feature"] == "schedule" and row["percentage"] == 100.0 for row in payload["featureAdoption"])
    assert "vendorOpened" not in json.dumps(payload) and "queenEntry" not in json.dumps(payload)
    assert "url" not in json.dumps(payload).lower()


def test_empty_database_returns_stable_zero_aggregate_shapes():
    repository = MemoryReportingRepository()
    summary = asyncio.run(summary_report(repository, "30d", NOW))["overview"]
    content = asyncio.run(content_report(repository, "all", NOW))["content"]
    traffic = asyncio.run(traffic_report(repository, "7d", NOW))["traffic"]
    assert summary["uniqueVisitors"] == summary["sessions"] == summary["launches"] == 0
    assert summary["averageSessionDurationSeconds"] is None
    assert content["map"]["opens"] == 0 and content["pages"] == []
    assert len(traffic["todayByHour"]) == 24 and not any(row["sessions"] for row in traffic["todayByHour"])


def test_event_scope_isolation_and_no_identifiers_leak_from_any_report():
    repository = fixture_repository()
    payloads = [
        asyncio.run(summary_report(repository, "all", NOW)),
        asyncio.run(traffic_report(repository, "all", NOW)),
        asyncio.run(content_report(repository, "all", NOW)),
    ]
    encoded = json.dumps(payloads, default=str)
    assert "visitor-a" not in encoded and "visitor-x" not in encoded and "session-" not in encoded


class NoSessionCollection:
    async def find_one(self, _query): return None


class AuthDatabase:
    organizer_sessions = NoSessionCollection()


def test_reporting_endpoints_require_authentication(monkeypatch):
    monkeypatch.setattr(server, "db", AuthDatabase())
    async def verify():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="http://test") as client:
            for path in ("summary", "live", "traffic", "content"):
                response = await client.get(f"/api/admin/analytics/{path}")
                assert response.status_code == 401
    asyncio.run(verify())


def test_authenticated_endpoints_validate_range_and_event_scope(monkeypatch):
    repository = fixture_repository()
    monkeypatch.setattr(server, "analytics_reporting_repository", repository)
    async def ipm_user(): return {"event_id": ANALYTICS_EVENT_SCOPE}
    async def other_user(): return {"event_id": "another-event"}
    server.app.dependency_overrides[server.get_current_organizer_user] = ipm_user
    async def verify():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="http://test") as client:
            response = await client.get("/api/admin/analytics/summary?range=unknown")
            assert response.status_code == 400
            response = await client.get("/api/admin/analytics/content?range=today")
            assert response.status_code == 200
            assert "visitorId" not in response.text and "sessionId" not in response.text
        server.app.dependency_overrides[server.get_current_organizer_user] = other_user
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="http://test") as client:
            assert (await client.get("/api/admin/analytics/live")).status_code == 403
    try: asyncio.run(verify())
    finally: server.app.dependency_overrides.clear()
