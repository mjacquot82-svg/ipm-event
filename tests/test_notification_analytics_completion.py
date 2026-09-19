"""Provider-free proofs for the recovered notification analytics implementation."""
import asyncio
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import httpx
import pytest
from fastapi import HTTPException
from backend import server
from backend.analytics import AnalyticsEventInput, AnalyticsEventsRequest, _event_document, MongoAnalyticsRepository
from backend.notification_analytics import *
from backend.platform_services import WonderPushClient, WonderPushError, SupabaseNotificationDeliveryService
from tests.test_announcements import configure_notification_fakes, announcement

NOW = datetime(2026, 9, 18, 22, tzinfo=timezone.utc)
DID, ALERT, NAV = (str(uuid4()) for _ in range(3))


def delivery(**overrides):
    return {'id': DID, 'announcement_id': ALERT, 'audience': 'everyone', 'status': 'sent',
            'provider_campaign_id': campaign_identity(DID, 'everyone'),
            'requested_at': (NOW-timedelta(minutes=10)).isoformat(),
            'target_url': f'https://staging.theipm.ca/announcements/{ALERT}?notification_ref={DID}', **overrides}


@pytest.mark.parametrize('age,previous,expected', [
    (9, None, False), (10, None, True), (3599, 59, False), (3599, 60, True),
    (3600, 899, False), (3600, 900, True), (86400, 21599, False),
    (86400, 21600, True), (604799, 21600, True), (604800, None, False),
])
def test_refresh_boundary(age, previous, expected):
    row = delivery(requested_at=(NOW-timedelta(seconds=age)).isoformat(),
                   provider_statistics_refreshed_at=(NOW-timedelta(seconds=previous)).isoformat() if previous is not None else None)
    assert refresh_due(row, NOW) is expected


@pytest.mark.parametrize('status', ['unavailable', 'rate_limited'])
def test_failure_backoff(status):
    row = delivery(provider_statistics_status=status, provider_statistics_refreshed_at=(NOW-timedelta(seconds=3599)).isoformat())
    assert not refresh_due(row, NOW)
    assert refresh_due(row, NOW+timedelta(seconds=1))


def test_history_and_ambiguous_legacy_identity_not_queried():
    for row in [delivery(provider_campaign_id=None), delivery(provider_campaign_id='wonderpush:accepted'),
                delivery(status='failed'), delivery(audience='test',provider_campaign_id='ipm-announcement-test-alert')]:
        assert not refresh_due(row,NOW)
    row=delivery(requested_at=(NOW-timedelta(days=10)).isoformat())
    assert refresh_due(row,NOW,diagnostic=True)


class Ledger:
    def __init__(self, rows): self.rows=deepcopy(rows); self.patches=[]
    async def claim_statistics_refresh(self,row,now):
        actual=next(x for x in self.rows if x['id']==row['id'])
        if actual.get('provider_statistics_refreshed_at') != row.get('provider_statistics_refreshed_at'): return False
        actual.update(provider_statistics_refreshed_at=now.isoformat(),provider_statistics_status='refreshing')
        return True
    async def update_provider_statistics(self, did, values, lease_at=None):
        row=next(x for x in self.rows if x['id']==did)
        if lease_at and row.get('provider_statistics_refreshed_at')!=lease_at: return None
        row.update(values);self.patches.append((did,values));return dict(row)


class FixtureProvider:
    def __init__(self, values=None, error=None): self.values=values or {};self.error=error;self.calls=[]
    async def get_campaign_statistics(self,campaign_id,**kw):
        self.calls.append(campaign_id)
        if self.error:raise self.error
        return self.values


@pytest.mark.parametrize('missing', [False,True])
def test_fixture_metrics_correct_row_storage_and_public_contract(missing):
    # Adapter-level fixture: proves all supported nullable fields independently of
    # upstream availability. The production reports adapter leaves exact targets/unique opens null.
    values={} if missing else dict(zip(METRIC_FIELDS,[12,11,9,1,3,2]))
    rows=[delivery(),delivery(id='other',provider_campaign_id=None)]
    ledger=Ledger(rows);provider=FixtureProvider(values)
    asyncio.run(refresh_statistics(rows,ledger,provider,NOW))
    assert provider.calls==[rows[0]['provider_campaign_id']]
    assert all(did==DID for did,_ in ledger.patches)
    assert ledger.rows[1]==delivery(id='other',provider_campaign_id=None)
    public=server.notification_analytics_response(rows[0]).model_dump()
    expected=[None]*5 if missing else [12,11,9,1,3]
    assert [public[k] for k in ['targeted_devices','sent_to_push_service','provider_confirmed_receipts','provider_failures','notification_opens']]==expected
    assert public['provider_accepted'] is True
    assert not any(key in public for key in ['delivery_id','provider_campaign_id','provider_delivery_id'])
    assert 'installation' not in str(public)


@pytest.mark.parametrize('error', [WonderPushError('DO NOT LEAK accessToken=secret',status_code=429),ValueError('secret'),TimeoutError()])
def test_provider_failure_preserves_send_and_known_metrics(error):
    row=delivery(provider_sent_count=3);ledger=Ledger([row]);provider=FixtureProvider(error=error)
    asyncio.run(refresh_statistics([row],ledger,provider,NOW))
    assert ledger.rows[0]['status']=='sent'
    assert ledger.rows[0]['provider_sent_count']==3
    assert 'secret' not in ledger.rows[0]['provider_statistics_error']


def test_refresh_budget_and_concurrent_lease():
    async def scenario():
        rows=[delivery(id=str(uuid4())) for _ in range(8)];ledger=Ledger(rows);provider=FixtureProvider()
        await asyncio.gather(refresh_statistics(deepcopy(rows),ledger,provider,NOW),refresh_statistics(deepcopy(rows),ledger,provider,NOW))
        assert len(provider.calls)==8  # one lookup per delivery, max five per load
        assert len(ledger.patches)==8
    asyncio.run(scenario())


def test_statistics_query_is_read_only_exact_campaign(monkeypatch):
    calls=[]
    class Client:
        def __init__(self,**kw): pass
        async def __aenter__(self):return self
        async def __aexit__(self,*args):pass
        async def post(self,url,params,json):
            calls.append((url,json))
            return httpx.Response(200,json={'success':True,'hasErrors':False,'bulkValues':[
                {'groups':[{'dimensions':{},'value':{'int':n}}]} for n in [4,3,1,0]]})
    monkeypatch.setattr(httpx,'AsyncClient',Client)
    provider=WonderPushClient(access_token='fixture-token')
    result=asyncio.run(provider.get_campaign_statistics('campaign',requested_at=NOW.isoformat()))
    assert result['provider_sent_count']==4 and result['provider_failure_count']==0
    assert result['provider_confirmed_receipt_count']==3 and result['provider_targeted_device_count'] is None
    assert calls[0][0].endswith('/stats/reports')
    assert all(r['params']['campaignId']=='campaign' and r['metric']=='campaign.events.type'
               and 'precision' not in r and 'dimensions' not in r for r in calls[0][1]['bulk'])


@pytest.mark.parametrize('groups', [[], [{'dimensions':{},'value':{}}]])
def test_missing_report_counts_remain_null(groups):
    result=normalize_report_statistics({'success':True,'hasErrors':False,'bulkValues':[{'groups':groups}]*4})
    assert all(v is None for v in result.values())


def test_report_error_not_fabricated_zero():
    with pytest.raises(ValueError):
        normalize_report_statistics({'success':True,'hasErrors':True,'bulkValues':[]})


def test_provider_breakdowns_not_double_counted_or_misattributed():
    data={'data':[{'campaignId':'correct','counters':[{'type':'@NOTIFICATION_SENT','count':7},
            {'type':'@NOTIFICATION_SENT','platform':'Web','count':7},
            {'type':'@NOTIFICATION_RECEIVED','count':5}]},
            {'campaignId':'other','counters':[{'type':'@NOTIFICATION_SENT','count':900}]}]}
    result=normalize_event_statistics(data,'correct')
    assert result['provider_sent_count']==7 and result['provider_confirmed_receipt_count'] is None


@pytest.mark.parametrize('value', [-1,1.5,True,'3',None])
def test_bad_counts_never_become_zero(value):
    assert checked_metrics({'provider_open_count':value})['provider_open_count'] is None


def test_repeated_test_sends_unique_and_broadcast_guard_retained(monkeypatch):
    provider,ledger=configure_notification_fakes(monkeypatch,announcement())
    user={'username':'owner','role':'Owner','event_id':'event-a'}
    one=asyncio.run(server.notify_announcement('announcement-1','test',user))
    two=asyncio.run(server.notify_announcement('announcement-1','test',user))
    assert one.provider_campaign_id != two.provider_campaign_id
    assert one.provider_campaign_id=='ipm-test-delivery-1'
    assert provider.test_installations==['test-1','test-2']  # existing fake; real provider enforces exactly one
    first=asyncio.run(server.notify_announcement('announcement-1','everyone',user))
    assert first.provider_campaign_id not in [one.provider_campaign_id,two.provider_campaign_id]
    with pytest.raises(HTTPException) as error:asyncio.run(server.notify_announcement('announcement-1','everyone',user))
    assert error.value.status_code==409


def event(nav=NAV,did=DID,alert=ALERT):
    return AnalyticsEventInput(clientEventId=uuid4(),eventName='notification_origin_visit',properties={
        'delivery_id':did,'announcement_id':alert,'navigation_id':nav,'destination':'announcement_detail','source':'notification','navigation_type':'deep_link'})


def test_reload_and_retries_same_event_key_new_navigation_distinct():
    def doc(e):return _event_document(visitor_id=uuid4(),session_id=uuid4(),event=e,received_at=NOW)
    first=doc(event());reloaded=doc(event());second=doc(event(nav=str(uuid4())))
    assert first['clientEventId']==reloaded['clientEventId']!=second['clientEventId']


@pytest.mark.parametrize('bad', ['unknown','wrong-announcement','historical','not-accepted','invalid'])
def test_bad_attribution_ignored_without_oracle(monkeypatch,bad):
    row=delivery()
    if bad=='unknown':row=None
    elif bad=='wrong-announcement':row['announcement_id']=str(uuid4())
    elif bad=='historical':row['target_url']='https://staging.theipm.ca/announcements/'+ALERT
    elif bad=='not-accepted':row['status']='requested'
    class Service:
        async def get_delivery(self,*args,**kwargs):return row
    monkeypatch.setattr(server,'require_notification_delivery_service',lambda:Service())
    e=event(did='not-a-uuid') if bad=='invalid' else event()
    result=asyncio.run(server.analytics_events(AnalyticsEventsRequest(visitorId=uuid4(),sessionId=uuid4(),events=[e])))
    assert result['accepted']==0


def test_normal_open_does_not_enter_notification_ledger(monkeypatch):
    class Repo:
        async def heartbeat_session(self,**kw):return True
        async def record_event(self,doc):
            assert doc['eventName']=='announcement_opened';return True
        async def increment_rollup(self,**kw):pass
    monkeypatch.setattr(server,'analytics_repository',Repo())
    request=AnalyticsEventsRequest(visitorId=uuid4(),sessionId=uuid4(),events=[AnalyticsEventInput(clientEventId=uuid4(),eventName='announcement_opened',properties={'announcement_id':ALERT,'source':'home'})])
    assert asyncio.run(server.analytics_events(request))['accepted']==1


def test_historical_without_reference_remains_unknown(monkeypatch):
    class Repo:
        async def notification_visit_counts(self,ids):raise AssertionError('historical ref queried')
    monkeypatch.setattr(server,'analytics_repository',Repo());row=delivery(target_url='/announcements/'+ALERT)
    asyncio.run(server.attach_notification_visit_counts([row],Ledger([row])))
    assert server.notification_analytics_response(row).notification_origin_visits is None


def test_visit_count_aggregate_correct_delivery(monkeypatch):
    class Repo:
        async def notification_visit_counts(self,ids):assert ids==[DID];return {DID:3}
    monkeypatch.setattr(server,'analytics_repository',Repo());row=delivery();ledger=Ledger([row])
    asyncio.run(server.attach_notification_visit_counts([row],ledger))
    assert ledger.rows[0]['notification_origin_visit_count']==3


def test_refresh_lease_conditional_patch_and_safe_fields():
    calls=[]
    class Client:
        async def request(self,method,path,**kw):calls.append((method,path,kw));return [{'id':DID}]
    service=SupabaseNotificationDeliveryService(supabase_url='https://invalid.test',service_role_key='fixture',event_slug='fixture')
    service.client=Client()
    asyncio.run(service.claim_statistics_refresh(delivery(),NOW))
    assert calls[0][2]['params']['provider_statistics_refreshed_at']=='is.null'
    asyncio.run(service.update_provider_statistics(DID,{'provider_open_count':3},lease_at=NOW.isoformat()))
    assert calls[1][2]['params']['provider_statistics_refreshed_at']=='eq.'+NOW.isoformat()


def test_diagnostics_owner_only_and_secret_allowlist(monkeypatch):
    with pytest.raises(HTTPException) as err:asyncio.run(server.notification_analytics_diagnostics(ALERT,{'role':'Communications'}))
    assert err.value.status_code==403
    class Service:
        async def list_deliveries(self,**kw):return [delivery(pushToken='SECRET',capability_hash='SECRET',error_message='SECRET')]
    monkeypatch.setattr(server,'require_notification_delivery_service',lambda:Service())
    result=asyncio.run(server.notification_analytics_diagnostics(ALERT,{'role':'Owner','event_id':'ipm-2026'}))
    assert result['deliveries'][0]['id']==DID and 'SECRET' not in str(result)


def test_visit_cache_cannot_regress_on_concurrent_snapshot():
    calls=[]
    class Client:
        async def request(self,method,path,**kw):calls.append(kw);return []
    service=SupabaseNotificationDeliveryService(supabase_url='https://invalid.test',service_role_key='fixture',event_slug='fixture')
    service.client=Client()
    asyncio.run(service.update_provider_statistics(DID,{'notification_origin_visit_count':3}))
    assert calls[0]['params']['or']=='(notification_origin_visit_count.is.null,notification_origin_visit_count.lt.3)'


def test_authenticated_fixture_api_matches_browser_contract(monkeypatch):
    import json
    from pathlib import Path
    fixture=json.loads((Path(__file__).parents[1]/'frontend/tests/fixtures/notification-analytics.json').read_text())
    row=delivery(announcement_id=fixture['announcement_id'],audience_device_count=13,notification_origin_visit_count=2,
                 requested_at=(datetime.now(timezone.utc)-timedelta(minutes=10)).isoformat())
    class Service(Ledger):
        async def list_announcement_stats(self,**kw):return self.rows
    ledger=Service([row]);provider=FixtureProvider(dict(zip(METRIC_FIELDS,[12,11,9,1,3,None])))
    monkeypatch.setattr(server,'require_notification_delivery_service',lambda:ledger)
    monkeypatch.setattr(server,'wonderpush_client',provider)
    class Visits:
        async def notification_visit_counts(self,ids):return {DID:2}
    monkeypatch.setattr(server,'analytics_repository',Visits())
    server.app.dependency_overrides[server.get_current_organizer_user]=lambda:{'role':'Owner','event_id':'ipm-2026'}
    async def check():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app),base_url='https://fixture.test') as client:
            response=await client.get('/api/admin/announcements/delivery-stats')
        assert response.status_code==200,response.text
        body=response.json()['deliveries'][0]
        for key in ('announcement_id','audience_device_count','provider_targeted_device_count','provider_sent_count',
                    'provider_confirmed_receipt_count','provider_open_count','provider_failure_count','notification_origin_visit_count','provider_accepted'):
            assert body[key]==fixture[key]
        assert 'provider_campaign_id' not in body and 'id' not in body
    try:asyncio.run(check())
    finally:server.app.dependency_overrides.clear()


@pytest.mark.parametrize('status', [None,408,500,503])
def test_ambiguous_broadcast_keeps_identity_and_blocks_accidental_new_send(monkeypatch,status):
    provider,ledger=configure_notification_fakes(monkeypatch,announcement())
    async def ambiguous(**kw):raise WonderPushError('ambiguous',status_code=status)
    provider.send_everyone=ambiguous
    user={'username':'owner','role':'Owner','event_id':'event-a'}
    with pytest.raises(HTTPException) as error:asyncio.run(server.notify_announcement('announcement-1','everyone',user))
    assert error.value.status_code==502
    assert ledger.rows[0]['status']=='requested'
    assert ledger.rows[0]['provider_campaign_id']=='ipm-everyone-delivery-1'
    with pytest.raises(HTTPException) as retry:asyncio.run(server.notify_announcement('announcement-1','everyone',user))
    assert retry.value.status_code==409 and len(ledger.rows)==1


def test_definitively_rejected_broadcast_retry_is_a_distinct_actual_attempt(monkeypatch):
    provider,ledger=configure_notification_fakes(monkeypatch,announcement())
    provider.fail=True;user={'username':'owner','role':'Owner','event_id':'event-a'}
    with pytest.raises(HTTPException):asyncio.run(server.notify_announcement('announcement-1','everyone',user))
    first=dict(provider.everyone_options)
    provider.fail=False
    asyncio.run(server.notify_announcement('announcement-1','everyone',user))
    assert first['campaign_id']!=provider.everyone_options['campaign_id']
    assert first['idempotency_key']!=provider.everyone_options['idempotency_key']
    assert campaign_identity(ledger.rows[1]['id'],'everyone')==provider.everyone_options['campaign_id']


def test_statistics_http_logging_never_exposes_credentials(monkeypatch,caplog):
    import logging
    original=httpx.AsyncClient
    def handler(request):
        assert request.url.path=='/v1/stats/reports'
        return httpx.Response(200,json={'success':True,'hasErrors':False,'bulkValues':[
            {'groups':[{'dimensions':{},'value':{'int':2}}]}]*4})
    monkeypatch.setattr(httpx,'AsyncClient',lambda **kw:original(transport=httpx.MockTransport(handler),**kw))
    with caplog.at_level(logging.INFO,logger='httpx'):
        values=asyncio.run(WonderPushClient(access_token='fixture-SECRET').get_campaign_statistics(
            'fixture-campaign',requested_at=NOW.isoformat()))
    assert values['provider_confirmed_receipt_count']==2
    assert 'fixture-SECRET' not in caplog.text and 'accessToken=' not in caplog.text


def test_future_send_identity_and_destination_across_announcements_and_tests(monkeypatch):
    """Exercise the actual send orchestration with a provider fake, never a live send."""
    from urllib.parse import urlsplit, parse_qs
    provider, ledger = configure_notification_fakes(monkeypatch, announcement())
    server.announcement_service.announcements[('event-a', 'announcement-2')] = {
        **announcement(), 'id': 'announcement-2'}
    user = {'username': 'owner', 'role': 'Owner', 'event_id': 'event-a'}
    identities, idempotency_keys = set(), set()
    for aid, audience in [('announcement-1', 'everyone'), ('announcement-2', 'everyone'),
                          ('announcement-1', 'test'), ('announcement-1', 'test')]:
        result = asyncio.run(server.notify_announcement(aid, audience, user))
        stored = ledger.rows[-1]
        options = provider.everyone_options if audience == 'everyone' else provider.test_options
        assert options['campaign_id'] == stored['provider_campaign_id'] == result.provider_campaign_id
        assert options['campaign_id'] == campaign_identity(stored['id'], audience)
        identities.add(options['campaign_id']); idempotency_keys.add(options['idempotency_key'])
        destination = urlsplit(stored['target_url'])
        assert destination.path == f'/announcements/{aid}'
        assert parse_qs(destination.query) == {'notification_ref': [stored['id']]}
        assert 'owner' not in destination.query and 'test-1' not in destination.query
    assert len(identities) == len(idempotency_keys) == 4
    with pytest.raises(HTTPException) as duplicate:
        asyncio.run(server.notify_announcement('announcement-1', 'everyone', user))
    assert duplicate.value.status_code == 409 and len(ledger.rows) == 4


def test_historical_explanation_requires_evidence_not_just_missing_counts():
    assert unattributed_history(delivery(provider_campaign_id='wonderpush:accepted', target_url='https://example.test/announcements/a'))
    assert not unattributed_history(delivery())  # A new send awaiting stats is not old history.
    assert not unattributed_history(delivery(status='requested', provider_campaign_id=None, target_url=''))
