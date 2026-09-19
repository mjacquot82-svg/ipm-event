import asyncio
from copy import deepcopy
from datetime import datetime, timezone
from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from backend.notification_overview import overview, read_overview
from backend.platform_services import SupabaseNotificationDeliveryService
from backend import server

NOW = datetime(2026, 9, 18, 23, tzinfo=timezone.utc)

def row(**kw):
    return dict(audience='everyone', status='sent', requested_at=NOW.isoformat(), **kw)

@pytest.mark.parametrize('rows,accepted,receipt,covered', [
    ([],0,None,0), ([row()],1,None,0),
    ([row(provider_confirmed_receipt_count=42)],1,42,1),
    ([row(),row(provider_confirmed_receipt_count=42)],2,42,1),
    ([row(provider_confirmed_receipt_count=0)],1,0,1),
    ([row(provider_confirmed_receipt_count=False),row(provider_confirmed_receipt_count=-1)],2,None,0),
])
def test_unknown_zero_and_independent_coverage(rows,accepted,receipt,covered):
    result=overview(rows,NOW)
    assert result['accepted_sends']==accepted
    assert result['metrics']['receipts']==dict(value=receipt,covered_sends=covered,total_sends=accepted)
    assert result['metrics']['opens']['value'] is None
    assert result['rates'] is None


def test_full_partial_failures_test_exclusion_and_no_incompatible_rates():
    a=row(provider_targeted_device_count=100,provider_confirmed_receipt_count=80,provider_open_count=120,
          provider_failure_count=2,notification_origin_visit_count=5)
    b=row(provider_confirmed_receipt_count=9,provider_failure_count=0)
    failed={**row(), 'status':'failed', 'provider_failure_count':999}
    pending={**row(), 'status':'requested'}
    test={**a,'audience':'test'}
    r=overview([a,b,failed,pending,test],NOW)
    assert r['accepted_sends']==2 and r['failed_requests']==1 and r['pending_requests']==1
    assert r['metrics']['failures']==dict(value=2,covered_sends=2,total_sends=2)
    assert r['metrics']['receipts']['value']==89
    assert r['metrics']['targeted_devices']['covered_sends']==1
    assert r['metrics']['opens']['value']==120
    assert r['rates'] is None  # Event counts are not unique-device conversion numerators.


def test_shared_provider_campaign_not_double_counted_but_visits_remain_valid():
    r=overview([row(provider_campaign_id='shared',provider_open_count=4,notification_origin_visit_count=1)]*2,NOW)
    assert r['metrics']['opens']['value'] is None
    assert r['metrics']['visits']['value']==2


def test_recent_safe_allowlist_and_chronology():
    rows=[row(notification_title=f'Title {i}',requested_by='secret',push_token='secret',provider_campaign_id=f'private{i}') for i in range(7)]
    rows[0]['requested_at']='2026-01-01T00:00:00Z'
    r=overview(rows,NOW)
    assert len(r['recent'])==5 and r['recent'][0]['title']=='Title 1'
    assert set(r['recent'][0])=={'title','requested_at','provider_accepted'}
    assert 'secret' not in str(r) and 'private' not in str(r)


class Client:
    def __init__(self, pages): self.pages=iter(pages); self.calls=[]
    async def get_event_id(self,event): assert event=='event-a'; return 'resolved-a'
    async def request(self,method,path,params):
        assert method=='GET' and path=='/notification_deliveries'
        self.calls.append(params); return next(self.pages)


def service(client):
    result=SupabaseNotificationDeliveryService(supabase_url='https://example.test',service_role_key='fixture',event_slug='event-a')
    result.client=client; return result


def test_paginated_read_is_scoped_and_reads_past_short_server_pages():
    client=Client([[row()],[row()],[]]);r=asyncio.run(service(client).list_overview_rows(event_id='event-a',now=NOW))
    assert len(r)==2
    assert [c['offset'] for c in client.calls]==['0','1','2']
    for c in client.calls:
        assert c['event_id']=='eq.resolved-a' and c['audience']=='eq.everyone'
        assert c['requested_at']=='lte.'+NOW.isoformat()
        assert 'push_token' not in c['select'] and 'requested_by' not in c['select']


def test_bounded_read_fails_instead_of_returning_partial_totals():
    client=Client([[row()]]*201)
    with pytest.raises(ValueError): asyncio.run(service(client).list_overview_rows(event_id='event-a',now=NOW))


@pytest.mark.parametrize('unavailable',[False,True])
def test_visit_aggregation_read_only_and_unavailability(unavailable):
    rows=[row(id='delivery',target_url='https://example.test/?notification_ref=delivery',notification_origin_visit_count=50)]
    class Deliveries:
        async def list_overview_rows(self,**kw):return deepcopy(rows)
    class Visits:
        async def notification_visit_counts(self,ids):
            assert ids==['delivery']
            if unavailable: raise RuntimeError('down')
            return {}  # Successful authoritative ledger read proves zero.
    result=asyncio.run(read_overview(Deliveries(),Visits(),'event-a',NOW))
    assert result['metrics']['visits']['value']==(None if unavailable else 0)
    assert rows[0]['notification_origin_visit_count']==50


def test_route_auth_scope_and_sanitized_error(monkeypatch):
    monkeypatch.setattr(server,'event_service',SimpleNamespace(get_public_event_id=lambda:'event-a',get_admin_event_id=lambda user,event_id:user['event_id']))
    for user in [{'role':'Vendor','event_id':'event-a'},{'role':'Owner','event_id':'event-b'}]:
        with pytest.raises(HTTPException) as error: asyncio.run(server.notification_summary(user))
        assert error.value.status_code==403
    class Bad:
        async def list_overview_rows(self,**kw):raise RuntimeError('private credentials')
    monkeypatch.setattr(server,'require_notification_delivery_service',lambda:Bad())
    with pytest.raises(HTTPException) as error:asyncio.run(server.notification_summary({'role':'Owner','event_id':'event-a'}))
    assert error.value.status_code==503 and 'private' not in error.value.detail


def test_authenticated_route_returns_only_summary_and_never_uses_provider(monkeypatch):
    import httpx
    class Ledger:
        async def list_overview_rows(self,**kwargs):
            assert kwargs['event_id']=='event-a'
            return [row(provider_open_count=2,provider_campaign_id='internal-only',notification_title='Saved title')]
    class Forbidden:
        def __getattr__(self,name): raise AssertionError('No provider calls allowed')
    monkeypatch.setattr(server,'event_service',SimpleNamespace(get_public_event_id=lambda:'event-a',get_admin_event_id=lambda user,event_id:user['event_id']))
    monkeypatch.setattr(server,'require_notification_delivery_service',lambda:Ledger())
    monkeypatch.setattr(server,'wonderpush_client',Forbidden())
    server.app.dependency_overrides[server.get_current_organizer_user]=lambda:{'role':'Communications','event_id':'event-a'}
    async def check():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app),base_url='https://fixture.test') as client:
            response=await client.get('/api/admin/analytics/notification-summary')
        assert response.status_code==200,response.text
        assert response.json()['metrics']['opens']['value']==2
        assert 'internal-only' not in response.text
    try:asyncio.run(check())
    finally:server.app.dependency_overrides.clear()
