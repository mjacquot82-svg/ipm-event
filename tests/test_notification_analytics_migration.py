"""Run the ORIGINAL migration in disposable PostgreSQL, never staging/production."""
import subprocess
import time
from pathlib import Path
from uuid import uuid4
import pytest

ROOT=Path(__file__).resolve().parents[1]
MIGRATION=(ROOT/'supabase/migrations/20260918000200_accurate_notification_analytics.sql').read_text()
BASE='''create table public.events(id uuid primary key);
create table public.alerts(id uuid primary key,event_id uuid references public.events(id));
'''+(ROOT/'docs/platform/phase1a_notification_deliveries_migration.sql').read_text()
HISTORY='''insert into events values ('00000000-0000-4000-8000-000000000001');
insert into alerts values ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001');
insert into notification_deliveries(event_id,announcement_id,audience,requested_by,target_url,notification_title,notification_message,status,provider_campaign_id,sent_at)
values ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','everyone','fixture','/announcements/fixture','fixture','fixture','sent','legacy',now());
'''

@pytest.fixture(scope='module')
def postgres():
    name='ipm-analytics-migration-'+uuid4().hex[:10]
    subprocess.run(['docker','run','-d','--name',name,'--network','none','--tmpfs','/var/lib/postgresql/data',
        '-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine'],check=True,capture_output=True)
    try:
        for _ in range(60):
            if subprocess.run(['docker','exec',name,'pg_isready','-h','127.0.0.1','-U','postgres'],capture_output=True).returncode==0:break
            time.sleep(.2)
        else:raise RuntimeError('Isolated PostgreSQL did not start')
        def sql(query):
            return subprocess.run(['docker','exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-tA'],
                input=query,text=True,capture_output=True)
        yield sql
    finally:
        subprocess.run(['docker','rm','-f',name],check=True,capture_output=True)


def run(postgres,body):
    result=postgres('begin;'+BASE+body+'rollback;')
    assert result.returncode==0,result.stderr
    return result.stdout


def test_original_migration_on_fresh_database(postgres):
    assert '13' in run(postgres,MIGRATION+"select count(*) from information_schema.columns where table_name='notification_deliveries' and column_name in ('provider_delivery_id','provider_requested_at','provider_accepted_at','provider_targeted_device_count','provider_sent_count','provider_confirmed_receipt_count','provider_failure_count','provider_open_count','provider_unique_open_count','provider_statistics_refreshed_at','provider_statistics_status','provider_statistics_error','notification_origin_visit_count');")


def test_all_new_columns_nullable_without_default(postgres):
    result=run(postgres,MIGRATION+"select count(*) from information_schema.columns where table_name='notification_deliveries' and column_name in ('provider_delivery_id','provider_requested_at','provider_accepted_at','provider_targeted_device_count','provider_sent_count','provider_confirmed_receipt_count','provider_failure_count','provider_open_count','provider_unique_open_count','provider_statistics_refreshed_at','provider_statistics_status','provider_statistics_error','notification_origin_visit_count') and is_nullable='YES' and column_default is null;")
    assert '\n13\n' in result


def test_historical_accepted_row_unchanged_unknowns_null(postgres):
    result=run(postgres,HISTORY+MIGRATION+"select status,provider_campaign_id,provider_targeted_device_count is null,provider_sent_count is null,provider_confirmed_receipt_count is null,provider_open_count is null,notification_origin_visit_count is null from notification_deliveries;")
    assert 'sent|legacy|t|t|t|t|t' in result


def test_original_migration_is_idempotent_locally(postgres):
    run(postgres,HISTORY+MIGRATION+MIGRATION)


def test_existing_concurrency_and_scope_constraints_retained(postgres):
    # Successful broadcast cannot be duplicated; cross-event FK still enforced.
    result=postgres('begin;'+BASE+HISTORY+MIGRATION+'insert into notification_deliveries'+HISTORY.split('insert into notification_deliveries')[1]+'rollback;')
    assert result.returncode!=0 and 'notification_deliveries_one_active_everyone_idx' in result.stderr
    postgres('rollback;')


def test_transactional_rollback_restores_original_schema(postgres):
    result=run(postgres,'savepoint migration;'+MIGRATION+'rollback to migration;'+"select count(*) from information_schema.columns where table_name='notification_deliveries' and column_name='provider_sent_count';")
    assert '\n0\n' in result


def test_event_scope_foreign_key_and_existing_indexes(postgres):
    body=HISTORY+MIGRATION+"insert into events values ('00000000-0000-4000-8000-000000000003'); update notification_deliveries set event_id='00000000-0000-4000-8000-000000000003';"
    result=postgres('begin;'+BASE+body+'rollback;')
    assert result.returncode!=0 and 'notification_delivery_event_announcement_fk' in result.stderr
    result=run(postgres,MIGRATION+"select indexname from pg_indexes where tablename='notification_deliveries';")
    assert 'notification_deliveries_event_announcement_idx' in result
    assert 'notification_deliveries_one_active_everyone_idx' in result
