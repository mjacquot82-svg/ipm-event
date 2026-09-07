import asyncio
import json
from unittest.mock import AsyncMock
import httpx
import pytest
from fastapi import FastAPI
from backend import production_reconciliation as routes

CAP = 'PRIVATE-CAPABILITY-CANARY'.ljust(43, 'x')
PRIVATE = 'PRIVATE-REGISTRATION-CANARY'

def config(client):
    return dict(host='ipm-backend-eoiw.onrender.com', app='https://theipm.ca',
                database='https://hppboivlpqkfhhzfftuu.supabase.co', event='ipm-2026',
                credential='PRIVATE-CREDENTIAL-CANARY', commit='a'*40, client=client)

def request(c, path, method='POST', headers=None, content=None):
    app = FastAPI(); routes.install_routes(app, lambda: c)
    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='https://theipm.ca') as client:
            return await client.request(method, path, headers=headers or {}, content=content)
    return asyncio.run(run())

@pytest.mark.parametrize('field',['host','app','database','event'])
def test_exact_production_isolation(field):
    client=AsyncMock(); c=config(client); c[field]='wrong'
    for path,method in [('reconciliation-health','GET'),('pilot-eligibility','POST'),('reconcile','POST')]:
        r=request(c,'/notification-registrations/'+path,method)
        assert r.status_code==404
    client.request.assert_not_called()

@pytest.mark.parametrize('eligible',[False,True])
def test_membership_is_read_only_private_and_sanitized(eligible,caplog):
    client=AsyncMock(); client.request.return_value={'pilot_eligible':eligible,'observation_enabled':False,'repair_enabled':False,'private':PRIVATE}
    r=request(config(client),'/notification-registrations/pilot-eligibility',headers={'Origin':'https://theipm.ca','X-Notification-Device-Capability':CAP})
    assert r.json()=={'pilot_eligible':eligible,'observation_enabled':False,'repair_enabled':False}
    args=client.request.call_args.kwargs['json']['p']
    assert args['action']=='eligibility' and 'capability_hash' in args
    assert CAP not in json.dumps(args)
    assert PRIVATE not in r.text+caplog.text and CAP not in r.text+caplog.text
    assert r.headers['cache-control']=='no-store'

@pytest.mark.parametrize('pilot',[None,PRIVATE])
def test_health_defaults_off_and_never_discloses_pilot(pilot,caplog):
    client=AsyncMock();client.request.return_value=[{'pilot_registration_id':pilot,'enabled':False,'repair_enabled':False}]
    r=request(config(client),'/notification-registrations/reconciliation-health','GET')
    assert r.json()['pilot_restriction_count']==int(pilot is not None)
    assert r.json()['observation_enabled'] is False and r.json()['repair_enabled'] is False
    assert PRIVATE not in r.text+caplog.text

def test_origin_oversize_invalid_and_outage_fail_closed():
    client=AsyncMock();c=config(client)
    assert request(c,'/notification-registrations/reconcile').status_code==404
    assert request(c,'/notification-registrations/reconcile',headers={'Origin':c['app']},content='x'*12289).json()['status']=='INELIGIBLE'
    client.request.assert_not_called()
    client.request.side_effect=Exception(PRIVATE)
    r=request(c,'/notification-registrations/pilot-eligibility',headers={'Origin':c['app'],'X-Notification-Device-Capability':CAP})
    assert r.status_code==503 and PRIVATE not in r.text

def test_nonpilot_claim_never_reads_or_patches_provider(monkeypatch):
    from backend import subscription_reconciliation as core
    from tests.test_subscription_reconciliation import RPC, run
    def forbidden(*args): raise AssertionError('Nonpilot provider access')
    monkeypatch.setattr(core.provider,'read_installation',forbidden)
    monkeypatch.setattr(core.provider,'patch_installation',forbidden)
    assert run(RPC({'status':'INELIGIBLE','outcome':'NOT_PILOT'}))['outcome']=='NOT_PILOT'

def test_server_mount_and_cors_preserve_existing_routes(monkeypatch):
    from backend import server
    client=AsyncMock();client.request.return_value=[{'enabled':False,'repair_enabled':False,'pilot_registration_id':None}]
    from types import SimpleNamespace
    monkeypatch.setenv('RENDER_EXTERNAL_HOSTNAME','ipm-backend-eoiw.onrender.com')
    monkeypatch.setattr(server,'PUBLIC_APP_URL','https://theipm.ca')
    monkeypatch.setattr(server,'SUPABASE_URL','https://hppboivlpqkfhhzfftuu.supabase.co')
    monkeypatch.setattr(server,'DEFAULT_EVENT_ID','ipm-2026')
    monkeypatch.setattr(server,'notification_registration_repository',SimpleNamespace(client=client))
    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app),base_url='https://theipm.ca') as c:
            assert (await c.get('/api/')).status_code==200
            r=await c.get('/api/notification-registrations/reconciliation-health')
            assert r.status_code==200 and r.json()['pilot_only'] is True
            r=await c.options('/api/notification-registrations/reconcile',headers={'Origin':'https://theipm.ca','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,x-notification-device-capability'})
            assert r.status_code==200 and r.headers['access-control-allow-origin']=='https://theipm.ca'
            assert (await c.post('/api/notification-registrations/reconcile',headers={'Origin':'https://staging.theipm.ca'},json={})).status_code==404
            assert (await c.post('/api/production-diagnostics/push-target',headers={'Origin':'https://staging.theipm.ca'},json={})).status_code==403
    asyncio.run(run())
