from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse, FileResponse, RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Literal
import uuid
from datetime import datetime, timedelta, timezone
import httpx
import csv
from io import StringIO
import asyncio
import hashlib
import json
import traceback

try:
    from backend.analytics import (
        ANALYTICS_EVENT_SCOPE,
        AnalyticsEventsRequest,
        AnalyticsSessionEndRequest,
        AnalyticsSessionRequest,
        AnalyticsValidationError,
        MongoAnalyticsRepository,
        end_session as end_analytics_session,
        heartbeat_session as heartbeat_analytics_session,
        ingest_events as ingest_analytics_events,
        start_session as start_analytics_session,
    )
    from backend.analytics_reporting import (
        AnalyticsRangeError,
        MongoAnalyticsReportingRepository,
        content_report as get_analytics_content_report,
        live_report as get_analytics_live_report,
        summary_report as get_analytics_summary_report,
        traffic_report as get_analytics_traffic_report,
    )
    from backend.itinerary_reminders import InstallationTargetedWonderPush, ItineraryReminderEngine, ProviderReadinessSynchronizer, SupabaseItineraryReminderRepository, provider_readiness, public_status, test_device_status
    from backend.reminder_scale import batched_scale_report, scale_report
    from backend.plowing_results_demo import DemoResultsPayload, demo_document, ranked_document, validated_document
except ModuleNotFoundError:
    from analytics import (
        ANALYTICS_EVENT_SCOPE,
        AnalyticsEventsRequest,
        AnalyticsSessionEndRequest,
        AnalyticsSessionRequest,
        AnalyticsValidationError,
        MongoAnalyticsRepository,
        end_session as end_analytics_session,
        heartbeat_session as heartbeat_analytics_session,
        ingest_events as ingest_analytics_events,
        start_session as start_analytics_session,
    )
    from analytics_reporting import (
        AnalyticsRangeError,
        MongoAnalyticsReportingRepository,
        content_report as get_analytics_content_report,
        live_report as get_analytics_live_report,
        summary_report as get_analytics_summary_report,
        traffic_report as get_analytics_traffic_report,
    )
    from itinerary_reminders import InstallationTargetedWonderPush, ItineraryReminderEngine, ProviderReadinessSynchronizer, SupabaseItineraryReminderRepository, provider_readiness, public_status, test_device_status
    from reminder_scale import batched_scale_report, scale_report
    from plowing_results_demo import DemoResultsPayload, demo_document, ranked_document, validated_document
import secrets
import base64
import hmac
import re
import time
from urllib.parse import quote
try:
    from backend.calendar_export import CalendarExportError, generate_calendar, generate_google_calendar_url
except ImportError:
    from calendar_export import CalendarExportError, generate_calendar, generate_google_calendar_url
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
try:
    from platform_services import (
        EventService,
        ScheduleService,
        SupabaseScheduleService,
        SupabaseAnnouncementService,
        SupabaseNotificationDeliveryService,
        SupabaseVendorService,
        VendorService,
        WonderPushClient,
        WonderPushError,
    )
except ImportError:
    from backend.platform_services import (
        EventService,
        ScheduleService,
        SupabaseScheduleService,
        SupabaseAnnouncementService,
        SupabaseNotificationDeliveryService,
        SupabaseVendorService,
        VendorService,
        WonderPushClient,
        WonderPushError,
    )


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection - supports both MONGODB_URL (Railway) and MONGO_URL (Emergent)
mongo_url = os.environ.get('MONGODB_URL') or os.environ.get('MONGO_URL')
if not mongo_url:
    logging.warning(
        "No MongoDB URL found. Mongo-backed features are disabled. "
        "Set MONGODB_URL or MONGO_URL to enable SOS, push tokens, starred-event sync, and notifications."
    )
    client = None
    db = None
else:
    # Extract database name from URL or use default
    db_name = os.environ.get('DB_NAME', 'ipm2026')
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

analytics_repository = MongoAnalyticsRepository(db) if db is not None else None
analytics_reporting_repository = MongoAnalyticsReportingRepository(db) if db is not None else None

# Google Sheet URLs (public CSV export)
EVENTS_SHEET_ID = "1tnfBd7Ffg5S4hyk5c5CpB-VGkJcSnLpdsKGbNJIiQCs"
EVENTS_SHEET_CSV_URL = f"https://docs.google.com/spreadsheets/d/{EVENTS_SHEET_ID}/export?format=csv"

VENDORS_SHEET_ID = "12FhDHOZDUaI41oZGeIvSopFxlfFi7X8OxKNSVaBmBgg"
VENDORS_SHEET_CSV_URL = f"https://docs.google.com/spreadsheets/d/{VENDORS_SHEET_ID}/export?format=csv"

# Cron job settings
CHECK_INTERVAL_SECONDS = 300  # Check every 5 minutes
cached_events_hash: str = ""

# Organizer portal authentication settings
DEFAULT_EVENT_ID = os.environ.get("DEFAULT_EVENT_ID", "ipm-2026")
ENVIRONMENT = os.environ.get("ENVIRONMENT", "development").strip().lower()
CONTENT_SOURCE = os.environ.get("CONTENT_SOURCE", "google_sheets").strip().lower()
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
WONDERPUSH_ACCESS_TOKEN = os.environ.get("WONDERPUSH_ACCESS_TOKEN", "")
WONDERPUSH_ANNOUNCEMENT_CAMPAIGN_ID = os.environ.get(
    "WONDERPUSH_ANNOUNCEMENT_CAMPAIGN_ID", ""
).strip()
WONDERPUSH_REMINDER_CAMPAIGN_ID = os.environ.get(
    "WONDERPUSH_REMINDER_CAMPAIGN_ID", ""
).strip()
WONDERPUSH_TEST_INSTALLATION_IDS = [
    installation_id.strip()
    for installation_id in os.environ.get("WONDERPUSH_TEST_INSTALLATION_IDS", "").split(",")
    if installation_id.strip()
]
STAGING_SUPABASE_HOST = "https://hooiqjcbcbwzjjvnwyxf.supabase.co"
IS_STAGING_DEPLOYMENT = (
    ENVIRONMENT == "staging"
    or os.environ.get("RENDER_GIT_BRANCH") == "staging"
    or SUPABASE_URL.rstrip("/") == STAGING_SUPABASE_HOST
)
ITINERARY_REMINDER_FOUNDATION_ENABLED = os.environ.get(
    "ITINERARY_REMINDER_FOUNDATION_ENABLED", "true" if IS_STAGING_DEPLOYMENT else "false"
).lower() == "true"
ITINERARY_REMINDER_TEST_ENABLED = os.environ.get(
    "ITINERARY_REMINDER_TEST_ENABLED", "false"
).lower() == "true"
ITINERARY_REMINDER_SCHEDULER_ENABLED = os.environ.get(
    "ITINERARY_REMINDER_SCHEDULER_ENABLED", "true" if IS_STAGING_DEPLOYMENT else "false"
).lower() == "true"
ITINERARY_REMINDER_DELIVERY_ENABLED = os.environ.get(
    "ITINERARY_REMINDER_DELIVERY_ENABLED", "false"
).lower() == "true"
ITINERARY_REMINDER_INTERVAL_SECONDS = max(30, int(os.environ.get("ITINERARY_REMINDER_INTERVAL_SECONDS", "60")))
ITINERARY_REMINDER_CLAIM_BATCH_SIZE = max(1, min(10000, int(
    os.environ.get("ITINERARY_REMINDER_CLAIM_BATCH_SIZE", "10000"))))
ITINERARY_REMINDER_CONCURRENCY = max(1, min(100, int(os.environ.get("ITINERARY_REMINDER_CONCURRENCY", "20"))))
ITINERARY_REMINDER_MAX_SENDS_PER_SECOND = max(1, min(1000, int(
    os.environ.get("ITINERARY_REMINDER_MAX_SENDS_PER_SECOND", "10"))))
ITINERARY_REMINDER_MAX_TARGETS_PER_REQUEST = max(1, min(10000, int(
    os.environ.get("ITINERARY_REMINDER_MAX_TARGETS_PER_REQUEST", "10000"))))
ITINERARY_REMINDER_PROVIDER_READINESS_MAX_AGE_SECONDS = max(60, int(os.environ.get(
    "ITINERARY_REMINDER_PROVIDER_READINESS_MAX_AGE_SECONDS", "900")))
ITINERARY_REMINDER_PROVIDER_REFRESH_INTERVAL_SECONDS = max(60, int(os.environ.get(
    "ITINERARY_REMINDER_PROVIDER_REFRESH_INTERVAL_SECONDS", "300")))
ITINERARY_REMINDER_PROVIDER_REFRESH_ENABLED = os.environ.get(
    "ITINERARY_REMINDER_PROVIDER_REFRESH_ENABLED", "false").lower() == "true"
PUBLIC_APP_URL = os.environ.get("PUBLIC_APP_URL", "https://theipm.ca").rstrip("/")
ADMIN_SESSION_COOKIE_NAME = os.environ.get("ADMIN_SESSION_COOKIE_NAME", "ipm_admin_session")
ADMIN_SESSION_DAYS = int(os.environ.get("ADMIN_SESSION_DAYS", "7"))
ADMIN_COOKIE_SECURE = os.environ.get("ADMIN_COOKIE_SECURE", "true").lower() == "true"
PASSWORD_HASH_ITERATIONS = 260000
DEFAULT_CORS_ORIGINS = [
    "https://theipm.ca",
    "https://www.theipm.ca",
    "http://localhost:8081",
    "http://localhost:19006",
    "http://localhost:3000",
]
CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", ",".join(DEFAULT_CORS_ORIGINS)).split(",")
    if origin.strip()
]
# Allow preview deploys and GitHub Codespaces forwarded ports during development.
# Codespaces origins follow https://<codespace-name>-<port>.app.github.dev.
CORS_ORIGIN_REGEX = os.environ.get(
    "CORS_ORIGIN_REGEX",
    r"^https://.*\.netlify\.app$|^https://[A-Za-z0-9-]+-\d+\.app\.github\.dev$",
)
if CONTENT_SOURCE not in {"google_sheets", "supabase"}:
    raise RuntimeError("CONTENT_SOURCE must be either 'google_sheets' or 'supabase'")

# Create the main app without a prefix. API documentation is development-only.
api_docs_enabled = ENVIRONMENT != "production"
app = FastAPI(
    docs_url="/docs" if api_docs_enabled else None,
    redoc_url="/redoc" if api_docs_enabled else None,
    openapi_url="/openapi.json" if api_docs_enabled else None,
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class Event(BaseModel):
    id: str
    name: str
    slug: str
    timezone: str = "America/Toronto"
    status: str = "draft"
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ScheduleEvent(BaseModel):
    id: str
    title: str
    description: Optional[str] = ""
    start_date: str
    start_time: str
    end_time: str
    category: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    days_active: str
    location_name: Optional[str] = None

class ScheduleResponse(BaseModel):
    events: List[ScheduleEvent]
    last_updated: datetime
    total_count: int

class AdminScheduleEvent(ScheduleEvent):
    row_number: int

class AdminScheduleResponse(BaseModel):
    events: List[AdminScheduleEvent]
    last_updated: datetime
    total_count: int

class ScheduleEventPayload(BaseModel):
    title: str
    description: Optional[str] = ""
    start_date: str
    start_time: str
    end_time: str
    category: Optional[str] = "Event"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    days_active: Optional[str] = ""
    location_name: Optional[str] = None

class ScheduleImportRow(BaseModel):
    row_number: int
    data: ScheduleEventPayload


class CalendarBulkExportRequest(BaseModel):
    schedule_ids: List[uuid.UUID]

class ItineraryStarsPayload(BaseModel):
    schedule_ids: List[uuid.UUID]

class ItineraryEnabledPayload(BaseModel):
    enabled: bool

class TestDevicePayload(BaseModel):
    label: Literal["A", "B"]

class ControlledTargetingSendPayload(BaseModel):
    device_a_verification_code: str
    device_b_verification_code: str

class SyntheticReminderFixturePayload(BaseModel):
    starred: bool = True
    scenario: str = "t30"

class SyntheticOneShotPayload(BaseModel):
    fixture_key: str

class ScheduleImportProblem(BaseModel):
    row_number: int
    errors: List[str]
    values: Dict[str, str] = Field(default_factory=dict)

class ScheduleImportRequest(BaseModel):
    rows: List[ScheduleImportRow]
    problems: List[ScheduleImportProblem] = Field(default_factory=list)

class ScheduleImportResponse(BaseModel):
    imported_count: int
    problem_count: int
    problems: List[ScheduleImportProblem]
    events: List[AdminScheduleEvent]
    last_updated: datetime

class ScheduleRefreshResponse(BaseModel):
    status: str
    events: List[AdminScheduleEvent]
    last_updated: datetime
    total_count: int

class Vendor(BaseModel):
    id: str
    name: str
    type: str
    location: str
    hours_of_operation: str
    days_of_operation: str
    priority: int = 99  # Default to 99 (lowest priority)

class VendorsResponse(BaseModel):
    vendors: List[Vendor]
    last_updated: datetime
    total_count: int

class VendorPayload(BaseModel):
    name: str
    type: str = ""
    location: str = ""
    hours_of_operation: str = ""
    days_of_operation: str = ""
    priority: int = 99

OrganizerRole = Literal["Owner", "Communications", "Schedule"]
BroadcastPriority = Literal["Normal", "Important", "Emergency"]
BroadcastStatus = Literal["sent"]
BroadcastAudience = Literal["Everyone"]

class OrganizerUserPublic(BaseModel):
    id: str
    username: str
    display_name: str
    role: OrganizerRole
    event_id: str
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime] = None

class OrganizerLoginRequest(BaseModel):
    username: str
    password: str
    event_id: Optional[str] = None

class OrganizerBootstrapRequest(BaseModel):
    username: str
    password: str
    display_name: Optional[str] = None
    event_id: Optional[str] = None

class OrganizerCreateUserRequest(BaseModel):
    username: str
    password: str
    display_name: Optional[str] = None
    role: OrganizerRole
    event_id: Optional[str] = None

class OrganizerAuthResponse(BaseModel):
    user: OrganizerUserPublic

class OrganizerUsersResponse(BaseModel):
    users: List[OrganizerUserPublic]
    total_count: int

class BroadcastCreateRequest(BaseModel):
    title: str
    message: str
    priority: BroadcastPriority = "Normal"

class BroadcastResponse(BaseModel):
    id: str
    event_id: str
    title: str
    message: str
    priority: BroadcastPriority
    sender_username: str
    sender_role: OrganizerRole
    created_at: datetime
    sent_at: datetime
    status: BroadcastStatus
    audience: BroadcastAudience

class BroadcastsResponse(BaseModel):
    broadcasts: List[BroadcastResponse]
    total_count: int

AnnouncementPriority = Literal["Information", "Important", "Emergency"]
AnnouncementStatus = Literal["draft", "published", "archived"]

class AnnouncementPayload(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=5000)
    priority: AnnouncementPriority = "Information"
    expires_at: Optional[datetime] = None
    status: AnnouncementStatus = "published"

class AnnouncementStatusPayload(BaseModel):
    status: AnnouncementStatus

class AnnouncementResponse(BaseModel):
    id: str
    event_id: str
    title: str
    message: str
    priority: AnnouncementPriority
    expires_at: Optional[datetime] = None
    created_by: str
    created_at: datetime
    updated_at: datetime
    status: AnnouncementStatus

class AnnouncementsResponse(BaseModel):
    announcements: List[AnnouncementResponse]
    total_count: int

class NotificationDeliveryResponse(BaseModel):
    id: str
    event_id: str
    announcement_id: str
    audience: Literal["test", "everyone"]
    provider: Literal["webpushr", "wonderpush"]
    provider_campaign_id: Optional[str] = None
    status: Literal["requested", "sent", "failed"]
    requested_by: str
    requested_at: datetime
    sent_at: Optional[datetime] = None
    error_message: Optional[str] = None
    target_url: str
    notification_title: str
    notification_message: str

SCHEDULE_TITLE_FIELDS = ("Name", "Title", "Event Title", "Event Name", "Activity", "Program")
SCHEDULE_FIELD_ALIASES = {
    "Name": SCHEDULE_TITLE_FIELDS,
}
SCHEDULE_REQUIRED_FIELDS = ("Name", "Start Date", "Event Start", "Event End")
SCHEDULE_SHEET_HEADERS = (
    "Name",
    "Start Date",
    "Event Start",
    "Event End",
    "Category",
    "Days_Active",
    "Description",
    "Location",
    "Lat",
    "Long",
)
SCHEDULE_CONTENT_FIELDS = (
    "Name",
    "Start Date",
    "Event Start",
    "Event End",
    "Category",
    "Days_Active",
    "Description",
    "Location",
    "Lat",
    "Long",
)


def get_schedule_cell(row: Dict[str, str], field: str, default: str = "") -> str:
    for candidate in SCHEDULE_FIELD_ALIASES.get(field, (field,)):
        value = row.get(candidate)
        if value and value.strip():
            return value.strip()
    return default


def has_schedule_content(row: Dict[str, str]) -> bool:
    return any(get_schedule_cell(row, field) for field in SCHEDULE_CONTENT_FIELDS)


def is_valid_schedule_row(row: Dict[str, str]) -> bool:
    if not has_schedule_content(row):
        return False
    return all(get_schedule_cell(row, field) for field in SCHEDULE_REQUIRED_FIELDS)


def schedule_event_id(row_index: int, name: str) -> str:
    slug = name.replace(" ", "_").lower()
    return f"gs_{row_index}_{slug}"


def schedule_event_from_row(row: Dict[str, str], row_index: int) -> AdminScheduleEvent:
    try:
        lat = float(get_schedule_cell(row, "Lat")) if get_schedule_cell(row, "Lat") else None
        lng = float(get_schedule_cell(row, "Long")) if get_schedule_cell(row, "Long") else None
    except ValueError:
        lat, lng = None, None

    title = get_schedule_cell(row, "Name", "Untitled Event")
    return AdminScheduleEvent(
        id=schedule_event_id(row_index, title),
        row_number=row_index + 2,
        title=title,
        description=get_schedule_cell(row, "Description"),
        start_date=get_schedule_cell(row, "Start Date"),
        start_time=get_schedule_cell(row, "Event Start"),
        end_time=get_schedule_cell(row, "Event End"),
        category=get_schedule_cell(row, "Category", "Event"),
        latitude=lat,
        longitude=lng,
        days_active=get_schedule_cell(row, "Days_Active"),
        location_name=get_schedule_cell(row, "Location"),
    )


def schedule_payload_to_sheet_row(payload: ScheduleEventPayload) -> List[str]:
    return [
        payload.title.strip(),
        payload.start_date.strip(),
        payload.start_time.strip(),
        payload.end_time.strip(),
        (payload.category or "Event").strip(),
        (payload.days_active or "").strip(),
        (payload.description or "").strip(),
        (payload.location_name or "").strip(),
        "" if payload.latitude is None else str(payload.latitude),
        "" if payload.longitude is None else str(payload.longitude),
    ]


def get_schedule_row_number(event_id: str) -> int:
    match = re.match(r"^gs_(\d+)_", event_id)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid schedule event id")
    return int(match.group(1)) + 2


def get_google_service_account_info() -> dict:
    raw_value = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if not raw_value:
        raise HTTPException(
            status_code=503,
            detail="Google Sheets write access is not configured",
        )
    try:
        return json.loads(raw_value)
    except json.JSONDecodeError:
        try:
            return json.loads(base64.b64decode(raw_value).decode("utf-8"))
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail="Google Sheets service account configuration is invalid",
            ) from exc


def get_schedule_spreadsheet_id() -> str:
    return os.environ.get("SCHEDULE_SHEET_ID", EVENTS_SHEET_ID)


async def get_google_access_token() -> str:
    service_account = get_google_service_account_info()
    private_key = service_account.get("private_key")
    client_email = service_account.get("client_email")
    if not private_key or not client_email:
        raise HTTPException(
            status_code=503,
            detail="Google Sheets service account is missing required fields",
        )

    now = int(time.time())
    header = {"alg": "RS256", "typ": "JWT"}
    claim = {
        "iss": client_email,
        "scope": "https://www.googleapis.com/auth/spreadsheets",
        "aud": "https://oauth2.googleapis.com/token",
        "iat": now,
        "exp": now + 3600,
    }

    def encode_segment(value: dict) -> str:
        data = json.dumps(value, separators=(",", ":"), sort_keys=True).encode("utf-8")
        return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

    signing_input = f"{encode_segment(header)}.{encode_segment(claim)}".encode("ascii")
    key = serialization.load_pem_private_key(private_key.encode("utf-8"), password=None)
    signature = key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())
    assertion = f"{signing_input.decode('ascii')}.{base64.urlsafe_b64encode(signature).rstrip(b'=').decode('ascii')}"

    async with httpx.AsyncClient() as http_client:
        response = await http_client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": assertion,
            },
            timeout=30.0,
        )
    if response.status_code >= 400:
        logger.error("Google token request failed: %s", response.text)
        raise HTTPException(status_code=502, detail="Google Sheets authentication failed")
    return response.json()["access_token"]


async def google_sheets_request(method: str, path: str, **kwargs) -> dict:
    token = await get_google_access_token()
    async with httpx.AsyncClient() as http_client:
        response = await http_client.request(
            method,
            f"https://sheets.googleapis.com/v4/spreadsheets/{get_schedule_spreadsheet_id()}{path}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30.0,
            **kwargs,
        )
    if response.status_code >= 400:
        logger.error("Google Sheets API request failed: %s", response.text)
        raise HTTPException(status_code=502, detail="Google Sheets write request failed")
    return response.json() if response.content else {}


async def get_schedule_sheet_title() -> str:
    configured_title = os.environ.get("SCHEDULE_SHEET_NAME")
    if configured_title:
        return configured_title
    metadata = await google_sheets_request("GET", "?fields=sheets.properties.title")
    sheets = metadata.get("sheets", [])
    if not sheets:
        raise HTTPException(status_code=502, detail="Schedule spreadsheet has no sheets")
    return sheets[0]["properties"]["title"]


async def get_admin_schedule_events() -> AdminScheduleResponse:
    async with httpx.AsyncClient(follow_redirects=True) as http_client:
        response = await http_client.get(EVENTS_SHEET_CSV_URL, timeout=30.0)
        response.raise_for_status()

    reader = csv.DictReader(StringIO(response.text))
    events = []
    for idx, row in enumerate(reader):
        if not is_valid_schedule_row(row):
            if has_schedule_content(row):
                logger.warning("Skipping invalid schedule row %s: missing required fields", idx + 2)
            continue
        events.append(schedule_event_from_row(row, idx))

    return AdminScheduleResponse(
        events=events,
        last_updated=datetime.utcnow(),
        total_count=len(events),
    )


async def replace_schedule_sheet(rows: List[ScheduleImportRow]) -> AdminScheduleResponse:
    sheet_title = await get_schedule_sheet_title()
    row_values = [SCHEDULE_SHEET_HEADERS] + [
        schedule_payload_to_sheet_row(row.data) for row in rows
    ]
    clear_range = quote(f"{sheet_title}!A:J", safe="")
    await google_sheets_request("POST", f"/values/{clear_range}:clear")
    encoded_range = quote(f"{sheet_title}!A1:J{max(len(row_values), 1)}", safe="")
    await google_sheets_request(
        "PUT",
        f"/values/{encoded_range}?valueInputOption=USER_ENTERED",
        json={"values": row_values},
    )
    return await get_admin_schedule_events()


async def append_schedule_event(payload: ScheduleEventPayload) -> AdminScheduleResponse:
    sheet_title = await get_schedule_sheet_title()
    encoded_range = quote(f"{sheet_title}!A:J", safe="")
    await google_sheets_request(
        "POST",
        f"/values/{encoded_range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS",
        json={"values": [schedule_payload_to_sheet_row(payload)]},
    )
    return await get_admin_schedule_events()


async def update_schedule_event_row(event_id: str, payload: ScheduleEventPayload) -> AdminScheduleResponse:
    row_number = get_schedule_row_number(event_id)
    sheet_title = await get_schedule_sheet_title()
    encoded_range = quote(f"{sheet_title}!A{row_number}:J{row_number}", safe="")
    await google_sheets_request(
        "PUT",
        f"/values/{encoded_range}?valueInputOption=USER_ENTERED",
        json={"values": [schedule_payload_to_sheet_row(payload)]},
    )
    return await get_admin_schedule_events()


async def clear_schedule_event_row(event_id: str) -> AdminScheduleResponse:
    row_number = get_schedule_row_number(event_id)
    sheet_title = await get_schedule_sheet_title()
    encoded_range = quote(f"{sheet_title}!A{row_number}:J{row_number}", safe="")
    await google_sheets_request("POST", f"/values/{encoded_range}:clear")
    return await get_admin_schedule_events()


async def get_public_schedule_events_from_google() -> ScheduleResponse:
    async with httpx.AsyncClient(follow_redirects=True) as http_client:
        response = await http_client.get(EVENTS_SHEET_CSV_URL, timeout=30.0)
        response.raise_for_status()

    reader = csv.DictReader(StringIO(response.text))

    events = []
    for idx, row in enumerate(reader):
        if not is_valid_schedule_row(row):
            if has_schedule_content(row):
                logger.warning(f"Skipping invalid schedule row {idx + 2}: missing required fields")
            continue

        try:
            lat = float(get_schedule_cell(row, 'Lat')) if get_schedule_cell(row, 'Lat') else None
            lng = float(get_schedule_cell(row, 'Long')) if get_schedule_cell(row, 'Long') else None
        except ValueError:
            lat, lng = None, None

        event_id = f"gs_{idx}_{get_schedule_cell(row, 'Name').replace(' ', '_').lower()}"

        event = ScheduleEvent(
            id=event_id,
            title=get_schedule_cell(row, 'Name', 'Untitled Event'),
            description=get_schedule_cell(row, 'Description'),
            start_date=get_schedule_cell(row, 'Start Date'),
            start_time=get_schedule_cell(row, 'Event Start'),
            end_time=get_schedule_cell(row, 'Event End'),
            category=get_schedule_cell(row, 'Category', 'Event'),
            latitude=lat,
            longitude=lng,
            days_active=get_schedule_cell(row, 'Days_Active'),
            location_name=get_schedule_cell(row, 'Location')
        )
        events.append(event)

    return ScheduleResponse(
        events=events,
        last_updated=datetime.utcnow(),
        total_count=len(events)
    )


async def get_public_vendors_from_google() -> VendorsResponse:
    async with httpx.AsyncClient(follow_redirects=True) as http_client:
        response = await http_client.get(VENDORS_SHEET_CSV_URL, timeout=30.0)
        response.raise_for_status()

    reader = csv.DictReader(StringIO(response.text))

    vendors = []
    for idx, row in enumerate(reader):
        name = row.get('Name', '').strip()
        if not name:
            continue

        vendor_id = f"vendor_{idx}_{name.replace(' ', '_').lower()}"

        priority_str = row.get('priority', '').strip()
        try:
            priority = int(priority_str) if priority_str else 99
        except ValueError:
            priority = 99

        vendor = Vendor(
            id=vendor_id,
            name=name,
            type=row.get('Type', '').strip(),
            location=row.get('Location', '').strip(),
            hours_of_operation=row.get('Hours of Operation', '').strip(),
            days_of_operation=row.get('Days of Operation', '').strip(),
            priority=priority,
        )
        vendors.append(vendor)

    vendors.sort(key=lambda v: v.priority)

    return VendorsResponse(
        vendors=vendors,
        last_updated=datetime.utcnow(),
        total_count=len(vendors)
    )


event_service = EventService(DEFAULT_EVENT_ID)
if CONTENT_SOURCE == "supabase":
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "CONTENT_SOURCE=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
        )
    schedule_service = SupabaseScheduleService(
        supabase_url=SUPABASE_URL,
        service_role_key=SUPABASE_SERVICE_ROLE_KEY,
        event_slug=event_service.get_public_event_id(),
        schedule_response_model=ScheduleResponse,
        schedule_event_model=ScheduleEvent,
        admin_schedule_response_model=AdminScheduleResponse,
        admin_schedule_event_model=AdminScheduleEvent,
    )
else:
    schedule_service = ScheduleService(
        list_public_schedule=get_public_schedule_events_from_google,
        list_admin_schedule=get_admin_schedule_events,
        replace_schedule=replace_schedule_sheet,
        append_schedule_event=append_schedule_event,
        update_schedule_event=update_schedule_event_row,
        clear_schedule_event=clear_schedule_event_row,
    )
if CONTENT_SOURCE == "supabase":
    vendor_service = SupabaseVendorService(
        supabase_url=SUPABASE_URL,
        service_role_key=SUPABASE_SERVICE_ROLE_KEY,
        event_slug=event_service.get_public_event_id(),
        vendors_response_model=VendorsResponse,
        vendor_model=Vendor,
    )
else:
    vendor_service = VendorService(
        list_public_vendors=get_public_vendors_from_google,
    )

announcement_service = None
notification_delivery_service = None
itinerary_reminder_repository = None
if CONTENT_SOURCE == "supabase":
    announcement_service = SupabaseAnnouncementService(
        supabase_url=SUPABASE_URL,
        service_role_key=SUPABASE_SERVICE_ROLE_KEY,
        event_slug=event_service.get_public_event_id(),
    )
    notification_delivery_service = SupabaseNotificationDeliveryService(
        supabase_url=SUPABASE_URL,
        service_role_key=SUPABASE_SERVICE_ROLE_KEY,
        event_slug=event_service.get_public_event_id(),
    )
    itinerary_reminder_repository = SupabaseItineraryReminderRepository(
        schedule_service.client, event_service.get_public_event_id()
    )

wonderpush_client = None
if WONDERPUSH_ACCESS_TOKEN:
    wonderpush_client = WonderPushClient(access_token=WONDERPUSH_ACCESS_TOKEN)


def normalize_username(username: str) -> str:
    return username.strip().lower()


def get_event_id(event_id: Optional[str] = None) -> str:
    return event_service.get_event_id(event_id)


def get_public_event_id(request: Optional[Request] = None) -> str:
    return event_service.get_request_event_id(request)


def get_admin_event_id(
    user: Optional[dict] = None,
    event_id: Optional[str] = None,
) -> str:
    return event_service.get_admin_event_id(user=user, event_id=event_id)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_HASH_ITERATIONS,
    )
    return "pbkdf2_sha256${}${}${}".format(
        PASSWORD_HASH_ITERATIONS,
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(password_hash).decode("ascii"),
    )


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt, expected_hash = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        password_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            base64.b64decode(salt.encode("ascii")),
            int(iterations),
        )
        return hmac.compare_digest(
            base64.b64encode(password_hash).decode("ascii"),
            expected_hash,
        )
    except Exception:
        return False


def create_session_token() -> str:
    return secrets.token_urlsafe(48)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def public_organizer_user(user: dict) -> OrganizerUserPublic:
    return OrganizerUserPublic(
        id=user["id"],
        username=user["username"],
        display_name=user.get("display_name") or user["username"],
        role=user["role"],
        event_id=get_admin_event_id(user),
        is_active=user.get("is_active", True),
        created_at=user.get("created_at", datetime.utcnow()),
        updated_at=user.get("updated_at", datetime.utcnow()),
        last_login_at=user.get("last_login_at"),
    )


def public_broadcast(broadcast: dict) -> BroadcastResponse:
    return BroadcastResponse(
        id=broadcast["id"],
        event_id=get_event_id(broadcast.get("event_id")),
        title=broadcast["title"],
        message=broadcast["message"],
        priority=broadcast["priority"],
        sender_username=broadcast["sender_username"],
        sender_role=broadcast["sender_role"],
        created_at=broadcast["created_at"],
        sent_at=broadcast["sent_at"],
        status=broadcast["status"],
        audience=broadcast["audience"],
    )


async def queue_broadcast_push_delivery(broadcast: dict):
    # TODO: Connect this service boundary to a push notification provider.
    # This function intentionally avoids provider-specific behavior for now.
    logger.info(
        "Broadcast %s saved for future push delivery integration",
        broadcast.get("id"),
    )


def require_broadcast_sender_role(user: dict):
    if user.get("role") not in ("Owner", "Communications"):
        raise HTTPException(
            status_code=403,
            detail="Your organizer role can view broadcasts but cannot send them",
        )


def require_announcement_manager_role(user: dict):
    if user.get("role") not in ("Owner", "Communications"):
        raise HTTPException(
            status_code=403,
            detail="Your organizer role cannot manage announcements",
        )


def validate_announcement_payload(data: AnnouncementPayload):
    if not data.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")
    if not data.message.strip():
        raise HTTPException(status_code=400, detail="Message is required")
    if data.expires_at:
        expires_at = data.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Expiry date/time must be in the future")


def require_announcement_service():
    if announcement_service is None:
        raise HTTPException(
            status_code=503,
            detail="Announcements require the Supabase content source",
        )
    return announcement_service


def require_notification_delivery_service():
    if notification_delivery_service is None:
        raise HTTPException(
            status_code=503,
            detail="Notification delivery requires the Supabase content source",
        )
    return notification_delivery_service


def require_wonderpush_client():
    if wonderpush_client is None:
        raise HTTPException(status_code=503, detail="WonderPush is not configured")
    return wonderpush_client


ANNOUNCEMENT_MAX_TTL_SECONDS = 72 * 60 * 60
ANNOUNCEMENT_MIN_USEFUL_TTL_SECONDS = 60


def announcement_expiration_time(announcement: dict, *, now: datetime | None = None) -> str:
    """Return a bounded WonderPush duration, rejecting effectively stale pushes."""
    reference = now or datetime.now(timezone.utc)
    ttl_seconds = ANNOUNCEMENT_MAX_TTL_SECONDS
    expires_at = announcement.get("expires_at")
    if expires_at:
        expiry = expires_at if isinstance(expires_at, datetime) else datetime.fromisoformat(
            str(expires_at).replace("Z", "+00:00"))
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        ttl_seconds = min(ttl_seconds, int((expiry - reference).total_seconds()))
    if ttl_seconds < ANNOUNCEMENT_MIN_USEFUL_TTL_SECONDS:
        raise HTTPException(status_code=409, detail="Announcement expires too soon to notify")
    return f"{ttl_seconds} seconds"


def require_schedule_manager_role(user: dict):
    if user.get("role") not in ("Owner", "Schedule"):
        raise HTTPException(
            status_code=403,
            detail="Your organizer role cannot manage schedule events",
        )


def require_vendor_manager_role(user: dict):
    if user.get("role") != "Owner":
        raise HTTPException(
            status_code=403,
            detail="Your organizer role cannot manage vendors",
        )


def require_plowing_demo():
    if not IS_STAGING_DEPLOYMENT:
        raise HTTPException(status_code=404, detail="Not found")
    return require_mongodb()


def require_plowing_manager_role(user: dict):
    if user.get("role") not in ("Owner", "Schedule"):
        raise HTTPException(status_code=403, detail="Your organizer role cannot publish plowing results")


async def get_or_create_plowing_demo():
    database = require_plowing_demo()
    document = await database.plowing_results_demo.find_one({"id": "ipm-plowing-results-demo-v1"})
    if document is None:
        document = demo_document()
        await database.plowing_results_demo.insert_one(document)
    return ranked_document(document)


def set_admin_session_cookie(response: Response, token: str, expires_at: datetime):
    cookie_expires_at = expires_at
    if cookie_expires_at.tzinfo is None:
        cookie_expires_at = cookie_expires_at.replace(tzinfo=timezone.utc)

    response.set_cookie(
        key=ADMIN_SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=ADMIN_COOKIE_SECURE,
        samesite="none" if ADMIN_COOKIE_SECURE else "lax",
        expires=cookie_expires_at,
        max_age=ADMIN_SESSION_DAYS * 24 * 60 * 60,
        path="/",
    )


def clear_admin_session_cookie(response: Response):
    response.delete_cookie(
        key=ADMIN_SESSION_COOKIE_NAME,
        path="/",
        secure=ADMIN_COOKIE_SECURE,
        samesite="none" if ADMIN_COOKIE_SECURE else "lax",
    )


class PushTokenRegister(BaseModel):
    push_token: str
    device_id: str

class StarredEventsUpdate(BaseModel):
    push_token: str
    starred_event_ids: List[str]

class SOSReport(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    sex: str
    age: str
    height: str
    hair_color: str
    glasses: bool
    shirt_color: str
    pants_color: str
    last_location: str
    description: Optional[str] = ""  # Additional description/notes
    reporter_name: str = ""  # Reporter's name (required)
    reporter_phone: str = ""  # Reporter's phone number (required)
    status: str = "active"  # active, resolved, archived
    reporter_token: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None

class SOSReportCreate(BaseModel):
    name: str
    sex: str
    age: str
    height: str
    hair_color: str
    glasses: bool
    shirt_color: str
    pants_color: str
    last_location: str
    description: Optional[str] = ""
    reporter_name: str = ""  # Required
    reporter_phone: str = ""  # Required
    reporter_token: Optional[str] = None

class SOSResolveRequest(BaseModel):
    pin: str

# Public response - hides reporter info for privacy
class SOSReportResponse(BaseModel):
    id: str
    name: str
    sex: str
    age: str
    height: str
    hair_color: str
    glasses: bool
    shirt_color: str
    pants_color: str
    last_location: str
    description: Optional[str] = ""
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None

# Admin response - includes reporter contact info
class SOSReportAdminResponse(BaseModel):
    id: str
    name: str
    sex: str
    age: str
    height: str
    hair_color: str
    glasses: bool
    shirt_color: str
    pants_color: str
    last_location: str
    description: Optional[str] = ""
    reporter_name: str
    reporter_phone: str
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None

# Admin PIN for resolving alerts (default: 2026)
ADMIN_PIN = os.environ.get("ADMIN_PIN", "2026")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def log_analytics_ingestion_exception(operation: str, exc: Exception) -> None:
    """Log an unexpected ingestion failure without request or document data."""
    error_code = getattr(exc, "code", None)
    if not isinstance(error_code, int):
        error_code = None

    details = getattr(exc, "details", None)
    code_name = details.get("codeName") if isinstance(details, dict) else None
    if not isinstance(code_name, str) or not re.fullmatch(r"[A-Za-z0-9_.-]{1,64}", code_name):
        code_name = None

    # format_tb includes call frames but not the exception message, whose text
    # can contain Mongo commands or document values.
    stack_trace = "".join(traceback.format_tb(exc.__traceback__)).rstrip()
    logger.error(
        "analytics_ingestion_unexpected operation=%s exception_type=%s "
        "error_code=%s code_name=%s message=unexpected_analytics_ingestion_failure "
        "stack_trace=%s",
        operation,
        type(exc).__name__,
        error_code,
        code_name,
        stack_trace,
    )


async def analytics_session_start_exception_diagnostics(request: Request, call_next):
    """Capture failures that occur outside the session-start route function."""
    session_start_paths = {
        "/api/activity/session/start",
        "/api/analytics/session/start",
    }
    if request.method != "POST" or request.url.path not in session_start_paths:
        return await call_next(request)
    try:
        return await call_next(request)
    except Exception as exc:
        log_analytics_ingestion_exception("analytics_session_start_asgi", exc)
        return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


app.middleware("http")(analytics_session_start_exception_diagnostics)


def require_mongodb():
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="MongoDB is unavailable. This feature is disabled."
        )
    return db


async def get_current_organizer_user(request: Request) -> dict:
    database = require_mongodb()
    token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")

    session = await database.organizer_sessions.find_one({
        "token_hash": hash_session_token(token),
        "expires_at": {"$gt": datetime.utcnow()},
    })
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    user = await database.organizer_users.find_one({
        "id": session["user_id"],
        "event_id": session["event_id"],
        "is_active": True,
    })
    if not user:
        await database.organizer_sessions.delete_one({"id": session["id"]})
        raise HTTPException(status_code=401, detail="Organizer user is unavailable")

    return user


async def create_organizer_session(database, user: dict, response: Response) -> OrganizerUserPublic:
    session_token = create_session_token()
    expires_at = datetime.utcnow() + timedelta(days=ADMIN_SESSION_DAYS)
    session = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "event_id": get_admin_event_id(user),
        "token_hash": hash_session_token(session_token),
        "created_at": datetime.utcnow(),
        "expires_at": expires_at,
    }
    await database.organizer_sessions.insert_one(session)
    await database.organizer_users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login_at": datetime.utcnow(), "updated_at": datetime.utcnow()}},
    )
    set_admin_session_cookie(response, session_token, expires_at)
    user["last_login_at"] = datetime.utcnow()
    return public_organizer_user(user)

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}


@api_router.get("/version")
async def deployment_version():
    """Expose only non-secret build identity for staging deployment verification."""
    if not IS_STAGING_DEPLOYMENT:
        raise HTTPException(status_code=404, detail="Not found")
    commit = os.environ.get("RENDER_GIT_COMMIT", "").strip()
    return {
        "environment": "staging",
        "git_commit": commit or None,
        "git_commit_available": bool(commit),
    }


@api_router.get("/download-dist")
async def download_dist():
    """Download the dist folder as a zip file for Netlify deployment"""
    zip_path = ROOT_DIR / "dist.zip"
    if zip_path.exists():
        return FileResponse(
            path=str(zip_path),
            filename="ipm2026-dist.zip",
            media_type="application/zip",
            headers={
                "Content-Disposition": "attachment; filename=ipm2026-dist.zip"
            }
        )
    raise HTTPException(status_code=404, detail="dist.zip not found")

@api_router.get("/dist.zip")
async def download_dist_zip():
    """Download the dist folder as a zip file for Netlify deployment"""
    zip_path = ROOT_DIR / "dist.zip"
    if zip_path.exists():
        return FileResponse(
            path=str(zip_path),
            filename="ipm2026-dist.zip",
            media_type="application/zip",
            headers={
                "Content-Disposition": "attachment; filename=ipm2026-dist.zip"
            }
        )
    raise HTTPException(status_code=404, detail="dist.zip not found")

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    database = require_mongodb()
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await database.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    database = require_mongodb()
    status_checks = await database.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]


def require_analytics_repository():
    if analytics_repository is None:
        raise HTTPException(status_code=503, detail="Analytics storage is not configured")
    return analytics_repository


@api_router.post("/analytics/session/start", status_code=202, include_in_schema=False)
@api_router.post("/activity/session/start", status_code=202)
async def analytics_session_start(data: AnalyticsSessionRequest):
    """Start one anonymous attendee session in the server-owned IPM scope."""
    try:
        result = await start_analytics_session(require_analytics_repository(), data)
        return {"eventScope": ANALYTICS_EVENT_SCOPE, **result}
    except AnalyticsValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        log_analytics_ingestion_exception("analytics_session_start", exc)
        return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


@api_router.post("/analytics/session/heartbeat", status_code=202, include_in_schema=False)
@api_router.post("/activity/session/heartbeat", status_code=202)
async def analytics_session_heartbeat(data: AnalyticsSessionRequest):
    """Refresh activity for an existing, non-expired anonymous session."""
    try:
        result = await heartbeat_analytics_session(require_analytics_repository(), data)
        return {"eventScope": ANALYTICS_EVENT_SCOPE, **result}
    except AnalyticsValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@api_router.post("/analytics/session/end", status_code=202, include_in_schema=False)
@api_router.post("/activity/session/end", status_code=202)
async def analytics_session_end(data: AnalyticsSessionEndRequest):
    """End an anonymous attendee session. Repeated endings are idempotent."""
    try:
        result = await end_analytics_session(require_analytics_repository(), data)
        return {"eventScope": ANALYTICS_EVENT_SCOPE, **result}
    except AnalyticsValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@api_router.post("/analytics/events", status_code=202, include_in_schema=False)
@api_router.post("/activity/events", status_code=202)
async def analytics_events(data: AnalyticsEventsRequest):
    """Validate and ingest a bounded batch of allowlisted attendee events."""
    try:
        result = await ingest_analytics_events(require_analytics_repository(), data)
        return {"eventScope": ANALYTICS_EVENT_SCOPE, **result}
    except AnalyticsValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def require_analytics_reporting_repository(current_user: dict):
    if get_admin_event_id(current_user) != ANALYTICS_EVENT_SCOPE:
        raise HTTPException(status_code=403, detail="Analytics are unavailable for this event")
    if analytics_reporting_repository is None:
        raise HTTPException(status_code=503, detail="Analytics reporting storage is not configured")
    return analytics_reporting_repository


async def run_ranged_analytics_report(report, range_name: str, current_user: dict):
    repository = require_analytics_reporting_repository(current_user)
    try:
        return await report(repository, range_name)
    except AnalyticsRangeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@api_router.get("/admin/analytics/summary")
async def admin_analytics_summary(
    range: str = "7d",
    current_user: dict = Depends(get_current_organizer_user),
):
    return await run_ranged_analytics_report(get_analytics_summary_report, range, current_user)


@api_router.get("/admin/analytics/live")
async def admin_analytics_live(current_user: dict = Depends(get_current_organizer_user)):
    repository = require_analytics_reporting_repository(current_user)
    return await get_analytics_live_report(repository)


@api_router.get("/admin/analytics/traffic")
async def admin_analytics_traffic(
    range: str = "7d",
    current_user: dict = Depends(get_current_organizer_user),
):
    return await run_ranged_analytics_report(get_analytics_traffic_report, range, current_user)


@api_router.get("/admin/analytics/content")
async def admin_analytics_content(
    range: str = "7d",
    current_user: dict = Depends(get_current_organizer_user),
):
    return await run_ranged_analytics_report(get_analytics_content_report, range, current_user)


@api_router.post("/admin/bootstrap", response_model=OrganizerAuthResponse)
async def bootstrap_organizer_owner(data: OrganizerBootstrapRequest, response: Response):
    database = require_mongodb()
    event_id = get_event_id(data.event_id)
    username = normalize_username(data.username)
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if len(data.password) < 10:
        raise HTTPException(status_code=400, detail="Password must be at least 10 characters")

    existing_count = await database.organizer_users.count_documents({"event_id": event_id})
    if existing_count > 0:
        raise HTTPException(status_code=409, detail="Organizer users already exist for this event")

    now = datetime.utcnow()
    user = {
        "id": str(uuid.uuid4()),
        "username": username,
        "display_name": data.display_name.strip() if data.display_name else username,
        "password_hash": hash_password(data.password),
        "role": "Owner",
        "event_id": event_id,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
        "last_login_at": None,
    }
    await database.organizer_users.insert_one(user)
    public_user = await create_organizer_session(database, user, response)
    return OrganizerAuthResponse(user=public_user)


@api_router.post("/admin/auth/login", response_model=OrganizerAuthResponse)
async def login_organizer(data: OrganizerLoginRequest, response: Response):
    database = require_mongodb()
    event_id = get_event_id(data.event_id)
    username = normalize_username(data.username)

    user = await database.organizer_users.find_one({
        "username": username,
        "event_id": event_id,
        "is_active": True,
    })
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    public_user = await create_organizer_session(database, user, response)
    return OrganizerAuthResponse(user=public_user)


@api_router.post("/admin/auth/logout")
async def logout_organizer(request: Request, response: Response):
    database = require_mongodb()
    token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)
    if token:
        await database.organizer_sessions.delete_one({"token_hash": hash_session_token(token)})
    clear_admin_session_cookie(response)
    return {"status": "success"}


@api_router.get("/admin/auth/me", response_model=OrganizerAuthResponse)
async def get_organizer_me(current_user: dict = Depends(get_current_organizer_user)):
    return OrganizerAuthResponse(user=public_organizer_user(current_user))


@api_router.get("/plowing-results")
async def get_plowing_results_demo():
    return await get_or_create_plowing_demo()


@api_router.get("/admin/plowing-results")
async def get_admin_plowing_results_demo(current_user: dict = Depends(get_current_organizer_user)):
    require_plowing_manager_role(current_user)
    return await get_or_create_plowing_demo()


@api_router.put("/admin/plowing-results")
async def publish_admin_plowing_results_demo(
    payload: DemoResultsPayload,
    current_user: dict = Depends(get_current_organizer_user),
):
    require_plowing_manager_role(current_user)
    database = require_plowing_demo()
    document = validated_document(payload, str(current_user.get("username") or "organizer"))
    await database.plowing_results_demo.replace_one(
        {"id": "ipm-plowing-results-demo-v1"}, document, upsert=True
    )
    return ranked_document(document)


@api_router.post("/admin/plowing-results/reset")
async def reset_admin_plowing_results_demo(current_user: dict = Depends(get_current_organizer_user)):
    require_plowing_manager_role(current_user)
    database = require_plowing_demo()
    document = demo_document(str(current_user.get("username") or "organizer"))
    await database.plowing_results_demo.replace_one(
        {"id": "ipm-plowing-results-demo-v1"}, document, upsert=True
    )
    return ranked_document(document)


@api_router.get("/admin/users", response_model=OrganizerUsersResponse)
async def list_organizer_users(current_user: dict = Depends(get_current_organizer_user)):
    database = require_mongodb()
    users = await database.organizer_users.find({
        "event_id": get_admin_event_id(current_user)
    }).sort("created_at", 1).to_list(1000)
    public_users = [public_organizer_user(user) for user in users]
    return OrganizerUsersResponse(users=public_users, total_count=len(public_users))


@api_router.post("/admin/users", response_model=OrganizerUserPublic)
async def create_organizer_user(
    data: OrganizerCreateUserRequest,
    current_user: dict = Depends(get_current_organizer_user),
):
    database = require_mongodb()
    event_id = get_admin_event_id(current_user, data.event_id)
    username = normalize_username(data.username)
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if len(data.password) < 10:
        raise HTTPException(status_code=400, detail="Password must be at least 10 characters")

    existing_user = await database.organizer_users.find_one({
        "username": username,
        "event_id": event_id,
    })
    if existing_user:
        raise HTTPException(status_code=409, detail="Organizer user already exists for this event")

    now = datetime.utcnow()
    user = {
        "id": str(uuid.uuid4()),
        "username": username,
        "display_name": data.display_name.strip() if data.display_name else username,
        "password_hash": hash_password(data.password),
        "role": data.role,
        "event_id": event_id,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
        "last_login_at": None,
    }
    await database.organizer_users.insert_one(user)
    return public_organizer_user(user)


@api_router.post("/admin/broadcasts", response_model=BroadcastResponse)
async def create_broadcast(
    data: BroadcastCreateRequest,
    current_user: dict = Depends(get_current_organizer_user),
):
    require_broadcast_sender_role(current_user)
    database = require_mongodb()

    title = data.title.strip()
    message = data.message.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    now = datetime.utcnow()
    broadcast = {
        "id": str(uuid.uuid4()),
        "event_id": get_admin_event_id(current_user),
        "title": title,
        "message": message,
        "priority": data.priority,
        "sender_username": current_user["username"],
        "sender_role": current_user["role"],
        "created_at": now,
        "sent_at": now,
        "status": "sent",
        "audience": "Everyone",
    }
    await database.broadcasts.insert_one(broadcast)
    await queue_broadcast_push_delivery(broadcast)
    return public_broadcast(broadcast)


@api_router.get("/admin/broadcasts", response_model=BroadcastsResponse)
async def list_broadcasts(current_user: dict = Depends(get_current_organizer_user)):
    database = require_mongodb()
    broadcasts = await database.broadcasts.find({
        "event_id": get_admin_event_id(current_user)
    }).sort("sent_at", -1).to_list(200)
    public_broadcasts = [public_broadcast(broadcast) for broadcast in broadcasts]
    return BroadcastsResponse(
        broadcasts=public_broadcasts,
        total_count=len(public_broadcasts),
    )


@api_router.get("/admin/announcements", response_model=AnnouncementsResponse)
async def list_admin_announcements(current_user: dict = Depends(get_current_organizer_user)):
    require_announcement_manager_role(current_user)
    service = require_announcement_service()
    announcements = await service.list(get_admin_event_id(current_user))
    return AnnouncementsResponse(announcements=announcements, total_count=len(announcements))


@api_router.post("/admin/announcements", response_model=AnnouncementResponse, status_code=201)
async def create_admin_announcement(
    data: AnnouncementPayload,
    current_user: dict = Depends(get_current_organizer_user),
):
    require_announcement_manager_role(current_user)
    validate_announcement_payload(data)
    service = require_announcement_service()
    return await service.create(
        data,
        current_user.get("display_name") or current_user["username"],
        get_admin_event_id(current_user),
    )


@api_router.put("/admin/announcements/{announcement_id}", response_model=AnnouncementResponse)
async def update_admin_announcement(
    announcement_id: str,
    data: AnnouncementPayload,
    current_user: dict = Depends(get_current_organizer_user),
):
    require_announcement_manager_role(current_user)
    validate_announcement_payload(data)
    service = require_announcement_service()
    announcement = await service.update(announcement_id, data, get_admin_event_id(current_user))
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return announcement


@api_router.patch("/admin/announcements/{announcement_id}/status", response_model=AnnouncementResponse)
async def set_admin_announcement_status(
    announcement_id: str,
    data: AnnouncementStatusPayload,
    current_user: dict = Depends(get_current_organizer_user),
):
    require_announcement_manager_role(current_user)
    service = require_announcement_service()
    announcement = await service.set_status(announcement_id, data.status, get_admin_event_id(current_user))
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return announcement


@api_router.delete("/admin/announcements/{announcement_id}", status_code=204)
async def delete_admin_announcement(
    announcement_id: str,
    current_user: dict = Depends(get_current_organizer_user),
):
    require_announcement_manager_role(current_user)
    service = require_announcement_service()
    if not await service.delete(announcement_id, get_admin_event_id(current_user)):
        raise HTTPException(status_code=404, detail="Announcement not found")
    return Response(status_code=204)


@api_router.get("/announcements", response_model=AnnouncementsResponse)
async def list_public_announcements(event_id: Optional[str] = None):
    """Return published, unexpired announcements for one event."""
    service = require_announcement_service()
    announcements = await service.list(get_event_id(event_id), public=True)
    return AnnouncementsResponse(announcements=announcements, total_count=len(announcements))


@api_router.get("/announcements/{announcement_id}", response_model=AnnouncementResponse)
async def get_public_announcement(announcement_id: str, event_id: Optional[str] = None):
    """Return one published, unexpired announcement in the requested event."""
    service = require_announcement_service()
    announcement = await service.get(announcement_id, get_event_id(event_id), public=True)
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return announcement


async def notify_announcement(
    announcement_id: str,
    audience: Literal["test", "everyone"],
    current_user: dict,
) -> NotificationDeliveryResponse:
    require_announcement_manager_role(current_user)
    announcements = require_announcement_service()
    deliveries = require_notification_delivery_service()
    provider = require_wonderpush_client()
    event_id = get_admin_event_id(current_user)

    announcement = await announcements.get(announcement_id, event_id, public=True)
    if not announcement:
        raise HTTPException(
            status_code=409,
            detail="Only published, unexpired announcements can be notified",
        )
    if audience == "test" and not WONDERPUSH_TEST_INSTALLATION_IDS:
        raise HTTPException(status_code=503, detail="No WonderPush test installations are configured")

    expiration_time = announcement_expiration_time(announcement)

    target_url = f"{PUBLIC_APP_URL}/announcements/{quote(announcement_id, safe='')}"
    content = provider.notification_content(
        announcement["title"], announcement["message"], target_url
    )
    try:
        delivery = await deliveries.create_requested(
            event_id=event_id,
            announcement_id=announcement_id,
            audience=audience,
            requested_by=current_user.get("display_name") or current_user["username"],
            target_url=content["target_url"],
            notification_title=content["title"],
            notification_message=content["message"],
            provider="wonderpush",
        )
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 409 and audience == "everyone":
            raise HTTPException(
                status_code=409,
                detail="An everyone notification has already been requested or sent for this announcement",
            ) from exc
        raise

    try:
        if audience == "test":
            campaign_id = await provider.send_test(
                **content, installation_ids=WONDERPUSH_TEST_INSTALLATION_IDS,
                idempotency_key=f"announcement-test-{delivery['id']}",
                campaign_id=WONDERPUSH_ANNOUNCEMENT_CAMPAIGN_ID or None,
                expiration_time=expiration_time,
            )
        else:
            campaign_id = await provider.send_everyone(
                **content,
                idempotency_key=f"announcement-{event_id}-{announcement_id}"[:64],
                campaign_id=WONDERPUSH_ANNOUNCEMENT_CAMPAIGN_ID or None,
                expiration_time=expiration_time,
            )
    except WonderPushError as exc:
        await deliveries.mark_failed(delivery["id"], str(exc))
        detail = str(exc) if audience == "test" else "Notification could not be sent."
        raise HTTPException(status_code=502, detail=detail) from exc

    sent = await deliveries.mark_sent(delivery["id"], campaign_id)
    return NotificationDeliveryResponse(**sent)


@api_router.post(
    "/admin/announcements/{announcement_id}/notify/test",
    response_model=NotificationDeliveryResponse,
)
async def notify_announcement_test(
    announcement_id: str,
    current_user: dict = Depends(get_current_organizer_user),
):
    return await notify_announcement(announcement_id, "test", current_user)


@api_router.post(
    "/admin/announcements/{announcement_id}/notify/everyone",
    response_model=NotificationDeliveryResponse,
)
async def notify_announcement_everyone(
    announcement_id: str,
    current_user: dict = Depends(get_current_organizer_user),
):
    return await notify_announcement(announcement_id, "everyone", current_user)


@api_router.get("/admin/schedule", response_model=AdminScheduleResponse)
async def list_admin_schedule(current_user: dict = Depends(get_current_organizer_user)):
    require_schedule_manager_role(current_user)
    admin_event_id = get_admin_event_id(current_user)
    try:
        return await schedule_service.list_admin_schedule(admin_event_id)
    except httpx.HTTPError as e:
        logger.error("Failed to fetch schedule sheet for admin: %s", e)
        raise HTTPException(status_code=502, detail="Failed to fetch schedule data")


@api_router.post("/admin/schedule/import", response_model=ScheduleImportResponse)
async def import_admin_schedule(
    data: ScheduleImportRequest,
    current_user: dict = Depends(get_current_organizer_user),
):
    require_schedule_manager_role(current_user)
    admin_event_id = get_admin_event_id(current_user)
    schedule = await schedule_service.replace_schedule(data.rows, admin_event_id)
    return ScheduleImportResponse(
        imported_count=len(data.rows),
        problem_count=len(data.problems),
        problems=data.problems,
        events=schedule.events,
        last_updated=schedule.last_updated,
    )


@api_router.post("/admin/schedule/events", response_model=AdminScheduleResponse)
async def create_admin_schedule_event(
    data: ScheduleEventPayload,
    current_user: dict = Depends(get_current_organizer_user),
):
    require_schedule_manager_role(current_user)
    admin_event_id = get_admin_event_id(current_user)
    return await schedule_service.append_event(data, admin_event_id)


@api_router.put("/admin/schedule/events/{event_id}", response_model=AdminScheduleResponse)
async def update_admin_schedule_event(
    event_id: str,
    data: ScheduleEventPayload,
    current_user: dict = Depends(get_current_organizer_user),
):
    require_schedule_manager_role(current_user)
    admin_event_id = get_admin_event_id(current_user)
    return await schedule_service.update_event(event_id, data, admin_event_id)


@api_router.delete("/admin/schedule/events/{event_id}", response_model=AdminScheduleResponse)
async def delete_admin_schedule_event(
    event_id: str,
    current_user: dict = Depends(get_current_organizer_user),
):
    require_schedule_manager_role(current_user)
    admin_event_id = get_admin_event_id(current_user)
    return await schedule_service.clear_event(event_id, admin_event_id)


@api_router.post("/admin/schedule/refresh", response_model=ScheduleRefreshResponse)
async def refresh_admin_schedule(current_user: dict = Depends(get_current_organizer_user)):
    require_schedule_manager_role(current_user)
    admin_event_id = get_admin_event_id(current_user)
    schedule = await schedule_service.list_admin_schedule(admin_event_id)
    return ScheduleRefreshResponse(
        status="success",
        events=schedule.events,
        last_updated=schedule.last_updated,
        total_count=schedule.total_count,
    )


@api_router.get("/admin/vendors", response_model=VendorsResponse)
async def list_admin_vendors(current_user: dict = Depends(get_current_organizer_user)):
    require_vendor_manager_role(current_user)
    admin_event_id = get_admin_event_id(current_user)
    try:
        return await vendor_service.list_public_vendors(admin_event_id)
    except httpx.HTTPError as e:
        logger.error("Failed to fetch vendors for admin: %s", e)
        raise HTTPException(status_code=502, detail="Failed to fetch vendors data")


@api_router.post("/admin/vendors", response_model=VendorsResponse)
async def create_admin_vendor(
    data: VendorPayload,
    current_user: dict = Depends(get_current_organizer_user),
):
    require_vendor_manager_role(current_user)
    if not data.name.strip():
        raise HTTPException(status_code=400, detail="Vendor name is required")
    admin_event_id = get_admin_event_id(current_user)
    try:
        return await vendor_service.create_vendor(data, admin_event_id)
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except httpx.HTTPError as e:
        logger.error("Failed to create vendor: %s", e)
        raise HTTPException(status_code=502, detail="Failed to save vendor data")


@api_router.put("/admin/vendors/{vendor_id}", response_model=VendorsResponse)
async def update_admin_vendor(
    vendor_id: str,
    data: VendorPayload,
    current_user: dict = Depends(get_current_organizer_user),
):
    require_vendor_manager_role(current_user)
    if not data.name.strip():
        raise HTTPException(status_code=400, detail="Vendor name is required")
    admin_event_id = get_admin_event_id(current_user)
    try:
        return await vendor_service.update_vendor(vendor_id, data, admin_event_id)
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except httpx.HTTPError as e:
        logger.error("Failed to update vendor %s: %s", vendor_id, e)
        raise HTTPException(status_code=502, detail="Failed to save vendor data")


@api_router.delete("/admin/vendors/{vendor_id}", response_model=VendorsResponse)
async def delete_admin_vendor(
    vendor_id: str,
    current_user: dict = Depends(get_current_organizer_user),
):
    require_vendor_manager_role(current_user)
    admin_event_id = get_admin_event_id(current_user)
    try:
        return await vendor_service.delete_vendor(vendor_id, admin_event_id)
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except httpx.HTTPError as e:
        logger.error("Failed to delete vendor %s: %s", vendor_id, e)
        raise HTTPException(status_code=502, detail="Failed to delete vendor data")


@api_router.get("/schedule", response_model=ScheduleResponse)
async def get_schedule():
    """Fetch schedule events from Google Sheets."""
    try:
        return await schedule_service.list_public_schedule()
    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch Google Sheet: {e}")
        raise HTTPException(status_code=502, detail="Failed to fetch schedule data")
    except Exception as e:
        logger.error(f"Error processing schedule: {e}")
        raise HTTPException(status_code=500, detail="Error processing schedule data")


ITINERARY_STAR_LIMIT = 250

def require_itinerary_foundation():
    if not IS_STAGING_DEPLOYMENT or not ITINERARY_REMINDER_FOUNDATION_ENABLED:
        raise HTTPException(status_code=404, detail="Not found")
    if itinerary_reminder_repository is None:
        raise HTTPException(status_code=503, detail="Itinerary reminder storage is unavailable")
    return itinerary_reminder_repository

_itinerary_reminder_engine_instance: Optional[ItineraryReminderEngine] = None

def itinerary_reminder_engine() -> ItineraryReminderEngine:
    global _itinerary_reminder_engine_instance
    repository = require_itinerary_foundation()
    if _itinerary_reminder_engine_instance is None:
        _itinerary_reminder_engine_instance = ItineraryReminderEngine(repository, require_wonderpush_client(),
            delivery_enabled=ITINERARY_REMINDER_DELIVERY_ENABLED,
            batch_size=ITINERARY_REMINDER_CLAIM_BATCH_SIZE,
            concurrency=ITINERARY_REMINDER_CONCURRENCY,
            max_sends_per_second=ITINERARY_REMINDER_MAX_SENDS_PER_SECOND,
            max_targets_per_request=ITINERARY_REMINDER_MAX_TARGETS_PER_REQUEST,
            provider_readiness_max_age_seconds=ITINERARY_REMINDER_PROVIDER_READINESS_MAX_AGE_SECONDS,
            campaign_id=WONDERPUSH_REMINDER_CAMPAIGN_ID or None,
            target_url=f"{PUBLIC_APP_URL}/itinerary")
    return _itinerary_reminder_engine_instance

def itinerary_device_headers(request: Request) -> tuple[str, str]:
    installation_id = request.headers.get("X-WonderPush-Installation-Id", "").strip()
    capability = request.headers.get("X-Itinerary-Device-Capability", "").strip()
    if not installation_id or len(installation_id) > 500:
        raise HTTPException(status_code=400, detail="A WonderPush installation ID is required")
    if not re.fullmatch(r"[A-Za-z0-9_-]{43}", capability):
        raise HTTPException(status_code=400, detail="A valid device capability is required")
    return installation_id, capability

async def authorize_itinerary_device(request: Request):
    repository = require_itinerary_foundation()
    installation_id, capability = itinerary_device_headers(request)
    try:
        registration = await repository.authorize(installation_id, capability)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail="Invalid installation credentials") from exc
    return repository, registration

async def refresh_provider_readiness(repository, registration):
    try:
        installation = await require_wonderpush_client().get_installation(
            registration["wonderpush_installation_id"])
        reachability, has_push_token = provider_readiness(installation)
    except Exception:
        reachability, has_push_token = "unknown", False
    return await repository.set_readiness(registration["id"], reachability=reachability,
        has_push_token=has_push_token, checked_at=datetime.now(timezone.utc))

async def inspect_provider_readiness(registration):
    try:
        installation = await require_wonderpush_client().get_installation(
            registration["wonderpush_installation_id"])
        reachability, has_push_token = provider_readiness(installation)
    except Exception:
        reachability, has_push_token = "unknown", False
    result = public_status(registration)
    result.update({"provider_reachability": reachability,
        "provider_has_push_token": has_push_token,
        "provider_deliverable": reachability == "optIn" and has_push_token})
    return result

async def verify_current_provider_readiness(repository, registration):
    """Strict attendee-driven verification; transient failures never poison the mirror."""
    try:
        installation = await require_wonderpush_client().get_installation(
            registration["wonderpush_installation_id"])
    except Exception as exc:
        raise HTTPException(status_code=503,
            detail="Reminder readiness could not be verified temporarily") from exc
    reachability, has_token = provider_readiness(installation)
    return await repository.set_readiness(registration["id"], reachability=reachability,
        has_push_token=has_token, checked_at=datetime.now(timezone.utc))

def authoritative_readiness_status(registration):
    checked_at = registration.get("provider_checked_at")
    checked = None
    if isinstance(checked_at, str):
        try: checked = datetime.fromisoformat(checked_at.replace("Z", "+00:00"))
        except ValueError: checked = None
    elif isinstance(checked_at, datetime): checked = checked_at
    fresh = bool(checked and checked.astimezone(timezone.utc) > datetime.now(timezone.utc)
        - timedelta(seconds=ITINERARY_REMINDER_PROVIDER_READINESS_MAX_AGE_SECONDS))
    deliverable = bool(registration.get("provider_deliverable"))
    enabled = bool(registration.get("reminders_enabled"))
    final_ready = enabled and deliverable and fresh
    recovery_reason = None
    if not deliverable:
        recovery_reason = "provider_not_deliverable"
    elif not fresh:
        recovery_reason = "readiness_stale"
    elif not enabled:
        recovery_reason = "reminders_disabled"
    return {
        "registration_exists": True,
        "installation_match": True,
        "reminders_enabled": enabled,
        "synchronized_star_count": int(registration.get("starred_count", 0)),
        "provider_reachability": registration.get("provider_reachability") or "unknown",
        "provider_deliverable": deliverable,
        "provider_checked_at": checked_at,
        "provider_fresh": fresh,
        "final_reminder_ready": final_ready,
        "recovery_reason": recovery_reason,
    }

@api_router.post("/itinerary-reminders/register")
async def register_itinerary_device(request: Request):
    repository = require_itinerary_foundation()
    installation_id, capability = itinerary_device_headers(request)
    try:
        registration = await repository.register(installation_id, capability)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail="Invalid installation credentials") from exc
    return public_status(await verify_current_provider_readiness(repository, registration))

@api_router.get("/itinerary-reminders/status")
async def itinerary_reminder_status(request: Request):
    repository, registration = await authorize_itinerary_device(request)
    registration = await repository.with_starred_count(registration)
    return {**public_status(registration), **authoritative_readiness_status(registration)}

@api_router.post("/itinerary-reminders/readiness/verify")
async def verify_itinerary_reminder_readiness(request: Request):
    repository, registration = await authorize_itinerary_device(request)
    verified = await verify_current_provider_readiness(repository, registration)
    verified = await repository.with_starred_count(verified)
    return authoritative_readiness_status(verified)

@api_router.get("/itinerary-reminders/status-by-capability")
async def itinerary_reminder_status_by_capability(request: Request):
    repository = require_itinerary_foundation()
    capability = request.headers.get("X-Itinerary-Device-Capability", "").strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{43}", capability):
        raise HTTPException(status_code=400, detail="A valid device capability is required")
    registration = await repository.get_by_capability(capability)
    if not registration:
        raise HTTPException(status_code=404, detail="No reminder registration exists for this device")
    registration = await repository.with_starred_count(registration)
    result = {**public_status(registration), **authoritative_readiness_status(registration)}
    result["current_installation_match"] = "unavailable"
    result["installation_match"] = None
    result["final_reminder_ready"] = False
    result["recovery_reason"] = "current_installation_unverified"
    result["reminder_ready"] = False
    return result

@api_router.put("/itinerary-reminders/enabled")
async def set_itinerary_reminders_enabled(data: ItineraryEnabledPayload, request: Request):
    repository, registration = await authorize_itinerary_device(request)
    if data.enabled:
        registration = await verify_current_provider_readiness(repository, registration)
        if not registration.get("provider_deliverable"):
            raise HTTPException(status_code=409, detail="This installation is not currently provider-reachable")
    return public_status(await repository.set_enabled(registration["id"], data.enabled))

@api_router.put("/itinerary-reminders/stars")
async def sync_itinerary_reminder_stars(data: ItineraryStarsPayload, request: Request):
    repository, registration = await authorize_itinerary_device(request)
    schedule_ids = [str(item) for item in data.schedule_ids]
    if len(schedule_ids) > ITINERARY_STAR_LIMIT:
        raise HTTPException(status_code=413, detail="Too many starred Schedule events")
    if len(set(schedule_ids)) != len(schedule_ids):
        raise HTTPException(status_code=400, detail="Duplicate Schedule UUIDs are not allowed")
    if schedule_ids:
        getter = getattr(schedule_service, "get_calendar_rows", None)
        rows = await getter(schedule_ids) if getter else []
        if len(rows) != len(schedule_ids):
            raise HTTPException(status_code=404, detail="Unknown or cross-event Schedule UUID")
    result = await repository.sync_full_set(registration, schedule_ids)
    return {"synced": True, "starred_count": int(result.get("starred_count", len(schedule_ids)))}

@api_router.get("/itinerary-reminders/operations")
async def itinerary_reminder_operations():
    repository = require_itinerary_foundation()
    now = datetime.now(timezone.utc)
    metrics = await repository.operational_metrics(now)
    batch_metrics = await repository.batch_metrics(now)
    durable_metrics = await repository.durable_metrics(now)
    readiness_metrics = await repository.readiness_metrics(
        now, ITINERARY_REMINDER_PROVIDER_READINESS_MAX_AGE_SECONDS)
    provider_control = await repository.provider_control_status()
    benchmark_results = await repository.benchmark_results() if IS_STAGING_DEPLOYMENT else []
    readiness_benchmark = await repository.readiness_benchmark_results() if IS_STAGING_DEPLOYMENT else []
    return {**metrics, **batch_metrics, **durable_metrics, **readiness_metrics,
        "scheduler_enabled": ITINERARY_REMINDER_SCHEDULER_ENABLED,
        "delivery_kill_switch": not ITINERARY_REMINDER_DELIVERY_ENABLED,
        "eligibility_window_minutes": {"after": 25, "through": 30},
        "claim_batch_size": ITINERARY_REMINDER_CLAIM_BATCH_SIZE,
        "concurrency": ITINERARY_REMINDER_CONCURRENCY,
        "max_sends_per_second": ITINERARY_REMINDER_MAX_SENDS_PER_SECOND,
        "max_targets_per_request": ITINERARY_REMINDER_MAX_TARGETS_PER_REQUEST,
        "provider_readiness_max_age_seconds": ITINERARY_REMINDER_PROVIDER_READINESS_MAX_AGE_SECONDS,
        "provider_refresh_interval_seconds": ITINERARY_REMINDER_PROVIDER_REFRESH_INTERVAL_SECONDS,
        "provider_refresh_enabled": ITINERARY_REMINDER_PROVIDER_REFRESH_ENABLED,
        "provider_control": provider_control, "staging_database_benchmark": benchmark_results,
        "staging_readiness_benchmark": readiness_benchmark}

@api_router.post("/admin/itinerary-reminders/refresh-provider-readiness")
async def refresh_itinerary_provider_readiness(
    current_user: dict = Depends(get_current_organizer_user)):
    require_announcement_manager_role(current_user)
    synchronizer = ProviderReadinessSynchronizer(require_itinerary_foundation(),
        require_wonderpush_client(),
        max_age_seconds=ITINERARY_REMINDER_PROVIDER_READINESS_MAX_AGE_SECONDS)
    return await synchronizer.refresh(now=datetime.now(timezone.utc))

@api_router.get("/admin/itinerary-reminders/scale-report")
async def itinerary_reminder_scale_report(current_user: dict = Depends(get_current_organizer_user)):
    if not IS_STAGING_DEPLOYMENT:
        raise HTTPException(status_code=404, detail="Not found")
    require_announcement_manager_role(current_user)
    return {**scale_report(), "exact_target_batching": batched_scale_report(),
        "provider_mode": "mock-only", "real_notifications_sent": 0,
        "global_kill_switch": not ITINERARY_REMINDER_DELIVERY_ENABLED,
        "rate_limit_source": "configurable conservative default; WonderPush publishes 429 semantics but no numeric quota"}

@api_router.get("/itinerary-reminders/synthetic-fixture-status")
async def synthetic_reminder_fixture_status(fixture_key: str = "device_isolation_t30"):
    """Safe staging diagnostic: no device identifiers, secrets, provider calls, or writes."""
    fixed = {"device_isolation_t30", "device_isolation_t30_retest_2", "late_star_suppression"}
    if fixture_key not in fixed and not re.fullmatch(r"device_isolation_t30_oneshot_[0-9a-f]{32}", fixture_key):
        raise HTTPException(status_code=400, detail="Unknown synthetic reminder fixture")
    repository = require_itinerary_foundation()
    fixture = await repository.synthetic_fixture_status(fixture_key)
    return {"fixture_exists": fixture is not None, "fixture": fixture,
        "delivery_kill_switch": not ITINERARY_REMINDER_DELIVERY_ENABLED,
        "scheduler_invoked": False, "notification_sent_by_this_check": False}

@api_router.post("/itinerary-reminders/synthetic-one-shot-fixture")
async def create_synthetic_one_shot_fixture(request: Request):
    if not IS_STAGING_DEPLOYMENT:
        raise HTTPException(status_code=404, detail="Not found")
    repository, registration = await authorize_itinerary_device(request)
    if registration.get("test_device_label") != "A":
        raise HTTPException(status_code=403, detail="Only registered Device A can create this staging fixture")
    now = datetime.now(timezone.utc)
    fixture_key = f"device_isolation_t30_oneshot_{uuid.uuid4().hex}"
    fixture = await repository.prepare_synthetic_fixture(registration["id"],
        starts_at=now + timedelta(minutes=31), starred_at=now, starred=True,
        fixture_key=fixture_key, title="IPM Reminder Demo Event — One-Shot Test")
    status = await repository.synthetic_fixture_status(fixture_key)
    return {"fixture_key": fixture_key, "fixture": status,
        "global_kill_switch": not ITINERARY_REMINDER_DELIVERY_ENABLED, "notification_sent": False}

@api_router.post("/admin/itinerary-reminders/synthetic-one-shot/authorize")
async def authorize_synthetic_one_shot(data: SyntheticOneShotPayload,
    current_user: dict = Depends(get_current_organizer_user)):
    if not IS_STAGING_DEPLOYMENT:
        raise HTTPException(status_code=404, detail="Not found")
    require_announcement_manager_role(current_user)
    if ITINERARY_REMINDER_DELIVERY_ENABLED:
        raise HTTPException(status_code=409, detail="Global reminder kill switch must remain on")
    repository = require_itinerary_foundation()
    fixture = await repository.synthetic_fixture_by_key(data.fixture_key)
    if not fixture or not re.fullmatch(r"device_isolation_t30_oneshot_[0-9a-f]{32}", data.fixture_key):
        raise HTTPException(status_code=404, detail="Unknown one-shot synthetic fixture")
    status = await repository.synthetic_fixture_status(data.fixture_key)
    if status["device_a_association_count"] != 1 or status["device_b_association_count"] != 0:
        raise HTTPException(status_code=409, detail="Fixture association isolation check failed")
    registrations = await repository.test_registrations()
    device_a = next((item for item in registrations if item.get("test_device_label") == "A"), None)
    if not device_a:
        raise HTTPException(status_code=409, detail="Device A is not registered")
    actor = str(current_user.get("username") or current_user.get("id") or "organizer")
    try:
        authorization = await repository.authorize_synthetic_fixture(fixture_id=fixture["id"],
            registration_id=device_a["id"], authorized_by=actor, now=datetime.now(timezone.utc))
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 409:
            raise HTTPException(status_code=409, detail="This fixture already has an authorization") from exc
        raise
    return {"fixture_key": data.fixture_key, "authorization_status": "unused",
        "created_at": authorization["created_at"], "expires_at": authorization["expires_at"],
        "global_kill_switch": True, "notification_sent": False}

@api_router.post("/admin/itinerary-reminders/synthetic-one-shot/run")
async def run_synthetic_one_shot(data: SyntheticOneShotPayload,
    current_user: dict = Depends(get_current_organizer_user)):
    if not IS_STAGING_DEPLOYMENT:
        raise HTTPException(status_code=404, detail="Not found")
    require_announcement_manager_role(current_user)
    if ITINERARY_REMINDER_DELIVERY_ENABLED:
        raise HTTPException(status_code=409, detail="Global reminder kill switch must remain on")
    if not re.fullmatch(r"device_isolation_t30_oneshot_[0-9a-f]{32}", data.fixture_key):
        raise HTTPException(status_code=400, detail="Invalid one-shot fixture")
    repository = require_itinerary_foundation()
    fixture = await repository.synthetic_fixture_by_key(data.fixture_key)
    if not fixture:
        raise HTTPException(status_code=404, detail="Unknown one-shot synthetic fixture")
    status = await repository.synthetic_fixture_status(data.fixture_key)
    if status["device_a_association_count"] != 1 or status["device_b_association_count"] != 0:
        raise HTTPException(status_code=409, detail="Fixture association isolation check failed")
    registrations = await repository.test_registrations()
    device_a = next((item for item in registrations if item.get("test_device_label") == "A"), None)
    if not device_a:
        raise HTTPException(status_code=409, detail="Device A is not registered")
    result = await itinerary_reminder_engine().run_authorized_synthetic(
        now=datetime.now(timezone.utc), fixture_id=fixture["id"], registration_id=device_a["id"])
    return {**result, "fixture_key": data.fixture_key, "target": "Device A only",
        "device_b_targeted": False, "broadcast": False, "automatic_retry": False,
        "global_kill_switch": True, "physical_delivery": "unknown"}

@api_router.put("/itinerary-reminders/synthetic-fixture")
async def set_synthetic_reminder_fixture(data: SyntheticReminderFixturePayload, request: Request):
    repository, registration = await authorize_itinerary_device(request)
    now = datetime.now(timezone.utc)
    if data.scenario not in {"t30", "t30_retest_2", "late"}:
        raise HTTPException(status_code=400, detail="Unknown synthetic reminder scenario")
    late = data.scenario == "late"
    retest = data.scenario == "t30_retest_2"
    fixture_key = "late_star_suppression" if late else (
        "device_isolation_t30_retest_2" if retest else "device_isolation_t30")
    fixture = await repository.prepare_synthetic_fixture(registration["id"],
        starts_at=now + timedelta(minutes=20 if late else 31), starred_at=now, starred=data.starred,
        fixture_key=fixture_key,
        title="IPM Late-Star Demo Event" if late else (
            "IPM Reminder Demo Event — Retest 2" if retest else "IPM Reminder Demo Event"))
    return {"fixture": fixture_key,
        "title": fixture["title"], "starred": data.starred,
        "starts_in_minutes": 20 if late else 31, "notification_sent": False}

@api_router.post("/admin/itinerary-reminders/run")
async def run_itinerary_reminder_worker(
    synthetic: bool = False,
    current_user: dict = Depends(get_current_organizer_user),
):
    require_announcement_manager_role(current_user)
    return await itinerary_reminder_engine().run(now=datetime.now(timezone.utc), synthetic=synthetic)

@api_router.get("/itinerary-reminders/test-device")
async def get_itinerary_test_device(request: Request):
    _, registration = await authorize_itinerary_device(request)
    if not registration.get("test_device_label"):
        raise HTTPException(status_code=404, detail="This phone is not registered for the test")
    return test_device_status(registration)

@api_router.put("/itinerary-reminders/test-device")
async def set_itinerary_test_device(data: TestDevicePayload, request: Request):
    repository, registration = await authorize_itinerary_device(request)
    try:
        updated = await repository.set_test_label(registration["id"], data.label)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 409:
            raise HTTPException(status_code=409, detail=f"Device {data.label} is already registered") from exc
        raise
    return test_device_status(updated)

@api_router.get("/itinerary-reminders/test-readiness")
async def itinerary_test_readiness():
    repository = require_itinerary_foundation()
    registrations = await repository.test_registrations()
    labels = {item.get("test_device_label"): item for item in registrations}
    distinct = bool(labels.get("A") and labels.get("B") and
        labels["A"]["wonderpush_installation_id"] != labels["B"]["wonderpush_installation_id"])
    distinct_capabilities = bool(labels.get("A") and labels.get("B") and
        not hmac.compare_digest(labels["A"]["capability_hash"], labels["B"]["capability_hash"]))
    device_a_provider = await inspect_provider_readiness(labels["A"]) if labels.get("A") else {}
    device_b_provider = await inspect_provider_readiness(labels["B"]) if labels.get("B") else {}
    return {"device_a_registered": "A" in labels, "device_b_registered": "B" in labels,
        "distinct_installations": distinct, "distinct_capabilities": distinct_capabilities,
        "device_a_verification_code": test_device_status(labels["A"])["fingerprint"] if labels.get("A") else None,
        "device_b_verification_code": test_device_status(labels["B"])["fingerprint"] if labels.get("B") else None,
        "device_a_provider_reachability": device_a_provider.get("provider_reachability", "unknown"),
        "device_b_provider_reachability": device_b_provider.get("provider_reachability", "unknown"),
        "ready_for_authorization": distinct and distinct_capabilities and bool(device_a_provider.get("provider_deliverable")),
        "target": "Device A only" if distinct else None, "notification_sent": False}

@api_router.get("/itinerary-reminders/device-a-delivery-diagnostics")
async def device_a_delivery_diagnostics():
    repository = require_itinerary_foundation()
    registrations = await repository.test_registrations()
    labels = {item.get("test_device_label"): item for item in registrations}
    device_a = labels.get("A")
    if not device_a: raise HTTPException(status_code=404, detail="Device A is not registered")
    device_a = await repository.with_starred_count(device_a)
    installation = await require_wonderpush_client().get_installation(device_a["wonderpush_installation_id"])
    tests = [await repository.controlled_test("initial"), await repository.controlled_test("vpn_off")]
    safe_keys = set(installation or {})
    preferences = (installation or {}).get("preferences") or {}
    push_token = (installation or {}).get("pushToken") or {}
    device = (installation or {}).get("device") or {}
    subscription_status = preferences.get("subscriptionStatus")
    has_push_token = bool(push_token.get("data"))
    reachability = "optOut" if not has_push_token else ("softOptOut" if subscription_status == "optOut" else "optIn")
    return {
        "verification_code": test_device_status(device_a)["fingerprint"],
        "provider_installation_found": installation is not None,
        "provider_reachability": reachability,
        "provider_has_push_token": has_push_token,
        "provider_subscription_status": subscription_status,
        "provider_os_notifications_visible": preferences.get("osNotificationsVisible"),
        "provider_subscribed_to_notifications": preferences.get("subscribedToNotifications"),
        "provider_platform": (installation or {}).get("platform") or device.get("platform"),
        "provider_browser_or_brand": device.get("brand"),
        "synchronized_star_count": int(device_a.get("starred_count", 0)),
        "provider_last_activity_at": (installation or {}).get("lastActivityDate"),
        "provider_created_at": (installation or {}).get("creationDate"),
        "provider_updated_at": (installation or {}).get("updateDate"),
        "provider_metadata_fields": sorted(key for key in safe_keys if key in {
            "creationDate", "updateDate", "lastActivityDate", "platform", "reachability", "subscriptionStatus"
        }),
        "tests": [{"test_key": item.get("test_key"), "status": item.get("status"),
            "claimed_at": item.get("claimed_at"), "sent_at": item.get("sent_at"),
            "provider_result": item.get("provider_delivery_id")} for item in tests if item],
        "automatic_retry_pending": False,
        "device_b_targeted": False,
    }

@api_router.post("/admin/itinerary-reminders/test/{installation_id}")
async def send_itinerary_targeting_test(
    installation_id: str,
    current_user: dict = Depends(get_current_organizer_user),
):
    require_announcement_manager_role(current_user)
    repository = require_itinerary_foundation()
    if not ITINERARY_REMINDER_TEST_ENABLED:
        raise HTTPException(status_code=404, detail="Not found")
    if installation_id not in WONDERPUSH_TEST_INSTALLATION_IDS:
        raise HTTPException(status_code=403, detail="Installation is not allowlisted for targeting tests")
    if not await repository.get(installation_id):
        raise HTTPException(status_code=404, detail="Installation is not registered")
    registrations = await repository.test_registrations()
    labels = {item.get("test_device_label"): item for item in registrations}
    if not labels.get("A") or labels["A"]["wonderpush_installation_id"] != installation_id:
        raise HTTPException(status_code=403, detail="Only registered Device A may be targeted")
    if not labels.get("B") or labels["B"]["wonderpush_installation_id"] == installation_id:
        raise HTTPException(status_code=409, detail="Distinct Device B registration is required")
    if hmac.compare_digest(labels["A"]["capability_hash"], labels["B"]["capability_hash"]):
        raise HTTPException(status_code=409, detail="Distinct device capabilities are required")
    refreshed = await refresh_provider_readiness(repository, labels["A"])
    if not refreshed.get("provider_deliverable"):
        raise HTTPException(status_code=409, detail="Device A is not currently provider-reachable")
    provider = require_wonderpush_client()
    targeted_provider = InstallationTargetedWonderPush(repository, provider)
    campaign_id = await targeted_provider.send(
        title="IPM — Targeting Test",
        message="This staging-only notification was sent to one allowlisted installation.",
        target_url=f"{PUBLIC_APP_URL}/itinerary",
        installation_id=installation_id,
    )
    return {"status": "sent", "provider_campaign_id": campaign_id, "installation_id": installation_id}

CONTROLLED_SEND_TOKEN_HASH = "c1dc23c0ac58cf66310f75eb685e9b1e2ce7dd7befca7dabda5059f8abbf113a"
VPN_OFF_SEND_TOKEN_HASH = "013e62bc68eb47cc3ea3719f963b407bc3ea96db887a47fad6b9743f393ab3a7"
READY_DEVICE_SEND_TOKEN_HASH = "9736cd1011a2872d81b5de661f060948f4cab316db5a37e5aa187a39204f4a81"
READY_DEVICE_PHYSICAL_RETEST_TOKEN_HASH = "d67f1978336f1b652d27d0f26ef4135be44ac5a6a23ccddca79e3ee441e77c97"

@api_router.post("/itinerary-reminders/controlled-device-a-send")
async def controlled_device_a_send(data: ControlledTargetingSendPayload, request: Request):
    repository = require_itinerary_foundation()
    supplied = request.headers.get("X-Controlled-Send-Authorization", "")
    if not supplied or not hmac.compare_digest(hashlib.sha256(supplied.encode()).hexdigest(), CONTROLLED_SEND_TOKEN_HASH):
        raise HTTPException(status_code=403, detail="Invalid controlled-send authorization")
    registrations = await repository.test_registrations()
    labels = {item.get("test_device_label"): item for item in registrations}
    if not labels.get("A") or not labels.get("B"):
        raise HTTPException(status_code=409, detail="Both controlled devices must be registered")
    if labels["A"]["wonderpush_installation_id"] == labels["B"]["wonderpush_installation_id"]:
        raise HTTPException(status_code=409, detail="Installations are not distinct")
    if hmac.compare_digest(labels["A"]["capability_hash"], labels["B"]["capability_hash"]):
        raise HTTPException(status_code=409, detail="Capabilities are not distinct")
    device_a = await refresh_provider_readiness(repository, labels["A"])
    if not device_a.get("provider_deliverable"):
        raise HTTPException(status_code=409, detail="Device A is not currently provider-reachable")
    if not hmac.compare_digest(test_device_status(labels["A"])["fingerprint"], data.device_a_verification_code):
        raise HTTPException(status_code=409, detail="Device A verification failed")
    if not hmac.compare_digest(test_device_status(labels["B"])["fingerprint"], data.device_b_verification_code):
        raise HTTPException(status_code=409, detail="Device B verification failed")
    claim = await repository.claim_controlled_test(labels["A"]["id"])
    if not claim:
        raise HTTPException(status_code=409, detail="Controlled test was already claimed; no repeat permitted")
    provider = InstallationTargetedWonderPush(repository, require_wonderpush_client())
    try:
        provider_id = await provider.send(installation_id=labels["A"]["wonderpush_installation_id"],
            title="IPM — Targeting Test",
            message="This staging-only notification was sent to Device A only.",
            target_url=f"{PUBLIC_APP_URL}/itinerary")
    except Exception as exc:
        await repository.finish_controlled_test(claim["id"], status="provider_failed", error_message=str(exc))
        raise HTTPException(status_code=502, detail="Controlled provider send failed; it will not be retried") from exc
    await repository.finish_controlled_test(claim["id"], status="provider_accepted", provider_delivery_id=provider_id)
    return {"status": "provider_accepted", "physical_delivery": "unknown", "target": "Device A only", "provider_delivery_id": provider_id,
        "device_b_targeted": False, "broadcast": False}

@api_router.post("/itinerary-reminders/controlled-device-a-vpn-off-send")
async def controlled_device_a_vpn_off_send(data: ControlledTargetingSendPayload, request: Request):
    repository = require_itinerary_foundation()
    supplied = request.headers.get("X-Controlled-Send-Authorization", "")
    if not supplied or not hmac.compare_digest(hashlib.sha256(supplied.encode()).hexdigest(), VPN_OFF_SEND_TOKEN_HASH):
        raise HTTPException(status_code=403, detail="Invalid controlled-send authorization")
    registrations = await repository.test_registrations()
    labels = {item.get("test_device_label"): item for item in registrations}
    prior = await repository.controlled_test("initial")
    if not labels.get("A") or not labels.get("B") or not prior or prior.get("status") not in {"sent", "provider_accepted"}:
        raise HTTPException(status_code=409, detail="Prior controlled test state is not complete")
    if prior["registration_id"] != labels["A"]["id"]:
        raise HTTPException(status_code=409, detail="Device A registration changed since prior test")
    if labels["A"]["wonderpush_installation_id"] == labels["B"]["wonderpush_installation_id"]:
        raise HTTPException(status_code=409, detail="Installations are not distinct")
    if hmac.compare_digest(labels["A"]["capability_hash"], labels["B"]["capability_hash"]):
        raise HTTPException(status_code=409, detail="Capabilities are not distinct")
    device_a = await refresh_provider_readiness(repository, labels["A"])
    if not device_a.get("provider_deliverable"):
        raise HTTPException(status_code=409, detail="Device A is not currently provider-reachable")
    if test_device_status(labels["A"])["fingerprint"] != data.device_a_verification_code or test_device_status(labels["B"])["fingerprint"] != data.device_b_verification_code:
        raise HTTPException(status_code=409, detail="Device verification failed")
    claim = await repository.claim_controlled_test(labels["A"]["id"], "vpn_off")
    if not claim:
        raise HTTPException(status_code=409, detail="VPN-off retest already claimed; no repeat permitted")
    provider = InstallationTargetedWonderPush(repository, require_wonderpush_client())
    try:
        provider_id = await provider.send(installation_id=labels["A"]["wonderpush_installation_id"],
            title="IPM — Targeting Test", message="VPN-off Device A delivery test.",
            target_url=f"{PUBLIC_APP_URL}/itinerary")
    except Exception as exc:
        await repository.finish_controlled_test(claim["id"], status="provider_failed", error_message=str(exc))
        raise HTTPException(status_code=502, detail="VPN-off provider send failed; it will not be retried") from exc
    await repository.finish_controlled_test(claim["id"], status="provider_accepted", provider_delivery_id=provider_id)
    return {"status": "provider_accepted", "physical_delivery": "unknown", "test_key": "vpn_off", "target": "Device A only",
        "verification_code": data.device_a_verification_code, "provider_delivery_id": provider_id,
        "device_b_targeted": False, "broadcast": False,
        "sent_at": datetime.now(timezone.utc).isoformat()}

@api_router.post("/itinerary-reminders/controlled-ready-device-a-send")
async def controlled_ready_device_a_send(data: ControlledTargetingSendPayload, request: Request):
    repository = require_itinerary_foundation()
    supplied = request.headers.get("X-Controlled-Send-Authorization", "")
    if not supplied or not hmac.compare_digest(hashlib.sha256(supplied.encode()).hexdigest(), READY_DEVICE_SEND_TOKEN_HASH):
        raise HTTPException(status_code=403, detail="Invalid controlled-send authorization")
    registrations = await repository.test_registrations()
    labels = {item.get("test_device_label"): item for item in registrations}
    if not labels.get("A") or not labels.get("B"):
        raise HTTPException(status_code=409, detail="Both controlled devices must be registered")
    if labels["A"]["wonderpush_installation_id"] == labels["B"]["wonderpush_installation_id"]:
        raise HTTPException(status_code=409, detail="Installations are not distinct")
    if hmac.compare_digest(labels["A"]["capability_hash"], labels["B"]["capability_hash"]):
        raise HTTPException(status_code=409, detail="Capabilities are not distinct")
    if not hmac.compare_digest(test_device_status(labels["A"])["fingerprint"], data.device_a_verification_code):
        raise HTTPException(status_code=409, detail="Device A verification failed")
    if not hmac.compare_digest(test_device_status(labels["B"])["fingerprint"], data.device_b_verification_code):
        raise HTTPException(status_code=409, detail="Device B verification failed")
    device_a = await refresh_provider_readiness(repository, labels["A"])
    if not device_a.get("reminders_enabled"):
        raise HTTPException(status_code=409, detail="Device A reminders are not enabled")
    if not device_a.get("provider_deliverable") or device_a.get("provider_reachability") != "optIn" or not device_a.get("provider_has_push_token"):
        raise HTTPException(status_code=409, detail="Device A is not currently provider-reachable")
    claim = await repository.claim_controlled_test(labels["A"]["id"], "ready_device")
    if not claim:
        raise HTTPException(status_code=409, detail="Ready-device test already claimed; no repeat permitted")
    provider = InstallationTargetedWonderPush(repository, require_wonderpush_client())
    try:
        provider_id = await provider.send(installation_id=labels["A"]["wonderpush_installation_id"],
            title="IPM — Targeting Test", message="Ready-device delivery test.",
            target_url=f"{PUBLIC_APP_URL}/itinerary")
    except Exception as exc:
        await repository.finish_controlled_test(claim["id"], status="provider_failed", error_message=str(exc))
        raise HTTPException(status_code=502, detail="Ready-device provider send failed; it will not be retried") from exc
    await repository.finish_controlled_test(claim["id"], status="provider_accepted", provider_delivery_id=provider_id)
    return {"status": "provider_accepted", "physical_delivery": "unknown", "test_key": "ready_device",
        "target": "Device A only", "verification_code": data.device_a_verification_code,
        "provider_delivery_id": provider_id, "device_b_targeted": False, "broadcast": False,
        "automatic_retry": False, "provider_accepted_at": datetime.now(timezone.utc).isoformat()}

@api_router.post("/itinerary-reminders/controlled-ready-device-a-physical-retest")
async def controlled_ready_device_a_physical_retest(data: ControlledTargetingSendPayload, request: Request):
    """One-shot staging proof. The secret is held by the operator and never committed."""
    repository = require_itinerary_foundation()
    supplied = request.headers.get("X-Controlled-Send-Authorization", "")
    supplied_hash = hashlib.sha256(supplied.encode()).hexdigest()
    if not supplied or not hmac.compare_digest(supplied_hash, READY_DEVICE_PHYSICAL_RETEST_TOKEN_HASH):
        raise HTTPException(status_code=403, detail="Invalid controlled-send authorization")
    registrations = await repository.test_registrations()
    labels = {item.get("test_device_label"): item for item in registrations}
    if not labels.get("A") or not labels.get("B"):
        raise HTTPException(status_code=409, detail="Both controlled devices must be registered")
    if labels["A"]["wonderpush_installation_id"] == labels["B"]["wonderpush_installation_id"]:
        raise HTTPException(status_code=409, detail="Installations are not distinct")
    if hmac.compare_digest(labels["A"]["capability_hash"], labels["B"]["capability_hash"]):
        raise HTTPException(status_code=409, detail="Capabilities are not distinct")
    if not hmac.compare_digest(test_device_status(labels["A"])["fingerprint"], data.device_a_verification_code):
        raise HTTPException(status_code=409, detail="Device A current installation verification failed")
    if not hmac.compare_digest(test_device_status(labels["B"])["fingerprint"], data.device_b_verification_code):
        raise HTTPException(status_code=409, detail="Device B verification failed")

    provider_client = require_wonderpush_client()
    installation = await provider_client.get_installation(labels["A"]["wonderpush_installation_id"])
    if not installation:
        raise HTTPException(status_code=409, detail="Device A provider installation was not found")
    preferences = installation.get("preferences") or {}
    reachability, has_push_token = provider_readiness(installation)
    subscription_opt_in = preferences.get("subscriptionStatus") == "optIn"
    os_notifications_visible = preferences.get("osNotificationsVisible") is True
    device_a = await repository.set_readiness(labels["A"]["id"], reachability=reachability,
        has_push_token=has_push_token, checked_at=datetime.now(timezone.utc))
    reminder_ready = bool(device_a.get("reminders_enabled") and device_a.get("provider_deliverable")
        and reachability == "optIn" and has_push_token and subscription_opt_in and os_notifications_visible)
    if not reminder_ready:
        raise HTTPException(status_code=409, detail="Device A failed the complete reminder readiness gate")

    test_key = "ready_device_physical_retest_20260823"
    claim = await repository.claim_controlled_test(labels["A"]["id"], test_key)
    if not claim:
        raise HTTPException(status_code=409, detail="Physical retest already claimed; no repeat permitted")
    targeted_provider = InstallationTargetedWonderPush(repository, provider_client)
    try:
        provider_id = await targeted_provider.send(
            installation_id=labels["A"]["wonderpush_installation_id"],
            title="IPM — Targeting Test", message="Ready-device physical delivery test.",
            target_url=f"{PUBLIC_APP_URL}/itinerary")
    except Exception as exc:
        await repository.finish_controlled_test(claim["id"], status="provider_failed", error_message=str(exc))
        raise HTTPException(status_code=502, detail="Physical retest provider send failed; it will not be retried") from exc
    accepted_at = datetime.now(timezone.utc).isoformat()
    await repository.finish_controlled_test(claim["id"], status="provider_accepted", provider_delivery_id=provider_id)
    return {"test_key": test_key, "status": "provider_accepted", "physical_delivery": "unknown",
        "provider_delivery_id": provider_id, "provider_accepted_at": accepted_at,
        "target": "Device A only", "verification_code": data.device_a_verification_code,
        "preflight": {"device_a_registered": True, "device_b_registered": True,
            "distinct_installations": True, "distinct_capabilities": True,
            "current_installation_match": True, "provider_installation_found": True,
            "provider_reachability": reachability, "provider_has_push_token": has_push_token,
            "provider_subscription": preferences.get("subscriptionStatus"),
            "os_notifications_visible": os_notifications_visible,
            "reminders_enabled": bool(device_a.get("reminders_enabled")),
            "provider_deliverable": bool(device_a.get("provider_deliverable")),
            "provider_verification_fresh": True, "reminder_ready": reminder_ready,
            "device_b_excluded": True, "retry_pending": False},
        "device_b_targeted": False, "broadcast": False, "automatic_retry": False}


CALENDAR_BULK_EXPORT_LIMIT = 200


async def get_calendar_export_rows(schedule_ids: List[uuid.UUID]) -> list[dict]:
    normalized_ids = [str(schedule_id) for schedule_id in schedule_ids]
    if not normalized_ids:
        raise HTTPException(status_code=400, detail="At least one Schedule event is required")
    if len(normalized_ids) > CALENDAR_BULK_EXPORT_LIMIT:
        raise HTTPException(status_code=413, detail="Too many Schedule events requested")
    if len(set(normalized_ids)) != len(normalized_ids):
        raise HTTPException(status_code=400, detail="Duplicate Schedule event IDs are not allowed")
    getter = getattr(schedule_service, "get_calendar_rows", None)
    if not getter:
        raise HTTPException(status_code=503, detail="Calendar export is unavailable")
    try:
        rows = await getter(normalized_ids)
    except httpx.HTTPError as exc:
        logger.error("Calendar export Schedule lookup failed: %s", exc)
        raise HTTPException(status_code=502, detail="Unable to create calendar export") from exc
    if len(rows) != len(normalized_ids):
        raise HTTPException(status_code=404, detail="One or more Schedule events were not found")
    return rows


def calendar_response(rows: list[dict], filename: str) -> Response:
    try:
        content = generate_calendar(rows, event_service.get_public_event_id())
    except CalendarExportError as exc:
        logger.error("Canonical Schedule row could not be exported: %s", exc)
        raise HTTPException(status_code=500, detail="Unable to create calendar export") from exc
    return Response(
        content=content,
        media_type="text/calendar",
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


@api_router.get("/schedule/{schedule_id}/calendar")
async def export_schedule_event_calendar(schedule_id: uuid.UUID):
    """Export one canonical Schedule event as an iCalendar file."""
    rows = await get_calendar_export_rows([schedule_id])
    return calendar_response(rows, "ipm-schedule-event.ics")


@api_router.get("/schedule/{schedule_id}/calendar/google")
async def open_schedule_event_in_google_calendar(schedule_id: uuid.UUID):
    """Redirect to a Google event template built from one canonical Schedule row."""
    rows = await get_calendar_export_rows([schedule_id])
    try:
        destination = generate_google_calendar_url(rows[0])
    except CalendarExportError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return RedirectResponse(
        destination,
        status_code=307,
        headers={"Cache-Control": "no-store"},
    )


@api_router.post("/schedule/calendar")
async def export_schedule_itinerary_calendar(data: CalendarBulkExportRequest):
    """Export a bounded attendee-selected Schedule snapshot as one calendar file."""
    rows = await get_calendar_export_rows(data.schedule_ids)
    return calendar_response(rows, "ipm-my-itinerary.ics")

@api_router.get("/vendors", response_model=VendorsResponse)
async def get_vendors():
    """Fetch vendors from Google Sheets"""
    try:
        return await vendor_service.list_public_vendors()
    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch Vendors Sheet: {e}")
        raise HTTPException(status_code=502, detail="Failed to fetch vendors data")
    except Exception as e:
        logger.error(f"Error processing vendors: {e}")
        raise HTTPException(status_code=500, detail="Error processing vendors data")

@api_router.post("/register-push-token")
async def register_push_token(data: PushTokenRegister):
    """Register a device's push notification token"""
    database = require_mongodb()
    try:
        # Upsert the token (update if exists, insert if not)
        await database.push_tokens.update_one(
            {"device_id": data.device_id},
            {
                "$set": {
                    "push_token": data.push_token,
                    "device_id": data.device_id,
                    "updated_at": datetime.utcnow()
                }
            },
            upsert=True
        )
        return {"status": "success", "message": "Push token registered"}
    except Exception as e:
        logger.error(f"Error registering push token: {e}")
        raise HTTPException(status_code=500, detail="Failed to register push token")

@api_router.post("/update-starred-events")
async def update_starred_events(data: StarredEventsUpdate):
    """Update the list of starred events for a user (for notification tracking)"""
    database = require_mongodb()
    try:
        await database.user_starred_events.update_one(
            {"push_token": data.push_token},
            {
                "$set": {
                    "push_token": data.push_token,
                    "starred_event_ids": data.starred_event_ids,
                    "updated_at": datetime.utcnow()
                }
            },
            upsert=True
        )
        return {"status": "success", "message": "Starred events updated"}
    except Exception as e:
        logger.error(f"Error updating starred events: {e}")
        raise HTTPException(status_code=500, detail="Failed to update starred events")

# ============== SOS MISSING PERSON ENDPOINTS ==============

@api_router.post("/sos/report", response_model=SOSReportResponse)
async def create_sos_report(data: SOSReportCreate):
    """Create an SOS missing person report and broadcast to all users"""
    database = require_mongodb()
    try:
        # Create the report
        report = SOSReport(
            name=data.name,
            sex=data.sex,
            age=data.age,
            height=data.height,
            hair_color=data.hair_color,
            glasses=data.glasses,
            shirt_color=data.shirt_color,
            pants_color=data.pants_color,
            last_location=data.last_location,
            description=data.description,
            reporter_name=data.reporter_name,
            reporter_phone=data.reporter_phone,
            reporter_token=data.reporter_token
        )
        
        # Save to database
        await database.sos_reports.insert_one(report.dict())
        
        # Build notification message
        glasses_text = "Wears glasses" if data.glasses else "No glasses"
        notification_body = (
            f"🚨 MISSING PERSON ALERT 🚨\n"
            f"Name: {data.name}\n"
            f"Sex: {data.sex}, Age: {data.age}\n"
            f"Height: {data.height}, Hair: {data.hair_color}\n"
            f"{glasses_text}\n"
            f"Shirt: {data.shirt_color}, Pants: {data.pants_color}\n"
            f"Last seen: {data.last_location}"
        )
        
        # Get all registered push tokens
        all_tokens = await database.push_tokens.find().to_list(10000)
        
        logger.info(f"SOS: Broadcasting alert to {len(all_tokens)} devices")
        
        # Send notification to all registered devices
        for token_doc in all_tokens:
            push_token = token_doc.get('push_token')
            if push_token:
                await send_sos_push_notification(
                    push_token=push_token,
                    title="🚨 MISSING PERSON ALERT",
                    body=notification_body,
                    data={"type": "sos_alert", "sos_id": report.id}
                )
        
        return SOSReportResponse(
            id=report.id,
            name=report.name,
            sex=report.sex,
            age=report.age,
            height=report.height,
            hair_color=report.hair_color,
            glasses=report.glasses,
            shirt_color=report.shirt_color,
            pants_color=report.pants_color,
            last_location=report.last_location,
            description=report.description,
            status=report.status,
            created_at=report.created_at
        )
        
    except Exception as e:
        logger.error(f"Error creating SOS report: {e}")
        raise HTTPException(status_code=500, detail="Failed to create SOS report")

@api_router.get("/sos/active", response_model=List[SOSReportResponse])
async def get_active_sos_reports():
    """Get all active SOS reports"""
    database = require_mongodb()
    try:
        reports = await database.sos_reports.find({"status": "active"}).to_list(100)
        # Return empty list if no reports found (not an error)
        if not reports:
            return []
        return [SOSReportResponse(**report) for report in reports]
    except Exception as e:
        logger.error(f"Error fetching SOS reports: {e}")
        # Return empty list on error instead of 500 (graceful degradation)
        return []

@api_router.post("/sos/cancel/{report_id}")
async def cancel_sos_report(report_id: str, reporter_token: Optional[str] = None):
    """Cancel/resolve an SOS report (person found)"""
    database = require_mongodb()
    try:
        # Find the report
        report = await database.sos_reports.find_one({"id": report_id})
        if not report:
            raise HTTPException(status_code=404, detail="SOS report not found")
        
        # Update status
        await database.sos_reports.update_one(
            {"id": report_id},
            {
                "$set": {
                    "status": "resolved",
                    "resolved_at": datetime.utcnow()
                }
            }
        )
        
        # Notify all users that the person was found
        all_tokens = await database.push_tokens.find().to_list(10000)
        
        logger.info(f"SOS: Broadcasting FOUND alert to {len(all_tokens)} devices")
        
        for token_doc in all_tokens:
            push_token = token_doc.get('push_token')
            if push_token:
                await send_expo_push_notification(
                    push_token=push_token,
                    title="✅ Person Found - Alert Cancelled",
                    body=f"{report['name']} has been found! Thank you for your help.",
                    data={"type": "sos_cancelled", "sos_id": report_id}
                )
        
        return {"status": "success", "message": "SOS report cancelled, person found"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling SOS report: {e}")
        raise HTTPException(status_code=500, detail="Failed to cancel SOS report")

@api_router.post("/sos/resolve/{report_id}")
async def secure_resolve_sos_report(report_id: str, data: SOSResolveRequest):
    """Securely resolve an SOS report with PIN verification (Admin only)"""
    database = require_mongodb()
    try:
        # Verify PIN
        if data.pin != ADMIN_PIN:
            return {"status": "error", "message": "Unauthorized - Invalid PIN"}
        
        # Find the report
        report = await database.sos_reports.find_one({"id": report_id})
        if not report:
            raise HTTPException(status_code=404, detail="SOS report not found")
        
        if report["status"] == "resolved":
            return {"status": "already_resolved", "message": "Alert already resolved"}
        
        # Update the report status to resolved
        resolved_time = datetime.utcnow()
        await database.sos_reports.update_one(
            {"id": report_id},
            {"$set": {
                "status": "resolved",
                "resolved_at": resolved_time
            }}
        )
        
        # Broadcast "Resolved" notification to all registered devices
        all_tokens = await database.push_tokens.find().to_list(1000)
        logger.info(f"SOS RESOLVED: Broadcasting to {len(all_tokens)} devices")
        
        for token_doc in all_tokens:
            push_token = token_doc.get("push_token")
            if push_token:
                await send_expo_push_notification(
                    push_token=push_token,
                    title="✅ Alert Resolved",
                    body=f"Update: The situation regarding {report['name']} has been resolved. Thank you for your help.",
                    data={"type": "sos_resolved", "sos_id": report_id}
                )
        
        return {
            "status": "success", 
            "message": "Alert resolved successfully",
            "resolved_at": resolved_time.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resolving SOS report: {e}")
        raise HTTPException(status_code=500, detail="Failed to resolve SOS report")

@api_router.post("/sos/archive/{report_id}")
async def archive_sos_report(report_id: str, data: SOSResolveRequest):
    """Archive an SOS report with PIN verification (Admin only)"""
    database = require_mongodb()
    try:
        # Verify PIN
        if data.pin != ADMIN_PIN:
            return {"status": "error", "message": "Unauthorized - Invalid PIN"}
        
        report = await database.sos_reports.find_one({"id": report_id})
        if not report:
            raise HTTPException(status_code=404, detail="SOS report not found")
        
        # Update to archived status (can archive any status now with admin PIN)
        await database.sos_reports.update_one(
            {"id": report_id},
            {"$set": {
                "status": "archived",
                "archived_at": datetime.utcnow()
            }}
        )
        
        return {"status": "success", "message": "Alert archived successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error archiving SOS report: {e}")
        raise HTTPException(status_code=500, detail="Failed to archive SOS report")

@api_router.get("/sos/resolved", response_model=List[SOSReportResponse])
async def get_resolved_sos_reports():
    """Get all resolved (but not yet archived) SOS reports"""
    database = require_mongodb()
    try:
        reports = await database.sos_reports.find({"status": "resolved"}).to_list(100)
        if not reports:
            return []
        return [SOSReportResponse(**report) for report in reports]
    except Exception as e:
        logger.error(f"Error fetching resolved SOS reports: {e}")
        return []

@api_router.get("/sos/archived", response_model=List[SOSReportResponse])
async def get_archived_sos_reports():
    """Get all archived (past) SOS reports"""
    database = require_mongodb()
    try:
        reports = await database.sos_reports.find({"status": "archived"}).to_list(100)
        if not reports:
            return []
        return [SOSReportResponse(**report) for report in reports]
    except Exception as e:
        logger.error(f"Error fetching archived SOS reports: {e}")
        return []

@api_router.post("/sos/test-alert")
async def create_test_alert():
    """Create a test SOS alert for testing purposes (Admin endpoint)"""
    database = require_mongodb()
    try:
        test_report = SOSReport(
            id=str(uuid.uuid4()),
            name="Test Alert - John Doe",
            sex="Male",
            age="25",
            height="5'10\"",
            hair_color="Brown",
            glasses=False,
            shirt_color="Blue t-shirt",
            pants_color="Jeans",
            last_location="Main Entrance - Test Location",
            description="This is a TEST ALERT for system verification. Please ignore.",
            reporter_name="System Admin",
            reporter_phone="(519) 555-0123",
            status="active",
            created_at=datetime.utcnow()
        )
        
        await database.sos_reports.insert_one(test_report.dict())
        
        logger.info(f"Test SOS alert created with ID: {test_report.id}")
        
        return {
            "status": "success",
            "message": "Test alert created successfully",
            "alert_id": test_report.id,
            "note": "This is a test alert. Use DELETE /api/sos/test-alert/{id} to remove it."
        }
    except Exception as e:
        logger.error(f"Error creating test alert: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create test alert: {str(e)}")

@api_router.delete("/sos/test-alert/{alert_id}")
async def delete_test_alert(alert_id: str):
    """Delete a test SOS alert"""
    database = require_mongodb()
    try:
        result = await database.sos_reports.delete_one({"id": alert_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Alert not found")
        return {"status": "success", "message": "Test alert deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting test alert: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete test alert")


@api_router.post("/sos/admin/{report_id}", response_model=SOSReportAdminResponse)
async def get_sos_admin_details(report_id: str, data: SOSResolveRequest):
    """Get full SOS report details including reporter info (Admin PIN required)"""
    database = require_mongodb()
    try:
        # Verify PIN
        if data.pin != ADMIN_PIN:
            raise HTTPException(status_code=401, detail="Unauthorized - Invalid PIN")
        
        # Find the report
        report = await database.sos_reports.find_one({"id": report_id})
        if not report:
            raise HTTPException(status_code=404, detail="SOS report not found")
        
        # Return full admin response with reporter info
        return SOSReportAdminResponse(
            id=report.get("id"),
            name=report.get("name", ""),
            sex=report.get("sex", ""),
            age=report.get("age", ""),
            height=report.get("height", ""),
            hair_color=report.get("hair_color", ""),
            glasses=report.get("glasses", False),
            shirt_color=report.get("shirt_color", ""),
            pants_color=report.get("pants_color", ""),
            last_location=report.get("last_location", ""),
            description=report.get("description", ""),
            reporter_name=report.get("reporter_name", "Unknown"),
            reporter_phone=report.get("reporter_phone", "No phone provided"),
            status=report.get("status", "active"),
            created_at=report.get("created_at", datetime.utcnow()),
            resolved_at=report.get("resolved_at"),
            archived_at=report.get("archived_at")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching admin SOS details: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch SOS details")


async def send_sos_push_notification(push_token: str, title: str, body: str, data: dict = None):
    """Send CRITICAL push notification for SOS alerts with loud sound"""
    try:
        message = {
            "to": push_token,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {},
            "priority": "high",
            "channelId": "sos-alerts",
            "_contentAvailable": True,
        }
        
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                "https://exp.host/--/api/v2/push/send",
                json=message,
                headers={"Content-Type": "application/json"},
                timeout=10.0
            )
            if response.status_code == 200:
                logger.info(f"SOS Notification sent to {push_token[:20]}...")
            else:
                logger.warning(f"Failed to send SOS notification: {response.text}")
    except Exception as e:
        logger.error(f"Error sending SOS push notification: {e}")

# Include the router in the main app
app.include_router(api_router)

# Direct download endpoint (not through api_router)
@app.get("/download")
async def download_dist_direct():
    """Download the dist folder as a zip file for Netlify deployment"""
    zip_path = ROOT_DIR / "dist.zip"
    if zip_path.exists():
        return FileResponse(
            path=str(zip_path),
            filename="ipm2026-dist.zip",
            media_type="application/zip"
        )
    raise HTTPException(status_code=404, detail="dist.zip not found")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============== CRON JOB FOR EVENT CHANGE DETECTION ==============

async def fetch_events_data() -> tuple[List[dict], str]:
    """Fetch events from the active schedule service and return data with hash."""
    try:
        schedule = await schedule_service.list_public_schedule()
        events = [
            {
                'id': event.id,
                'title': event.title,
                'description': event.description,
                'start_date': event.start_date,
                'start_time': event.start_time,
                'end_time': event.end_time,
                'category': event.category,
                'days_active': event.days_active,
            }
            for event in schedule.events
        ]
        
        # Create hash of the data to detect changes
        data_str = json.dumps(events, sort_keys=True)
        data_hash = hashlib.md5(data_str.encode()).hexdigest()
        
        return events, data_hash
    except Exception as e:
        logger.error(f"Error fetching events for cron: {e}")
        return [], ""

async def send_expo_push_notification(push_token: str, title: str, body: str, data: dict = None):
    """Send push notification via Expo's push service"""
    try:
        message = {
            "to": push_token,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {},
        }
        
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(
                "https://exp.host/--/api/v2/push/send",
                json=message,
                headers={"Content-Type": "application/json"},
                timeout=10.0
            )
            if response.status_code == 200:
                logger.info(f"Notification sent to {push_token[:20]}...")
            else:
                logger.warning(f"Failed to send notification: {response.text}")
    except Exception as e:
        logger.error(f"Error sending push notification: {e}")

async def check_for_event_changes():
    """Check Google Sheet for changes and notify users"""
    global cached_events_hash
    if db is None:
        logger.warning("Cron: MongoDB unavailable; skipping event change detection")
        return
    database = db
    
    logger.info("Cron: Checking for event changes...")
    
    events, new_hash = await fetch_events_data()
    
    if not new_hash:
        logger.warning("Cron: Could not fetch events data")
        return
    
    # First run - just cache the hash
    if not cached_events_hash:
        cached_events_hash = new_hash
        # Store events in DB for comparison
        await database.cached_events.delete_many({})
        for event in events:
            await database.cached_events.insert_one(event)
        logger.info(f"Cron: Initial cache set with {len(events)} events")
        return
    
    # Check if hash changed
    if new_hash == cached_events_hash:
        logger.info("Cron: No changes detected")
        return
    
    logger.info("Cron: Changes detected! Finding affected events...")
    
    # Find what changed
    old_events = await database.cached_events.find().to_list(1000)
    old_events_dict = {e['id']: e for e in old_events}
    
    changed_event_ids = []
    for event in events:
        old_event = old_events_dict.get(event['id'])
        if old_event:
            # Check if any field changed
            for key in ['title', 'description', 'start_date', 'start_time', 'end_time', 'days_active']:
                if event.get(key) != old_event.get(key):
                    changed_event_ids.append(event['id'])
                    logger.info(f"Cron: Event '{event['title']}' changed (field: {key})")
                    break
    
    # Update cache
    cached_events_hash = new_hash
    await database.cached_events.delete_many({})
    for event in events:
        await database.cached_events.insert_one(event)
    
    if not changed_event_ids:
        logger.info("Cron: Hash changed but no event content changes detected")
        return
    
    # Find users who starred these events and notify them
    for event_id in changed_event_ids:
        # Find the event details
        event_details = next((e for e in events if e['id'] == event_id), None)
        if not event_details:
            continue
        
        # Find users who starred this event
        starred_users = await database.user_starred_events.find({
            "starred_event_ids": event_id
        }).to_list(1000)
        
        logger.info(f"Cron: Notifying {len(starred_users)} users about '{event_details['title']}'")
        
        for user in starred_users:
            push_token = user.get('push_token')
            if push_token:
                await send_expo_push_notification(
                    push_token=push_token,
                    title="Event Updated! 📅",
                    body=f"'{event_details['title']}' has been updated. Check the app for details.",
                    data={"eventId": event_id, "type": "event_update"}
                )

async def cron_scheduler():
    """Background task that runs the event check periodically"""
    while True:
        try:
            await check_for_event_changes()
        except Exception as e:
            logger.error(f"Cron scheduler error: {e}")
        
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)

async def itinerary_reminder_scheduler():
    """Real canonical T-30 worker; the independent delivery kill switch defaults off."""
    while True:
        try:
            result = await itinerary_reminder_engine().run(now=datetime.now(timezone.utc))
            logger.info("Itinerary reminder scheduler result=%s", result)
        except Exception as exc:
            logger.error("Itinerary reminder scheduler error: %s", exc)
        await asyncio.sleep(ITINERARY_REMINDER_INTERVAL_SECONDS)

async def itinerary_provider_readiness_scheduler():
    """Refresh the provider mirror ahead of T-30; this worker never sends notifications."""
    synchronizer = ProviderReadinessSynchronizer(
        require_itinerary_foundation(), require_wonderpush_client(),
        max_age_seconds=ITINERARY_REMINDER_PROVIDER_READINESS_MAX_AGE_SECONDS)
    while True:
        try:
            result = await synchronizer.refresh(now=datetime.now(timezone.utc))
            logger.info("Itinerary provider readiness refresh result=%s", result)
        except Exception as exc:
            logger.error("Itinerary provider readiness refresh failed: %s", exc)
        await asyncio.sleep(ITINERARY_REMINDER_PROVIDER_REFRESH_INTERVAL_SECONDS)

@app.on_event("startup")
async def startup_event():
    """Start the cron job when the server starts"""
    if ITINERARY_REMINDER_SCHEDULER_ENABLED and itinerary_reminder_repository and wonderpush_client:
        logger.info("Starting itinerary reminder scheduler (delivery_enabled=%s)", ITINERARY_REMINDER_DELIVERY_ENABLED)
        asyncio.create_task(itinerary_reminder_scheduler())
    if ITINERARY_REMINDER_PROVIDER_REFRESH_ENABLED and itinerary_reminder_repository and wonderpush_client:
        logger.info("Starting itinerary provider readiness mirror refresh")
        asyncio.create_task(itinerary_provider_readiness_scheduler())
    if db is None:
        logger.warning("MongoDB unavailable; event change notification cron is disabled")
        return
    await db.organizer_users.create_index(
        [("event_id", 1), ("username", 1)],
        unique=True,
        name="organizer_event_username_unique",
    )
    await db.organizer_sessions.create_index(
        "expires_at",
        expireAfterSeconds=0,
        name="organizer_session_expiry",
    )
    await db.organizer_sessions.create_index(
        "token_hash",
        unique=True,
        name="organizer_session_token_unique",
    )
    await db.broadcasts.create_index(
        [("event_id", 1), ("sent_at", -1)],
        name="broadcast_event_sent_at",
    )
    await analytics_repository.ensure_indexes()
    logger.info("Starting cron scheduler for event change detection...")
    asyncio.create_task(cron_scheduler())

@app.on_event("shutdown")
async def shutdown_db_client():
    if client is not None:
        client.close()
