from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse, PlainTextResponse, FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, ConfigDict, Field, field_validator
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
from collections import OrderedDict

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
import secrets
import base64
import hmac
import re
import time
from urllib.parse import quote
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
        WebpushrClient,
        WebpushrError,
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
        WebpushrClient,
        WebpushrError,
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

# Webpushr Service Worker content
WEBPUSHR_SW_CONTENT = "importScripts('https://cdn.webpushr.com/sw-server.min.js');"

# Cron job settings
CHECK_INTERVAL_SECONDS = 300  # Check every 5 minutes
cached_events_hash: str = ""

# Organizer portal authentication settings
DEFAULT_EVENT_ID = os.environ.get("DEFAULT_EVENT_ID", "ipm-2026")
ENVIRONMENT = os.environ.get("ENVIRONMENT", "development").strip().lower()
CONTENT_SOURCE = os.environ.get("CONTENT_SOURCE", "google_sheets").strip().lower()
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
WEBPUSHR_API_KEY = os.environ.get("WEBPUSHR_API_KEY", "")
WEBPUSHR_AUTH_TOKEN = os.environ.get("WEBPUSHR_AUTH_TOKEN", "")
WEBPUSHR_TEST_SUBSCRIBER_IDS = [
    subscriber_id.strip()
    for subscriber_id in os.environ.get("WEBPUSHR_TEST_SUBSCRIBER_IDS", "").split(",")
    if subscriber_id.strip()
]
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
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    client_name: str = Field(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9 ._:/-]+$")

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
    provider: Literal["webpushr"]
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

webpushr_client = None
if WEBPUSHR_API_KEY and WEBPUSHR_AUTH_TOKEN:
    webpushr_client = WebpushrClient(
        api_key=WEBPUSHR_API_KEY,
        auth_token=WEBPUSHR_AUTH_TOKEN,
    )


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


def require_webpushr_client():
    if webpushr_client is None:
        raise HTTPException(status_code=503, detail="Webpushr is not configured")
    return webpushr_client


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


def require_sos_admin_role(user: dict):
    if user.get("role") not in ("Owner", "Communications"):
        raise HTTPException(status_code=403, detail="Your organizer role cannot manage SOS alerts")


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
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    push_token: str = Field(min_length=20, max_length=256, pattern=r"^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$")
    device_id: str = Field(min_length=1, max_length=128)

    @field_validator("device_id")
    @classmethod
    def validate_device_id(cls, value: str) -> str:
        if any(ord(character) < 32 for character in value):
            raise ValueError("device_id contains control characters")
        return value

class StarredEventsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    push_token: str = Field(min_length=20, max_length=256, pattern=r"^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$")
    starred_event_ids: List[str] = Field(max_length=200)

    @field_validator("starred_event_ids")
    @classmethod
    def validate_event_ids(cls, values: List[str]) -> List[str]:
        if len(values) != len(set(values)):
            raise ValueError("starred_event_ids must not contain duplicates")
        if any(not re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}", value) for value in values):
            raise ValueError("starred_event_ids contains an invalid event id")
        return values

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
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=120)
    sex: str = Field(min_length=1, max_length=40)
    age: str = Field(min_length=1, max_length=20)
    height: str = Field(default="", max_length=40)
    hair_color: str = Field(default="", max_length=60)
    glasses: bool
    shirt_color: str = Field(default="", max_length=80)
    pants_color: str = Field(default="", max_length=80)
    last_location: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default="", max_length=1000)
    reporter_name: str = Field(default="", max_length=120)
    reporter_phone: str = Field(default="", max_length=40, pattern=r"^[0-9+(). xX-]*$")
    reporter_token: Optional[str] = Field(default=None, min_length=16, max_length=128, pattern=r"^[A-Za-z0-9_-]+$")

class SOSResolveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    pin: str = Field(min_length=1, max_length=64)

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
    notification_status: Optional[Literal["accepted", "partial", "failed", "no_recipients"]] = None
    notification_batches_attempted: Optional[int] = None
    notification_batches_succeeded: Optional[int] = None


class SOSReportCreatedResponse(SOSReportResponse):
    reporter_token: str

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


class BoundedRateLimiter:
    """Fixed-window, process-local limiter with bounded key cardinality."""

    def __init__(self, max_keys: int = 4096):
        self.max_keys = max_keys
        self.entries: OrderedDict[str, tuple[float, int]] = OrderedDict()

    def check(self, key: str, *, limit: int, window_seconds: int) -> bool:
        now = time.monotonic()
        cutoff = now - window_seconds
        while self.entries and next(iter(self.entries.values()))[0] <= cutoff:
            self.entries.popitem(last=False)
        started, count = self.entries.get(key, (now, 0))
        if started <= cutoff:
            started, count = now, 0
        if count >= limit:
            self.entries[key] = (started, count)
            self.entries.move_to_end(key)
            return False
        self.entries[key] = (started, count + 1)
        self.entries.move_to_end(key)
        while len(self.entries) > self.max_keys:
            self.entries.popitem(last=False)
        return True


public_write_rate_limiter = BoundedRateLimiter()


def rate_limit_identity(request: Request, value: str = "") -> str:
    # Uvicorn/Render's trusted proxy handling supplies request.client. Raw
    # forwarding headers are deliberately ignored because clients can spoof them.
    client_host = request.client.host if request.client else "unknown"
    digest = hashlib.sha256(value.encode()).hexdigest()[:16] if value else "none"
    return f"{client_host}:{digest}"


def enforce_public_write_limit(
    request: Request, bucket: str, *, identifier: str = "", limit: int, window_seconds: int,
) -> None:
    key = f"{bucket}:{rate_limit_identity(request, identifier)}"
    if not public_write_rate_limiter.check(key, limit=limit, window_seconds=window_seconds):
        raise HTTPException(status_code=429, detail="Too many requests; please try again later")


def validate_sos_report_id(report_id: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", report_id):
        raise HTTPException(status_code=404, detail="SOS report is unavailable")


PUBLIC_WRITE_BODY_LIMITS = {
    "/api/status": 1024,
    "/api/register-push-token": 2048,
    "/api/update-starred-events": 32768,
    "/api/sos/report": 16384,
}


@app.middleware("http")
async def public_write_body_limits(request: Request, call_next):
    limit = PUBLIC_WRITE_BODY_LIMITS.get(request.url.path)
    if request.method in {"POST", "PUT", "PATCH"} and limit is not None:
        content_length = request.headers.get("content-length")
        if content_length and content_length.isdigit() and int(content_length) > limit:
            return JSONResponse(status_code=413, content={"detail": "Request body is too large"})
        body = await request.body()
        if len(body) > limit:
            return JSONResponse(status_code=413, content={"detail": "Request body is too large"})
    return await call_next(request)


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

# Serve Webpushr service worker via API route
@api_router.get("/webpushr-sw.js", response_class=PlainTextResponse)
async def serve_webpushr_service_worker_api():
    """Serve Webpushr service worker via API route"""
    return PlainTextResponse(
        content=WEBPUSHR_SW_CONTENT,
        media_type="application/javascript",
        headers={
            "Service-Worker-Allowed": "/",
            "Cache-Control": "no-cache"
        }
    )

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
async def create_status_check(input: StatusCheckCreate, request: Request):
    enforce_public_write_limit(request, "status", limit=30, window_seconds=60)
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
    provider = require_webpushr_client()
    event_id = get_admin_event_id(current_user)

    announcement = await announcements.get(announcement_id, event_id, public=True)
    if not announcement:
        raise HTTPException(
            status_code=409,
            detail="Only published, unexpired announcements can be notified",
        )
    if audience == "test" and not WEBPUSHR_TEST_SUBSCRIBER_IDS:
        raise HTTPException(status_code=503, detail="No Webpushr test subscribers are configured")

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
                **content, subscriber_ids=WEBPUSHR_TEST_SUBSCRIBER_IDS
            )
        else:
            campaign_id = await provider.send_everyone(**content)
    except WebpushrError as exc:
        await deliveries.mark_failed(delivery["id"], str(exc))
        raise HTTPException(status_code=502, detail=str(exc)) from exc

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
async def register_push_token(data: PushTokenRegister, request: Request):
    """Register a device's push notification token"""
    database = require_mongodb()
    enforce_public_write_limit(request, "push-token-device", identifier=data.device_id, limit=10, window_seconds=60)
    enforce_public_write_limit(request, "push-token-ip", limit=300, window_seconds=60)
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
async def update_starred_events(data: StarredEventsUpdate, request: Request):
    """Update the list of starred events for a user (for notification tracking)"""
    database = require_mongodb()
    enforce_public_write_limit(request, "starred-token", identifier=data.push_token, limit=30, window_seconds=60)
    enforce_public_write_limit(request, "starred-ip", limit=600, window_seconds=60)
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

SOS_MAX_PUSH_RECIPIENTS = 5000
EXPO_PUSH_BATCH_SIZE = 100
EXPO_PUSH_CONCURRENCY = 10


async def broadcast_sos_notification(database, *, title: str, body: str, data: dict) -> dict[str, int | str]:
    token_documents = await database.push_tokens.find().to_list(SOS_MAX_PUSH_RECIPIENTS)
    tokens = [row.get("push_token") for row in token_documents if row.get("push_token")]
    batches = [tokens[offset:offset + EXPO_PUSH_BATCH_SIZE] for offset in range(0, len(tokens), EXPO_PUSH_BATCH_SIZE)]
    if not batches:
        return {"status": "no_recipients", "attempted": 0, "succeeded": 0}
    semaphore = asyncio.Semaphore(EXPO_PUSH_CONCURRENCY)
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(15.0, connect=5.0),
        limits=httpx.Limits(max_connections=EXPO_PUSH_CONCURRENCY),
    ) as http_client:
        async def send_batch(batch: list[str]) -> bool:
            messages = [
                {"to": token, "sound": "default", "title": title, "body": body, "data": data,
                 "priority": "high", "channelId": "sos-alerts"}
                for token in batch
            ]
            try:
                async with semaphore:
                    response = await http_client.post(
                        "https://exp.host/--/api/v2/push/send",
                        json=messages,
                        headers={"Content-Type": "application/json"},
                    )
                return response.status_code == 200
            except Exception as exc:
                logger.error("SOS notification batch failed: %s", exc)
                return False
        results = await asyncio.gather(*(send_batch(batch) for batch in batches))
    succeeded = sum(results)
    status = "accepted" if succeeded == len(batches) else ("partial" if succeeded else "failed")
    return {"status": status, "attempted": len(batches), "succeeded": succeeded}

@api_router.post("/sos/report", response_model=SOSReportCreatedResponse)
async def create_sos_report(data: SOSReportCreate, request: Request):
    """Create an SOS missing person report and broadcast to all users"""
    database = require_mongodb()
    identity = data.reporter_token or data.reporter_phone or f"{data.reporter_name}:{data.name}"
    enforce_public_write_limit(request, "sos-report-identity", identifier=identity, limit=3, window_seconds=600)
    enforce_public_write_limit(request, "sos-report-ip", limit=30, window_seconds=600)
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
            reporter_token=data.reporter_token or secrets.token_urlsafe(32)
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
        
        delivery = await broadcast_sos_notification(
            database,
            title="🚨 MISSING PERSON ALERT",
            body=notification_body,
            data={"type": "sos_alert", "sos_id": report.id},
        )
        await database.sos_reports.update_one(
            {"id": report.id},
            {"$set": {
                "notification_status": delivery["status"],
                "notification_batches_attempted": delivery["attempted"],
                "notification_batches_succeeded": delivery["succeeded"],
            }},
        )
        
        return SOSReportCreatedResponse(
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
            created_at=report.created_at,
            notification_status=delivery["status"],
            notification_batches_attempted=delivery["attempted"],
            notification_batches_succeeded=delivery["succeeded"],
            reporter_token=report.reporter_token,
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
async def cancel_sos_report(report_id: str, request: Request, reporter_token: Optional[str] = None):
    """Cancel/resolve an SOS report (person found)"""
    database = require_mongodb()
    validate_sos_report_id(report_id)
    enforce_public_write_limit(request, "sos-cancel", identifier=reporter_token or "missing", limit=10, window_seconds=600)
    try:
        report = await database.sos_reports.find_one({"id": report_id})
        stored_token = report.get("reporter_token") if report else None
        if not reporter_token or not stored_token or not secrets.compare_digest(reporter_token, stored_token):
            raise HTTPException(status_code=404, detail="SOS report is unavailable")
        
        # Update status
        result = await database.sos_reports.update_one(
            {"id": report_id, "status": "active", "reporter_token": stored_token},
            {
                "$set": {
                    "status": "resolved",
                    "resolved_at": datetime.utcnow()
                }
            }
        )
        if not getattr(result, "modified_count", 0):
            raise HTTPException(status_code=404, detail="SOS report is unavailable")
        delivery = await broadcast_sos_notification(
            database,
            title="✅ Person Found - Alert Cancelled",
            body=f"{report['name']} has been found! Thank you for your help.",
            data={"type": "sos_cancelled", "sos_id": report_id},
        )
        return {"status": "success", "message": "SOS report cancelled, person found", "notification_status": delivery["status"]}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling SOS report: {e}")
        raise HTTPException(status_code=500, detail="Failed to cancel SOS report")

@api_router.post("/sos/resolve/{report_id}")
async def secure_resolve_sos_report(
    report_id: str,
    data: SOSResolveRequest,
    current_user: dict = Depends(get_current_organizer_user),
):
    """Securely resolve an SOS report with PIN verification (Admin only)"""
    database = require_mongodb()
    validate_sos_report_id(report_id)
    require_sos_admin_role(current_user)
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
        
        delivery = await broadcast_sos_notification(
            database,
            title="✅ Alert Resolved",
            body=f"Update: The situation regarding {report['name']} has been resolved. Thank you for your help.",
            data={"type": "sos_resolved", "sos_id": report_id},
        )
        
        return {
            "status": "success", 
            "message": "Alert resolved successfully",
            "resolved_at": resolved_time.isoformat(),
            "notification_status": delivery["status"],
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resolving SOS report: {e}")
        raise HTTPException(status_code=500, detail="Failed to resolve SOS report")

@api_router.post("/sos/archive/{report_id}")
async def archive_sos_report(
    report_id: str,
    data: SOSResolveRequest,
    current_user: dict = Depends(get_current_organizer_user),
):
    """Archive an SOS report with PIN verification (Admin only)"""
    database = require_mongodb()
    validate_sos_report_id(report_id)
    require_sos_admin_role(current_user)
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
async def create_test_alert(current_user: dict = Depends(get_current_organizer_user)):
    """Create a test SOS alert for testing purposes (Admin endpoint)"""
    database = require_mongodb()
    require_sos_admin_role(current_user)
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
        raise HTTPException(status_code=500, detail="Failed to create test alert")

@api_router.delete("/sos/test-alert/{alert_id}")
async def delete_test_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_organizer_user),
):
    """Delete a test SOS alert"""
    database = require_mongodb()
    validate_sos_report_id(alert_id)
    require_sos_admin_role(current_user)
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
async def get_sos_admin_details(
    report_id: str,
    data: SOSResolveRequest,
    current_user: dict = Depends(get_current_organizer_user),
):
    """Get full SOS report details including reporter info (Admin PIN required)"""
    database = require_mongodb()
    validate_sos_report_id(report_id)
    require_sos_admin_role(current_user)
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

# Serve Webpushr service worker at root level (not under /api)
@app.get("/webpushr-sw.js", response_class=PlainTextResponse)
async def serve_webpushr_service_worker():
    """Serve Webpushr service worker from root"""
    return PlainTextResponse(
        content=WEBPUSHR_SW_CONTENT,
        media_type="application/javascript",
        headers={
            "Service-Worker-Allowed": "/",
            "Cache-Control": "no-cache"
        }
    )

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

@app.on_event("startup")
async def startup_event():
    """Start the cron job when the server starts"""
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
