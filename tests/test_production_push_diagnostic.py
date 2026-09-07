import asyncio
import base64
import copy
import json
import logging
from urllib.parse import parse_qs,urlsplit
import httpx
import pytest
from fastapi import FastAPI
from backend import production_push_diagnostic as d
from backend import production_push_material as m

CAP='C'*43
TARGET='I'*40
SECRET='PRIVATE_CREDENTIAL_CANARY'
ENDPOINT='https://push.example/PRIVATE_ENDPOINT_CANARY'
def b64(b):return base64.urlsafe_b64encode(b).decode().rstrip('=')
TOKEN={'data':ENDPOINT,'p256dh':b64(b'\x04'+b'p'*64),'auth':b64(b'a'*16),'applicationServerKey':b64(b'\x04'+b'v'*64)}
BODY={'pushToken':TOKEN,'preferences':{'subscriptionStatus':'optIn','subscribedToNotifications':True,'osNotificationsVisible':True},'updateDate':'2026-09-07T20:15:00.000Z'}
def payload():
 challenge='ab'*32
 values={'endpoint':m.endpoint_bytes(TOKEN['data']),'p256dh':m.key_bytes(TOKEN['p256dh'],65),'auth':m.key_bytes(TOKEN['auth'],16),'application_server_key':m.key_bytes(TOKEN['applicationServerKey'],65)}
 return {'challenge':challenge,'digests':{k:m.field_digest(challenge,k,v) for k,v in values.items()}}
def run(body=None,targets=None,rows=None,p=None,cap=CAP):
 calls=[]
 def read(url,headers):
  calls.append((url,headers))
  if len(calls)==1:return rows if rows is not None else [{'wonderpush_installation_id':TARGET}]
  return BODY if body is None else body
 out=d.inspect(capability=cap,payload=payload() if p is None else p,database='https://db.example',database_key=SECRET,credential=SECRET,targets=[TARGET] if targets is None else targets,read=read)
 return out,calls

def test_exact_equality_and_privacy(caplog):
 caplog.set_level(logging.DEBUG)
 out,calls=run()
 assert out['browser_provider_match'] is True
 assert out['configured_test_target_matches_current_registration'] is True
 assert out['provider_opt_in'] is True and out['provider_has_push_token'] is True
 assert len(calls)==2
 text=json.dumps(out)+caplog.text
 for value in [CAP,TARGET,SECRET,ENDPOINT,*TOKEN.values(),payload()['challenge'],*payload()['digests'].values()]:assert value not in text
 assert set(out)==set(d.result())
 q=parse_qs(urlsplit(calls[1][0]).query)
 assert set(q['fields'][0].split(','))==set((*m.PROVIDER_FIELDS,'preferences.subscriptionStatus','preferences.subscribedToNotifications','preferences.osNotificationsVisible','updateDate'))
 assert 'events.slug=eq.ipm-2026' in calls[0][0]

@pytest.mark.parametrize('field',['data','p256dh','auth','applicationServerKey'])
def test_each_mismatch(field):
 body=copy.deepcopy(BODY)
 body['pushToken'][field]='https://push.example/other' if field=='data' else b64((b'\x04'+b'z'*64) if field!='auth' else b'z'*16)
 out,_=run(body)
 assert out['browser_provider_match'] is False
 name={'data':'endpoint','applicationServerKey':'application_server_key'}.get(field,field)
 assert out[name+'_match'] is False

def test_proven_three_field_mismatch():
 body=copy.deepcopy(BODY)
 body['pushToken'].update(data='https://push.example/old',p256dh=b64(b'\x04'+b'o'*64),auth=b64(b'o'*16))
 out,_=run(body)
 assert out['application_server_key_match'] is True
 assert all(out[k+'_match'] is False for k in ['endpoint','p256dh','auth'])

@pytest.mark.parametrize('targets',[[],['Z'*40],[TARGET,TARGET]])
def test_allowlist_fail_closed(targets):
 out,_=run(targets=targets)
 assert out['configured_test_target_matches_current_registration'] is False
 assert out['configured_test_target_count']==len(targets)

@pytest.mark.parametrize('rows',[[],[{},{}],[{'wonderpush_installation_id':'bad'}]])
def test_no_unique_identity_no_provider_read(rows):
 out,calls=run(rows=rows);assert len(calls)==1
 assert out['browser_provider_match']=='unverifiable'

@pytest.mark.parametrize('p',[{}, {'challenge':'x','digests':{}}, {'raw':SECRET}])
def test_invalid_input_no_reads(p):assert run(p=p)[1]==[]
def test_missing_capability_no_reads():assert run(cap='')[1]==[]

@pytest.mark.parametrize('field',list(TOKEN))
def test_malformed_provider_data(field):
 body=copy.deepcopy(BODY);body['pushToken'][field]='invalid'
 assert run(body)[0]['browser_provider_match']=='unverifiable'

def test_opt_out_and_os_hidden():
 body=copy.deepcopy(BODY);body['preferences'].update(subscriptionStatus='optOut',osNotificationsVisible=False)
 out,_=run(body);assert out['provider_opt_in'] is False and out['provider_os_notifications_visible'] is False

def test_exceptions_no_retries_or_disclosure(caplog):
 calls=[]
 def read(*a):calls.append(1);raise ValueError(SECRET+ENDPOINT)
 out=d.inspect(capability=CAP,payload=payload(),database='https://db',database_key=SECRET,credential=SECRET,targets=[TARGET],read=read)
 assert len(calls)==1 and out['diagnostic_status']=='REGISTRATION_READ_UNAVAILABLE'
 assert SECRET not in json.dumps(out)+caplog.text

def config():return dict(host='ipm-backend-eoiw.onrender.com',app='https://theipm.ca',database='https://hppboivlpqkfhhzfftuu.supabase.co',event='ipm-2026',database_key=SECRET,credential=SECRET,targets=[TARGET])
@pytest.mark.parametrize('field',['host','app','database','event'])
def test_nonproduction_gated(field):
 c=config();c[field]='staging'
 app=FastAPI();d.install_routes(app,lambda:c)
 async def check():
  async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='https://test') as client:
   r=await client.post('/production-diagnostics/push-target',json=payload(),headers={'Origin':'https://theipm.ca'})
   assert r.status_code==404
 asyncio.run(check())

def test_http_boundary_and_sensitive_request_not_echoed(monkeypatch,caplog):
 app=FastAPI();d.install_routes(app,config)
 calls=[]
 def inspect(**kwargs):calls.append(1);return d.result('COMPARED',1)
 monkeypatch.setattr(d,'inspect',inspect)
 async def check():
  async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='https://test') as client:
   r=await client.post('/production-diagnostics/push-target',json=payload(),headers={'Origin':'https://theipm.ca','X-Notification-Device-Capability':CAP})
   assert r.status_code==200 and r.headers['cache-control']=='no-store'
   assert CAP not in r.text+caplog.text
   r=await client.post('/production-diagnostics/push-target',content='x'*2049,headers={'Origin':'https://theipm.ca'})
   assert r.json()['diagnostic_status']=='INVALID_INPUT'
   r=await client.post('/production-diagnostics/push-target',json=payload(),headers={'Origin':'https://staging.theipm.ca'})
   assert r.status_code==403
 assert not calls
 asyncio.run(check());assert len(calls)==1

def test_transport_get_only_no_redirect_and_sanitized_failure(monkeypatch):
 calls=[]
 class Opener:
  def open(self,request,timeout):
   calls.append(request.get_method());raise RuntimeError(SECRET)
 monkeypatch.setattr(d,'build_opener',lambda *args:Opener())
 with pytest.raises(ValueError) as e:d.read_json('https://example',{})
 assert str(e.value)=='READ_UNAVAILABLE' and e.value.__suppress_context__
 assert calls==['GET']
 assert d.NoRedirect().redirect_request(None,None,302,'',{},'https://other') is None

def test_provider_failure_single_attempt_and_safe_trace(caplog):
    import traceback
    calls=[]
    def read(*args):
        calls.append(1)
        if len(calls)==1:return [{'wonderpush_installation_id':TARGET}]
        raise RuntimeError(SECRET+ENDPOINT)
    out=d.inspect(capability=CAP,payload=payload(),database='https://db',database_key=SECRET,credential=SECRET,targets=[TARGET],read=read)
    assert len(calls)==2 and out['diagnostic_status']=='PROVIDER_READ_UNAVAILABLE'
    assert out['browser_provider_match']=='unverifiable'
    assert SECRET not in json.dumps(out)+caplog.text


def test_transport_trace_does_not_disclose_sensitive_exception(monkeypatch):
    import traceback
    class Opener:
        def open(self,*args,**kwargs):raise RuntimeError(SECRET+ENDPOINT)
    monkeypatch.setattr(d,'build_opener',lambda *args:Opener())
    try:d.read_json('https://example',{})
    except ValueError as error:
        trace=''.join(traceback.format_exception(error))
        assert SECRET not in trace and ENDPOINT not in trace


def test_missing_provider_fields_cannot_partially_match():
    for field in TOKEN:
        body=copy.deepcopy(BODY);del body['pushToken'][field]
        out,_=run(body)
        assert out['browser_provider_match']=='unverifiable'
