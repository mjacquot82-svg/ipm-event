import hashlib,json
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from unittest.mock import Mock
import pytest
from tests.test_production_reconciliation import config,request,CAP,PRIVATE
from tests.test_pilot_binding import INV
from backend import production_binding_diagnostic as d
NOW=datetime(2026,9,7,tzinfo=timezone.utc)

def project(**kw):
 return dict(enabled=False,repair_enabled=False,pilot_registration_id=None,pilot_bound_at=None,binding_invitation_hash=hashlib.sha256(INV.encode()).hexdigest(),binding_expires_at='2026-09-08T00:00:00Z',**kw)
class Reader:
 def __init__(self):
  self.project=project();self.regs=[{'wonderpush_installation_id':'a'*40}];self.metadata=[];self.calls=[];self.changed=False
 def __call__(self,url,headers):
  self.calls.append(url);p=urlparse(url);query=parse_qs(p.query)
  assert '/rpc/' not in p.path and p.scheme=='https'
  if p.path.endswith('/notification_reconciliation_project'):
   if self.changed and len(self.calls)>1:return [{**self.project,'pilot_bound_at':'2026-09-07T00:00:00Z'}]
   return [self.project]
  if p.path.endswith('/notification_reconciliation'):return self.metadata
  assert p.path.endswith('/notification_installations')
  assert query['events.slug']==['eq.ipm-2026']
  assert query['capability_hash']==['eq.'+hashlib.sha256(CAP.encode()).hexdigest()]
  return self.regs

def run(r=None,**kw):
 c=config(None);c['database_key']='PRIVATE-DATABASE-KEY-CANARY'
 return d.inspect(c,kw.get('capability',CAP),kw.get('invitation',INV),read=r or Reader(),now=NOW)

def test_healthy_probe_no_write_and_canaries(caplog):
 r=Reader();out=run(r)
 assert out['diagnostic_status']=='CURRENT_GATES_PASS'
 assert out['owned_registration_count']==out['eligible_registration_count']==1
 assert out['observation_off'] and out['repair_off'] and out['snapshot_consistent']
 assert len(r.calls)==4
 for value in [CAP,INV,'a'*40,hashlib.sha256(CAP.encode()).hexdigest(),hashlib.sha256(INV.encode()).hexdigest(),'PRIVATE-DATABASE-KEY-CANARY']:
  assert value not in json.dumps(out)+caplog.text

@pytest.mark.parametrize('field,value,gate',[('enabled',True,'OBSERVATION_ON'),('repair_enabled',True,'REPAIR_ON'),('pilot_registration_id',PRIVATE,'PILOT_ALREADY_SET'),('pilot_bound_at','2026-09-07T00:00:00Z','ALREADY_BOUND'),('binding_invitation_hash',None,'INVITATION_UNARMED'),('binding_expires_at',None,'INVITATION_UNARMED'),('binding_expires_at','2026-09-06T00:00:00Z','INVITATION_EXPIRED'),('binding_invitation_hash','e'*64,'INVITATION_MISMATCH')])
def test_gate_refusals_no_ownership_read(field,value,gate):
 r=Reader();r.project[field]=value
 out=run(r);assert out['diagnostic_status']==gate;assert len(r.calls)==1
 assert out['owned_registration_count']=='unverifiable'

@pytest.mark.parametrize('regs,gate,owned,eligible', [([], 'CAPABILITY_UNOWNED',0,0),([{'wonderpush_installation_id':'bad'}],'INSTALLATION_IDENTITY',1,0),([{'wonderpush_installation_id':None}],'INSTALLATION_IDENTITY',1,0),([{},{}],'READ_LIMIT','unverifiable','unverifiable')])
def test_ownership_and_identity(regs,gate,owned,eligible):
 r=Reader();r.regs=regs;out=run(r)
 assert out['diagnostic_status']==gate and out['owned_registration_count']==owned and out['eligible_registration_count']==eligible

def test_metadata_gate_no_registration_read():
 r=Reader();r.metadata=[{'status':'CHECK_DUE'}]
 assert run(r)['diagnostic_status']=='METADATA_PRESENT';assert len(r.calls)==2

def test_changed_project_never_claims_all_gates_pass():
 r=Reader();r.changed=True
 assert run(r)['diagnostic_status']=='SNAPSHOT_CHANGED'

@pytest.mark.parametrize('kw,gate',[({'capability':'bad'},'CAPABILITY_FORMAT'),({'invitation':'x'*64},'INVITATION_FORMAT'),({'invitation':INV+' '},'INVITATION_FORMAT')])
def test_local_format_failure_no_database_read(kw,gate):
 r=Mock();assert run(r,**kw)['diagnostic_status']==gate;r.assert_not_called()

def test_outage_no_retry_no_exception_leak(caplog):
 r=Mock(side_effect=Exception(CAP+INV+PRIVATE))
 out=run(r);assert out['diagnostic_status']=='READ_UNAVAILABLE';r.assert_called_once()
 assert all(x not in json.dumps(out)+caplog.text for x in [CAP,INV,PRIVATE])

def test_probe_route_is_separate_no_binding_calls(monkeypatch):
 import asyncio,httpx
 from fastapi import FastAPI
 c=config(None);c['database_key']='private'
 app=FastAPI();d.install_routes(app,lambda:c)
 original=d.inspect
 monkeypatch.setattr(d,'inspect',lambda c,cap,inv:original(c,cap,inv,read=Reader(),now=NOW))
 async def call():
  async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='https://theipm.ca') as client:
   r=await client.post('/production-diagnostics/pilot-binding',headers={'Origin':c['app'],'X-Notification-Device-Capability':CAP},json={'invitation':INV})
   assert r.json()['diagnostic_status']=='CURRENT_GATES_PASS' and r.headers['cache-control']=='no-store'
   assert (await client.post('/production-diagnostics/pilot-binding',json={})).status_code==404
   r=await client.post('/production-diagnostics/pilot-binding',headers={'Origin':c['app']},content='x'*129)
   assert r.json()['diagnostic_status']=='INVALID_BODY'
 asyncio.run(call())

def test_source_has_no_mutation_or_provider_access():
 source=Path(d.__file__).read_text()
 for forbidden in ['ipm_bind_reconciliation_pilot','/rpc/','patch_installation','client.request','INSERT','UPDATE','DELETE','FOR UPDATE']:
  assert forbidden not in source

def test_missing_schema_fields_fail_closed():
 r=Reader();del r.project['binding_invitation_hash']
 assert run(r)['diagnostic_status']=='READ_UNAVAILABLE'
