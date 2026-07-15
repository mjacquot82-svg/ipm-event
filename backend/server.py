from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import PlainTextResponse, FileResponse
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
        SupabaseVendorService,
        VendorService,
    )
except ImportError:
    from backend.platform_services import (
        EventService,
        ScheduleService,
        SupabaseScheduleService,
        SupabaseAnnouncementService,
        SupabaseVendorService,
        VendorService,
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
CONTENT_SOURCE = os.environ.get("CONTENT_SOURCE", "google_sheets").strip().lower()
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
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

# Create the main app without a prefix
app = FastAPI()

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
if CONTENT_SOURCE == "supabase":
    announcement_service = SupabaseAnnouncementService(
        supabase_url=SUPABASE_URL,
        service_role_key=SUPABASE_SERVICE_ROLE_KEY,
        event_slug=event_service.get_public_event_id(),
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
    logger.info("Starting cron scheduler for event change detection...")
    asyncio.create_task(cron_scheduler())

@app.on_event("shutdown")
async def shutdown_db_client():
    if client is not None:
        client.close()
