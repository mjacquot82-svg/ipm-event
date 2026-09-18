from copy import deepcopy
from datetime import timedelta
import asyncio
import pytest
from backend.notification_analytics import aggregate_reminder_ledger, read_reminder_ledger, reminder_summary
from tests.test_notification_analytics_completion import NOW


def star(**overrides):
    return {'registration_id':'r1','schedule_item_id':'s1','starred_at':(NOW-timedelta(hours=2)).isoformat(),
            'registration':{'reminders_enabled':True,'provider_deliverable':True,'provider_reachability':'optIn',
                            'provider_has_push_token':True,'provider_checked_at':NOW.isoformat()},
            'item':{'status':'published','starts_at':(NOW+timedelta(minutes=28)).isoformat()},**overrides}


def test_aggregate_claim_attempt_outcomes_no_double_count_or_secrets():
    deliveries=[{'registration_id':f'r{i}','schedule_item_id':'s1','status':status,'attempt_count':1,'batch_id':'b1'}
        for i,status in enumerate(['claimed','provider_accepted','provider_failed','delivery_unknown'])]
    result=aggregate_reminder_ledger([star()],deliveries,[{'attempt_count':2}],NOW)
    assert result['normal_claims']==4 and result['provider_attempts']==2
    assert result['provider_accepted']==result['provider_failed']==result['delivery_unknown']==1
    assert result['due_reminders']==0 and result['duplicate_eligible_interests']==1
    assert result['duplicates_suppressed'] is None
    assert not any(k in str(result) for k in ['registration_id','batch_id','push_token','capability','r1'])


@pytest.mark.parametrize('minutes,expected', [(25,0),(25.001,1),(30,1),(30.001,0)])
def test_due_window_matches_existing_claim_sql(minutes,expected):
    row=star(item={'status':'published','starts_at':(NOW+timedelta(minutes=minutes)).isoformat()})
    assert aggregate_reminder_ledger([row],[],[],NOW)['due_reminders']==expected


@pytest.mark.parametrize('field,value', [('reminders_enabled',False),('provider_deliverable',False),
    ('provider_reachability','optOut'),('provider_has_push_token',False),
    ('provider_checked_at',(NOW-timedelta(minutes=15)).isoformat())])
def test_due_readiness_fails_closed(field,value):
    row=star();row['registration'][field]=value
    assert aggregate_reminder_ledger([row],[],[],NOW)['due_reminders']==0


def test_late_stars_retry_budget_cancelled_and_stale():
    late=star(starred_at=NOW.isoformat());cancelled=star(item={'status':'archived','starts_at':NOW.isoformat()})
    assert aggregate_reminder_ledger([late,cancelled],[],[],NOW)['stale_interests']==1
    assert aggregate_reminder_ledger([late],[],[],NOW)['due_reminders']==0
    row={'registration_id':'r1','schedule_item_id':'s1','status':'provider_failed','attempt_count':2,'next_attempt_at':NOW.isoformat()}
    assert aggregate_reminder_ledger([star()],[row],[],NOW)['due_reminders']==1
    row['attempt_count']=3
    assert aggregate_reminder_ledger([star()],[row],[],NOW)['due_reminders']==0


def test_snapshot_reads_only_event_scoped_ledger_and_no_scheduler():
    calls=[]
    class Repo:
        async def _event_id(self):return 'event-staging'
        @property
        def client(self):return self
        async def request(self,method,path,params):
            calls.append((method,path,params));return []
    result=asyncio.run(read_reminder_ledger(Repo(),NOW))
    assert result['normal_claims']==0
    assert all(method=='GET' and not path.startswith('/rpc/') for method,path,_ in calls)
    assert all('eq.event-staging' in params.values() for _,_,params in calls)
    assert all('capability_hash' not in params['select'] and 'wonderpush_installation_id' not in params['select'] for _,_,params in calls)


def test_unknown_durable_counters_remain_unknown():
    result=reminder_summary({'synchronized_stars':0,'provider_accepted':2,'capability_hash':'SECRET'})
    assert result['synchronized_interests']==0 and result['provider_accepted']==2
    assert result['duplicates_suppressed'] is None and result['removed_interests'] is None
    assert 'SECRET' not in str(result)
