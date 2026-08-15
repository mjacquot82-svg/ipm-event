"""Privacy-preserving, event-scoped analytics ingestion for IPM.

The attendee client supplies anonymous UUIDs and idempotency keys. The server
owns event scope, receipt timestamps, validation, session semantics, and data
retention. Reporting intentionally lives outside this module and must later be
exposed only through authenticated organizer endpoints.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import json
from typing import Any, Mapping, Optional, Protocol
from uuid import UUID
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError


ANALYTICS_EVENT_SCOPE = "ipm-2026"
ANALYTICS_TIMEZONE = "America/Toronto"
ANALYTICS_ZONE = ZoneInfo(ANALYTICS_TIMEZONE)
ANALYTICS_SESSION_TIMEOUT = timedelta(minutes=30)
ANALYTICS_RAW_RETENTION_DAYS = 400
MAX_BATCH_EVENTS = 50
MAX_BATCH_BYTES = 24 * 1024
MAX_PROPERTIES = 32
MAX_PROPERTIES_BYTES = 8 * 1024

Scalar = str | int | float | bool | None


class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class AnalyticsEventInput(StrictRequest):
    clientEventId: UUID
    eventName: str = Field(min_length=1, max_length=64)
    properties: dict[str, Scalar] = Field(default_factory=dict)
    occurredAt: Optional[datetime] = None

    @field_validator("occurredAt")
    @classmethod
    def normalize_occurred_at(cls, value: Optional[datetime]) -> Optional[datetime]:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("occurredAt must include a timezone")
        return value.astimezone(UTC)


class AnalyticsEventsRequest(StrictRequest):
    visitorId: UUID
    sessionId: UUID
    events: list[AnalyticsEventInput] = Field(min_length=1, max_length=MAX_BATCH_EVENTS)

    @model_validator(mode="after")
    def enforce_batch_size(self):
        payload = self.model_dump(mode="json")
        if len(json.dumps(payload, separators=(",", ":")).encode("utf-8")) > MAX_BATCH_BYTES:
            raise ValueError(f"analytics batch exceeds {MAX_BATCH_BYTES} bytes")
        event_ids = [event.clientEventId for event in self.events]
        if len(event_ids) != len(set(event_ids)):
            raise ValueError("clientEventId values must be unique within a batch")
        return self


class AnalyticsSessionRequest(StrictRequest):
    visitorId: UUID
    sessionId: UUID
    clientEventId: UUID
    occurredAt: Optional[datetime] = None
    launchMode: Optional[str] = Field(default=None, max_length=32)
    appVersion: Optional[str] = Field(default=None, max_length=32)

    @field_validator("occurredAt")
    @classmethod
    def normalize_occurred_at(cls, value: Optional[datetime]) -> Optional[datetime]:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("occurredAt must include a timezone")
        return value.astimezone(UTC)

    @field_validator("launchMode")
    @classmethod
    def validate_launch_mode(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in {"browser", "installed_pwa", "native"}:
            raise ValueError("launchMode is not supported")
        return value


class AnalyticsSessionEndRequest(AnalyticsSessionRequest):
    reason: Optional[str] = Field(default=None, max_length=32)

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in {"pagehide", "background", "timeout", "explicit"}:
            raise ValueError("reason is not supported")
        return value


@dataclass(frozen=True)
class PropertyRule:
    kinds: tuple[type, ...]
    required: bool = False
    choices: frozenset[Scalar] | None = None
    minimum: float | None = None
    maximum: float | None = None
    max_length: int = 128


def rule(*kinds: type, required: bool = False, choices=None, minimum=None, maximum=None, max_length=128):
    return PropertyRule(
        kinds=kinds,
        required=required,
        choices=frozenset(choices) if choices is not None else None,
        minimum=minimum,
        maximum=maximum,
        max_length=max_length,
    )


ID = rule(str, required=True, max_length=128)
OPT_ID = rule(str, max_length=128)
SOURCE = rule(str, max_length=64)
COUNT = rule(int, minimum=0, maximum=1_000_000)
SEARCH_LENGTH = rule(int, required=True, minimum=0, maximum=256)
SEARCH_RESULTS = rule(int, required=True, minimum=0, maximum=100_000)
ZERO_RESULTS = rule(bool, required=True)
LOAD_STATUS = rule(str, choices={"success", "empty", "cached", "failed"}, max_length=16)
FAILURE_CODE = rule(str, max_length=64)
DURATION = rule(int, float, minimum=0, maximum=86_400)

COMMON_NAVIGATION = {
    "source": SOURCE,
    "path": rule(str, max_length=160),
    "previous_page_id": OPT_ID,
    "navigation_type": rule(str, choices={"tab", "quick_action", "deep_link", "back", "internal"}),
}
COMMON_LOAD = {"load_status": LOAD_STATUS, "failure_code": FAILURE_CODE}


EVENT_CATALOG: dict[str, dict[str, PropertyRule]] = {
    "app_launched": {
        "launch_mode": rule(str, required=True, choices={"browser", "installed_pwa", "native"}),
        "app_version": rule(str, max_length=32),
    },
    "install_guidance_shown": {
        "platform": rule(str, required=True, choices={"ios", "android", "desktop", "unknown"}),
        "browser": rule(str, required=True, choices={"safari", "chrome", "samsung_internet", "edge", "firefox", "other"}),
        "install_state": rule(str, required=True, choices={"install_prompt_available", "manual_install_required", "unsupported_or_unknown"}),
        "native_prompt_available": rule(bool, required=True),
    },
    "install_action_selected": {
        "platform": rule(str, required=True, choices={"ios", "android", "desktop", "unknown"}),
        "browser": rule(str, required=True, choices={"safari", "chrome", "samsung_internet", "edge", "firefox", "other"}),
        "install_state": rule(str, required=True, choices={"install_prompt_available", "manual_install_required", "unsupported_or_unknown"}),
        "native_prompt_available": rule(bool, required=True),
    },
    "install_guidance_continued": {
        "platform": rule(str, required=True, choices={"ios", "android", "desktop", "unknown"}),
        "browser": rule(str, required=True, choices={"safari", "chrome", "samsung_internet", "edge", "firefox", "other"}),
        "install_state": rule(str, required=True, choices={"install_prompt_available", "manual_install_required", "unsupported_or_unknown"}),
        "native_prompt_available": rule(bool, required=True),
    },
    "installed_launch_observed": {
        "platform": rule(str, required=True, choices={"ios", "android", "desktop", "unknown"}),
        "browser": rule(str, required=True, choices={"safari", "chrome", "samsung_internet", "edge", "firefox", "other"}),
    },
    "session_started": {
        "launch_mode": rule(str, choices={"browser", "installed_pwa", "native"}),
        "app_version": rule(str, max_length=32),
    },
    "session_heartbeat": {},
    "session_ended": {
        "duration_seconds": DURATION,
        "reason": rule(str, choices={"pagehide", "background", "timeout", "explicit"}),
    },
    "page_viewed": {
        "page_id": ID,
        "section_id": OPT_ID,
        "engagement_duration_seconds": DURATION,
        **COMMON_NAVIGATION,
        **COMMON_LOAD,
    },
    "home_quick_action_clicked": {
        "action_id": ID,
        "destination_type": rule(str, required=True, max_length=64),
        **COMMON_NAVIGATION,
    },
    "schedule_viewed": {**COMMON_NAVIGATION, **COMMON_LOAD},
    "schedule_event_opened": {
        "schedule_item_id": ID,
        "category": rule(str, max_length=64),
        **COMMON_NAVIGATION,
    },
    "schedule_filter_used": {
        "filter_type": rule(str, required=True, choices={"category", "day"}),
        "filter_value": rule(str, required=True, max_length=64),
    },
    "schedule_search_used": {
        "query_length": SEARCH_LENGTH,
        "result_count": SEARCH_RESULTS,
        "zero_results": ZERO_RESULTS,
    },
    "map_opened": {"location_id": OPT_ID, **COMMON_NAVIGATION, **COMMON_LOAD},
    "vendor_directory_opened": {**COMMON_NAVIGATION, **COMMON_LOAD},
    "vendor_search_used": {
        "query_length": SEARCH_LENGTH,
        "result_count": SEARCH_RESULTS,
        "zero_results": ZERO_RESULTS,
    },
    "vendor_filter_used": {
        "filter_value": rule(str, required=True, choices={"all", "food", "indoor", "outdoor"}),
    },
    "vendor_opened": {
        "vendor_id": ID,
        "vendor_type": rule(str, max_length=64),
        **COMMON_NAVIGATION,
    },
    "queen_archive_opened": {**COMMON_NAVIGATION, **COMMON_LOAD},
    "queen_entry_opened": {
        "entry_id": ID,
        "year": rule(int, required=True, minimum=1900, maximum=2200),
        **COMMON_NAVIGATION,
    },
    "announcement_list_viewed": {"unread_count": COUNT, **COMMON_NAVIGATION, **COMMON_LOAD},
    "announcement_impression": {
        "announcement_id": ID,
        "surface": rule(str, required=True, choices={"home", "list", "notification"}),
    },
    "announcement_opened": {
        "announcement_id": ID,
        "notification_id": OPT_ID,
        "campaign_id": OPT_ID,
        **COMMON_NAVIGATION,
        **COMMON_LOAD,
    },
    "announcement_link_clicked": {
        "announcement_id": ID,
        "destination_id": ID,
        "destination_type": rule(str, required=True, max_length=64),
    },
    "outbound_link_clicked": {
        "destination_id": ID,
        "destination_type": rule(str, required=True, max_length=64),
        **COMMON_NAVIGATION,
    },
    "favorite_changed": {
        "schedule_item_id": ID,
        "action": rule(str, required=True, choices={"added", "removed"}),
    },
}
SESSION_LIFECYCLE_EVENTS = frozenset({"session_started", "session_heartbeat", "session_ended"})

FORBIDDEN_PROPERTY_FRAGMENTS = {
    "name", "email", "phone", "latitude", "longitude", "gps", "advertising",
    "advertising_id", "ad_id", "raw_query", "search_query", "query_text", "url", "href",
}


class AnalyticsValidationError(ValueError):
    pass


def validate_event(event_name: str, properties: Mapping[str, Scalar]) -> dict[str, Scalar]:
    schema = EVENT_CATALOG.get(event_name)
    if schema is None:
        raise AnalyticsValidationError(f"unknown analytics event: {event_name}")
    if len(properties) > MAX_PROPERTIES:
        raise AnalyticsValidationError(f"properties may contain at most {MAX_PROPERTIES} keys")
    if len(json.dumps(properties, separators=(",", ":")).encode("utf-8")) > MAX_PROPERTIES_BYTES:
        raise AnalyticsValidationError(f"properties exceed {MAX_PROPERTIES_BYTES} bytes")

    for key in properties:
        normalized = key.lower()
        if any(fragment == normalized or normalized.endswith(f"_{fragment}") for fragment in FORBIDDEN_PROPERTY_FRAGMENTS):
            raise AnalyticsValidationError(f"privacy-sensitive property is not allowed: {key}")
        if key not in schema:
            raise AnalyticsValidationError(f"property is not allowed for {event_name}: {key}")

    for key, property_rule in schema.items():
        if property_rule.required and key not in properties:
            raise AnalyticsValidationError(f"missing required property for {event_name}: {key}")
        if key not in properties or properties[key] is None:
            continue
        value = properties[key]
        # bool is a subclass of int; never accept it for numeric metrics.
        if isinstance(value, bool) and bool not in property_rule.kinds:
            raise AnalyticsValidationError(f"invalid type for {event_name}.{key}")
        if not isinstance(value, property_rule.kinds):
            raise AnalyticsValidationError(f"invalid type for {event_name}.{key}")
        if isinstance(value, str) and (not value or len(value) > property_rule.max_length):
            raise AnalyticsValidationError(f"invalid length for {event_name}.{key}")
        if property_rule.choices is not None and value not in property_rule.choices:
            raise AnalyticsValidationError(f"invalid value for {event_name}.{key}")
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            if property_rule.minimum is not None and value < property_rule.minimum:
                raise AnalyticsValidationError(f"value below minimum for {event_name}.{key}")
            if property_rule.maximum is not None and value > property_rule.maximum:
                raise AnalyticsValidationError(f"value above maximum for {event_name}.{key}")

    if event_name.endswith("_search_used"):
        expected_zero = properties["result_count"] == 0
        if properties["zero_results"] is not expected_zero:
            raise AnalyticsValidationError("zero_results must match result_count")
    if properties.get("load_status") != "failed" and properties.get("failure_code") is not None:
        raise AnalyticsValidationError("failure_code requires load_status=failed")
    return dict(properties)


def toronto_date_key(timestamp: datetime) -> str:
    return timestamp.astimezone(ANALYTICS_ZONE).date().isoformat()


def toronto_hour_key(timestamp: datetime) -> str:
    return timestamp.astimezone(ANALYTICS_ZONE).strftime("%H:00")


def toronto_day_bounds(timestamp: datetime) -> tuple[datetime, datetime]:
    local = timestamp.astimezone(ANALYTICS_ZONE)
    start_local = datetime.combine(local.date(), datetime.min.time(), tzinfo=ANALYTICS_ZONE)
    next_local = datetime.combine(local.date() + timedelta(days=1), datetime.min.time(), tzinfo=ANALYTICS_ZONE)
    return start_local.astimezone(UTC), next_local.astimezone(UTC)


class AnalyticsRepository(Protocol):
    async def ensure_indexes(self) -> None: ...
    async def record_event(self, document: dict[str, Any]) -> bool: ...
    async def touch_visitor(self, *, visitor_id: str, received_at: datetime) -> tuple[bool, int]: ...
    async def start_session(self, *, visitor_id: str, session_id: str, received_at: datetime) -> bool: ...
    async def heartbeat_session(self, *, visitor_id: str, session_id: str, received_at: datetime) -> bool: ...
    async def end_session(self, *, visitor_id: str, session_id: str, received_at: datetime, reason: Optional[str]) -> Optional[float]: ...
    async def increment_rollup(self, *, event_name: str, received_at: datetime) -> None: ...


class MongoAnalyticsRepository:
    def __init__(self, database: Any, *, retention_days: int = ANALYTICS_RAW_RETENTION_DAYS):
        self.db = database
        self.retention = timedelta(days=retention_days)

    async def ensure_indexes(self) -> None:
        await self.db.analytics_visitors.create_index(
            [("eventScope", ASCENDING), ("visitorId", ASCENDING)], unique=True,
            name="analytics_visitor_scope_unique",
        )
        await self.db.analytics_visitors.create_index(
            [("eventScope", ASCENDING), ("firstSeenAt", ASCENDING), ("lastSeenAt", DESCENDING)],
            name="analytics_visitors_reporting",
        )
        await self.db.analytics_sessions.create_index(
            [("eventScope", ASCENDING), ("sessionId", ASCENDING)], unique=True,
            name="analytics_session_scope_unique",
        )
        await self.db.analytics_sessions.create_index(
            [("eventScope", ASCENDING), ("lastActivityAt", DESCENDING)],
            name="analytics_sessions_active",
        )
        await self.db.analytics_sessions.create_index(
            [("eventScope", ASCENDING), ("startedAt", DESCENDING)],
            name="analytics_sessions_reporting",
        )
        await self.db.analytics_events.create_index(
            [("eventScope", ASCENDING), ("clientEventId", ASCENDING)], unique=True,
            name="analytics_event_idempotency_unique",
        )
        await self.db.analytics_events.create_index(
            [("eventScope", ASCENDING), ("eventName", ASCENDING), ("receivedAt", DESCENDING)],
            name="analytics_events_name_received",
        )
        await self.db.analytics_events.create_index(
            [("eventScope", ASCENDING), ("receivedAt", DESCENDING)],
            name="analytics_events_reporting_window",
        )
        await self.db.analytics_events.create_index(
            [("eventScope", ASCENDING), ("sessionId", ASCENDING), ("receivedAt", DESCENDING)],
            name="analytics_events_session_received",
        )
        await self.db.analytics_events.create_index(
            [("eventScope", ASCENDING), ("visitorId", ASCENDING), ("receivedAt", DESCENDING)],
            name="analytics_events_visitor_received",
        )
        await self.db.analytics_events.create_index(
            [("expiresAt", ASCENDING)], expireAfterSeconds=0, name="analytics_events_retention_ttl",
        )
        await self.db.analytics_daily_rollups.create_index(
            [("eventScope", ASCENDING), ("localDate", ASCENDING), ("eventName", ASCENDING), ("localHour", ASCENDING)],
            unique=True, name="analytics_daily_event_hour_unique",
        )

    async def record_event(self, document: dict[str, Any]) -> bool:
        document = {**document, "expiresAt": document["receivedAt"] + self.retention}
        await self.db.analytics_metadata.update_one(
            {"_id": f"collection-start:{ANALYTICS_EVENT_SCOPE}"},
            {"$setOnInsert": {
                "eventScope": ANALYTICS_EVENT_SCOPE,
                "collectionStartedAt": document["receivedAt"],
                "createdAt": document["receivedAt"],
            }},
            upsert=True,
        )
        try:
            await self.db.analytics_events.insert_one(document)
            return True
        except DuplicateKeyError:
            return False

    async def touch_visitor(self, *, visitor_id: str, received_at: datetime) -> tuple[bool, int]:
        existing = await self.db.analytics_visitors.find_one(
            {"eventScope": ANALYTICS_EVENT_SCOPE, "visitorId": visitor_id}, {"visitCount": 1}
        )
        await self.db.analytics_visitors.update_one(
            {"eventScope": ANALYTICS_EVENT_SCOPE, "visitorId": visitor_id},
            {
                "$setOnInsert": {"firstSeenAt": received_at, "createdAt": received_at},
                "$set": {"lastSeenAt": received_at, "updatedAt": received_at},
                "$inc": {"visitCount": 1},
            }, upsert=True,
        )
        return existing is None, (existing or {}).get("visitCount", 0) + 1

    async def start_session(self, *, visitor_id: str, session_id: str, received_at: datetime) -> bool:
        result = await self.db.analytics_sessions.update_one(
            {"eventScope": ANALYTICS_EVENT_SCOPE, "sessionId": session_id},
            {"$setOnInsert": {
                "eventScope": ANALYTICS_EVENT_SCOPE, "sessionId": session_id,
                "visitorId": visitor_id, "startedAt": received_at,
                "lastActivityAt": received_at, "createdAt": received_at,
                "status": "active",
            }}, upsert=True,
        )
        return result.upserted_id is not None

    async def heartbeat_session(self, *, visitor_id: str, session_id: str, received_at: datetime) -> bool:
        result = await self.db.analytics_sessions.update_one(
            {"eventScope": ANALYTICS_EVENT_SCOPE, "sessionId": session_id, "visitorId": visitor_id,
             "status": "active", "lastActivityAt": {"$gte": received_at - ANALYTICS_SESSION_TIMEOUT}},
            {"$set": {"lastActivityAt": received_at, "updatedAt": received_at}},
        )
        return result.matched_count == 1

    async def end_session(self, *, visitor_id: str, session_id: str, received_at: datetime, reason: Optional[str]) -> Optional[float]:
        session = await self.db.analytics_sessions.find_one(
            {"eventScope": ANALYTICS_EVENT_SCOPE, "sessionId": session_id, "visitorId": visitor_id, "status": "active"}
        )
        if not session:
            return None
        duration = max(0.0, (received_at - session["startedAt"]).total_seconds())
        result = await self.db.analytics_sessions.update_one(
            {"_id": session["_id"], "status": "active"},
            {"$set": {"status": "ended", "endedAt": received_at, "lastActivityAt": received_at,
                      "durationSeconds": duration, "endReason": reason, "updatedAt": received_at}},
        )
        return duration if result.modified_count == 1 else None

    async def increment_rollup(self, *, event_name: str, received_at: datetime) -> None:
        await self.db.analytics_daily_rollups.update_one(
            {"eventScope": ANALYTICS_EVENT_SCOPE, "localDate": toronto_date_key(received_at),
             "eventName": event_name, "localHour": toronto_hour_key(received_at)},
            {"$inc": {"count": 1}, "$set": {"updatedAt": received_at},
             "$setOnInsert": {"createdAt": received_at}}, upsert=True,
        )


def _event_document(*, visitor_id: UUID, session_id: UUID, event: AnalyticsEventInput, received_at: datetime) -> dict[str, Any]:
    return {
        "eventScope": ANALYTICS_EVENT_SCOPE,
        "visitorId": str(visitor_id),
        "sessionId": str(session_id),
        "clientEventId": str(event.clientEventId),
        "eventName": event.eventName,
        "properties": validate_event(event.eventName, event.properties),
        "clientOccurredAt": event.occurredAt,
        "receivedAt": received_at,
        "localDate": toronto_date_key(received_at),
        "localHour": toronto_hour_key(received_at),
        "createdAt": received_at,
    }


async def ingest_events(repository: AnalyticsRepository, request: AnalyticsEventsRequest, *, received_at: Optional[datetime] = None) -> dict[str, int]:
    now = (received_at or datetime.now(UTC)).astimezone(UTC)
    lifecycle_events = [event.eventName for event in request.events if event.eventName in SESSION_LIFECYCLE_EVENTS]
    if lifecycle_events:
        raise AnalyticsValidationError("session lifecycle events must use the session endpoints")
    documents = [_event_document(visitor_id=request.visitorId, session_id=request.sessionId, event=event, received_at=now) for event in request.events]
    active = await repository.heartbeat_session(
        visitor_id=str(request.visitorId), session_id=str(request.sessionId), received_at=now
    )
    if not active:
        raise AnalyticsValidationError("session is missing, ended, or inactive")
    accepted = duplicates = 0
    for document in documents:
        inserted = await repository.record_event(document)
        if inserted:
            accepted += 1
            await repository.increment_rollup(event_name=document["eventName"], received_at=now)
        else:
            duplicates += 1
    return {"accepted": accepted, "duplicates": duplicates}


async def start_session(repository: AnalyticsRepository, request: AnalyticsSessionRequest, *, received_at: Optional[datetime] = None) -> dict[str, Any]:
    now = (received_at or datetime.now(UTC)).astimezone(UTC)
    created = await repository.start_session(
        visitor_id=str(request.visitorId), session_id=str(request.sessionId), received_at=now
    )
    if not created:
        return {"accepted": False, "duplicate": True, "firstVisit": False, "returningVisitor": False}
    properties = {key: value for key, value in {"launch_mode": request.launchMode, "app_version": request.appVersion}.items() if value is not None}
    event = AnalyticsEventInput(clientEventId=request.clientEventId, eventName="session_started", properties=properties, occurredAt=request.occurredAt)
    document = _event_document(visitor_id=request.visitorId, session_id=request.sessionId, event=event, received_at=now)
    inserted = await repository.record_event(document)
    if not inserted:
        return {"accepted": False, "duplicate": True, "firstVisit": False, "returningVisitor": False}
    first_visit, visit_count = await repository.touch_visitor(visitor_id=str(request.visitorId), received_at=now)
    await repository.increment_rollup(event_name="session_started", received_at=now)
    return {"accepted": True, "duplicate": False, "firstVisit": first_visit, "returningVisitor": visit_count > 1}


async def heartbeat_session(repository: AnalyticsRepository, request: AnalyticsSessionRequest, *, received_at: Optional[datetime] = None) -> dict[str, Any]:
    now = (received_at or datetime.now(UTC)).astimezone(UTC)
    active = await repository.heartbeat_session(
        visitor_id=str(request.visitorId), session_id=str(request.sessionId), received_at=now
    )
    if not active:
        raise AnalyticsValidationError("session is missing, ended, or inactive")
    event = AnalyticsEventInput(clientEventId=request.clientEventId, eventName="session_heartbeat", occurredAt=request.occurredAt)
    document = _event_document(visitor_id=request.visitorId, session_id=request.sessionId, event=event, received_at=now)
    inserted = await repository.record_event(document)
    if not inserted:
        return {"accepted": False, "duplicate": True, "sessionActive": True}
    await repository.increment_rollup(event_name="session_heartbeat", received_at=now)
    return {"accepted": True, "duplicate": False, "sessionActive": True}


async def end_session(repository: AnalyticsRepository, request: AnalyticsSessionEndRequest, *, received_at: Optional[datetime] = None) -> dict[str, Any]:
    now = (received_at or datetime.now(UTC)).astimezone(UTC)
    duration = await repository.end_session(visitor_id=str(request.visitorId), session_id=str(request.sessionId), received_at=now, reason=request.reason)
    if duration is None:
        return {"accepted": False, "duplicate": True, "durationSeconds": None}
    properties = {"duration_seconds": duration}
    if request.reason is not None:
        properties["reason"] = request.reason
    event = AnalyticsEventInput(clientEventId=request.clientEventId, eventName="session_ended", properties=properties, occurredAt=request.occurredAt)
    document = _event_document(visitor_id=request.visitorId, session_id=request.sessionId, event=event, received_at=now)
    inserted = await repository.record_event(document)
    if inserted:
        await repository.increment_rollup(event_name="session_ended", received_at=now)
    return {"accepted": inserted, "duplicate": not inserted, "durationSeconds": duration}
