"""Real disposable Mongo proof. No app startup, production DB, or provider access."""
import asyncio
from datetime import datetime,timezone
import json
import subprocess
import time
from uuid import uuid4
import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from backend.analytics import MongoAnalyticsRepository,_event_document
from tests.test_notification_analytics_completion import event,DID


def test_real_visit_ledger_reload_new_navigation_and_privacy():
    name='ipm-analytics-visits-'+uuid4().hex[:10]
    subprocess.run(['docker','run','-d','--name',name,'--tmpfs','/data/db','-p','127.0.0.1::27017','mongo:7'],check=True,capture_output=True)
    try:
        mapping=json.loads(subprocess.check_output(['docker','inspect',name]))[0]['NetworkSettings']['Ports']['27017/tcp'][0]
        async def scenario():
            client=AsyncIOMotorClient('mongodb://127.0.0.1:'+mapping['HostPort'],serverSelectionTimeoutMS=1000)
            try:
                for _ in range(30):
                    try:await client.admin.command('ping');break
                    except Exception:await asyncio.sleep(.2)
                else:raise RuntimeError('Isolated Mongo did not start')
                db=client.fixture;repo=MongoAnalyticsRepository(db)
                await repo.ensure_indexes()
                def document(e):return _event_document(visitor_id=uuid4(),session_id=uuid4(),event=e,received_at=datetime.now(timezone.utc))
                assert await repo.record_event(document(event())) is True
                assert await repo.notification_visit_counts([DID])=={DID:1}
                assert await repo.record_event(document(event())) is False
                assert await repo.notification_visit_counts([DID])=={DID:1}
                assert await repo.record_event(document(event(nav=str(uuid4())))) is True
                assert await repo.notification_visit_counts([DID])=={DID:2}
                assert await repo.notification_visit_counts([str(uuid4())])=={}
                stored=await db.notification_origin_visits.find_one({})
                assert set(stored)=={'_id','eventScope','deliveryId','createdAt'}
            finally:client.close()
        asyncio.run(scenario())
    finally:subprocess.run(['docker','rm','-f',name],check=True,capture_output=True)
