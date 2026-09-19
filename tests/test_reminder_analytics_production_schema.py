"""Real PostgREST/PostgreSQL regression, with no provider or external network access.

Run with POSTGREST_BIN pointing to a static Linux PostgREST binary. The existing
migration fixture creates a disposable network-none database and applies the six
candidate migrations plus their production prerequisites. No live credentials.
"""
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
from urllib.parse import urlencode
from uuid import uuid4

from fastapi.testclient import TestClient
import pytest
from backend import server
from backend.itinerary_reminders import SupabaseItineraryReminderRepository
from backend.notification_overview import overview
from tests.test_release_candidate_migrations import db


@pytest.fixture(scope='module')
def rest(db):
    binary = os.environ.get('POSTGREST_BIN') or shutil.which('postgrest')
    assert binary and Path(binary).is_file(), 'Set POSTGREST_BIN to the static PostgREST binary; this integration test must not silently skip.'
    db('alter role service_role bypassrls; grant usage on schema public to service_role; grant all on all tables in schema public to service_role;')
    subprocess.run(['docker', 'cp', binary, db.container_name+':/tmp/postgrest'], check=True, capture_output=True)
    subprocess.run(['docker', 'exec', '-d', db.container_name, 'env',
                    'PGRST_DB_URI=postgres://postgres@127.0.0.1:5432/postgres',
                    'PGRST_DB_ANON_ROLE=service_role', 'PGRST_DB_SCHEMAS=public',
                    'PGRST_SERVER_HOST=127.0.0.1', '/tmp/postgrest'], check=True, capture_output=True)

    def request(path, params=None, body=None):
        url = 'http://127.0.0.1:3000'+path+('?' + urlencode(params) if params else '')
        command = ['docker', 'exec', db.container_name, 'wget', '-q', '-O', '-']
        if body is not None:
            command += ['--header=Content-Type: application/json', '--post-data='+json.dumps(body)]
        return subprocess.run(command+[url], capture_output=True, text=True)

    for _ in range(60):
        if request('/').returncode == 0: break
        time.sleep(.2)
    else: pytest.fail('Local PostgREST did not start')
    return request


@pytest.fixture(scope='module')
def records(db, rest):
    event_id, other_event, schedule_id = (str(uuid4()) for _ in range(3))
    now = datetime.now(timezone.utc)
    db(f"insert into events(id,slug,name,status) values ('{event_id}','analytics-local','Local','published'),('{other_event}','analytics-other','Other','published');")
    db(f"insert into schedule_items(id,event_id,title,starts_at,status) values ('{schedule_id}','{event_id}','Normal event','{(now+timedelta(minutes=28)).isoformat()}','published');")
    for index, status in enumerate(['claimed', 'provider_accepted', 'provider_failed', 'delivery_unknown', None]):
        registration = str(uuid4())
        db(f"insert into itinerary_reminder_installations(id,event_id,wonderpush_installation_id,capability_hash,reminders_enabled,provider_reachability,provider_has_push_token,provider_deliverable,provider_checked_at) values ('{registration}','{event_id}','local-{index}',repeat('{index}',64),true,'optIn',true,true,'{now.isoformat()}');")
        db(f"insert into itinerary_reminder_stars values ('{registration}','{schedule_id}','{(now-timedelta(hours=1)).isoformat()}');")
        if status:
            db(f"insert into itinerary_reminder_deliveries(registration_id,schedule_item_id,reminder_type,status,attempt_count) values ('{registration}','{schedule_id}','itinerary_t30','{status}',1);")
    # Another event's ledger must never contaminate this organizer's aggregate.
    registration, item = str(uuid4()), str(uuid4())
    db(f"insert into schedule_items(id,event_id,title,starts_at,status) values ('{item}','{other_event}','Other event','{(now+timedelta(minutes=28)).isoformat()}','published');")
    db(f"insert into itinerary_reminder_installations(id,event_id,wonderpush_installation_id,capability_hash) values ('{registration}','{other_event}','other-local',repeat('f',64));")
    db(f"insert into itinerary_reminder_deliveries(registration_id,schedule_item_id,reminder_type,status) values ('{registration}','{item}','itinerary_t30','provider_accepted');")
    return event_id


def test_old_staging_filter_is_rejected_by_production_schema(db, rest, records):
    assert db("select count(*) from information_schema.columns where table_schema='public' and column_name='controlled_fixture_id';").strip() == '0'
    result = rest('/itinerary_reminder_deliveries', {'select':'id', 'controlled_fixture_id':'is.null'})
    assert result.returncode != 0 and '400' in result.stderr


def test_real_t30_endpoint_succeeds_with_normal_production_schema(db, rest, records, monkeypatch):
    calls = []
    class Storage:
        async def get_event_id(self, slug): return records
        async def request(self, method, path, params=None, json=None, headers=None):
            assert method == 'GET' or (method == 'POST' and path == '/rpc/itinerary_reminder_operational_metrics')
            calls.append((method,path,params))
            response = rest(path, params, json)
            assert response.returncode == 0, response.stderr
            import json as codec
            return codec.loads(response.stdout)

    repository = SupabaseItineraryReminderRepository(Storage(), 'ipm-2026')
    monkeypatch.setattr(server, 'itinerary_reminder_repository', repository)
    prior = dict(server.app.dependency_overrides)
    server.app.dependency_overrides[server.get_current_organizer_user] = lambda: {'role':'Owner','event_id':'ipm-2026'}
    before = db("select json_agg(d order by id)::text from itinerary_reminder_deliveries d;")
    try:
        # No lifespan context: never start unrelated server background jobs.
        client = TestClient(server.app)
        response = client.get('/api/admin/analytics/reminders')
        assert response.status_code == 200, response.text
        result = response.json()
        assert result['active_interests'] == 5
        assert result['normal_claims'] == 4
        assert result['provider_accepted'] == result['provider_failed'] == result['delivery_unknown'] == 1
        assert result['due_reminders'] == 1
        assert result['duplicate_eligible_interests'] == 4
        assert result['duplicates_suppressed'] is None
        assert records not in response.text and 'local-' not in response.text
        assert client.get('/api/admin/analytics/reminders').json()['normal_claims'] == 4
    finally:
        server.app.dependency_overrides.clear()
        server.app.dependency_overrides.update(prior)
    assert db("select json_agg(d order by id)::text from itinerary_reminder_deliveries d;") == before
    assert not any('controlled_fixture_id' in (params or {}) for _,_,params in calls)


def test_historical_notification_metrics_stay_unknown(db, rest, records):
    announcement = str(uuid4())
    db(f"insert into alerts(id,event_id,title,message) values ('{announcement}','{records}','Historical','Historical');")
    db(f"insert into notification_deliveries(event_id,announcement_id,audience,provider,status,requested_by,target_url,notification_title,notification_message,provider_campaign_id,sent_at) values ('{records}','{announcement}','everyone','wonderpush','sent','Local','https://example.invalid','Historical','Historical','local-campaign',now());")
    response = rest('/notification_deliveries', {'event_id':'eq.'+records, 'select':'*'})
    assert response.returncode == 0, response.stderr
    rows = json.loads(response.stdout)
    for key in ['provider_confirmed_receipt_count','provider_targeted_device_count','provider_open_count','provider_failure_count','notification_origin_visit_count']:
        assert rows[0][key] is None
    result = overview(rows, datetime.now(timezone.utc))
    assert result['accepted_sends'] == 1
    assert all(metric['value'] is None for metric in result['metrics'].values())
