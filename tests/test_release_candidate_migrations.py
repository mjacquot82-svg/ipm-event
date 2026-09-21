"""Candidate schema/content validation in network-isolated, disposable PostgreSQL."""
import json
from pathlib import Path
import subprocess
import time
from uuid import uuid4
import pytest
from backend.prepare_release_artisan_content import reviewed_sql, desired_rows, EVENT_ID

ROOT=Path(__file__).resolve().parents[1]

@pytest.fixture(scope='module')
def db():
    name='ipm-release-audit-'+uuid4().hex[:10]
    subprocess.run(['docker','run','-d','--name',name,'--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine'],check=True,capture_output=True)
    try:
        for _ in range(60):
            if subprocess.run(['docker','exec',name,'pg_isready','-h','127.0.0.1','-U','postgres'],capture_output=True).returncode==0:break
            time.sleep(.2)
        def sql(query):
            result=subprocess.run(['docker','exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-tA'],input=query,text=True,capture_output=True)
            assert result.returncode==0,result.stderr
            return result.stdout
        sql('create role anon;create role authenticated;create role service_role;')
        for file in ['phase1_supabase_schema.sql','phase1_announcements_migration.sql','phase1a_notification_deliveries_migration.sql']:
            sql((ROOT/'docs/platform'/file).read_text())
        for file in sorted((ROOT/'supabase/migrations').glob('*.sql')):
            if file.name.endswith('announcement_images.sql'):continue # Supabase Storage bucket policies are already deployed; not a candidate delta.
            sql(file.read_text())
        sql.container_name = name
        yield sql
    finally:subprocess.run(['docker','rm','-f',name],check=True,capture_output=True)


def test_fresh_schema_has_only_normal_reminder_tables(db):
    assert db("select count(*) from information_schema.tables where table_schema='public' and table_name like '%controlled%';").strip()=='0'
    assert db("select count(*) from information_schema.tables where table_schema='public' and table_name like '%synthetic%';").strip()=='0'
    assert 'itinerary_reminder_batches' in db("select tablename from pg_tables where tablename like 'itinerary_reminder%';")


def test_reminder_rpc_privileges_and_rls(db):
    assert db("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%itinerary%' and p.prosecdef and has_function_privilege('anon',p.oid,'EXECUTE');").strip()=='0'
    assert db("select count(*) from pg_class where relname like 'itinerary_reminder%' and relkind='r' and not relrowsecurity;").strip()=='0'


def test_artisan_content_is_idempotent_and_preserves_existing_ids(db):
    db(f"insert into events(id,slug,name,status) values ('{EVENT_ID}','ipm-2026','IPM 2026','published');")
    manifest=json.loads((ROOT/'frontend/scripts/data/artisan-tent-vendors-2026.json').read_text())
    for v in manifest['vendors']:
        if not v['create_if_absent']:
            db(f"insert into vendors(id,event_id,name,status) values ('{v['id']}','{EVENT_ID}','{v['name'].replace(chr(39),chr(39)*2)}','published');")
    db(reviewed_sql());db(reviewed_sql())
    assert db("select count(*) from schedule_items;").strip()=='9'
    assert db("select count(*) from vendors where location='Indoors at the Artisan Tent';").strip()=='11'
    assert db("select count(distinct id) from vendors;").strip()=='11'
    assert len(desired_rows())==9


def test_normal_t30_claim_is_atomic_exact_and_late_stars_excluded(db):
    # Only local rows. Two installations and one normal published event.
    db("insert into itinerary_reminder_installations(id,event_id,wonderpush_installation_id,capability_hash,reminders_enabled,provider_reachability,provider_has_push_token,provider_deliverable,provider_checked_at) values ('00000000-0000-4000-8000-000000000011','"+EVENT_ID+"','local-one',repeat('a',64),true,'optIn',true,true,'2026-09-22T17:31:00Z'),('00000000-0000-4000-8000-000000000012','"+EVENT_ID+"','local-late',repeat('b',64),true,'optIn',true,true,'2026-09-22T17:31:00Z');")
    event=desired_rows()[0]['id']
    db(f"insert into itinerary_reminder_stars values ('00000000-0000-4000-8000-000000000011','{event}','2026-09-22T17:00:00Z'),('00000000-0000-4000-8000-000000000012','{event}','2026-09-22T17:31:00Z');")
    claim=f"select wonderpush_installation_id from claim_due_itinerary_reminders('2026-09-22T17:31:00Z','{EVENT_ID}',250);"
    assert db(claim).strip()=='local-one'
    assert db(claim).strip()==''


def test_generic_engine_runs_all_rpc_dependencies_without_real_provider(db):
    """Execute repository SQL against local Postgres; the provider cannot use a network."""
    import asyncio
    from datetime import datetime, timedelta, timezone
    from backend.itinerary_reminders import ItineraryReminderEngine, SupabaseItineraryReminderRepository
    now = datetime.now(timezone.utc)
    event, registration = str(uuid4()), str(uuid4())
    starts = (now + timedelta(minutes=29)).isoformat()
    db(f"insert into schedule_items(id,event_id,title,starts_at,status) values ('{event}','{EVENT_ID}','Local engine verification','{starts}','published');")
    db(f"insert into itinerary_reminder_installations(id,event_id,wonderpush_installation_id,capability_hash,reminders_enabled) values ('{registration}','{EVENT_ID}','local-engine-target',repeat('c',64),true);")
    db(f"insert into itinerary_reminder_stars values ('{registration}','{event}','{(now-timedelta(hours=1)).isoformat()}');")

    def literal(value):
        if value is None: return 'NULL'
        if isinstance(value,bool): return str(value).lower()
        if isinstance(value,(int,float)): return str(value)
        if isinstance(value,list): return 'ARRAY['+','.join(literal(v) for v in value)+']::uuid[]'
        return "'"+str(value).replace("'","''")+"'"

    class Storage:
        async def get_event_id(self,slug): return EVENT_ID
        async def request(self,method,path,params=None,json=None,headers=None):
            import json as codec
            if path.startswith('/rpc/'):
                name=path.split('/')[-1]
                args=','.join(k+'=>'+literal(v) for k,v in json.items())
                scalar=name in ['mark_itinerary_batch_attempted','record_itinerary_provider_outcome']
                query=f'select to_json({name}({args}));' if scalar else f"select coalesce(json_agg(r),'[]'::json) from (select * from {name}({args})) r;"
                return codec.loads(db(query).strip())
            assert method=='PATCH', (method,path)
            setters=','.join(k+'='+literal(v) for k,v in json.items())
            conditions=[]
            for key,value in params.items():
                op,value=value.split('.',1)
                conditions.append(key+{'eq':'=','lt':'<'}[op]+literal(value))
            query=f"with updated as (update {path[1:]} set {setters} where {' and '.join(conditions)} returning *) select coalesce(json_agg(updated),'[]'::json) from updated;"
            return codec.loads(db(query).strip())

    class Provider:
        calls=[]
        async def get_installation(self,installation_id):
            return {'preferences':{'subscriptionStatus':'optIn'},'pushToken':{'data':'local-only'}}
        async def send_installations(self,**kwargs):
            self.calls.append(kwargs)
            return {'provider_delivery_id':'local-provider-result','status_code':202}

    async def run():
        provider=Provider()
        repository=SupabaseItineraryReminderRepository(Storage(),'ipm-2026')
        disabled=await ItineraryReminderEngine(repository,provider).run(now=now)
        assert disabled['kill_switch_enabled'] and not provider.calls
        engine=ItineraryReminderEngine(repository,provider,delivery_enabled=True)
        result=await engine.run(now=now)
        assert result['provider_accepted']==1
        assert provider.calls[0]['installation_ids']==['local-engine-target']
        assert provider.calls[0]['idempotency_key'].startswith('ipm-t30-')
        again=await engine.run(now=now)
        assert again['claimed']==0 and len(provider.calls)==1
    asyncio.run(run())


def test_production_content_revisions_are_monotonic_and_event_scoped(db):
    event = str(uuid4())
    db(f"insert into events(id,slug,name,status) values ('{event}','manifest-test','Manifest test','published');")
    db(f"insert into content_revisions(event_id,content_type) values ('{event}','schedule'),('{event}','announcements');")
    db(f"insert into schedule_items(event_id,title) values ('{event}','first');")
    assert db(f"select revision from content_revisions where event_id='{event}' and content_type='schedule';").strip() == '2'
    db(f"update schedule_items set title='second' where event_id='{event}';")
    assert db(f"select revision from content_revisions where event_id='{event}' and content_type='schedule';").strip() == '3'
    db(f"insert into alerts(event_id,title,message,status) values ('{event}','Update','Message','published');")
    assert db(f"select revision from content_revisions where event_id='{event}' and content_type='announcements';").strip() == '2'
    assert db(f"select revision from content_revisions where event_id='{event}' and content_type='schedule';").strip() == '3'
