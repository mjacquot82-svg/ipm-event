from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import PlainTextResponse, FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime
import httpx
import csv
from io import StringIO
import asyncio
import hashlib
import json


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection - supports both MONGODB_URL (Railway) and MONGO_URL (Emergent)
mongo_url = os.environ.get('MONGODB_URL') or os.environ.get('MONGO_URL')
if not mongo_url:
    raise Exception("No MongoDB URL found. Set MONGODB_URL or MONGO_URL environment variable.")

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
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

@api_router.get("/schedule", response_model=ScheduleResponse)
async def get_schedule():
    """Fetch schedule events from Google Sheets (only Event type, not Locations)"""
    try:
        async with httpx.AsyncClient(follow_redirects=True) as http_client:
            response = await http_client.get(EVENTS_SHEET_CSV_URL, timeout=30.0)
            response.raise_for_status()
            
        # Parse CSV
        csv_content = response.text
        reader = csv.DictReader(StringIO(csv_content))
        
        events = []
        for idx, row in enumerate(reader):
            # Only include Event types, not Locations
            entry_type = row.get('Entry_Type', '').strip()
            if entry_type.lower() != 'event':
                continue
            
            # Parse coordinates
            try:
                lat = float(row.get('Lat', 0)) if row.get('Lat') else None
                lng = float(row.get('Long', 0)) if row.get('Long') else None
            except ValueError:
                lat, lng = None, None
            
            # Create unique ID based on row data
            event_id = f"gs_{idx}_{row.get('Name', '').replace(' ', '_').lower()}"
            
            event = ScheduleEvent(
                id=event_id,
                title=row.get('Name', 'Untitled Event').strip(),
                description=row.get('Description', '').strip(),
                start_date=row.get('Start Date', '').strip(),
                start_time=row.get('Event Start', '').strip(),
                end_time=row.get('Event End', '').strip(),
                category=row.get('Category', 'Event').strip(),
                latitude=lat,
                longitude=lng,
                days_active=row.get('Days_Active', '').strip(),
                location_name=row.get('Location', '').strip()
            )
            events.append(event)
        
        return ScheduleResponse(
            events=events,
            last_updated=datetime.utcnow(),
            total_count=len(events)
        )
        
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
        async with httpx.AsyncClient(follow_redirects=True) as http_client:
            response = await http_client.get(VENDORS_SHEET_CSV_URL, timeout=30.0)
            response.raise_for_status()
            
        # Parse CSV
        csv_content = response.text
        reader = csv.DictReader(StringIO(csv_content))
        
        vendors = []
        for idx, row in enumerate(reader):
            # Skip empty rows
            name = row.get('Name', '').strip()
            if not name:
                continue
            
            vendor_id = f"vendor_{idx}_{name.replace(' ', '_').lower()}"
            
            # Parse priority - default to 99 if not present or invalid
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
        
        # Sort vendors by priority (1 at top, 99 at bottom)
        vendors.sort(key=lambda v: v.priority)
        
        return VendorsResponse(
            vendors=vendors,
            last_updated=datetime.utcnow(),
            total_count=len(vendors)
        )
        
    except httpx.HTTPError as e:
        logger.error(f"Failed to fetch Vendors Sheet: {e}")
        raise HTTPException(status_code=502, detail="Failed to fetch vendors data")
    except Exception as e:
        logger.error(f"Error processing vendors: {e}")
        raise HTTPException(status_code=500, detail="Error processing vendors data")

@api_router.post("/register-push-token")
async def register_push_token(data: PushTokenRegister):
    """Register a device's push notification token"""
    try:
        # Upsert the token (update if exists, insert if not)
        await db.push_tokens.update_one(
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
    try:
        await db.user_starred_events.update_one(
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
        await db.sos_reports.insert_one(report.dict())
        
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
        all_tokens = await db.push_tokens.find().to_list(10000)
        
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
    try:
        reports = await db.sos_reports.find({"status": "active"}).to_list(100)
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
    try:
        # Find the report
        report = await db.sos_reports.find_one({"id": report_id})
        if not report:
            raise HTTPException(status_code=404, detail="SOS report not found")
        
        # Update status
        await db.sos_reports.update_one(
            {"id": report_id},
            {
                "$set": {
                    "status": "resolved",
                    "resolved_at": datetime.utcnow()
                }
            }
        )
        
        # Notify all users that the person was found
        all_tokens = await db.push_tokens.find().to_list(10000)
        
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
    try:
        # Verify PIN
        if data.pin != ADMIN_PIN:
            return {"status": "error", "message": "Unauthorized - Invalid PIN"}
        
        # Find the report
        report = await db.sos_reports.find_one({"id": report_id})
        if not report:
            raise HTTPException(status_code=404, detail="SOS report not found")
        
        if report["status"] == "resolved":
            return {"status": "already_resolved", "message": "Alert already resolved"}
        
        # Update the report status to resolved
        resolved_time = datetime.utcnow()
        await db.sos_reports.update_one(
            {"id": report_id},
            {"$set": {
                "status": "resolved",
                "resolved_at": resolved_time
            }}
        )
        
        # Broadcast "Resolved" notification to all registered devices
        all_tokens = await db.push_tokens.find().to_list(1000)
        logger.info(f"SOS RESOLVED: Broadcasting to {len(all_tokens)} devices")
        
        for token_doc in all_tokens:
            push_token = token_doc.get("token")
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
async def archive_sos_report(report_id: str):
    """Archive a resolved SOS report (called after 30-minute timer)"""
    try:
        report = await db.sos_reports.find_one({"id": report_id})
        if not report:
            raise HTTPException(status_code=404, detail="SOS report not found")
        
        if report["status"] != "resolved":
            return {"status": "error", "message": "Can only archive resolved alerts"}
        
        # Update to archived status
        await db.sos_reports.update_one(
            {"id": report_id},
            {"$set": {
                "status": "archived",
                "archived_at": datetime.utcnow()
            }}
        )
        
        return {"status": "success", "message": "Alert archived"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error archiving SOS report: {e}")
        raise HTTPException(status_code=500, detail="Failed to archive SOS report")

@api_router.get("/sos/resolved", response_model=List[SOSReportResponse])
async def get_resolved_sos_reports():
    """Get all resolved (but not yet archived) SOS reports"""
    try:
        reports = await db.sos_reports.find({"status": "resolved"}).to_list(100)
        if not reports:
            return []
        return [SOSReportResponse(**report) for report in reports]
    except Exception as e:
        logger.error(f"Error fetching resolved SOS reports: {e}")
        return []

@api_router.get("/sos/archived", response_model=List[SOSReportResponse])
async def get_archived_sos_reports():
    """Get all archived (past) SOS reports"""
    try:
        reports = await db.sos_reports.find({"status": "archived"}).to_list(100)
        if not reports:
            return []
        return [SOSReportResponse(**report) for report in reports]
    except Exception as e:
        logger.error(f"Error fetching archived SOS reports: {e}")
        return []

@api_router.post("/sos/test-alert")
async def create_test_alert():
    """Create a test SOS alert for testing purposes (Admin endpoint)"""
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
        
        await db.sos_reports.insert_one(test_report.dict())
        
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
    try:
        result = await db.sos_reports.delete_one({"id": alert_id})
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
    try:
        # Verify PIN
        if data.pin != ADMIN_PIN:
            raise HTTPException(status_code=401, detail="Unauthorized - Invalid PIN")
        
        # Find the report
        report = await db.sos_reports.find_one({"id": report_id})
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
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============== CRON JOB FOR EVENT CHANGE DETECTION ==============

async def fetch_events_data() -> tuple[List[dict], str]:
    """Fetch events from Google Sheet and return data with hash"""
    try:
        async with httpx.AsyncClient(follow_redirects=True) as http_client:
            response = await http_client.get(EVENTS_SHEET_CSV_URL, timeout=30.0)
            response.raise_for_status()
        
        csv_content = response.text
        reader = csv.DictReader(StringIO(csv_content))
        
        events = []
        for idx, row in enumerate(reader):
            entry_type = row.get('Entry_Type', '').strip()
            if entry_type.lower() != 'event':
                continue
            
            event_id = f"gs_{idx}_{row.get('Name', '').replace(' ', '_').lower()}"
            events.append({
                'id': event_id,
                'title': row.get('Name', '').strip(),
                'description': row.get('Description', '').strip(),
                'start_date': row.get('Start Date', '').strip(),
                'start_time': row.get('Event Start', '').strip(),
                'end_time': row.get('Event End', '').strip(),
                'category': row.get('Category', '').strip(),
                'days_active': row.get('Days_Active', '').strip(),
            })
        
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
    
    logger.info("Cron: Checking for event changes...")
    
    events, new_hash = await fetch_events_data()
    
    if not new_hash:
        logger.warning("Cron: Could not fetch events data")
        return
    
    # First run - just cache the hash
    if not cached_events_hash:
        cached_events_hash = new_hash
        # Store events in DB for comparison
        await db.cached_events.delete_many({})
        for event in events:
            await db.cached_events.insert_one(event)
        logger.info(f"Cron: Initial cache set with {len(events)} events")
        return
    
    # Check if hash changed
    if new_hash == cached_events_hash:
        logger.info("Cron: No changes detected")
        return
    
    logger.info("Cron: Changes detected! Finding affected events...")
    
    # Find what changed
    old_events = await db.cached_events.find().to_list(1000)
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
    await db.cached_events.delete_many({})
    for event in events:
        await db.cached_events.insert_one(event)
    
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
        starred_users = await db.user_starred_events.find({
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
    logger.info("Starting cron scheduler for event change detection...")
    asyncio.create_task(cron_scheduler())

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
