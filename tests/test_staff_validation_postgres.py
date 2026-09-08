"""Controlled cohort behavior on a disposable, loopback-only PostgreSQL instance."""
import concurrent.futures
import hashlib
import json
import pytest
from tests.test_reconciliation_postgres import sql, rpc, fence, verified, DSN

pytestmark = pytest.mark.skipif(not DSN, reason='Requires isolated PostgreSQL')

@pytest.fixture(autouse=True)
def setup():
 assert '127.0.0.1:55439' in DSN
 sql('update notification_reconciliation_project set pilot_registration_id=null')
 sql('truncate notification_reconciliation,notification_installations,events cascade')
 sql('insert into notification_reconciliation_project(singleton) values(true) on conflict do nothing')
 sql("insert into events values('11111111-1111-1111-1111-111111111111','ipm-2026')")
 sql("insert into notification_installations(event_id,wonderpush_installation_id,capability_hash) values('11111111-1111-1111-1111-111111111111',%s,%s)",('b'*40,'a'*64))
 sql("update notification_reconciliation_project set enabled=true,repair_enabled=true,mode='POPULATION_REPAIR_STAGED',repair_cohort_percent=0,open_until=null,checks=0,failures=0,window_start=now()")

def call(action='claim', **kw): return rpc(action,event_slug='ipm-2026',**kw)
def reference(target='b'*40): return hashlib.sha256(target.encode()).hexdigest()[:10].upper()
def designate(**kw):
 return sql('select ipm_designate_staff_validation(%s::jsonb)', (json.dumps({'reference':reference(),'consent':True,**kw}),))[0][0]
def observe():
 r=call(); assert not r['repair_enabled']
 call('finish',**fence(r),status='MISMATCH',outcome='MISMATCH',provider_ready=True)
 return r

def test_requires_capability_owned_observation_and_no_browser_identity_selection():
 assert not designate()['designated']
 assert call(capability_hash='x'*64)['status']=='INELIGIBLE'
 assert call(installation_id='x'*40)['status']=='IDENTITY_UNRESOLVED'
 observe()
 for kw in [{'consent':False},{'registration_id':'private-canary'},{'installation_id':'private-canary'},{'reference':'bad'}]:
  assert not designate(**kw)['designated']
 assert designate()['designated']
 assert set(designate())=={'designated','expires_at'}

def test_staff_at_zero_percent_and_revocation_fences_patch():
 observe(); assert designate()['designated']
 sql('update notification_reconciliation set next_attempt_at=null')
 r=call(); assert r['repair_enabled']
 sql('update notification_reconciliation set validation_until=now()')
 assert call('patch',**fence(r))['status']=='OUTCOME_UNKNOWN'
 assert sql('select patch_attempts from notification_reconciliation')[0][0]==0

@pytest.mark.parametrize('change',[
 "update notification_reconciliation_project set mode='POPULATION_OBSERVE'",
 'update notification_reconciliation_project set repair_enabled=false',
 "update notification_reconciliation set validation_until=now()-interval '1 second'",
 "update notification_reconciliation set validation_capability_hash='different'",
 "update notification_reconciliation set validation_installation_hash='different'",
 'update notification_reconciliation set uncertain=true',
])
def test_every_staff_patch_rechecks_controls(change):
 observe(); assert designate()['designated']
 sql('update notification_reconciliation set next_attempt_at=null')
 r=call(); assert r['repair_enabled']
 sql(change)
 assert call('patch',**fence(r))['status']=='OUTCOME_UNKNOWN'

@pytest.mark.parametrize('change',[
 'update notification_reconciliation_project set repair_cohort_percent=1',
 'update notification_reconciliation_project set failures=1',
 "update notification_reconciliation_project set open_until=now()+interval '1 hour'",
 'update notification_reconciliation set uncertain=true',
 "update notification_reconciliation set observed_at=now()-interval '16 minutes'",
 "update notification_installations set capability_hash='new-owner'",
 "update notification_installations set wonderpush_installation_id='new-installation'",
 "update events set slug='staging'",
])
def test_designation_stop_conditions(change):
 observe(); sql(change); assert not designate()['designated']

def test_three_device_limit_serialized_and_random_not_selected():
 observe(); assert designate()['designated']
 for i in range(1,5):
  sql("insert into notification_installations(event_id,wonderpush_installation_id,capability_hash) values('11111111-1111-1111-1111-111111111111',%s,%s)",(str(i)*40,str(i)*64))
  r=call(installation_id=str(i)*40,capability_hash=str(i)*64)
  assert not r['repair_enabled']
  call('finish',installation_id=str(i)*40,capability_hash=str(i)*64,**fence(r),status='MISMATCH')
 def enroll(i):return designate(reference=reference(str(i)*40))['designated']
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  assert sum(pool.map(enroll,range(1,5)))==2
 assert sql('select count(*) from notification_reconciliation where validation_until>now()')[0][0]==3

def test_ambiguity_and_reference_privileges():
 observe()
 sql('insert into notification_installations(event_id,wonderpush_installation_id,capability_hash) select event_id,wonderpush_installation_id,capability_hash from notification_installations')
 assert not designate()['designated']
 assert call()['status']=='INELIGIBLE'
 for role in ['anon','authenticated']:
  for fn in ['ipm_designate_staff_validation','ipm_staff_validation_reference']:
   assert not sql('select has_function_privilege(%s,%s,%s)',(role,'public.'+fn+'(jsonb)','EXECUTE'))[0][0]
 assert sql('select ipm_staff_validation_reference(%s::jsonb)',(json.dumps({'event_slug':'ipm-2026','capability_hash':'a'*64}),))[0][0]=={}

@pytest.mark.parametrize('healthy', [True,False])
def test_real_backend_protocol_no_write_or_single_guarded_repair(monkeypatch, healthy):
 import asyncio
 from backend import subscription_reconciliation as core
 from tests.test_subscription_reconciliation import TOKEN,OLD,PREFS,CAP,ID,SECRET
 sql('update notification_installations set capability_hash=%s',(hashlib.sha256(CAP.encode()).hexdigest(),))
 class Client:
  async def request(self,method,path,**kw):
   assert method=='POST' and path=='/rpc/ipm_reconciliation'
   return sql('select ipm_reconciliation(%s::jsonb)',(json.dumps(kw['json']['p']),))[0][0]
 stored=dict(TOKEN if healthy else OLD); writes=[]
 def read(*_):return {'pushToken':dict(stored),'preferences':PREFS}
 def patch(target,credential,token):assert target==ID; writes.append(1);stored.update(token)
 monkeypatch.setattr(core.provider,'read_installation',read);monkeypatch.setattr(core.provider,'patch_installation',patch)
 async def run():
  base=dict(subscription=TOKEN,installation_id=ID,permission='granted',local_subscribed=True,user_id=None)
  async def execute(**kw):return await core.reconcile(client=Client(),event_slug='ipm-2026',credential=SECRET,scope='test',capability=CAP,payload={**base,**kw})
  first=await execute(action='check')
  if healthy:
   assert first['status']=='VERIFYING'
   assert (await execute(action='confirm',generation=first['generation']))['status']=='VERIFIED'
  else: assert first['status']=='MISMATCH'
  assert designate()['designated']
  # Test time passage; operator enrollment never clears cooldown or freshness.
  sql("update notification_reconciliation set next_attempt_at=null,verification_expires_at=now()-interval '1 second'")
  result=await execute(action='check');assert result['status']=='VERIFYING'
  assert (await execute(action='confirm',generation=result['generation']))['status']=='VERIFIED'
 asyncio.run(run())
 assert writes==([] if healthy else [1]); assert stored==TOKEN
 assert sql('select patch_attempts from notification_reconciliation')[0][0]==int(not healthy)

def test_missing_control_row_fails_closed():
 observe();sql('delete from notification_reconciliation_project')
 assert not designate()['designated']
 assert call()['status']=='DEFERRED'

def test_staff_claim_deduplicates_and_circuit_fences_patch():
 observe();assert designate()['designated']
 sql('update notification_reconciliation set next_attempt_at=null')
 with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
  results=list(pool.map(lambda _:call(),range(24)))
 claims=[r for r in results if r['status']=='COMPARING']
 assert len(claims)==1 and claims[0]['repair_enabled']
 sql("update notification_reconciliation_project set open_until=now()+interval '1 hour'")
 assert call('patch',**fence(claims[0]))['status']=='OUTCOME_UNKNOWN'

def test_staff_membership_never_crosses_rebound_installation():
 observe();assert designate()['designated']
 sql("update notification_installations set wonderpush_installation_id=%s",('z'*40,))
 sql('update notification_reconciliation set next_attempt_at=null')
 assert call()['status']=='IDENTITY_UNRESOLVED'
 assert call(installation_id='z'*40)['repair_enabled'] is False

def test_staff_key_mismatch_never_patches(monkeypatch):
 import asyncio
 from backend import subscription_reconciliation as core
 from tests.test_subscription_reconciliation import TOKEN,PREFS,CAP,ID,SECRET
 owner=hashlib.sha256(CAP.encode()).hexdigest()
 sql('update notification_installations set capability_hash=%s',(owner,))
 r=call(capability_hash=owner);call('finish',capability_hash=owner,**fence(r),status='INELIGIBLE',outcome='KEY_MISMATCH')
 assert designate()['designated']
 sql('update notification_reconciliation set next_attempt_at=null')
 stored=dict(TOKEN)
 import base64
 stored['applicationServerKey']=base64.urlsafe_b64encode(b'\x04'+b'\x09'*64).decode().rstrip('=')
 class Client:
  async def request(self,method,path,**kw):return sql('select ipm_reconciliation(%s::jsonb)',(json.dumps(kw['json']['p']),))[0][0]
 monkeypatch.setattr(core.provider,'read_installation',lambda *_:{'pushToken':stored,'preferences':PREFS})
 def forbidden(*_):pytest.fail('KEY_MISMATCH patched')
 monkeypatch.setattr(core.provider,'patch_installation',forbidden)
 result=asyncio.run(core.reconcile(client=Client(),event_slug='ipm-2026',credential=SECRET,scope='test',capability=CAP,
  payload=dict(action='check',subscription=TOKEN,installation_id=ID,permission='granted',local_subscribed=True,user_id=None)))
 assert result['status']=='INELIGIBLE' and result['outcome']=='KEY_MISMATCH'
 assert sql('select patch_attempts from notification_reconciliation')[0][0]==0
