"""Authenticated, aggregate-only reporting for IPM attendee analytics."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import UTC, date, datetime, time, timedelta
from typing import Any, Iterable, Optional, Protocol

try:
    from backend.analytics import (
        ANALYTICS_EVENT_SCOPE, ANALYTICS_SESSION_TIMEOUT,
        ANALYTICS_TIMEZONE, ANALYTICS_ZONE,
    )
except ModuleNotFoundError:
    from analytics import (
        ANALYTICS_EVENT_SCOPE, ANALYTICS_SESSION_TIMEOUT,
        ANALYTICS_TIMEZONE, ANALYTICS_ZONE,
    )


RANGE_DAYS = {"today": 1, "7d": 7, "30d": 30, "all": None}
HOURLY_LABELS = tuple(f"{hour:02d}:00" for hour in range(24))
FEATURE_EVENTS = {
    "schedule": {"schedule_viewed", "schedule_event_opened", "schedule_filter_used", "schedule_search_used", "favorite_changed"},
    "map": {"map_opened"},
    "vendors": {"vendor_directory_opened", "vendor_search_used", "vendor_filter_used"},
    "queen_of_the_furrow": {"queen_archive_opened"},
    "announcements": {"announcement_list_viewed", "announcement_impression", "announcement_opened"},
}


class AnalyticsRangeError(ValueError):
    pass


class AnalyticsReportingRepository(Protocol):
    async def fetch_visitors(self, event_scope: str) -> list[dict[str, Any]]: ...
    async def fetch_sessions(self, event_scope: str, start: Optional[datetime], end: datetime) -> list[dict[str, Any]]: ...
    async def fetch_events(self, event_scope: str, start: Optional[datetime], end: datetime, event_names: Optional[set[str]] = None) -> list[dict[str, Any]]: ...
    async def fetch_rollups(self, event_scope: str, first_date: Optional[str], last_date: str) -> list[dict[str, Any]]: ...
    async def fetch_recent_events(self, event_scope: str, cutoff: datetime, now: datetime) -> list[dict[str, Any]]: ...
    async def fetch_active_sessions(self, event_scope: str, cutoff: datetime, now: datetime) -> list[dict[str, Any]]: ...


class MongoAnalyticsReportingRepository:
    """Indexed reads split by refresh cadence; no endpoint returns raw records."""

    def __init__(self, database: Any):
        self.db = database

    async def fetch_visitors(self, event_scope: str) -> list[dict[str, Any]]:
        return await self.db.analytics_visitors.find(
            {"eventScope": event_scope},
            {"_id": 0, "visitorId": 1, "firstSeenAt": 1, "lastSeenAt": 1, "visitCount": 1},
        ).to_list(length=None)

    async def fetch_sessions(self, event_scope: str, start: Optional[datetime], end: datetime) -> list[dict[str, Any]]:
        match: dict[str, Any] = {"eventScope": event_scope, "startedAt": {"$lt": end}}
        if start is not None:
            match["startedAt"]["$gte"] = start
        return await self.db.analytics_sessions.find(match, {
            "_id": 0, "visitorId": 1, "startedAt": 1, "lastActivityAt": 1,
            "endedAt": 1, "durationSeconds": 1, "status": 1,
        }).to_list(length=None)

    async def fetch_events(self, event_scope: str, start: Optional[datetime], end: datetime, event_names: Optional[set[str]] = None) -> list[dict[str, Any]]:
        match: dict[str, Any] = {"eventScope": event_scope, "receivedAt": {"$lt": end}}
        if start is not None:
            match["receivedAt"]["$gte"] = start
        if event_names:
            match["eventName"] = {"$in": sorted(event_names)}
        return await self.db.analytics_events.find(match, {
            "_id": 0, "visitorId": 1, "eventName": 1, "properties": 1,
            "receivedAt": 1, "localDate": 1, "localHour": 1,
        }).to_list(length=None)

    async def fetch_rollups(self, event_scope: str, first_date: Optional[str], last_date: str) -> list[dict[str, Any]]:
        match: dict[str, Any] = {"eventScope": event_scope, "localDate": {"$lte": last_date}}
        if first_date is not None:
            match["localDate"]["$gte"] = first_date
        return await self.db.analytics_daily_rollups.find(match, {"_id": 0}).to_list(length=None)

    async def fetch_recent_events(self, event_scope: str, cutoff: datetime, now: datetime) -> list[dict[str, Any]]:
        return await self.db.analytics_events.find(
            {"eventScope": event_scope, "receivedAt": {"$gte": cutoff, "$lte": now}},
            {"_id": 0, "eventName": 1, "properties.page_id": 1, "receivedAt": 1},
        ).to_list(length=None)

    async def fetch_active_sessions(self, event_scope: str, cutoff: datetime, now: datetime) -> list[dict[str, Any]]:
        return await self.db.analytics_sessions.find(
            {"eventScope": event_scope, "lastActivityAt": {"$gte": cutoff, "$lte": now}, "status": "active"},
            {"_id": 0, "lastActivityAt": 1},
        ).to_list(length=None)


def normalize_now(value: Optional[datetime] = None) -> datetime:
    current = value or datetime.now(UTC)
    return current.replace(tzinfo=UTC) if current.tzinfo is None else current.astimezone(UTC)


def reporting_bounds(range_name: str, now: Optional[datetime] = None) -> tuple[Optional[datetime], datetime, date, date]:
    if range_name not in RANGE_DAYS:
        raise AnalyticsRangeError("range must be one of: today, 7d, 30d, all")
    current = normalize_now(now)
    local_now = current.astimezone(ANALYTICS_ZONE)
    last_date = local_now.date()
    days = RANGE_DAYS[range_name]
    first_date = last_date if days == 1 else (last_date - timedelta(days=days - 1) if days else date.min)
    start = None if days is None else datetime.combine(first_date, time.min, ANALYTICS_ZONE).astimezone(UTC)
    next_day = datetime.combine(last_date + timedelta(days=1), time.min, ANALYTICS_ZONE).astimezone(UTC)
    return start, min(next_day, current + timedelta(microseconds=1)), first_date, last_date


def zero_filled_hours(counts: dict[str, int]) -> list[dict[str, Any]]:
    return [{"hour": label, "sessions": int(counts.get(label, 0))} for label in HOURLY_LABELS]


def _rank(counter: Counter, total: int, *, label_key: str = "id", extra: Optional[dict[Any, dict[str, Any]]] = None) -> list[dict[str, Any]]:
    rows = []
    for label, count in sorted(counter.items(), key=lambda item: (-item[1], str(item[0]))):
        if label in (None, ""):
            continue
        row = {label_key: label, "count": int(count), "share": round((count / total * 100), 2) if total else 0.0}
        if extra and label in extra:
            row.update(extra[label])
        rows.append(row)
    return rows


def _events_named(events: Iterable[dict[str, Any]], name: str) -> list[dict[str, Any]]:
    return [event for event in events if event.get("eventName") == name]


def build_summary(visitors: list[dict[str, Any]], sessions: list[dict[str, Any]], events: list[dict[str, Any]], start: Optional[datetime], end: datetime) -> dict[str, Any]:
    active_visitor_ids = {session.get("visitorId") for session in sessions if session.get("visitorId")}
    visitor_by_id = {visitor.get("visitorId"): visitor for visitor in visitors}
    if start is None:
        new_visitors = sum(1 for visitor_id in active_visitor_ids if visitor_by_id.get(visitor_id, {}).get("visitCount", 0) <= 1)
        returning_visitors = sum(1 for visitor_id in active_visitor_ids if visitor_by_id.get(visitor_id, {}).get("visitCount", 0) > 1)
    else:
        new_visitors = sum(1 for visitor_id in active_visitor_ids if start <= visitor_by_id.get(visitor_id, {}).get("firstSeenAt", end) < end)
        returning_visitors = sum(1 for visitor_id in active_visitor_ids if visitor_by_id.get(visitor_id, {}).get("firstSeenAt", end) < start)
    launches = _events_named(events, "app_launched")
    installed = {event.get("visitorId") for event in launches if event.get("properties", {}).get("launch_mode") in {"installed_pwa", "native"}}
    browser = {event.get("visitorId") for event in launches if event.get("properties", {}).get("launch_mode") == "browser"} - installed
    durations = []
    for session in sessions:
        value = session.get("durationSeconds")
        if isinstance(value, (int, float)) and value >= 0:
            durations.append(float(value))
    return {
        "uniqueVisitors": len(active_visitor_ids), "newVisitors": new_visitors,
        "returningVisitors": returning_visitors, "sessions": len(sessions),
        "launches": len(launches), "pageViews": len(_events_named(events, "page_viewed")),
        "installedPwaVisitors": len(installed), "browserOnlyVisitors": len(browser),
        "averageSessionDurationSeconds": round(sum(durations) / len(durations), 2) if durations else None,
        "sessionDurationSampleSize": len(durations),
    }


def build_live(events: list[dict[str, Any]], active_sessions: list[dict[str, Any]], now: datetime) -> dict[str, Any]:
    one = now - timedelta(minutes=1)
    five = now - timedelta(minutes=5)
    recent_pages = Counter(
        event.get("properties", {}).get("page_id") for event in events
        if event.get("eventName") == "page_viewed" and event.get("receivedAt") and event["receivedAt"] >= five
    )
    latest = max((event.get("receivedAt") for event in events if event.get("receivedAt")), default=None)
    return {
        "activeSessions": len(active_sessions),
        "activityLastMinute": sum(1 for event in events if event.get("receivedAt") and event["receivedAt"] >= one),
        "activityLastFiveMinutes": sum(1 for event in events if event.get("receivedAt") and event["receivedAt"] >= five),
        "mostRecentActivityAt": latest,
        "topActivePages": _rank(recent_pages, sum(recent_pages.values()), label_key="pageId")[:5],
        "activityWindowMinutes": 30,
    }


def build_traffic(rollups: list[dict[str, Any]], events: list[dict[str, Any]], first_date: date, last_date: date) -> dict[str, Any]:
    sessions_by_day: Counter = Counter()
    page_views_by_day: Counter = Counter()
    launches_by_day: Counter = Counter()
    today_hours: Counter = Counter()
    for row in rollups:
        day, name, count = row.get("localDate"), row.get("eventName"), int(row.get("count", 0))
        if name == "session_started":
            sessions_by_day[day] += count
            if day == last_date.isoformat():
                today_hours[row.get("localHour")] += count
        elif name == "page_viewed": page_views_by_day[day] += count
        elif name == "app_launched": launches_by_day[day] += count
    visitor_days: dict[str, set[str]] = defaultdict(set)
    for event in events:
        if event.get("visitorId") and event.get("localDate"):
            visitor_days[event["localDate"]].add(event["visitorId"])
    if first_date == date.min:
        days = sorted(set(sessions_by_day) | set(page_views_by_day) | set(launches_by_day) | set(visitor_days))
    else:
        days = [(first_date + timedelta(days=offset)).isoformat() for offset in range((last_date - first_date).days + 1)]
    return {
        "byDay": [{"date": day, "visitors": len(visitor_days[day]), "sessions": sessions_by_day[day], "launches": launches_by_day[day], "pageViews": page_views_by_day[day]} for day in days],
        "todayByHour": zero_filled_hours(today_hours),
        "selectedRange": {"firstLocalDate": None if first_date == date.min else first_date.isoformat(), "lastLocalDate": last_date.isoformat(), "timezone": ANALYTICS_TIMEZONE},
    }


def build_content(events: list[dict[str, Any]]) -> dict[str, Any]:
    page_events = _events_named(events, "page_viewed")
    page_counts = Counter(event.get("properties", {}).get("page_id") for event in page_events)
    page_visitors: dict[str, set[str]] = defaultdict(set)
    for event in page_events:
        if event.get("properties", {}).get("page_id") and event.get("visitorId"):
            page_visitors[event["properties"]["page_id"]].add(event["visitorId"])
    pages = _rank(page_counts, len(page_events), label_key="pageId", extra={key: {"uniqueVisitors": len(value)} for key, value in page_visitors.items()})

    def count(name: str) -> int: return len(_events_named(events, name))
    def prop_rank(name: str, prop: str, label: str = "id") -> list[dict[str, Any]]:
        rows = _events_named(events, name); counter = Counter(row.get("properties", {}).get(prop) for row in rows)
        return _rank(counter, len(rows), label_key=label)

    schedule_opened = _events_named(events, "schedule_event_opened")
    schedule_ids = Counter(row.get("properties", {}).get("schedule_item_id") for row in schedule_opened)
    schedule_categories = {key: {"category": next((row.get("properties", {}).get("category") for row in schedule_opened if row.get("properties", {}).get("schedule_item_id") == key), None)} for key in schedule_ids}
    schedule_searches = _events_named(events, "schedule_search_used")
    vendor_searches = _events_named(events, "vendor_search_used")
    map_events = _events_named(events, "map_opened")
    map_sources = Counter((row.get("properties", {}).get("source") or "other") for row in map_events)
    map_source_normalized = Counter()
    for source, value in map_sources.items():
        map_source_normalized[{"bottom_nav": "bottom_navigation", "home_quick_action": "home_quick_action", "schedule": "schedule"}.get(source, "other")] += value
    queen_events = _events_named(events, "queen_archive_opened")
    announcements_impressions = _events_named(events, "announcement_impression")
    announcements_opens = _events_named(events, "announcement_opened")
    announcement_ids = set(row.get("properties", {}).get("announcement_id") for row in announcements_impressions + announcements_opens)
    announcement_rows = []
    for announcement_id in sorted(value for value in announcement_ids if value):
        impressions = sum(row.get("properties", {}).get("announcement_id") == announcement_id for row in announcements_impressions)
        opens = sum(row.get("properties", {}).get("announcement_id") == announcement_id for row in announcements_opens)
        announcement_rows.append({"announcementId": announcement_id, "impressions": impressions, "opens": opens, "openImpressionRate": round(opens / impressions * 100, 2) if impressions else None})
    announcement_rows.sort(key=lambda row: (-row["opens"], -row["impressions"], row["announcementId"]))
    quick = _events_named(events, "home_quick_action_clicked")
    outbound = _events_named(events, "outbound_link_clicked")
    outbound_types = {
        row.get("properties", {}).get("destination_id"): {
            "destinationType": row.get("properties", {}).get("destination_type")
        }
        for row in outbound if row.get("properties", {}).get("destination_id")
    }
    all_visitors = {row.get("visitorId") for row in events if row.get("visitorId")}
    adoption = []
    for feature, names in FEATURE_EVENTS.items():
        used = {row.get("visitorId") for row in events if row.get("eventName") in names and row.get("visitorId")}
        adoption.append({"feature": feature, "visitors": len(used), "percentage": round(len(used) / len(all_visitors) * 100, 2) if all_visitors else 0.0})
    event_days: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in events:
        if row.get("localDate"): event_days[row["localDate"]].append(row)
    comparisons = []
    for day, rows in sorted(event_days.items()):
        comparisons.append({
            "date": day, "visitors": len({row.get("visitorId") for row in rows if row.get("visitorId")}),
            "sessions": count_in(rows, "session_started"), "pageViews": count_in(rows, "page_viewed"),
            "scheduleUsage": sum(row.get("eventName") in FEATURE_EVENTS["schedule"] for row in rows),
            "vendorUsage": sum(row.get("eventName") in FEATURE_EVENTS["vendors"] for row in rows),
            "mapUsage": count_in(rows, "map_opened"),
        })
    return {
        "pages": pages,
        "schedule": {"opens": count("schedule_viewed"), "eventOpens": len(schedule_opened), "mostOpenedEvents": _rank(schedule_ids, len(schedule_opened), label_key="scheduleItemId", extra=schedule_categories), "filters": prop_rank("schedule_filter_used", "filter_value", "filterValue"), "searches": len(schedule_searches), "zeroResultSearches": sum(bool(row.get("properties", {}).get("zero_results")) for row in schedule_searches), "favoritesAdded": sum(row.get("properties", {}).get("action") == "added" for row in _events_named(events, "favorite_changed")), "favoritesRemoved": sum(row.get("properties", {}).get("action") == "removed" for row in _events_named(events, "favorite_changed")), "mapActions": map_source_normalized["schedule"]},
        "vendors": {"directoryOpens": count("vendor_directory_opened"), "searches": len(vendor_searches), "zeroResultSearches": sum(bool(row.get("properties", {}).get("zero_results")) for row in vendor_searches), "filters": prop_rank("vendor_filter_used", "filter_value", "filterValue")},
        "map": {"opens": len(map_events), "sources": [{"source": source, "count": map_source_normalized[source]} for source in ("bottom_navigation", "home_quick_action", "schedule", "other")], "locations": prop_rank("map_opened", "location_id", "locationId")},
        "queenOfTheFurrow": {"archiveOpens": len(queen_events), "uniqueArchiveVisitors": len({row.get("visitorId") for row in queen_events if row.get("visitorId")})},
        "announcements": {"listViews": count("announcement_list_viewed"), "impressions": len(announcements_impressions), "opens": len(announcements_opens), "openSources": prop_rank("announcement_opened", "source", "source"), "ranking": announcement_rows},
        "quickActions": {"clicks": len(quick), "actions": prop_rank("home_quick_action_clicked", "action_id", "actionId"), "sources": prop_rank("home_quick_action_clicked", "source", "source"), "destinationTypes": prop_rank("home_quick_action_clicked", "destination_type", "destinationType")},
        "outboundLinks": {"clicks": len(outbound), "destinations": _rank(Counter(row.get("properties", {}).get("destination_id") for row in outbound), len(outbound), label_key="destinationId", extra=outbound_types), "destinationTypes": prop_rank("outbound_link_clicked", "destination_type", "destinationType")},
        "featureAdoption": adoption, "eventDayComparisons": comparisons,
    }


def count_in(events: Iterable[dict[str, Any]], event_name: str) -> int:
    return sum(event.get("eventName") == event_name for event in events)


async def summary_report(repository: AnalyticsReportingRepository, range_name: str, now: Optional[datetime] = None) -> dict[str, Any]:
    current = normalize_now(now); start, end, _, _ = reporting_bounds(range_name, current)
    visitors = await repository.fetch_visitors(ANALYTICS_EVENT_SCOPE)
    sessions = await repository.fetch_sessions(ANALYTICS_EVENT_SCOPE, start, end)
    events = await repository.fetch_events(ANALYTICS_EVENT_SCOPE, start, end, {"app_launched", "page_viewed"})
    return {"range": range_name, "timezone": ANALYTICS_TIMEZONE, "overview": build_summary(visitors, sessions, events, start, end)}


async def live_report(repository: AnalyticsReportingRepository, now: Optional[datetime] = None) -> dict[str, Any]:
    current = normalize_now(now); cutoff = current - ANALYTICS_SESSION_TIMEOUT
    events = await repository.fetch_recent_events(ANALYTICS_EVENT_SCOPE, cutoff, current)
    sessions = await repository.fetch_active_sessions(ANALYTICS_EVENT_SCOPE, cutoff, current)
    return {"timezone": ANALYTICS_TIMEZONE, "live": build_live(events, sessions, current)}


async def traffic_report(repository: AnalyticsReportingRepository, range_name: str, now: Optional[datetime] = None) -> dict[str, Any]:
    current = normalize_now(now); start, end, first, last = reporting_bounds(range_name, current)
    rollups = await repository.fetch_rollups(ANALYTICS_EVENT_SCOPE, None if first == date.min else first.isoformat(), last.isoformat())
    events = await repository.fetch_events(ANALYTICS_EVENT_SCOPE, start, end, {"session_started"})
    return {"range": range_name, "timezone": ANALYTICS_TIMEZONE, "traffic": build_traffic(rollups, events, first, last)}


async def content_report(repository: AnalyticsReportingRepository, range_name: str, now: Optional[datetime] = None) -> dict[str, Any]:
    current = normalize_now(now); start, end, _, _ = reporting_bounds(range_name, current)
    events = await repository.fetch_events(ANALYTICS_EVENT_SCOPE, start, end)
    return {"range": range_name, "timezone": ANALYTICS_TIMEZONE, "content": build_content(events)}
