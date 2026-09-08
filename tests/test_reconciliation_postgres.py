"""Real PostgreSQL transactions/concurrency; opt-in isolated test DB, never staging."""
import asyncio
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import uuid
import pytest

psycopg=pytest.importorskip('psycopg')
DSN=os.environ.get('IPM_RECONCILIATION_TEST_DSN')
pytestmark=pytest.mark.skipif(not DSN,reason='Requires isolated PostgreSQL test database')

def sql(query,args=None):
 with psycopg.connect(DSN,autocommit=True) as c:
  with c.cursor() as cur:
   cur.execute(query,args)
   return cur.fetchall() if cur.description else []

@pytest.fixture(autouse=True)
def reset():
 # Isolated database marker and loopback guard prevent accidental staging use.
 assert '127.0.0.1:55439' in DSN
 sql('update notification_reconciliation_project set pilot_registration_id=null')
 sql('truncate notification_reconciliation, notification_installations, events cascade')
 sql('insert into notification_reconciliation_project(singleton) values(true) on conflict do nothing')
 sql("update notification_reconciliation_project set enabled=true,repair_enabled=true,checks=0,failures=0,window_start=now(),open_until=null")
 sql("insert into events values('11111111-1111-1111-1111-111111111111','test')")
 sql("insert into notification_installations(event_id,wonderpush_installation_id,capability_hash) values('11111111-1111-1111-1111-111111111111',%s,%s)",('b'*40,'a'*64))
 sql('update notification_reconciliation_project set pilot_registration_id=(select id from notification_installations limit 1)')

def rpc(action='claim',**kw):
 p={'action':action,'event_slug':'test','capability_hash':'a'*64,'installation_id':'b'*40,'fingerprint':'c'*64,'generation':1,**kw}
 return sql('select ipm_reconciliation(%s::jsonb)',(json.dumps(p),))[0][0]

def fence(r):return {'operation_id':r['operation_id'],'generation':r['generation']}
def verified():
 r=rpc();rpc('finish',**fence(r),status='VERIFYING',provider_ready=True)
 return rpc('confirm',generation=r['generation'])

def test_durable_claim_deduplicates_multiple_instances_and_restarts():
 with concurrent.futures.ThreadPoolExecutor(max_workers=20) as pool:
  results=list(pool.map(lambda _:rpc(),range(40)))
 assert sum(r['status']=='COMPARING' for r in results)==1
 assert all(r['status'] in ('COMPARING','DEFERRED') for r in results)
 assert rpc()['status']=='DEFERRED'

def test_verified_history_does_not_skip_new_claim_and_reads_remain_bounded():
 for _ in range(4):assert verified()['status']=='VERIFIED'
 assert rpc()['outcome']=='RATE_LIMIT'
 assert sql('select checks from notification_reconciliation')[0][0]==4


def test_rotation_fences_old_patch_and_confirmation():
 r=rpc()
 assert rpc('invalidate',fingerprint='d'*64,generation=1)['status']=='CHECK_DUE'
 assert rpc('patch',**fence(r))['outcome']=='STALE_GENERATION'
 assert rpc('confirm',generation=1)['outcome']=='STALE_GENERATION'

def test_rotation_during_patch_cannot_verify_old_generation():
 r=rpc();assert rpc('patch',**fence(r))['status']=='PATCH_PENDING'
 rpc('invalidate',fingerprint='d'*64,generation=1)
 assert rpc('finish',**fence(r),status='VERIFYING')['outcome']=='STALE_GENERATION'
 sql("update notification_reconciliation set lease_until=now()-interval '1 second'")
 new=rpc(fingerprint='d'*64,generation=2)
 assert new['generation']==2 and new['uncertain'] is True
 assert rpc('patch',fingerprint='d'*64,**fence(new))['status']=='OUTCOME_UNKNOWN'

def test_crashed_patch_lease_expiry_never_authorizes_replay():
 r=rpc();rpc('patch',**fence(r))
 sql("update notification_reconciliation set lease_until=now()-interval '1 second'")
 r=rpc();assert r['uncertain'] is True
 assert rpc('patch',**fence(r))['status']=='OUTCOME_UNKNOWN'

def test_healthy_confirmation_freshness_separate_from_readiness():
 r=rpc();rpc('finish',**fence(r),status='VERIFYING',provider_ready=True)
 assert sql('select subscription_verified_at from notification_reconciliation')[0][0] is None
 assert rpc('confirm',generation=1)['status']=='VERIFIED'
 row=sql('select provider_checked_at,subscription_verified_at,verification_expires_at from notification_reconciliation')[0]
 assert all(row) and (row[2]-row[1]).total_seconds()==21600

def test_four_cycles_per_hour_and_retry_schedule():
 for index in range(4):
  r=rpc();assert r['status']=='COMPARING'
  rpc('finish',**fence(r),status='DEFERRED',outcome='DATA')
  assert rpc()['status']=='DEFERRED'
  sql("update notification_reconciliation set next_attempt_at=now()-interval '1 second'")
 assert rpc()['outcome']=='RATE_LIMIT'
 assert sql('select checks from notification_reconciliation')[0][0]==4

def test_project_circuit_retry_after_and_healthy_request_cannot_clear_it():
 r=rpc();rpc('finish',**fence(r),status='DEFERRED',outcome='BILLING',retry_after=7200)
 until=sql('select open_until from notification_reconciliation_project')[0][0]
 assert until is not None
 sql("update notification_reconciliation set next_attempt_at=now()-interval '1 second'")
 assert rpc()['outcome']=='CIRCUIT_OPEN'

def test_identity_event_and_capability_isolation_no_metadata_created():
 for kw in [{'capability_hash':'x'*64},{'installation_id':'z'*40},{'event_slug':'production'}]:
  assert rpc(**kw)['status'] in ('IDENTITY_UNRESOLVED','INELIGIBLE')
 assert sql('select count(*) from notification_reconciliation')[0][0]==0

def test_disabled_observation_and_repair_switches():
 sql('update notification_reconciliation_project set enabled=false')
 assert rpc()['outcome']=='DISABLED'
 sql('update notification_reconciliation_project set enabled=true,repair_enabled=false')
 r=rpc();assert not r['repair_enabled']
 assert rpc('patch',**fence(r))['status']=='OUTCOME_UNKNOWN'

def test_1000_nonpilot_attendees_hard_excluded_before_metadata():
 sql("insert into notification_installations(event_id,wonderpush_installation_id,capability_hash) select '11111111-1111-1111-1111-111111111111',lpad(i::text,40,'0'),lpad(i::text,64,'0') from generate_series(1,1000) i")
 def launch(i):return rpc(installation_id=str(i).zfill(40),capability_hash=str(i).zfill(64))
 with concurrent.futures.ThreadPoolExecutor(max_workers=25) as pool:results=list(pool.map(launch,range(1,1001)))
 assert all(r.get('outcome')=='NOT_PILOT' for r in results)
 assert sql('select count(*) from notification_reconciliation')[0][0]==0
 assert sql('select checks from notification_reconciliation_project')[0][0]==0


def test_real_database_backend_protocol_exact_failure(monkeypatch):
 from backend import subscription_reconciliation as core
 from tests.test_subscription_reconciliation import TOKEN,OLD,PREFS,CAP,ID,SECRET
 sql('update notification_installations set capability_hash=%s',(hashlib.sha256(CAP.encode()).hexdigest(),))
 class Client:
  async def request(self,method,path,**kw):
   assert method=='POST' and path=='/rpc/ipm_reconciliation'
   return sql('select ipm_reconciliation(%s::jsonb)',(json.dumps(kw['json']['p']),))[0][0]
 stored=dict(OLD);writes=[]
 def read(*_):return {'pushToken':dict(stored),'preferences':PREFS}
 def patch(target,credential,token):writes.append(1);stored.update(token)
 monkeypatch.setattr(core.provider,'read_installation',read);monkeypatch.setattr(core.provider,'patch_installation',patch)
 async def run():
  base=dict(subscription=TOKEN,installation_id=ID,permission='granted',local_subscribed=True,user_id=None)
  async def call(**kw):return await core.reconcile(client=Client(),event_slug='test',credential=SECRET,scope='staging',capability=CAP,payload={**base,**kw})
  result=await call(action='check');assert result['status']=='VERIFYING'
  assert (await call(action='confirm',generation=result['generation']))['status']=='VERIFIED'
  assert (await call(action='check'))['status']=='VERIFYING'
 asyncio.run(run());assert writes==[1];assert stored==TOKEN

def test_late_old_check_cannot_revert_a_new_generation():
 r=rpc();rpc('invalidate',fingerprint='d'*64,generation=1)
 sql("update notification_reconciliation set lease_until=now()-interval '1 second'")
 old=rpc(generation=1)
 assert old['status']=='CHECK_DUE' and old['generation']==2
 assert sql('select fingerprint from notification_reconciliation')[0][0]=='d'*64
 assert rpc('invalidate',fingerprint='c'*64,generation=1)['outcome']=='STALE_GENERATION'


def test_null_pilot_and_membership_read_are_no_write():
 sql('update notification_reconciliation_project set enabled=false,repair_enabled=false')
 assert rpc('eligibility')['pilot_eligible'] is True
 assert rpc()['outcome']=='DISABLED'
 assert sql('select count(*) from notification_reconciliation')[0][0]==0
 sql('update notification_reconciliation_project set pilot_registration_id=null,enabled=true,repair_enabled=true')
 assert rpc()['outcome']=='NOT_PILOT'
 assert rpc('eligibility')['pilot_eligible'] is False
 assert sql('select count(*) from notification_reconciliation')[0][0]==0


def test_pilot_change_fences_inflight_patch():
 claim=rpc()
 sql('update notification_reconciliation_project set pilot_registration_id=null')
 assert rpc('patch',**fence(claim))['outcome']=='NOT_PILOT'
 assert sql('select status from notification_reconciliation')[0][0]=='COMPARING'


def test_service_role_only_permissions():
 for role in ['anon','authenticated']:
  assert not sql("select has_function_privilege(%s,'public.ipm_reconciliation(jsonb)','EXECUTE')",(role,))[0][0]
  for table in ['notification_reconciliation','notification_reconciliation_project']:
   assert not sql("select has_table_privilege(%s,%s,'SELECT')",(role,'public.'+table))[0][0]
 assert sql("select has_function_privilege('service_role','public.ipm_reconciliation(jsonb)','EXECUTE')")[0][0]
 assert all(r[0] for r in sql("select relrowsecurity from pg_class where oid in ('public.notification_reconciliation'::regclass,'public.notification_reconciliation_project'::regclass)"))
