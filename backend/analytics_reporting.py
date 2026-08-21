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
MAX_RANKING_ROWS = 25
MAX_DAILY_ROWS = 1000
MONGO_REPORT_MAX_TIME_MS = 20_000


class AnalyticsRangeError(ValueError):
    pass


class AnalyticsReportingRepository(Protocol):
    async def fetch_collection_started_at(self, event_scope: str) -> Optional[datetime]: ...
    async def aggregate_summary(self, event_scope: str, start: Optional[datetime], end: datetime) -> dict[str, Any]: ...
    async def aggregate_traffic(self, event_scope: str, start: Optional[datetime], end: datetime, first_date: Optional[str], last_date: str) -> dict[str, Any]: ...
    async def aggregate_content(self, event_scope: str, start: Optional[datetime], end: datetime) -> dict[str, Any]: ...
    async def aggregate_live(self, event_scope: str, cutoff: datetime, now: datetime) -> dict[str, Any]: ...


class MongoAnalyticsReportingRepository:
    """Indexed reads split by refresh cadence; no endpoint returns raw records."""

    def __init__(self, database: Any):
        self.db = database

    async def fetch_collection_started_at(self, event_scope: str) -> Optional[datetime]:
        metadata = await self.db.analytics_metadata.find_one(
            {"_id": f"collection-start:{event_scope}", "eventScope": event_scope},
            {"_id": 0, "collectionStartedAt": 1},
        )
        return metadata.get("collectionStartedAt") if metadata else None

    @staticmethod
    def _time_match(field: str, event_scope: str, start: Optional[datetime], end: datetime) -> dict[str, Any]:
        match: dict[str, Any] = {"eventScope": event_scope, field: {"$lt": end}}
        if start is not None:
            match[field]["$gte"] = start
        return match

    async def _one(self, collection: Any, pipeline: list[dict[str, Any]]) -> dict[str, Any]:
        rows = await collection.aggregate(
            pipeline, allowDiskUse=True, maxTimeMS=MONGO_REPORT_MAX_TIME_MS,
        ).to_list(length=1)
        return rows[0] if rows else {}

    async def aggregate_summary(self, event_scope: str, start: Optional[datetime], end: datetime) -> dict[str, Any]:
        session_match = self._time_match("startedAt", event_scope, start, end)
        visitor_condition = (
            {"$lte": [{"$ifNull": [{"$arrayElemAt": ["$visitor.visitCount", 0]}, 0]}, 1]}
            if start is None else
            {"$and": [
                {"$gte": [{"$arrayElemAt": ["$visitor.firstSeenAt", 0]}, start]},
                {"$lt": [{"$arrayElemAt": ["$visitor.firstSeenAt", 0]}, end]},
            ]}
        )
        returning_condition = (
            {"$gt": [{"$ifNull": [{"$arrayElemAt": ["$visitor.visitCount", 0]}, 0]}, 1]}
            if start is None else {"$lt": [{"$arrayElemAt": ["$visitor.firstSeenAt", 0]}, start]}
        )
        sessions = await self._one(self.db.analytics_sessions, [
            {"$match": session_match},
            {"$group": {
                "_id": "$visitorId", "sessions": {"$sum": 1},
                "durationSum": {"$sum": {"$cond": [{"$and": [{"$isNumber": "$durationSeconds"}, {"$gte": ["$durationSeconds", 0]}]}, "$durationSeconds", 0]}},
                "durationCount": {"$sum": {"$cond": [{"$and": [{"$isNumber": "$durationSeconds"}, {"$gte": ["$durationSeconds", 0]}]}, 1, 0]}},
            }},
            {"$lookup": {"from": "analytics_visitors", "let": {"visitorId": "$_id"}, "pipeline": [
                {"$match": {"$expr": {"$and": [{"$eq": ["$eventScope", event_scope]}, {"$eq": ["$visitorId", "$$visitorId"]}]}}},
                {"$project": {"_id": 0, "firstSeenAt": 1, "visitCount": 1}}, {"$limit": 1},
            ], "as": "visitor"}},
            {"$group": {"_id": None, "uniqueVisitors": {"$sum": 1}, "sessions": {"$sum": "$sessions"},
                "durationSum": {"$sum": "$durationSum"}, "durationCount": {"$sum": "$durationCount"},
                "newVisitors": {"$sum": {"$cond": [visitor_condition, 1, 0]}},
                "returningVisitors": {"$sum": {"$cond": [returning_condition, 1, 0]}},
            }}, {"$project": {"_id": 0}},
        ])
        event_match = self._time_match("receivedAt", event_scope, start, end)
        event_match["eventName"] = {"$in": ["app_launched", "page_viewed"]}
        events = await self._one(self.db.analytics_events, [
            {"$match": event_match},
            {"$group": {"_id": "$visitorId",
                "launches": {"$sum": {"$cond": [{"$eq": ["$eventName", "app_launched"]}, 1, 0]}},
                "pageViews": {"$sum": {"$cond": [{"$eq": ["$eventName", "page_viewed"]}, 1, 0]}},
                "installed": {"$max": {"$cond": [{"$and": [{"$eq": ["$eventName", "app_launched"]}, {"$in": ["$properties.launch_mode", ["installed_pwa", "native"]]}]}, 1, 0]}},
                "browser": {"$max": {"$cond": [{"$and": [{"$eq": ["$eventName", "app_launched"]}, {"$eq": ["$properties.launch_mode", "browser"]}]}, 1, 0]}},
            }},
            {"$group": {"_id": None, "launches": {"$sum": "$launches"}, "pageViews": {"$sum": "$pageViews"},
                "installedPwaVisitors": {"$sum": "$installed"},
                "browserOnlyVisitors": {"$sum": {"$cond": [{"$and": [{"$eq": ["$browser", 1]}, {"$eq": ["$installed", 0]}]}, 1, 0]}},
            }}, {"$project": {"_id": 0}},
        ])
        duration_count = int(sessions.get("durationCount", 0))
        return {
            "uniqueVisitors": int(sessions.get("uniqueVisitors", 0)), "newVisitors": int(sessions.get("newVisitors", 0)),
            "returningVisitors": int(sessions.get("returningVisitors", 0)), "sessions": int(sessions.get("sessions", 0)),
            "launches": int(events.get("launches", 0)), "pageViews": int(events.get("pageViews", 0)),
            "installedPwaVisitors": int(events.get("installedPwaVisitors", 0)), "browserOnlyVisitors": int(events.get("browserOnlyVisitors", 0)),
            "averageSessionDurationSeconds": round(float(sessions.get("durationSum", 0)) / duration_count, 2) if duration_count else None,
            "sessionDurationSampleSize": duration_count,
        }

    async def aggregate_traffic(self, event_scope: str, start: Optional[datetime], end: datetime, first_date: Optional[str], last_date: str) -> dict[str, Any]:
        rollup_match: dict[str, Any] = {"eventScope": event_scope, "localDate": {"$lte": last_date}, "eventName": {"$in": ["session_started", "page_viewed", "app_launched"]}}
        if first_date is not None:
            rollup_match["localDate"]["$gte"] = first_date
        rollups = await self._one(self.db.analytics_daily_rollups, [
            {"$match": rollup_match},
            {"$facet": {
                "days": [{"$group": {"_id": {"date": "$localDate", "name": "$eventName"}, "count": {"$sum": "$count"}}}, {"$sort": {"_id.date": -1}}, {"$limit": MAX_DAILY_ROWS * 3}],
                "hours": [{"$match": {"localDate": last_date, "eventName": "session_started"}}, {"$group": {"_id": "$localHour", "count": {"$sum": "$count"}}}],
            }},
        ])
        event_match = self._time_match("receivedAt", event_scope, start, end)
        event_match["eventName"] = "session_started"
        visitors = await self._one(self.db.analytics_events, [
            {"$match": event_match}, {"$match": {"visitorId": {"$nin": [None, ""]}, "localDate": {"$nin": [None, ""]}}},
            {"$group": {"_id": {"date": "$localDate", "visitor": "$visitorId"}}},
            {"$group": {"_id": "$_id.date", "count": {"$sum": 1}}}, {"$sort": {"_id": -1}}, {"$limit": MAX_DAILY_ROWS},
            {"$group": {"_id": None, "rows": {"$push": {"date": "$_id", "count": "$count"}}}}, {"$project": {"_id": 0}},
        ])
        return build_traffic_from_aggregates(rollups.get("days", []), rollups.get("hours", []), visitors.get("rows", []), first_date, last_date)

    async def aggregate_live(self, event_scope: str, cutoff: datetime, now: datetime) -> dict[str, Any]:
        five = now - timedelta(minutes=5)
        one = now - timedelta(minutes=1)
        events = await self._one(self.db.analytics_events, [
            {"$match": {"eventScope": event_scope, "receivedAt": {"$gte": cutoff, "$lte": now}}},
            {"$facet": {
                "totals": [{"$group": {"_id": None,
                    "activityLastMinute": {"$sum": {"$cond": [{"$gte": ["$receivedAt", one]}, 1, 0]}},
                    "activityLastFiveMinutes": {"$sum": {"$cond": [{"$gte": ["$receivedAt", five]}, 1, 0]}},
                    "mostRecentActivityAt": {"$max": "$receivedAt"}}}, {"$project": {"_id": 0}}],
                "pageTotal": [{"$match": {"eventName": "page_viewed", "receivedAt": {"$gte": five}}}, {"$count": "count"}],
                "pages": [{"$match": {"eventName": "page_viewed", "receivedAt": {"$gte": five}, "properties.page_id": {"$nin": [None, ""]}}},
                    {"$group": {"_id": "$properties.page_id", "count": {"$sum": 1}}}, {"$sort": {"count": -1, "_id": 1}}, {"$limit": 5}],
            }},
        ])
        active = await self._one(self.db.analytics_sessions, [
            {"$match": {"eventScope": event_scope, "status": "active", "lastActivityAt": {"$gte": cutoff, "$lte": now}}}, {"$count": "count"},
        ])
        totals = (events.get("totals") or [{}])[0]
        page_total = int(((events.get("pageTotal") or [{}])[0]).get("count", 0))
        return {
            "activeSessions": int(active.get("count", 0)), "activityLastMinute": int(totals.get("activityLastMinute", 0)),
            "activityLastFiveMinutes": int(totals.get("activityLastFiveMinutes", 0)), "mostRecentActivityAt": totals.get("mostRecentActivityAt"),
            "topActivePages": [{"pageId": row["_id"], "count": int(row["count"]), "share": round(row["count"] / page_total * 100, 2) if page_total else 0.0} for row in events.get("pages", [])],
            "activityWindowMinutes": 30,
        }

    async def aggregate_content(self, event_scope: str, start: Optional[datetime], end: datetime) -> dict[str, Any]:
        match = self._time_match("receivedAt", event_scope, start, end)
        facets: dict[str, list[dict[str, Any]]] = {
            "eventCounts": [{"$group": {"_id": "$eventName", "count": {"$sum": 1}}}],
            "allVisitors": [{"$match": {"visitorId": {"$nin": [None, ""]}}}, {"$group": {"_id": "$visitorId"}}, {"$count": "count"}],
            "pages": self._ranking_facet("page_viewed", "$properties.page_id"),
            "pageVisitors": [{"$match": {"eventName": "page_viewed", "properties.page_id": {"$nin": [None, ""]}, "visitorId": {"$nin": [None, ""]}}}, {"$group": {"_id": {"page": "$properties.page_id", "visitor": "$visitorId"}}}, {"$group": {"_id": "$_id.page", "count": {"$sum": 1}}}],
            "scheduleItems": self._ranking_facet("schedule_event_opened", "$properties.schedule_item_id", extra={"category": {"$first": "$properties.category"}}),
            "scheduleFilters": self._ranking_facet("schedule_filter_used", "$properties.filter_value"),
            "vendorFilters": self._ranking_facet("vendor_filter_used", "$properties.filter_value"),
            "mapLocations": self._ranking_facet("map_opened", "$properties.location_id"),
            "announcementSources": self._ranking_facet("announcement_opened", "$properties.source"),
            "quickActions": self._ranking_facet("home_quick_action_clicked", "$properties.action_id"),
            "quickSources": self._ranking_facet("home_quick_action_clicked", "$properties.source"),
            "quickTypes": self._ranking_facet("home_quick_action_clicked", "$properties.destination_type"),
            "outboundDestinations": self._ranking_facet("outbound_link_clicked", "$properties.destination_id", extra={"destinationType": {"$last": "$properties.destination_type"}}),
            "outboundTypes": self._ranking_facet("outbound_link_clicked", "$properties.destination_type"),
            "announcements": [{"$match": {"eventName": {"$in": ["announcement_impression", "announcement_opened"]}, "properties.announcement_id": {"$nin": [None, ""]}}},
                {"$group": {"_id": "$properties.announcement_id", "impressions": {"$sum": {"$cond": [{"$eq": ["$eventName", "announcement_impression"]}, 1, 0]}}, "opens": {"$sum": {"$cond": [{"$eq": ["$eventName", "announcement_opened"]}, 1, 0]}}}},
                {"$sort": {"opens": -1, "impressions": -1, "_id": 1}}, {"$limit": MAX_RANKING_ROWS}],
            "dayCounts": [{"$match": {"localDate": {"$nin": [None, ""]}}}, {"$group": {"_id": "$localDate", "sessions": {"$sum": {"$cond": [{"$eq": ["$eventName", "session_started"]}, 1, 0]}}, "pageViews": {"$sum": {"$cond": [{"$eq": ["$eventName", "page_viewed"]}, 1, 0]}}, "scheduleUsage": {"$sum": {"$cond": [{"$in": ["$eventName", sorted(FEATURE_EVENTS["schedule"])]}, 1, 0]}}, "vendorUsage": {"$sum": {"$cond": [{"$in": ["$eventName", sorted(FEATURE_EVENTS["vendors"])]}, 1, 0]}}, "mapUsage": {"$sum": {"$cond": [{"$eq": ["$eventName", "map_opened"]}, 1, 0]}}}}, {"$sort": {"_id": -1}}, {"$limit": MAX_DAILY_ROWS}],
            "dayVisitors": [{"$match": {"localDate": {"$nin": [None, ""]}, "visitorId": {"$nin": [None, ""]}}}, {"$group": {"_id": {"date": "$localDate", "visitor": "$visitorId"}}}, {"$group": {"_id": "$_id.date", "count": {"$sum": 1}}}, {"$sort": {"_id": -1}}, {"$limit": MAX_DAILY_ROWS}],
            "mapSources": [{"$match": {"eventName": "map_opened"}}, {"$project": {"source": {"$switch": {"branches": [{"case": {"$eq": ["$properties.source", "bottom_nav"]}, "then": "bottom_navigation"}, {"case": {"$eq": ["$properties.source", "home_quick_action"]}, "then": "home_quick_action"}, {"case": {"$eq": ["$properties.source", "schedule"]}, "then": "schedule"}], "default": "other"}}}}, {"$group": {"_id": "$source", "count": {"$sum": 1}}}],
            "propertyCounts": [{"$group": {"_id": None,
                "scheduleZero": {"$sum": {"$cond": [{"$and": [{"$eq": ["$eventName", "schedule_search_used"]}, {"$eq": ["$properties.zero_results", True]}]}, 1, 0]}},
                "vendorZero": {"$sum": {"$cond": [{"$and": [{"$eq": ["$eventName", "vendor_search_used"]}, {"$eq": ["$properties.zero_results", True]}]}, 1, 0]}},
                "favoritesAdded": {"$sum": {"$cond": [{"$and": [{"$eq": ["$eventName", "favorite_changed"]}, {"$eq": ["$properties.action", "added"]}]}, 1, 0]}},
                "favoritesRemoved": {"$sum": {"$cond": [{"$and": [{"$eq": ["$eventName", "favorite_changed"]}, {"$eq": ["$properties.action", "removed"]}]}, 1, 0]}},
            }}],
        }
        for feature, names in FEATURE_EVENTS.items():
            facets[f"adoption_{feature}"] = [{"$match": {"eventName": {"$in": sorted(names)}, "visitorId": {"$nin": [None, ""]}}}, {"$group": {"_id": "$visitorId"}}, {"$count": "count"}]
        facets["queenVisitors"] = [{"$match": {"eventName": "queen_archive_opened", "visitorId": {"$nin": [None, ""]}}}, {"$group": {"_id": "$visitorId"}}, {"$count": "count"}]
        aggregate = await self._one(self.db.analytics_events, [{"$match": match}, {"$facet": facets}])
        return build_content_from_aggregates(aggregate)

    @staticmethod
    def _ranking_facet(event_name: str, value: str, *, extra: Optional[dict[str, Any]] = None) -> list[dict[str, Any]]:
        group: dict[str, Any] = {"_id": value, "count": {"$sum": 1}}
        if extra:
            group.update(extra)
        pipeline: list[dict[str, Any]] = [{"$match": {"eventName": event_name}}, {"$group": group}, {"$sort": {"count": -1, "_id": 1}}, {"$limit": MAX_RANKING_ROWS}]
        return pipeline


def normalize_utc_datetime(value: datetime) -> datetime:
    """Interpret MongoDB's timezone-naive BSON datetimes as UTC.

    PyMongo returns UTC BSON datetimes without tzinfo unless configured with
    tz_aware=True. Aware values retain their instant and are converted to UTC.
    """
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def normalize_now(value: Optional[datetime] = None) -> datetime:
    return normalize_utc_datetime(value or datetime.now(UTC))


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
    return rows[:MAX_RANKING_ROWS]


def _events_named(events: Iterable[dict[str, Any]], name: str) -> list[dict[str, Any]]:
    return [event for event in events if event.get("eventName") == name]


def build_summary(visitors: list[dict[str, Any]], sessions: list[dict[str, Any]], events: list[dict[str, Any]], start: Optional[datetime], end: datetime) -> dict[str, Any]:
    normalized_start = normalize_utc_datetime(start) if start is not None else None
    normalized_end = normalize_utc_datetime(end)
    active_visitor_ids = {session.get("visitorId") for session in sessions if session.get("visitorId")}
    visitor_by_id = {visitor.get("visitorId"): visitor for visitor in visitors}
    if start is None:
        new_visitors = sum(1 for visitor_id in active_visitor_ids if visitor_by_id.get(visitor_id, {}).get("visitCount", 0) <= 1)
        returning_visitors = sum(1 for visitor_id in active_visitor_ids if visitor_by_id.get(visitor_id, {}).get("visitCount", 0) > 1)
    else:
        first_seen = {
            visitor_id: normalize_utc_datetime(visitor_by_id.get(visitor_id, {}).get("firstSeenAt", normalized_end))
            for visitor_id in active_visitor_ids
        }
        new_visitors = sum(1 for visitor_id in active_visitor_ids if normalized_start <= first_seen[visitor_id] < normalized_end)
        returning_visitors = sum(1 for visitor_id in active_visitor_ids if first_seen[visitor_id] < normalized_start)
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
    current = normalize_utc_datetime(now)
    one = current - timedelta(minutes=1)
    five = current - timedelta(minutes=5)
    received_at = {
        id(event): normalize_utc_datetime(event["receivedAt"])
        for event in events if isinstance(event.get("receivedAt"), datetime)
    }
    recent_pages = Counter(
        event.get("properties", {}).get("page_id") for event in events
        if event.get("eventName") == "page_viewed" and id(event) in received_at and received_at[id(event)] >= five
    )
    latest = max(received_at.values(), default=None)
    return {
        "activeSessions": len(active_sessions),
        "activityLastMinute": sum(1 for event in events if id(event) in received_at and received_at[id(event)] >= one),
        "activityLastFiveMinutes": sum(1 for event in events if id(event) in received_at and received_at[id(event)] >= five),
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
    announcement_rows = announcement_rows[:MAX_RANKING_ROWS]
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
        "featureAdoption": adoption, "eventDayComparisons": comparisons[-MAX_DAILY_ROWS:],
    }


def count_in(events: Iterable[dict[str, Any]], event_name: str) -> int:
    return sum(event.get("eventName") == event_name for event in events)


def build_traffic_from_aggregates(day_rows: list[dict[str, Any]], hour_rows: list[dict[str, Any]], visitor_rows: list[dict[str, Any]], first_date: Optional[str], last_date: str) -> dict[str, Any]:
    values: dict[str, dict[str, int]] = defaultdict(lambda: {"visitors": 0, "sessions": 0, "launches": 0, "pageViews": 0})
    keys = {"session_started": "sessions", "app_launched": "launches", "page_viewed": "pageViews"}
    for row in day_rows:
        identity = row.get("_id", {})
        day, key = identity.get("date"), keys.get(identity.get("name"))
        if day and key:
            values[day][key] += int(row.get("count", 0))
    for row in visitor_rows:
        if row.get("date"):
            values[row["date"]]["visitors"] = int(row.get("count", 0))
    if first_date is None:
        days = sorted(values)[-MAX_DAILY_ROWS:]
    else:
        first = date.fromisoformat(first_date); last = date.fromisoformat(last_date)
        days = [(first + timedelta(days=offset)).isoformat() for offset in range((last - first).days + 1)]
    hours = {row.get("_id"): int(row.get("count", 0)) for row in hour_rows}
    return {
        "byDay": [{"date": day, **values[day]} for day in days],
        "todayByHour": zero_filled_hours(hours),
        "selectedRange": {"firstLocalDate": first_date, "lastLocalDate": last_date, "timezone": ANALYTICS_TIMEZONE},
    }


def build_content_from_aggregates(data: dict[str, Any]) -> dict[str, Any]:
    counts = {row.get("_id"): int(row.get("count", 0)) for row in data.get("eventCounts", [])}
    count = lambda name: counts.get(name, 0)

    def ranked(name: str, total: int, label: str, extras: tuple[str, ...] = ()) -> list[dict[str, Any]]:
        result = []
        for row in data.get(name, []):
            if row.get("_id") in (None, ""):
                continue
            item = {label: row["_id"], "count": int(row.get("count", 0)), "share": round(row.get("count", 0) / total * 100, 2) if total else 0.0}
            for extra in extras:
                item[extra] = row.get(extra)
            result.append(item)
        return result

    properties = (data.get("propertyCounts") or [{}])[0]
    all_visitors = int((data.get("allVisitors") or [{}])[0].get("count", 0))
    map_sources = {row.get("_id"): int(row.get("count", 0)) for row in data.get("mapSources", [])}
    page_visitors = {row.get("_id"): int(row.get("count", 0)) for row in data.get("pageVisitors", [])}
    for row in data.get("pages", []):
        row["uniqueVisitors"] = page_visitors.get(row.get("_id"), 0)
    adoption = []
    for feature in FEATURE_EVENTS:
        used = int((data.get(f"adoption_{feature}") or [{}])[0].get("count", 0))
        adoption.append({"feature": feature, "visitors": used, "percentage": round(used / all_visitors * 100, 2) if all_visitors else 0.0})
    day_visitors = {row.get("_id"): int(row.get("count", 0)) for row in data.get("dayVisitors", [])}
    comparisons = [{
        "date": row["_id"], "visitors": day_visitors.get(row["_id"], 0),
        "sessions": int(row.get("sessions", 0)), "pageViews": int(row.get("pageViews", 0)),
        "scheduleUsage": int(row.get("scheduleUsage", 0)), "vendorUsage": int(row.get("vendorUsage", 0)), "mapUsage": int(row.get("mapUsage", 0)),
    } for row in reversed(data.get("dayCounts", []))]
    announcements = []
    for row in data.get("announcements", []):
        impressions, opens = int(row.get("impressions", 0)), int(row.get("opens", 0))
        announcements.append({"announcementId": row["_id"], "impressions": impressions, "opens": opens, "openImpressionRate": round(opens / impressions * 100, 2) if impressions else None})
    return {
        "pages": ranked("pages", count("page_viewed"), "pageId", ("uniqueVisitors",)),
        "schedule": {"opens": count("schedule_viewed"), "eventOpens": count("schedule_event_opened"), "mostOpenedEvents": ranked("scheduleItems", count("schedule_event_opened"), "scheduleItemId", ("category",)), "filters": ranked("scheduleFilters", count("schedule_filter_used"), "filterValue"), "searches": count("schedule_search_used"), "zeroResultSearches": int(properties.get("scheduleZero", 0)), "favoritesAdded": int(properties.get("favoritesAdded", 0)), "favoritesRemoved": int(properties.get("favoritesRemoved", 0)), "mapActions": map_sources.get("schedule", 0)},
        "vendors": {"directoryOpens": count("vendor_directory_opened"), "searches": count("vendor_search_used"), "zeroResultSearches": int(properties.get("vendorZero", 0)), "filters": ranked("vendorFilters", count("vendor_filter_used"), "filterValue")},
        "map": {"opens": count("map_opened"), "sources": [{"source": source, "count": map_sources.get(source, 0)} for source in ("bottom_navigation", "home_quick_action", "schedule", "other")], "locations": ranked("mapLocations", count("map_opened"), "locationId")},
        "queenOfTheFurrow": {"archiveOpens": count("queen_archive_opened"), "uniqueArchiveVisitors": int((data.get("queenVisitors") or [{}])[0].get("count", 0))},
        "announcements": {"listViews": count("announcement_list_viewed"), "impressions": count("announcement_impression"), "opens": count("announcement_opened"), "openSources": ranked("announcementSources", count("announcement_opened"), "source"), "ranking": announcements},
        "quickActions": {"clicks": count("home_quick_action_clicked"), "actions": ranked("quickActions", count("home_quick_action_clicked"), "actionId"), "sources": ranked("quickSources", count("home_quick_action_clicked"), "source"), "destinationTypes": ranked("quickTypes", count("home_quick_action_clicked"), "destinationType")},
        "outboundLinks": {"clicks": count("outbound_link_clicked"), "destinations": ranked("outboundDestinations", count("outbound_link_clicked"), "destinationId", ("destinationType",)), "destinationTypes": ranked("outboundTypes", count("outbound_link_clicked"), "destinationType")},
        "featureAdoption": adoption, "eventDayComparisons": comparisons,
    }


async def summary_report(repository: AnalyticsReportingRepository, range_name: str, now: Optional[datetime] = None) -> dict[str, Any]:
    current = normalize_now(now); start, end, _, _ = reporting_bounds(range_name, current)
    collection_started_at = await repository.fetch_collection_started_at(ANALYTICS_EVENT_SCOPE)
    return {
        "range": range_name,
        "timezone": ANALYTICS_TIMEZONE,
        "collectionStartedAt": normalize_utc_datetime(collection_started_at) if collection_started_at else None,
        "overview": await repository.aggregate_summary(ANALYTICS_EVENT_SCOPE, start, end),
    }


async def live_report(repository: AnalyticsReportingRepository, now: Optional[datetime] = None) -> dict[str, Any]:
    current = normalize_now(now); cutoff = current - ANALYTICS_SESSION_TIMEOUT
    return {"timezone": ANALYTICS_TIMEZONE, "live": await repository.aggregate_live(ANALYTICS_EVENT_SCOPE, cutoff, current)}


async def traffic_report(repository: AnalyticsReportingRepository, range_name: str, now: Optional[datetime] = None) -> dict[str, Any]:
    current = normalize_now(now); start, end, first, last = reporting_bounds(range_name, current)
    first_string = None if first == date.min else first.isoformat()
    return {"range": range_name, "timezone": ANALYTICS_TIMEZONE, "traffic": await repository.aggregate_traffic(ANALYTICS_EVENT_SCOPE, start, end, first_string, last.isoformat())}


async def content_report(repository: AnalyticsReportingRepository, range_name: str, now: Optional[datetime] = None) -> dict[str, Any]:
    current = normalize_now(now); start, end, _, _ = reporting_bounds(range_name, current)
    return {"range": range_name, "timezone": ANALYTICS_TIMEZONE, "content": await repository.aggregate_content(ANALYTICS_EVENT_SCOPE, start, end)}
