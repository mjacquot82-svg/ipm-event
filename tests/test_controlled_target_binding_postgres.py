import concurrent.futures,json,os,pytest
psycopg=pytest.importorskip('psycopg')
DSN=os.environ.get('IPM_RECONCILIATION_TEST_DSN')
pytestmark=pytest.mark.skipif(not DSN,reason='Requires isolated PostgreSQL test database')
def sql(q,args=None):
 with psycopg.connect(DSN,autocommit=True) as c:
  with c.cursor() as cur:
   cur.execute(q,args);return cur.fetchall() if cur.description else []
CAP='a'*64;TARGET='b'*40
@pytest.fixture(autouse=True)
def reset():
 assert '127.0.0.1:55439' in DSN
 sql('alter table events drop constraint if exists events_slug_key')
 sql('truncate notification_reconciliation,notification_installations,events cascade')
 sql('insert into notification_reconciliation_project(singleton) values(true) on conflict do nothing')
 sql('update notification_reconciliation_project set enabled=false,repair_enabled=false,pilot_registration_id=null')
 sql("insert into events values('11111111-1111-1111-1111-111111111111','ipm-2026')")
 sql("insert into notification_installations(event_id,wonderpush_installation_id,capability_hash) values('11111111-1111-1111-1111-111111111111',%s,%s)",(TARGET,CAP))
def bind(target=TARGET,cap=CAP,event='ipm-2026'):
 p={'event_slug':event,'capability_hash':cap,'controlled_target':target}
 return sql('select ipm_bind_controlled_target(%s::jsonb)',(json.dumps(p),))[0][0]
def test_exact_target_bind_is_one_shot_and_switches_stay_off():
 row=sql('select id from notification_installations')[0][0];assert bind()['bound'] is True
 assert sql('select pilot_registration_id,enabled,repair_enabled from notification_reconciliation_project')==[(row,False,False)]
 assert bind()=={'reason':'PILOT_ALREADY_SET'}
 assert sql('select count(*) from notification_reconciliation')==[(0,)]
@pytest.mark.parametrize('target,reason',[(('c'*40),'CONTROLLED_TARGET_MISMATCH'),(('bad'),'CONTROLLED_TARGET_INVALID')])
def test_wrong_target(target,reason):
 assert bind(target=target)=={'reason':reason}
def test_missing_or_multiple_owned_registration():
 sql('delete from notification_installations');assert bind()=={'reason':'CAPABILITY_UNOWNED'}
 sql("insert into events values('22222222-2222-2222-2222-222222222222','ipm-2026')")
 sql("insert into notification_installations(event_id,wonderpush_installation_id,capability_hash) values('11111111-1111-1111-1111-111111111111',%s,%s),('22222222-2222-2222-2222-222222222222',%s,%s)",(TARGET,CAP,'c'*40,CAP));assert bind()=={'reason':'REGISTRATION_COUNT'}
@pytest.mark.parametrize('update,reason',[('enabled=true','OBSERVATION_ON'),('repair_enabled=true','REPAIR_ON')])
def test_switches(update,reason):
 sql('update notification_reconciliation_project set '+update);assert bind()=={'reason':reason}
def test_metadata_nonempty():
 row=sql('select id from notification_installations')[0][0];sql("insert into notification_reconciliation(registration_id,fingerprint) values(%s,%s)",(row,'d'*64));assert bind()=={'reason':'METADATA_PRESENT'}
def test_event_and_capability_gates():
 assert bind(event='wrong')=={'reason':'EVENT_MISMATCH'};assert bind(cap='bad')=={'reason':'CAPABILITY_INVALID'}
def test_concurrent_calls_exactly_one_winner():
 with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:results=list(pool.map(lambda _:bind(),range(32)))
 assert sum(r.get('bound') is True for r in results)==1;assert sum(r.get('reason')=='PILOT_ALREADY_SET' for r in results)==31
def test_service_role_only():
 assert sql("select has_function_privilege('anon','public.ipm_bind_controlled_target(jsonb)','EXECUTE')")==[(False,)]
 assert sql("select has_function_privilege('service_role','public.ipm_bind_controlled_target(jsonb)','EXECUTE')")==[(True,)]
