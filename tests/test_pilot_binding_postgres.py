"""Only the existing opt-in loopback fixture database is permitted."""
import concurrent.futures
import json
import pytest
from tests.test_reconciliation_postgres import sql, DSN
pytestmark=pytest.mark.skipif(not DSN,reason='Requires isolated PostgreSQL test database')

@pytest.fixture(autouse=True)
def setup():
 assert '127.0.0.1:55439' in DSN
 sql('update notification_reconciliation_project set pilot_registration_id=null')
 sql('truncate notification_reconciliation,notification_installations,events cascade')
 sql('insert into notification_reconciliation_project(singleton) values(true) on conflict do nothing')
 sql("update notification_reconciliation_project set enabled=false,repair_enabled=false,binding_invitation_hash=%s,binding_expires_at=now()+interval '10 minutes',pilot_bound_at=null",('d'*64,))
 sql("insert into events values('11111111-1111-1111-1111-111111111111','ipm-2026')")
 sql("insert into notification_installations(event_id,wonderpush_installation_id,capability_hash) values('11111111-1111-1111-1111-111111111111',%s,%s)",('b'*40,'a'*64))

def bind(**kw):
 return sql('select ipm_bind_reconciliation_pilot(%s::jsonb)',(json.dumps({'event_slug':'ipm-2026','capability_hash':'a'*64,'invitation_hash':'d'*64,**kw}),))[0][0]
def off():
 assert sql('select enabled,repair_enabled from notification_reconciliation_project')==[(False,False)]
 assert sql('select count(*) from notification_reconciliation')==[(0,)]

def test_one_shot_own_registration_switches_off_identity_preserved():
 before=sql('select * from notification_installations')
 assert bind()==dict(bound=True,pilot_restriction_count=1,observation_enabled=False,repair_enabled=False)
 assert sql('select pilot_registration_id from notification_reconciliation_project')[0][0]==before[0][0]
 assert sql('select * from notification_installations')==before
 assert sql('select binding_invitation_hash,binding_expires_at,pilot_bound_at is not null from notification_reconciliation_project')==[(None,None,True)]
 assert bind()=={'bound':False};off()
 sql('update notification_reconciliation_project set pilot_registration_id=null')
 assert bind()=={'bound':False};off()

@pytest.mark.parametrize('update',["enabled=true","repair_enabled=true","binding_invitation_hash=null","binding_expires_at=null","binding_expires_at=now()-interval '1 second'","pilot_bound_at=now()","pilot_registration_id=(select id from notification_installations limit 1)"])
def test_closed_gates_no_write(update):
 sql('update notification_reconciliation_project set '+update)
 before=sql('select * from notification_reconciliation_project')
 assert bind()=={'bound':False}
 assert sql('select * from notification_reconciliation_project')==before
 assert sql('select count(*) from notification_reconciliation')==[(0,)]

@pytest.mark.parametrize('kw',[{'capability_hash':'e'*64},{'invitation_hash':'e'*64},{'event_slug':'staging'},{'capability_hash':None},{'invitation_hash':None}])
def test_wrong_or_missing_identity_invitation_event_no_write(kw):
 before=sql('select * from notification_reconciliation_project')
 assert bind(**kw)=={'bound':False}
 assert sql('select * from notification_reconciliation_project')==before;off()

def test_concurrent_bindings_exactly_one_winner():
 with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
  results=list(pool.map(lambda _:bind(),range(24)))
 assert sum(r['bound'] for r in results)==1;off()

def test_caller_cannot_select_other_registration():
 sql("insert into notification_installations(event_id,wonderpush_installation_id,capability_hash) values('11111111-1111-1111-1111-111111111111',%s,%s)",('e'*40,'f'*64))
 other=sql('select id from notification_installations where capability_hash=%s',('f'*64,))[0][0]
 assert bind(registration_id=str(other),installation_id='e'*40)['bound'] is True
 assert sql('select pilot_registration_id <> %s from notification_reconciliation_project',(other,))==[(True,)];off()

def test_no_prior_reconciliation_metadata_allowed():
 sql("insert into notification_reconciliation(registration_id,fingerprint) select id,%s from notification_installations",('c'*64,))
 assert bind()=={'bound':False}

def test_permissions():
 for role in ('anon','authenticated'):
  assert sql("select has_function_privilege(%s,'public.ipm_bind_reconciliation_pilot(jsonb)','EXECUTE')",(role,))==[(False,)]
 assert sql("select has_function_privilege('service_role','public.ipm_bind_reconciliation_pilot(jsonb)','EXECUTE')")==[(True,)]

def test_route_to_real_database_owns_capability_and_returns_only_booleans():
 import hashlib
 from tests.test_production_reconciliation import config,request,CAP
 from tests.test_pilot_binding import INV,PATH,SUCCESS
 sql('update notification_installations set capability_hash=%s',(hashlib.sha256(CAP.encode()).hexdigest(),))
 sql('update notification_reconciliation_project set binding_invitation_hash=%s',(hashlib.sha256(INV.encode()).hexdigest(),))
 class Client:
  async def request(self,method,path,**kw):
   assert method=='POST' and path=='/rpc/ipm_bind_reconciliation_pilot'
   return sql('select ipm_bind_reconciliation_pilot(%s::jsonb)',(json.dumps(kw['json']['p']),))[0][0]
 def call():return request(config(Client()),PATH,headers={'Origin':'https://theipm.ca','X-Notification-Device-Capability':CAP},content=json.dumps({'invitation':INV}))
 assert call().json()==SUCCESS
 assert call().status_code==404;off()
