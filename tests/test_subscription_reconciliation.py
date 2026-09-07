import asyncio
import base64
import copy
import json
from types import SimpleNamespace
from unittest.mock import Mock
import pytest
from backend import subscription_reconciliation as core
from backend import subscription_provider as transport

CAP='a'*43
ID='b'*40
SECRET='TEST-PRIVATE-CREDENTIAL'
ENC=lambda v:base64.urlsafe_b64encode(v).decode().rstrip('=')
TOKEN={'data':'https://push.example.invalid/CANARY-ENDPOINT','p256dh':ENC(b'\x04'+b'a'*64),'auth':ENC(b'a'*16),'applicationServerKey':ENC(b'\x04'+b'b'*64)}
OLD={**TOKEN,'data':'https://push.example.invalid/OLD','p256dh':ENC(b'\x04'+b'z'*64),'auth':ENC(b'z'*16)}
PREFS={'subscriptionStatus':'optIn','subscribedToNotifications':True,'osNotificationsVisible':True}

def body(token=TOKEN):return {'pushToken':token,'preferences':PREFS}
def payload(**kw):return dict(action='check',subscription=TOKEN,installation_id=ID,permission='granted',local_subscribed=True,user_id=None,**kw)

class RPC:
 def __init__(self,claim=None):
  self.calls=[];self.claim=claim or {'status':'COMPARING','generation':1,'operation_id':'private-operation','target':ID,'repair_enabled':True,'uncertain':False}
 async def request(self,method,path,**kw):
  assert method=='POST' and path=='/rpc/ipm_reconciliation'
  p=kw['json']['p'];self.calls.append(p)
  if p['action']=='claim':return copy.deepcopy(self.claim)
  if p['action']=='patch':return {'status':'PATCH_PENDING'}
  return {'status':p.get('status','VERIFIED'),'generation':p['generation']}

def run(db=None,data=None,cap=CAP):
 return asyncio.run(core.reconcile(client=db or RPC(),event_slug='test',credential=SECRET,scope='staging',capability=cap,payload=data or payload()))

def test_exact_proven_case_and_private_output(monkeypatch,caplog):
 read=Mock(side_effect=[body(OLD),body()]);patch=Mock()
 monkeypatch.setattr(core.provider,'read_installation',read);monkeypatch.setattr(core.provider,'patch_installation',patch)
 db=RPC();result=run(db)
 assert result['status']=='VERIFYING' # Browser confirmation is mandatory, not inferred.
 patch.assert_called_once_with(ID,SECRET,TOKEN)
 assert [p['action'] for p in db.calls]==['claim','patch','finish']
 assert run(db,{**payload(),'action':'confirm','generation':1})['status']=='VERIFIED'
 for v in [CAP,ID,SECRET,*TOKEN.values(),'private-operation']:
  assert v not in json.dumps(result)+caplog.text

@pytest.mark.parametrize('changed',['data','p256dh','auth'])
def test_single_field_mismatch_recovers(changed,monkeypatch):
 token={**TOKEN,changed:OLD[changed]}
 monkeypatch.setattr(core.provider,'read_installation',Mock(side_effect=[body(token),body()]))
 patch=Mock();monkeypatch.setattr(core.provider,'patch_installation',patch)
 assert run()['status']=='VERIFYING';assert patch.call_count==1

@pytest.mark.parametrize('fresh',[True,False])
def test_healthy_zero_writes_fresh_zero_reads(fresh,monkeypatch):
 read=Mock(return_value=body());patch=Mock()
 monkeypatch.setattr(core.provider,'read_installation',read);monkeypatch.setattr(core.provider,'patch_installation',patch)
 db=RPC({'status':'VERIFIED','generation':1}) if fresh else RPC()
 assert run(db)['status']==('VERIFIED' if fresh else 'VERIFYING')
 assert read.call_count==(0 if fresh else 1);patch.assert_not_called()

def test_sdk_settled_before_provider_check_needs_no_fallback(monkeypatch):
 monkeypatch.setattr(core.provider,'read_installation',Mock(return_value=body()))
 patch=Mock();monkeypatch.setattr(core.provider,'patch_installation',patch)
 assert run()['status']=='VERIFYING';patch.assert_not_called()

@pytest.mark.parametrize('token', [{}, {**TOKEN,'auth':'invalid'}, {**OLD,'applicationServerKey':OLD['p256dh']}])
def test_bad_provider_or_application_key_never_patched(token,monkeypatch):
 monkeypatch.setattr(core.provider,'read_installation',Mock(return_value=body(token)))
 patch=Mock();monkeypatch.setattr(core.provider,'patch_installation',patch)
 assert run()['status'] in ('DEFERRED','INELIGIBLE');patch.assert_not_called()

@pytest.mark.parametrize('override',[{'permission':'denied'},{'local_subscribed':False},{'subscription':{}},{'installation_id':'bad'},{'user_id':'another-user'}])
def test_ineligible_input_never_contacts_provider(override,monkeypatch):
 read=Mock();monkeypatch.setattr(core.provider,'read_installation',read)
 assert run(data={**payload(),**override})['status'] in ('INELIGIBLE','IDENTITY_UNRESOLVED','DEFERRED')
 read.assert_not_called()

def test_no_capability(monkeypatch):
 db=RPC();assert run(db,cap='')['status']=='IDENTITY_UNRESOLVED';assert not db.calls

def test_provider_optout_never_patched(monkeypatch):
 monkeypatch.setattr(core.provider,'read_installation',Mock(return_value={'pushToken':OLD,'preferences':{**PREFS,'subscriptionStatus':'optOut'}}))
 patch=Mock();monkeypatch.setattr(core.provider,'patch_installation',patch)
 assert run()['status']=='INELIGIBLE';patch.assert_not_called()

@pytest.mark.parametrize('applied',[True,False])
def test_patch_response_lost_read_before_any_retry(applied,monkeypatch):
 monkeypatch.setattr(core.provider,'read_installation',Mock(side_effect=[body(OLD),body(TOKEN if applied else OLD)]))
 patch=Mock(side_effect=transport.ProviderFailure('NETWORK'));monkeypatch.setattr(core.provider,'patch_installation',patch)
 assert run()['status']==('VERIFYING' if applied else 'OUTCOME_UNKNOWN');assert patch.call_count==1

def test_readback_failure_retains_unknown(monkeypatch):
 monkeypatch.setattr(core.provider,'read_installation',Mock(side_effect=[body(OLD),transport.ProviderFailure('PROVIDER')]))
 monkeypatch.setattr(core.provider,'patch_installation',Mock())
 assert run()['status']=='OUTCOME_UNKNOWN'

def test_restart_with_uncertain_write_reads_only(monkeypatch):
 db=RPC();db.claim['uncertain']=True
 monkeypatch.setattr(core.provider,'read_installation',Mock(return_value=body(OLD)))
 patch=Mock();monkeypatch.setattr(core.provider,'patch_installation',patch)
 assert run(db)['status']=='OUTCOME_UNKNOWN';patch.assert_not_called()

@pytest.mark.parametrize('failure',['AUTH','BILLING','POLICY','RATE_LIMIT','NETWORK','PROVIDER'])
def test_outage_classification_and_retry_after(failure,monkeypatch):
 monkeypatch.setattr(core.provider,'read_installation',Mock(side_effect=transport.ProviderFailure(failure,900)))
 db=RPC();assert run(db)['status']=='DEFERRED'
 assert db.calls[-1]['outcome']==failure and db.calls[-1]['retry_after']==900

def test_stale_generation_fence_stops_patch(monkeypatch):
 db=RPC();original=db.request
 async def request(method,path,**kw):
  if kw['json']['p']['action']=='patch':return {'status':'CHECK_DUE','outcome':'STALE_GENERATION'}
  return await original(method,path,**kw)
 db.request=request
 monkeypatch.setattr(core.provider,'read_installation',Mock(return_value=body(OLD)))
 patch=Mock();monkeypatch.setattr(core.provider,'patch_installation',patch)
 assert run(db)['status']=='CHECK_DUE';patch.assert_not_called()

def test_hmac_scoped_and_canonical():
 a=core.fingerprint(TOKEN,SECRET,'staging',CAP)
 assert a!=core.fingerprint(TOKEN,SECRET,'production',CAP)
 assert a!=core.fingerprint(TOKEN,SECRET,'staging','different')
 assert core.canonical_token({**TOKEN,'auth':TOKEN['auth']+'=='})==TOKEN

def test_exception_canaries_never_escape(monkeypatch,caplog):
 monkeypatch.setattr(core.provider,'read_installation',Mock(side_effect=Exception(json.dumps(TOKEN)+SECRET)))
 output=run()
 assert output['status']=='DEFERRED'
 assert SECRET not in caplog.text+json.dumps(output)

def test_retry_after_and_patch_shape():
 assert transport.retry_seconds('120')==120
 assert transport.retry_seconds('bad')==0
 req=transport.patch_request(ID,SECRET,TOKEN)
 assert req.method=='PATCH' and '?' not in req.full_url
 assert json.loads(req.data)=={'accessToken':SECRET,'userId':'','body':{'pushToken':TOKEN}}

@pytest.mark.parametrize('staging',[True,False])
def test_real_api_environment_gate_origin_and_private_validation(staging):
 import os,subprocess,sys
 from backend.staging_provider_diagnostic import STAGING_HOST,STAGING_APP,STAGING_DATABASE
 env={**os.environ,'CONTENT_SOURCE':'google_sheets','MONGO_URL':'','MONGODB_URL':'',
      'RENDER_EXTERNAL_HOSTNAME':STAGING_HOST if staging else 'production.onrender.com',
      'PUBLIC_APP_URL':STAGING_APP if staging else 'https://theipm.ca','SUPABASE_URL':STAGING_DATABASE}
 script='''
import asyncio,httpx,json
from backend import server
async def run():
 async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app),base_url='https://staging.theipm.ca') as c:
  path='/api/notification-registrations/reconcile'
  bad=await c.post(path,json={'secret':'PRIVATE-CANARY'})
  good=await c.post(path,headers={'Origin':'https://staging.theipm.ca'},json={'secret':'PRIVATE-CANARY'})
  huge=await c.post(path,headers={'Origin':'https://staging.theipm.ca'},content='PRIVATE-CANARY'*2000)
  health=await c.get('/api/notification-registrations/reconciliation-health')
  print(json.dumps([bad.status_code,good.status_code,good.json(),huge.status_code,health.status_code]))
asyncio.run(run())
'''
 result=__import__('subprocess').run([sys.executable,'-c',script],env=env,capture_output=True,text=True,check=True)
 output=json.loads(result.stdout)
 assert output[0]==404 and output[1]==(200 if staging else 404)
 assert output[4]==(200 if staging else 404)
 assert 'PRIVATE-CANARY' not in result.stdout+result.stderr


def test_transport_http_error_sanitization_and_no_redirect_retry(monkeypatch,caplog):
 from urllib.error import HTTPError
 opening=Mock(side_effect=HTTPError('https://private.invalid/'+SECRET,402,SECRET,{'Retry-After':'120'},None))
 monkeypatch.setattr(transport,'build_opener',lambda _:SimpleNamespace(open=opening))
 with pytest.raises(transport.ProviderFailure) as error:transport.read_installation(ID,SECRET)
 assert str(error.value)=='BILLING' and error.value.retry_after==120
 assert opening.call_count==1
 import traceback
 assert SECRET not in caplog.text+str(error.value)+''.join(traceback.format_exception(error.value))

def test_definitive_rejection_requires_unchanged_readback_before_future_retry(monkeypatch):
 monkeypatch.setattr(core.provider,'read_installation',Mock(side_effect=[body(OLD),body(OLD)]))
 patch=Mock(side_effect=transport.ProviderFailure('RATE_LIMIT',120,not_applied=True))
 monkeypatch.setattr(core.provider,'patch_installation',patch)
 db=RPC();assert run(db)['status']=='DEFERRED'
 assert db.calls[-1]['clear_uncertain'] is True and db.calls[-1]['retry_after']==120
 assert patch.call_count==1

def test_temporary_manual_mutation_cannot_bypass_durable_coordinator():
 from pathlib import Path
 source=Path('backend/server.py').read_text()
 manual=source[source.index('async def staging_subscription_reconciliation('):source.index('@api_router.get("/notification-registrations/reconciliation-health"')]
 assert manual.index('PERMANENT_RECONCILIATION_ACTIVE')<manual.index('await repair_current(')
 assert 'flags[0].get("enabled") and flags[0].get("repair_enabled")' in manual
