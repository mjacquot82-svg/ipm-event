"""100% eligibility acceptance for the deployed backend plus freshness/circuit migration.
Provider transport is a deterministic fake; no external provider is contacted.
"""
import asyncio
import copy
import hashlib
import json
import os
import concurrent.futures
import pytest
import psycopg
from backend import subscription_reconciliation as core
from tests.test_subscription_reconciliation import TOKEN, OLD, PREFS, CAP, ID, SECRET, ENC

DSN=os.environ.get('IPM_RECONCILIATION_TEST_DSN')
pytestmark=pytest.mark.skipif(not DSN,reason='Requires isolated PostgreSQL test database')

def sql(query,args=None):
 with psycopg.connect(DSN,autocommit=True) as c:
  cur=c.execute(query,args)
  return cur.fetchall() if cur.description else []

@pytest.fixture(autouse=True)
def reset():
 assert '127.0.0.1:55439/ipm_freshness_fix' in DSN
 sql('update notification_reconciliation_project set pilot_registration_id=null')
 sql('truncate notification_reconciliation,notification_installations,events cascade')
 sql("insert into events values('11111111-1111-1111-1111-111111111111','ipm-2026')")
 sql("insert into notification_installations(event_id,wonderpush_installation_id,capability_hash) values('11111111-1111-1111-1111-111111111111',%s,%s)",(ID,hashlib.sha256(CAP.encode()).hexdigest()))
 sql("insert into notification_reconciliation_project(singleton,mode,enabled,repair_enabled,repair_cohort_percent) values(true,'POPULATION_REPAIR_STAGED',true,true,100)")

class Client:
 def __init__(self):self.actions=[]
 async def request(self,method,path,**kw):
  assert method=='POST' and path=='/rpc/ipm_reconciliation'
  p=kw['json']['p'];self.actions.append(p['action'])
  return sql('select ipm_reconciliation(%s::jsonb)',(json.dumps(p),))[0][0]

def raw(action='claim',**kw):
 p=dict(action=action,event_slug='ipm-2026',capability_hash=hashlib.sha256(CAP.encode()).hexdigest(),installation_id=ID,fingerprint='c'*64,generation=1)
 p.update(kw)
 return sql('select ipm_reconciliation(%s::jsonb)',(json.dumps(p),))[0][0]

def fence(r):return dict(generation=r['generation'],operation_id=r['operation_id'])

@pytest.fixture
def provider(monkeypatch):
 state={'token':copy.deepcopy(TOKEN),'preferences':dict(PREFS),'reads':0,'patches':0}
 def read(target,credential):
  assert target==ID and credential==SECRET
  state['reads']+=1
  if state.get('before_read'):state['before_read']()
  return {'pushToken':copy.deepcopy(state['token']),'preferences':dict(state['preferences'])}
 def patch(target,credential,token):
  assert target==ID and credential==SECRET
  state['patches']+=1;state['token']=copy.deepcopy(token)
 monkeypatch.setattr(core.provider,'read_installation',read)
 monkeypatch.setattr(core.provider,'patch_installation',patch)
 return state

def request(client=None,capability=CAP,event='ipm-2026',**override):
 payload=dict(action='check',subscription=copy.deepcopy(TOKEN),installation_id=ID,permission='granted',local_subscribed=True,user_id=None)
 payload.update(override)
 return asyncio.run(core.reconcile(client=client or Client(),event_slug=event,credential=SECRET,scope='audit',capability=capability,payload=payload))

def confirm(r):return request(action='confirm',generation=r['generation'])

def test_A_healthy_fresh_lifecycle_no_patch(provider):
 r=request();assert r['status']=='VERIFYING'
 assert provider['reads']==1 and provider['patches']==0
 assert confirm(r)['status']=='VERIFIED'

@pytest.mark.parametrize('field',['all','data','p256dh','auth'])
def test_B_safe_fresh_mismatch_repairs_same_installation_and_verifies_four_fields(provider,field):
 provider['token']=copy.deepcopy(OLD if field=='all' else {**TOKEN,field:OLD[field]})
 initial=sql('select id,wonderpush_installation_id,capability_hash from notification_installations')
 r=request();assert r['status']=='VERIFYING'
 assert provider['reads']==2 and provider['patches']==1 and provider['token']==TOKEN
 assert confirm(r)['status']=='VERIFIED'
 assert sql('select id,wonderpush_installation_id,capability_hash from notification_installations')==initial


def test_C_key_mismatch_excluded(provider):
 provider['token']={**OLD,'applicationServerKey':ENC(b'\x04'+b'x'*64)}
 r=request();assert r['status']=='INELIGIBLE' and r['outcome']=='KEY_MISMATCH'
 assert provider['patches']==0


def test_D_stale_historical_mismatch_cannot_patch_without_new_claim(provider):
 r=raw();raw('finish',**fence(r),status='MISMATCH',outcome='MISMATCH',provider_ready=True)
 assert raw('patch',**fence(r))['status']=='OUTCOME_UNKNOWN'
 assert raw('patch')['status']=='OUTCOME_UNKNOWN'
 assert provider['reads']==provider['patches']==0

@pytest.mark.parametrize('change',[{'capability':'z'*43},{'installation_id':'z'*40},{'event':'another-event'},{'user_id':'ambiguous'},{'registration_id':'browser-selected'}])
def test_E_wrong_owner_identity_event_or_browser_selection_denied(provider,change):
 r=request(**change)
 assert r['status'] in ('INELIGIBLE','IDENTITY_UNRESOLVED')
 assert provider['reads']==provider['patches']==0
 assert sql('select count(*) from notification_reconciliation')[0][0]==0


def test_F_percentage_change_does_not_schedule_or_touch_offline_rows(provider):
 sql("insert into notification_installations(event_id,wonderpush_installation_id,capability_hash) select '11111111-1111-1111-1111-111111111111',lpad(i::text,40,'0'),lpad(i::text,64,'0') from generate_series(1,127)i")
 before=sql('select to_jsonb(i) from notification_installations i order by id')
 sql('update notification_reconciliation_project set repair_cohort_percent=3')
 sql('update notification_reconciliation_project set repair_cohort_percent=100')
 assert sql('select count(*) from notification_reconciliation')[0][0]==0
 assert sql('select to_jsonb(i) from notification_installations i order by id')==before
 assert provider['reads']==provider['patches']==0


def test_G_uncertain_mismatch_read_only_no_replay(provider):
 provider['token']=copy.deepcopy(OLD)
 r=raw();raw('patch',**fence(r))
 sql("update notification_reconciliation set lease_until=now()-interval '1 second'")
 result=request(generation=1)
 if result['status']=='CHECK_DUE':result=request(generation=result['generation'])
 assert result['status']=='OUTCOME_UNKNOWN' and result['outcome']=='UNCERTAIN'
 assert provider['patches']==0 and provider['reads']==1

@pytest.mark.parametrize('outcome',['AUTH','BILLING','POLICY','PROVIDER','NETWORK'])
def test_H_provider_read_failure_never_patches(provider,monkeypatch,outcome):
 def fail(*_):raise core.provider.ProviderFailure(outcome)
 monkeypatch.setattr(core.provider,'read_installation',fail)
 r=request();assert r['status']=='DEFERRED' and r['outcome']==outcome
 assert provider['patches']==0
 assert sql('select failures from notification_reconciliation_project')[0][0]==1


def test_H_circuit_already_open_denies_claim(provider):
 sql("update notification_reconciliation_project set open_until=now()+interval '1 hour'")
 assert request()['outcome']=='CIRCUIT_OPEN'
 assert provider['reads']==provider['patches']==0

@pytest.mark.parametrize('override',[{'permission':'denied'},{'local_subscribed':False},{'subscription':None},{'subscription':{}}])
def test_browser_permission_and_subscription_mandatory(provider,override):
 assert request(**override)['status']=='INELIGIBLE'
 assert provider['reads']==provider['patches']==0

@pytest.mark.parametrize('change',[{'subscriptionStatus':'optOut'},{'subscribedToNotifications':False},{'osNotificationsVisible':False},{'osNotificationsVisible':None}])
def test_provider_permission_visibility_and_readiness_mandatory(provider,change):
 provider['preferences'].update(change)
 assert request()['status'] in ('INELIGIBLE','DEFERRED')
 assert provider['patches']==0


def test_missing_provider_token_never_patches(provider):
 provider['token']={};assert request()['outcome']=='DATA';assert provider['patches']==0


def test_concurrent_instances_only_one_claim():
 with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
  results=list(pool.map(lambda _:raw(),range(32)))
 assert sum(r['status']=='COMPARING' for r in results)==1
 assert all(r['status'] in ('COMPARING','DEFERRED') for r in results)


def test_generation_and_lease_fences():
 r=raw();raw('invalidate',fingerprint='d'*64)
 assert raw('patch',**fence(r))['outcome']=='STALE_GENERATION'

@pytest.mark.parametrize('kind',['project','registration'])
def test_rate_limits_prevent_provider_work(provider,kind):
 if kind=='project':sql('update notification_reconciliation_project set checks=120')
 else:
  r=raw();raw('finish',**fence(r),status='MISMATCH')
  sql('update notification_reconciliation set checks=4,next_attempt_at=null')
 assert request()['outcome']=='RATE_LIMIT'
 assert provider['reads']==provider['patches']==0


def test_lost_patch_response_readback_then_no_replay(provider,monkeypatch):
 provider['token']=copy.deepcopy(OLD)
 def timeout(*_):provider['patches']+=1;raise core.provider.ProviderFailure('NETWORK')
 monkeypatch.setattr(core.provider,'patch_installation',timeout)
 r=request();assert r['status']=='OUTCOME_UNKNOWN'
 assert provider['reads']==2 and provider['patches']==1
 sql("update notification_reconciliation set next_attempt_at=now()-interval '1 second'")
 r=request();assert r['status']=='OUTCOME_UNKNOWN'
 assert provider['reads']==3 and provider['patches']==1

# Acceptance assertions: these must pass to certify the requested architecture.
def test_requirement_fresh_provider_comparison_on_every_lifecycle(provider):
 assert confirm(request())['status']=='VERIFIED'
 provider['token']=copy.deepcopy(OLD)  # Provider drifts; browser evidence stays equal.
 before=provider['reads'];result=request()
 assert provider['reads']==before+2 and provider['patches']==1
 assert confirm(result)['status']=='VERIFIED' and provider['token']==TOKEN


def test_requirement_circuit_opening_between_claim_and_patch_denies_patch(provider):
 provider['token']=copy.deepcopy(OLD)
 def circuit_opens():
  # Independent request fails while this request is awaiting its provider read.
  sql("update notification_reconciliation_project set failures=1,open_until=now()+interval '1 hour'")
 provider['before_read']=circuit_opens
 result=request()
 assert result['status']=='DEFERRED' and result['outcome']=='CIRCUIT_OPEN'
 assert provider['patches']==0
 assert sql('select uncertain,operation_id,lease_until,failures from notification_reconciliation')==[(False,None,None,0)]
 assert sql('select failures from notification_reconciliation_project')==[(1,)]


def test_K_cached_healthy_is_compared_again_without_patch(provider):
 first=confirm(request());assert first['status']=='VERIFIED'
 second=request();assert second['status']=='VERIFYING'
 assert provider['reads']==2 and provider['patches']==0
 assert confirm(second)['status']=='VERIFIED'


def test_L_repeated_healthy_lifecycles_are_bounded(provider):
 for _ in range(4):assert confirm(request())['status']=='VERIFIED'
 for _ in range(20):assert request()['outcome']=='RATE_LIMIT'
 assert provider['reads']==4 and provider['patches']==0
 assert sql('select checks from notification_reconciliation_project')==[(4,)]


def test_circuit_lock_serializes_opening_before_patch_authorization():
 import threading
 import time
 claim=raw();started=threading.Event();worker_pid=[]
 def patch():
  with psycopg.connect(DSN,autocommit=True) as connection:
   worker_pid.append(connection.info.backend_pid);started.set()
   p=dict(action='patch',event_slug='ipm-2026',capability_hash=hashlib.sha256(CAP.encode()).hexdigest(),installation_id=ID,fingerprint='c'*64,**fence(claim))
   return connection.execute('select ipm_reconciliation(%s::jsonb)',(json.dumps(p),)).fetchone()[0]
 with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
  with psycopg.connect(DSN) as opener:
   opener.execute("update notification_reconciliation_project set open_until=now()+interval '1 hour',failures=5")
   pending=pool.submit(patch);assert started.wait(5)
   deadline=time.monotonic()+5
   while time.monotonic()<deadline:
    if sql('select wait_event_type from pg_stat_activity where pid=%s',(worker_pid[0],))==[('Lock',)]:break
    time.sleep(.01)
   else:raise AssertionError('PATCH did not wait on project circuit lock')
   assert not pending.done()
  result=pending.result(timeout=5)
 assert result['status']=='DEFERRED' and result['outcome']=='CIRCUIT_OPEN'
 assert sql('select status,uncertain,operation_id,lease_until from notification_reconciliation')==[('DEFERRED',False,None,None)]
 assert sql('select failures from notification_reconciliation_project')==[(5,)]


@pytest.mark.parametrize('change',[
 'repair_enabled=false', 'enabled=false', 'repair_cohort_percent=0',
])
def test_changed_configuration_still_fences_claimed_patch(change):
 claim=raw();sql('update notification_reconciliation_project set '+change)
 assert raw('patch',**fence(claim))['status']!='PATCH_PENDING'
 assert sql('select uncertain from notification_reconciliation')==[(False,)]


def test_migration_preserves_configuration_and_registration_metadata():
 from pathlib import Path
 claim=raw();raw('finish',**fence(claim),status='MISMATCH',outcome='MISMATCH')
 sql('update notification_reconciliation_project set repair_cohort_percent=3')
 tables=['notification_reconciliation_project','notification_reconciliation','notification_installations']
 before=[sql('select to_jsonb(t) from '+table+' t') for table in tables]
 sql((Path(__file__).parents[1]/'supabase/migrations/20260908155153_reconciliation_freshness_circuit_fences.sql').read_text())
 assert before==[sql('select to_jsonb(t) from '+table+' t') for table in tables]


@pytest.mark.parametrize('open_circuit',[False,True])
def test_new_paths_keep_private_material_out_of_results_and_logs(provider,caplog,open_circuit):
 assert confirm(request())['status']=='VERIFIED'
 provider['token']=copy.deepcopy(OLD)
 if open_circuit:
  provider['before_read']=lambda:sql("update notification_reconciliation_project set open_until=now()+interval '1 hour'")
 result=request()
 private=[CAP,ID,SECRET,hashlib.sha256(CAP.encode()).hexdigest(),*TOKEN.values(),*OLD.values()]
 private+=list(sql('select registration_id::text,fingerprint,operation_id::text from notification_reconciliation')[0])
 serialized=json.dumps(result)+caplog.text
 assert set(result)<= {'status','generation','outcome','next_attempt_at','subscription_verified_at','verification_expires_at'}
 assert all(value not in serialized for value in private if value)


def test_circuit_denial_requires_fresh_read_after_cooldown(provider):
 provider['token']=copy.deepcopy(OLD)
 provider['before_read']=lambda:sql("update notification_reconciliation_project set open_until=now()+interval '1 hour'")
 assert request()['outcome']=='CIRCUIT_OPEN'
 assert provider['patches']==0 and provider['reads']==1
 provider.pop('before_read')
 sql("update notification_reconciliation_project set open_until=now()-interval '1 second'")
 sql("update notification_reconciliation set next_attempt_at=now()-interval '1 second'")
 assert confirm(request())['status']=='VERIFIED'
 assert provider['patches']==1 and provider['reads']==3


def test_expired_lease_cannot_authorize_patch():
 claim=raw()
 sql("update notification_reconciliation set lease_until=now()-interval '1 second'")
 assert raw('patch',**fence(claim))['outcome']=='LEASE_LOST'
 assert sql('select uncertain from notification_reconciliation')==[(False,)]
