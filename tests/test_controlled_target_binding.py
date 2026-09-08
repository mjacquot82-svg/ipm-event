import asyncio,json
from unittest.mock import AsyncMock
import httpx,pytest
from fastapi import FastAPI
from backend import production_reconciliation as routes
from tests.test_production_reconciliation import config,CAP,PRIVATE

TARGET='a'*40
def cfg(client,targets=[TARGET]):
 c=config(client);c['targets']=targets;return c
def call(client,targets=[TARGET],headers=None,body='{}'):
 app=FastAPI();routes.install_routes(app,lambda:cfg(client,targets))
 async def run():
  async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='https://theipm.ca') as x:return await x.post('/notification-registrations/bind-controlled-target',headers=headers or {'Origin':'https://theipm.ca','X-Notification-Device-Capability':CAP},content=body)
 return asyncio.run(run())
SUCCESS={'bound':True,'pilot_restriction_count':1,'controlled_target_count':1,'controlled_target_match':True,'observation_enabled':False,'repair_enabled':False}
def test_success_sanitizes_and_hashes_capability_only():
 c=AsyncMock();c.request.return_value=SUCCESS;r=call(c);assert r.json()==SUCCESS
 p=c.request.call_args.kwargs['json']['p'];assert p['event_slug']=='ipm-2026' and 'capability_hash' in p and p['controlled_target']==TARGET
 assert CAP not in json.dumps(p) and TARGET not in r.text and PRIVATE not in r.text
@pytest.mark.parametrize('targets,reason', [([], 'CONTROLLED_TARGET_COUNT'),([TARGET,TARGET],'CONTROLLED_TARGET_COUNT'),(['bad'],'CONTROLLED_TARGET_INVALID')])
def test_target_count_and_shape_fail_before_rpc(targets,reason):
 c=AsyncMock();r=call(c,targets);assert r.json()=={'reason':reason};c.request.assert_not_called()
@pytest.mark.parametrize('reason',['CAPABILITY_UNOWNED','REGISTRATION_COUNT','CONTROLLED_TARGET_MISMATCH','PILOT_ALREADY_SET','OBSERVATION_ON','REPAIR_ON','METADATA_PRESENT','EVENT_MISMATCH'])
def test_database_refusal_is_reason_only(reason):
 c=AsyncMock();c.request.return_value={'reason':reason,'registration_id':PRIVATE,'controlled_target':TARGET};r=call(c);assert r.json()=={'reason':reason};assert PRIVATE not in r.text and TARGET not in r.text
def test_missing_capability_origin_and_bad_body():
 c=AsyncMock();assert call(c,headers={'Origin':'https://theipm.ca','X-Notification-Device-Capability':'bad'}).json()=={'reason':'CAPABILITY_INVALID'};c.request.assert_not_called()
 c=AsyncMock();assert call(c,headers={'Origin':'https://staging.theipm.ca','X-Notification-Device-Capability':CAP}).status_code==404;c.request.assert_not_called()
def test_unknown_rpc_result_and_outage_fail_closed():
 c=AsyncMock();c.request.return_value={'bound':True,'pilot_restriction_count':1};assert call(c).json()=={'reason':'UNAVAILABLE'}
 c=AsyncMock();c.request.side_effect=Exception(PRIVATE);r=call(c);assert r.status_code==503 and r.json()=={'reason':'UNAVAILABLE'} and PRIVATE not in r.text
def test_source_has_no_browser_registration_or_provider_operations():
 s=open(routes.__file__).read();assert 'registration_id' not in s[s.index('bind_controlled_target'):s.index("@router.post('/notification-registrations/reconcile'")];assert 'patch_installation' not in s
