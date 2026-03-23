from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import httpx
import csv
from io import StringIO


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
                location_name=None  # Can be added later if needed
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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
