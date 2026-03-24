from fastapi import FastAPI, APIRouter, HTTPException
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

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Google Sheet URLs (public CSV export)
EVENTS_SHEET_ID = "1tnfBd7Ffg5S4hyk5c5CpB-VGkJcSnLpdsKGbNJIiQCs"
EVENTS_SHEET_CSV_URL = f"https://docs.google.com/spreadsheets/d/{EVENTS_SHEET_ID}/export?format=csv"

VENDORS_SHEET_ID = "12FhDHOZDUaI41oZGeIvSopFxlfFi7X8OxKNSVaBmBgg"
VENDORS_SHEET_CSV_URL = f"https://docs.google.com/spreadsheets/d/{VENDORS_SHEET_ID}/export?format=csv"

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

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

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
            
            vendor = Vendor(
                id=vendor_id,
                name=name,
                type=row.get('Type', '').strip(),
                location=row.get('Location', '').strip(),
                hours_of_operation=row.get('Hours of Operation', '').strip(),
                days_of_operation=row.get('Days of Operation', '').strip(),
            )
            vendors.append(vendor)
        
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

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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
