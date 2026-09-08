import copy
import json
import os
from pathlib import Path
import pytest
from backend import promote_approved_schedule as core

@pytest.fixture
def snapshots():
    paths=[os.environ.get(k) for k in ['IPM_PROMOTION_PRODUCTION_SNAPSHOT','IPM_PROMOTION_STAGING_SNAPSHOT']]
    if not all(paths):pytest.skip('Supply the reviewed production and staging snapshot paths')
    return [json.loads(Path(p).read_text()) for p in paths]


def test_exact_approved_delta_and_production_identity_preservation(snapshots):
    p,s=snapshots;before=copy.deepcopy(p);r=core.plan(p,p,s)
    assert r['summary']==dict(updated=67,added=77,archived=10,unchanged=74,active=218,unrelated_diff=0,production_only_lost=0,duplicates=0,tentative_excluded=9,original_uuids_preserved=151,mandatory_preservations=5)
    assert len(r['inserts'])==77 and len(r['updates'])==77
    actual=core.keyed(r['result'])
    for row in p:assert actual[row['external_id']]['id']==row['id']
    assert p==before
    assert core.verify(r['result'],p,s)['active']==218
    assert not core.plan(r['result'],p,s)['updates'] and not core.plan(r['result'],p,s)['inserts']


@pytest.mark.parametrize('ext',list(core.PRESERVE))
def test_each_mandatory_production_field_preserved(snapshots,ext):
    p,s=snapshots;r=core.plan(p,p,s);field,required=core.PRESERVE[ext]
    actual=core.keyed(r['result'])[ext];original=core.keyed(p)[ext]
    assert actual[field]==original[field] and required in actual[field]
    assert actual['id']==original['id']
    if field=='title':assert actual['status']=='archived'


@pytest.mark.parametrize('kind',['unrelated_description','missing_existing','duplicate','new_category'])
def test_unapproved_staging_difference_stops_before_sql(snapshots,kind):
    p,s=snapshots;s=copy.deepcopy(s)
    if kind=='unrelated_description':s[0]['description']='Not approved'
    if kind=='missing_existing':s=[r for r in s if r['external_id']!=p[0]['external_id']]
    if kind=='duplicate':s[-1]['external_id']=s[0]['external_id']
    if kind=='new_category':s[-1]['category']='Unapproved category'
    with pytest.raises(ValueError):core.sql_release(p,p,s)


@pytest.fixture
def pg(snapshots):
    import psycopg
    from psycopg.types.json import Jsonb
    dsn=os.environ.get('IPM_PROMOTION_TEST_DSN')
    if not dsn:pytest.skip('Supply disposable local PostgreSQL DSN')
    c=psycopg.connect(dsn,autocommit=True)
    assert c.info.host in ('localhost','127.0.0.1') and c.info.dbname=='ipm_schedule_promotion'
    c.execute('''create table if not exists events(id uuid primary key,slug text unique);
create table if not exists schedule_items(id uuid primary key,event_id uuid references events(id),location_id uuid,title text,description text,starts_at timestamptz,ends_at timestamptz,timezone text,category text,location_name text,latitude double precision,longitude double precision,days_active text,source text,external_id text,status text,sort_order integer,created_at timestamptz default now(),updated_at timestamptz default now());
create unique index if not exists schedule_external on schedule_items(event_id,source,external_id) where external_id is not null;
truncate schedule_items,events;''')
    c.execute('insert into events values (%s,%s)',(core.EVENT,'ipm-2026'))
    c.execute('insert into schedule_items select * from jsonb_populate_recordset(null::schedule_items,%s)',(Jsonb(snapshots[0]),))
    yield c
    c.close()


def read(c):return c.execute("select jsonb_agg(to_jsonb(s) order by id) from schedule_items s").fetchone()[0]


def test_real_pg_exact_promotion_preservation_and_idempotency(pg,snapshots):
    p,s=snapshots;before=read(pg)
    pg.execute(core.sql_release(before,before,s))
    after=read(pg);assert core.verify(after,before,s)['active']==218
    pg.execute(core.sql_release(after,before,s))
    assert read(pg)==after


def test_real_pg_stale_snapshot_aborts_all_writes(pg,snapshots):
    import psycopg
    p,s=snapshots;sql=core.sql_release(p,p,s)
    pg.execute("update schedule_items set description='Concurrent edit' where id=%s",(p[0]['id'],))
    before=read(pg)
    with pytest.raises(psycopg.Error,match='changed since preflight'):pg.execute(sql)
    pg.execute('rollback');assert read(pg)==before


def test_real_pg_failed_final_assertion_rolls_back_updates_inserts_archives(pg,snapshots):
    import psycopg
    p,s=snapshots;before=read(pg);sql=core.sql_release(p,p,s)
    # Local fault injection proves a failed final verification aborts the whole delta.
    sql=sql.replace('DO $promotion$',f"UPDATE schedule_items SET title='Injected failure' WHERE id='{p[0]['id']}'::uuid;\nDO $promotion$",1)
    with pytest.raises(psycopg.Error,match='does not match approved delta'):pg.execute(sql)
    pg.execute('rollback');assert read(pg)==before


def test_real_pg_wrong_event_slug_denied(pg,snapshots):
    import psycopg
    p,s=snapshots;pg.execute("update events set slug='ipm-staging'")
    before=read(pg)
    with pytest.raises(psycopg.Error,match='Wrong schedule event'):pg.execute(core.sql_release(p,p,s))
    pg.execute('rollback');assert read(pg)==before
