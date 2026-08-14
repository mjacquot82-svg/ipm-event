import asyncio
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import httpx
import pytest
from fastapi import Depends, FastAPI
from pydantic import BaseModel, ValidationError, field_validator
from pymongo.errors import OperationFailure
from starlette.middleware.cors import CORSMiddleware

from backend import server
from backend.analytics import (
    ANALYTICS_EVENT_SCOPE,
    ANALYTICS_SESSION_TIMEOUT,
    EVENT_CATALOG,
    MAX_BATCH_EVENTS,
    AnalyticsEventInput,
    AnalyticsEventsRequest,
    AnalyticsSessionEndRequest,
    AnalyticsSessionRequest,
    AnalyticsValidationError,
    MongoAnalyticsRepository,
    end_session,
    heartbeat_session,
    ingest_events,
    start_session,
    toronto_date_key,
    toronto_day_bounds,
    toronto_hour_key,
    validate_event,
)


VISITOR_ID = uuid4()
SESSION_ID = uuid4()


VALID_PROPERTIES = {
    "app_launched": {"launch_mode": "browser", "app_version": "1.0.0"},
    "session_started": {"launch_mode": "browser"},
    "session_heartbeat": {},
    "session_ended": {"duration_seconds": 12, "reason": "explicit"},
    "page_viewed": {"page_id": "home", "source": "launch", "load_status": "success"},
    "home_quick_action_clicked": {"action_id": "map", "destination_type": "internal"},
    "schedule_viewed": {"source": "tab", "load_status": "cached"},
    "schedule_event_opened": {"schedule_item_id": "event-1", "category": "Entertainment"},
    "schedule_filter_used": {"filter_type": "day", "filter_value": "Tuesday"},
    "schedule_search_used": {"query_length": 4, "result_count": 0, "zero_results": True},
    "map_opened": {"source": "quick_action", "location_id": "main-gate"},
    "vendor_directory_opened": {"source": "home", "load_status": "success"},
    "vendor_search_used": {"query_length": 3, "result_count": 4, "zero_results": False},
    "vendor_filter_used": {"filter_value": "food"},
    "vendor_opened": {"vendor_id": "vendor-1", "vendor_type": "food"},
    "queen_archive_opened": {"source": "home", "load_status": "success"},
    "queen_entry_opened": {"entry_id": "queen-1985", "year": 1985},
    "announcement_list_viewed": {"unread_count": 2, "load_status": "success"},
    "announcement_impression": {"announcement_id": "notice-1", "surface": "home"},
    "announcement_opened": {"announcement_id": "notice-1", "source": "notification", "campaign_id": "campaign-1"},
    "announcement_link_clicked": {"announcement_id": "notice-1", "destination_id": "tickets", "destination_type": "tickets"},
    "outbound_link_clicked": {"destination_id": "camping", "destination_type": "registration", "source": "home"},
    "favorite_changed": {"schedule_item_id": "event-1", "action": "added"},
}


class InMemoryAnalyticsRepository:
    def __init__(self):
        self.events = {}
        self.visitors = {}
        self.sessions = {}
        self.rollups = {}

    async def ensure_indexes(self):
        return None

    async def record_event(self, document):
        key = (document["eventScope"], document["clientEventId"])
        if key in self.events:
            return False
        self.events[key] = dict(document)
        return True

    async def touch_visitor(self, *, visitor_id, received_at):
        key = (ANALYTICS_EVENT_SCOPE, visitor_id)
        visitor = self.visitors.get(key)
        if visitor is None:
            self.visitors[key] = {"firstSeenAt": received_at, "lastSeenAt": received_at, "visitCount": 1}
            return True, 1
        visitor["lastSeenAt"] = received_at
        visitor["visitCount"] += 1
        return False, visitor["visitCount"]

    async def start_session(self, *, visitor_id, session_id, received_at):
        key = (ANALYTICS_EVENT_SCOPE, session_id)
        if key in self.sessions:
            return False
        self.sessions[key] = {
            "visitorId": visitor_id,
            "startedAt": received_at,
            "lastActivityAt": received_at,
            "status": "active",
        }
        return True

    async def heartbeat_session(self, *, visitor_id, session_id, received_at):
        session = self.sessions.get((ANALYTICS_EVENT_SCOPE, session_id))
        if (
            not session
            or session["visitorId"] != visitor_id
            or session["status"] != "active"
            or session["lastActivityAt"] < received_at - ANALYTICS_SESSION_TIMEOUT
        ):
            return False
        session["lastActivityAt"] = received_at
        return True

    async def end_session(self, *, visitor_id, session_id, received_at, reason):
        session = self.sessions.get((ANALYTICS_EVENT_SCOPE, session_id))
        if not session or session["visitorId"] != visitor_id or session["status"] != "active":
            return None
        duration = max(0.0, (received_at - session["startedAt"]).total_seconds())
        session.update(status="ended", endedAt=received_at, lastActivityAt=received_at,
                       durationSeconds=duration, endReason=reason)
        return duration

    async def increment_rollup(self, *, event_name, received_at):
        key = (ANALYTICS_EVENT_SCOPE, toronto_date_key(received_at), event_name, toronto_hour_key(received_at))
        self.rollups[key] = self.rollups.get(key, 0) + 1


class IndexCollection:
    def __init__(self):
        self.indexes = []

    async def create_index(self, keys, **options):
        self.indexes.append((keys, options))


class IndexDatabase:
    def __init__(self):
        self.analytics_visitors = IndexCollection()
        self.analytics_sessions = IndexCollection()
        self.analytics_events = IndexCollection()
        self.analytics_daily_rollups = IndexCollection()


class RecordingCollection:
    def __init__(self):
        self.documents = []
        self.updates = []

    async def insert_one(self, document):
        self.documents.append(document)

    async def update_one(self, query, update, **options):
        self.updates.append((query, update, options))


class RecordingDatabase:
    def __init__(self):
        self.analytics_events = RecordingCollection()
        self.analytics_metadata = RecordingCollection()


def session_request(**overrides):
    values = {
        "visitorId": VISITOR_ID,
        "sessionId": SESSION_ID,
        "clientEventId": uuid4(),
        "occurredAt": datetime(2026, 8, 12, 12, tzinfo=UTC),
        "launchMode": "browser",
        "appVersion": "1.0.0",
    }
    values.update(overrides)
    return AnalyticsSessionRequest(**values)


def events_request(*events, visitor_id=VISITOR_ID, session_id=SESSION_ID):
    return AnalyticsEventsRequest(visitorId=visitor_id, sessionId=session_id, events=list(events))


def test_first_persisted_event_establishes_server_owned_collection_start_metadata():
    database = RecordingDatabase()
    repository = MongoAnalyticsRepository(database)
    received_at = datetime(2026, 9, 15, 13, tzinfo=UTC)
    inserted = asyncio.run(repository.record_event({
        "eventScope": ANALYTICS_EVENT_SCOPE,
        "clientEventId": str(uuid4()),
        "receivedAt": received_at,
    }))
    assert inserted
    query, update, options = database.analytics_metadata.updates[0]
    assert query == {"_id": "collection-start:ipm-2026"}
    assert update["$setOnInsert"]["collectionStartedAt"] == received_at
    assert update["$setOnInsert"]["eventScope"] == "ipm-2026"
    assert options == {"upsert": True}


@pytest.mark.parametrize("event_name", sorted(EVENT_CATALOG))
def test_every_approved_event_accepts_its_valid_properties(event_name):
    assert set(EVENT_CATALOG) == set(VALID_PROPERTIES)
    assert validate_event(event_name, VALID_PROPERTIES[event_name]) == VALID_PROPERTIES[event_name]


def test_unknown_event_and_unknown_property_are_rejected():
    with pytest.raises(AnalyticsValidationError, match="unknown analytics event"):
        validate_event("made_up_event", {})
    with pytest.raises(AnalyticsValidationError, match="property is not allowed"):
        validate_event("page_viewed", {"page_id": "home", "anything": "value"})


@pytest.mark.parametrize("field", [
    "name", "email", "phone", "latitude", "longitude", "gps", "advertising_id",
    "raw_query", "search_query", "query_text", "destination_url", "href",
])
def test_privacy_sensitive_fields_are_rejected(field):
    with pytest.raises(AnalyticsValidationError, match="privacy-sensitive"):
        validate_event("page_viewed", {"page_id": "home", field: "private"})


def test_searches_require_derived_non_raw_metrics_and_consistent_zero_result_flag():
    assert validate_event("vendor_search_used", {
        "query_length": 5, "result_count": 0, "zero_results": True,
    })
    with pytest.raises(AnalyticsValidationError, match="zero_results"):
        validate_event("vendor_search_used", {
            "query_length": 5, "result_count": 1, "zero_results": True,
        })
    with pytest.raises(AnalyticsValidationError, match="missing required property"):
        validate_event("schedule_search_used", {"query_length": 3})


def test_property_types_values_lengths_and_failure_pairing_are_strict():
    with pytest.raises(AnalyticsValidationError, match="invalid type"):
        validate_event("announcement_list_viewed", {"unread_count": True})
    with pytest.raises(AnalyticsValidationError, match="invalid value"):
        validate_event("vendor_filter_used", {"filter_value": "mystery"})
    with pytest.raises(AnalyticsValidationError, match="invalid length"):
        validate_event("page_viewed", {"page_id": "x" * 129})
    with pytest.raises(AnalyticsValidationError, match="requires load_status=failed"):
        validate_event("page_viewed", {"page_id": "home", "failure_code": "timeout"})
    assert validate_event("page_viewed", {
        "page_id": "home", "load_status": "failed", "failure_code": "timeout",
    })


def test_request_models_reject_malformed_ids_extra_fields_and_naive_timestamps():
    with pytest.raises(ValidationError):
        AnalyticsSessionRequest(visitorId="not-a-uuid", sessionId=SESSION_ID, clientEventId=uuid4())
    with pytest.raises(ValidationError):
        AnalyticsSessionRequest(visitorId=VISITOR_ID, sessionId=SESSION_ID, clientEventId=uuid4(), appId="evil")
    with pytest.raises(ValidationError, match="timezone"):
        AnalyticsEventInput(clientEventId=uuid4(), eventName="page_viewed", occurredAt=datetime(2026, 1, 1))


def test_batch_limits_count_duplicate_ids_and_encoded_size():
    repeated = uuid4()
    with pytest.raises(ValidationError, match="unique within a batch"):
        events_request(
            AnalyticsEventInput(clientEventId=repeated, eventName="page_viewed", properties={"page_id": "home"}),
            AnalyticsEventInput(clientEventId=repeated, eventName="map_opened", properties={}),
        )
    too_many = [AnalyticsEventInput(clientEventId=uuid4(), eventName="session_heartbeat") for _ in range(MAX_BATCH_EVENTS + 1)]
    with pytest.raises(ValidationError):
        events_request(*too_many)
    huge = [AnalyticsEventInput(clientEventId=uuid4(), eventName="page_viewed", properties={
        "page_id": "x" * 128, "section_id": "s" * 128, "path": "p" * 160,
        "previous_page_id": "q" * 128, "source": "z" * 64,
        "navigation_type": "internal", "load_status": "failed", "failure_code": "f" * 64,
    }) for _ in range(MAX_BATCH_EVENTS)]
    with pytest.raises(ValidationError, match="batch exceeds"):
        events_request(*huge)


def test_mongo_indexes_include_uniqueness_query_paths_retention_and_rollups():
    database = IndexDatabase()
    asyncio.run(MongoAnalyticsRepository(database).ensure_indexes())
    visitor_names = {options["name"] for _, options in database.analytics_visitors.indexes}
    session_names = {options["name"] for _, options in database.analytics_sessions.indexes}
    event_options = {options["name"]: options for _, options in database.analytics_events.indexes}
    rollup_names = {options["name"] for _, options in database.analytics_daily_rollups.indexes}

    assert visitor_names == {"analytics_visitor_scope_unique", "analytics_visitors_reporting"}
    assert session_names == {"analytics_session_scope_unique", "analytics_sessions_active", "analytics_sessions_reporting"}
    assert event_options["analytics_event_idempotency_unique"]["unique"] is True
    assert event_options["analytics_events_retention_ttl"]["expireAfterSeconds"] == 0
    assert {"analytics_events_name_received", "analytics_events_session_received", "analytics_events_visitor_received", "analytics_events_reporting_window"} <= set(event_options)
    assert rollup_names == {"analytics_daily_event_hour_unique"}


def test_session_start_retry_is_idempotent_and_second_session_is_returning():
    repository = InMemoryAnalyticsRepository()
    now = datetime(2026, 8, 12, 15, tzinfo=UTC)
    request = session_request()
    first = asyncio.run(start_session(repository, request, received_at=now))
    retry = asyncio.run(start_session(repository, request, received_at=now + timedelta(seconds=1)))
    second = asyncio.run(start_session(repository, session_request(sessionId=uuid4()), received_at=now + timedelta(hours=1)))

    assert first == {"accepted": True, "duplicate": False, "firstVisit": True, "returningVisitor": False}
    assert retry["duplicate"] is True
    assert second["firstVisit"] is False and second["returningVisitor"] is True
    assert repository.visitors[(ANALYTICS_EVENT_SCOPE, str(VISITOR_ID))]["visitCount"] == 2
    assert {doc["eventScope"] for doc in repository.events.values()} == {"ipm-2026"}


def test_batch_retry_deduplicates_and_uses_server_received_time():
    repository = InMemoryAnalyticsRepository()
    start_at = datetime(2026, 8, 12, 13, 10, tzinfo=UTC)
    asyncio.run(start_session(repository, session_request(), received_at=start_at))
    client_time = datetime(2020, 1, 1, tzinfo=UTC)
    event = AnalyticsEventInput(
        clientEventId=uuid4(), eventName="page_viewed",
        properties={"page_id": "home"}, occurredAt=client_time,
    )
    request = events_request(event)
    received = datetime(2026, 8, 12, 13, 30, tzinfo=UTC)
    first = asyncio.run(ingest_events(repository, request, received_at=received))
    retry = asyncio.run(ingest_events(repository, request, received_at=received + timedelta(seconds=2)))
    document = repository.events[(ANALYTICS_EVENT_SCOPE, str(event.clientEventId))]

    assert first == {"accepted": 1, "duplicates": 0}
    assert retry == {"accepted": 0, "duplicates": 1}
    assert document["clientOccurredAt"] == client_time
    assert document["receivedAt"] == received
    assert document["localDate"] == "2026-08-12"
    assert sum(repository.rollups.values()) == 2  # session start plus one page view


def test_events_require_an_active_matching_session():
    repository = InMemoryAnalyticsRepository()
    request = events_request(AnalyticsEventInput(
        clientEventId=uuid4(), eventName="page_viewed", properties={"page_id": "home"},
    ))
    with pytest.raises(AnalyticsValidationError, match="session is missing"):
        asyncio.run(ingest_events(repository, request, received_at=datetime.now(UTC)))
    assert repository.events == {}


def test_generic_batch_cannot_bypass_session_lifecycle_endpoints():
    repository = InMemoryAnalyticsRepository()
    asyncio.run(start_session(repository, session_request(), received_at=datetime.now(UTC)))
    request = events_request(AnalyticsEventInput(clientEventId=uuid4(), eventName="session_ended"))
    with pytest.raises(AnalyticsValidationError, match="session lifecycle"):
        asyncio.run(ingest_events(repository, request, received_at=datetime.now(UTC)))


def test_heartbeat_refreshes_active_session_and_rejects_expired_or_ended_session():
    repository = InMemoryAnalyticsRepository()
    start_at = datetime(2026, 8, 12, 10, tzinfo=UTC)
    asyncio.run(start_session(repository, session_request(), received_at=start_at))
    result = asyncio.run(heartbeat_session(repository, session_request(), received_at=start_at + timedelta(minutes=20)))
    assert result["accepted"] and result["sessionActive"]
    session = repository.sessions[(ANALYTICS_EVENT_SCOPE, str(SESSION_ID))]
    assert session["lastActivityAt"] == start_at + timedelta(minutes=20)

    with pytest.raises(AnalyticsValidationError, match="inactive"):
        asyncio.run(heartbeat_session(repository, session_request(), received_at=start_at + timedelta(minutes=51)))


def test_session_end_calculates_server_duration_and_repeated_end_is_idempotent():
    repository = InMemoryAnalyticsRepository()
    start_at = datetime(2026, 8, 12, 10, tzinfo=UTC)
    asyncio.run(start_session(repository, session_request(), received_at=start_at))
    request = AnalyticsSessionEndRequest(**session_request().model_dump(), reason="explicit")
    ended = asyncio.run(end_session(repository, request, received_at=start_at + timedelta(minutes=7)))
    retry = asyncio.run(end_session(repository, request, received_at=start_at + timedelta(minutes=8)))
    assert ended["accepted"] and ended["durationSeconds"] == 420
    assert retry == {"accepted": False, "duplicate": True, "durationSeconds": None}


def test_toronto_time_keys_and_dst_day_boundaries():
    summer = datetime(2026, 8, 12, 3, 30, tzinfo=UTC)
    assert toronto_date_key(summer) == "2026-08-11"
    assert toronto_hour_key(summer) == "23:00"

    spring_start, spring_end = toronto_day_bounds(datetime(2026, 3, 8, 12, tzinfo=UTC))
    fall_start, fall_end = toronto_day_bounds(datetime(2026, 11, 1, 12, tzinfo=UTC))
    assert spring_start == datetime(2026, 3, 8, 5, tzinfo=UTC)
    assert spring_end == datetime(2026, 3, 9, 4, tzinfo=UTC)
    assert spring_end - spring_start == timedelta(hours=23)
    assert fall_start == datetime(2026, 11, 1, 4, tzinfo=UTC)
    assert fall_end == datetime(2026, 11, 2, 5, tzinfo=UTC)
    assert fall_end - fall_start == timedelta(hours=25)
    assert toronto_hour_key(datetime(2026, 11, 1, 5, 30, tzinfo=UTC)) == "01:00"
    assert toronto_hour_key(datetime(2026, 11, 1, 6, 30, tzinfo=UTC)) == "01:00"


def test_api_never_accepts_client_event_scope_and_returns_fixed_scope(monkeypatch):
    repository = InMemoryAnalyticsRepository()
    monkeypatch.setattr(server, "analytics_repository", repository)

    async def verify():
        transport = httpx.ASGITransport(app=server.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            payload = {
                "visitorId": str(VISITOR_ID), "sessionId": str(SESSION_ID),
                "clientEventId": str(uuid4()), "launchMode": "browser",
            }
            response = await client.post("/api/analytics/session/start", json=payload)
            assert response.status_code == 202
            assert response.json()["eventScope"] == "ipm-2026"

            payload["clientEventId"] = str(uuid4())
            payload["appId"] = "another-app"
            response = await client.post("/api/analytics/session/start", json=payload)
            assert response.status_code == 422

            malformed = await client.post("/api/analytics/events", json={"visitorId": "bad"})
            assert malformed.status_code == 422

    asyncio.run(verify())


def test_session_start_logs_privacy_safe_unexpected_failure_and_returns_cors_500(monkeypatch, caplog):
    sensitive_visitor_id = "11111111-1111-4111-8111-111111111111"
    sensitive_session_id = "22222222-2222-4222-8222-222222222222"
    sensitive_event_id = "33333333-3333-4333-8333-333333333333"
    sensitive_message = "document for attendee@example.com included forbidden payload values"

    class FailingRepository(InMemoryAnalyticsRepository):
        async def start_session(self, **kwargs):
            raise OperationFailure(
                sensitive_message,
                code=121,
                details={"codeName": "DocumentValidationFailure", "errmsg": sensitive_message},
            )

    monkeypatch.setattr(server, "analytics_repository", FailingRepository())

    async def verify():
        transport = httpx.ASGITransport(app=server.app, raise_app_exceptions=False)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/analytics/session/start",
                headers={"Origin": "https://theipm.ca"},
                json={
                    "visitorId": sensitive_visitor_id,
                    "sessionId": sensitive_session_id,
                    "clientEventId": sensitive_event_id,
                    "occurredAt": "2026-08-14T12:00:00Z",
                    "launchMode": "browser",
                    "appVersion": "1.0.0",
                },
            )

        assert response.status_code == 500
        assert response.json() == {"detail": "Internal Server Error"}
        assert response.headers["access-control-allow-origin"] == "https://theipm.ca"

    with caplog.at_level("ERROR", logger=server.__name__):
        asyncio.run(verify())

    log_output = caplog.text
    assert "analytics_ingestion_unexpected" in log_output
    assert "operation=analytics_session_start" in log_output
    assert "exception_type=OperationFailure" in log_output
    assert "error_code=121" in log_output
    assert "code_name=DocumentValidationFailure" in log_output
    assert "stack_trace=" in log_output
    assert sensitive_visitor_id not in log_output
    assert sensitive_session_id not in log_output
    assert sensitive_event_id not in log_output
    assert sensitive_message not in log_output
    assert "attendee@example.com" not in log_output
    assert "2026-08-14T12:00:00Z" not in log_output
    assert "launchMode" not in log_output
    assert "appVersion" not in log_output


def test_session_start_analytics_validation_error_remains_422(monkeypatch):
    class RejectingRepository(InMemoryAnalyticsRepository):
        async def start_session(self, **kwargs):
            raise AnalyticsValidationError("analytics request rejected")

    monkeypatch.setattr(server, "analytics_repository", RejectingRepository())

    async def verify():
        transport = httpx.ASGITransport(app=server.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/analytics/session/start",
                json={
                    "visitorId": str(VISITOR_ID),
                    "sessionId": str(SESSION_ID),
                    "clientEventId": str(uuid4()),
                },
            )

        assert response.status_code == 422
        assert response.json() == {"detail": "analytics request rejected"}

    asyncio.run(verify())


def diagnostic_stage_app(stage, sensitive_message):
    diagnostic_app = FastAPI()
    diagnostic_app.middleware("http")(server.analytics_session_start_exception_diagnostics)
    diagnostic_app.add_middleware(
        CORSMiddleware,
        allow_origins=["https://theipm.ca"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def unexpected_failure():
        raise OperationFailure(
            sensitive_message,
            code=91,
            details={"codeName": "ShutdownInProgress", "errmsg": sensitive_message},
        )

    async def unexpected_dependency_failure():
        unexpected_failure()

    if stage == "request_validation":
        class ExplodingRequest(BaseModel):
            marker: str

            @field_validator("marker")
            @classmethod
            def reject_during_parsing(cls, value):
                unexpected_failure()

        @diagnostic_app.post("/api/analytics/session/start")
        async def parsing_endpoint(data: ExplodingRequest):
            return {"accepted": True}
    elif stage == "dependency_resolution":
        @diagnostic_app.post(
            "/api/analytics/session/start",
            dependencies=[Depends(unexpected_dependency_failure)],
        )
        async def dependency_endpoint():
            return {"accepted": True}
    elif stage == "response_handling":
        @diagnostic_app.post("/api/analytics/session/start")
        async def response_endpoint():
            return {"unencodable": object()}
    else:
        raise AssertionError(f"unknown diagnostic stage: {stage}")

    return diagnostic_app


@pytest.mark.parametrize(
    "stage,payload,exception_type,error_code,code_name",
    [
        ("request_validation", {"marker": "private-request-value"}, "OperationFailure", "91", "ShutdownInProgress"),
        ("dependency_resolution", {}, "OperationFailure", "91", "ShutdownInProgress"),
        ("response_handling", {}, "ValueError", "None", "None"),
    ],
)
def test_session_start_asgi_diagnostic_captures_framework_stage_failures_without_leaks(
    stage, payload, exception_type, error_code, code_name, caplog,
):
    sensitive_uuid = "44444444-4444-4444-8444-444444444444"
    sensitive_message = f"database failure included {sensitive_uuid} and attendee@example.com"
    diagnostic_app = diagnostic_stage_app(stage, sensitive_message)

    async def verify():
        transport = httpx.ASGITransport(app=diagnostic_app, raise_app_exceptions=False)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/analytics/session/start",
                headers={"Origin": "https://theipm.ca"},
                json=payload,
            )

        assert response.status_code == 500
        assert response.json() == {"detail": "Internal Server Error"}
        assert response.headers["access-control-allow-origin"] == "https://theipm.ca"

    with caplog.at_level("ERROR", logger=server.__name__):
        asyncio.run(verify())

    log_output = caplog.text
    assert "analytics_ingestion_unexpected" in log_output
    assert "operation=analytics_session_start_asgi" in log_output
    assert f"exception_type={exception_type}" in log_output
    assert f"error_code={error_code}" in log_output
    assert f"code_name={code_name}" in log_output
    assert "message=unexpected_analytics_ingestion_failure" in log_output
    assert "stack_trace=" in log_output
    assert sensitive_uuid not in log_output
    assert sensitive_message not in log_output
    assert "attendee@example.com" not in log_output
    assert "private-request-value" not in log_output
