import copy
from collections import Counter
from datetime import datetime
import json
import os
from pathlib import Path
from zoneinfo import ZoneInfo
import pytest
from backend import expand_show_guide_schedule as core


def test_all_67_accounted_and_only_58_public_rows_authorized():
    m = core.load_manifest()
    assert len(m['entries']) == 67
    wanted = core.desired_rows()
    assert len(wanted) == len({r['id'] for r in wanted}) == len({r['external_id'] for r in wanted}) == 58
    assert Counter(r['category'] for r in wanted) == core.COUNTS
    assert wanted == core.desired_rows()
    assert all(r['ends_at'] is None and r['latitude'] is None and r['longitude'] is None and r['location_id'] is None for r in wanted)
    assert all(r['location_name'] is None for r in wanted if r['category']=='Great Canadian Lumberjack Show')


def test_dates_times_source_mapping_and_tentative_exclusions():
    wanted = {r['external_id']:r for r in core.desired_rows()}
    for e in core.load_manifest()['entries']:
        if e['tentative']:
            assert e['external_id'] not in wanted
            continue
        r = wanted[e['external_id']]
        dt = datetime.fromisoformat(r['starts_at']).astimezone(ZoneInfo('America/Toronto'))
        assert dt.date().isoformat() == e['date'] and dt.strftime('%H:%M') == e['start']
        assert dt.strftime('%A') == r['days_active']
    assert not any('Lawn Mower' in r['title'] or 'VIP Plowing' in r['title'] for r in wanted.values())


@pytest.fixture
def rows():
    path = os.environ.get('IPM_SHOW_GUIDE_SNAPSHOT')
    if not path:pytest.skip('Set IPM_SHOW_GUIDE_SNAPSHOT to authoritative staging snapshot')
    return json.loads(Path(path).read_text())


def test_insert_only_idempotent_and_all_original_content_preserved(rows):
    before = copy.deepcopy(rows)
    p = core.plan(rows, before)
    assert p['summary']['added'] == 58 and p['summary']['active'] == 218
    assert not p['updates'] and p['result'][:170] == before and rows == before
    assert core.plan(p['result'], before)['summary']['added'] == 0


@pytest.mark.parametrize('kind', ['wrong_event','original_drift','import_drift','duplicate','unreviewed_import'])
def test_conflicts_fail_closed(rows, kind):
    changed = copy.deepcopy(rows)
    if kind=='wrong_event':changed[0]['event_id']='00000000-0000-0000-0000-000000000001'
    if kind=='original_drift':changed[0]['description']='Overwritten'
    if kind=='import_drift':changed=core.plan(rows,rows)['result'];changed[-1]['category']='Wrong category'
    if kind=='duplicate':changed.append(copy.deepcopy(changed[0]))
    if kind=='unreviewed_import':changed.append(dict(core.desired_rows()[0],external_id='unreviewed'))
    with pytest.raises(ValueError):core.plan(changed,rows)


@pytest.fixture
def pg(rows):
    dsn=os.environ.get('IPM_EXPANSION_TEST_DSN')
    if not dsn:pytest.skip('Set IPM_EXPANSION_TEST_DSN to disposable local PostgreSQL')
    import psycopg
    from psycopg.types.json import Jsonb
    conn=psycopg.connect(dsn,autocommit=True)
    assert conn.info.host in ('localhost','127.0.0.1') and conn.info.dbname=='ipm_category_expansion'
    conn.execute('''create table if not exists events(id uuid primary key,slug text unique);
create table if not exists schedule_items(id uuid primary key,event_id uuid references events(id),location_id uuid,title text,description text,starts_at timestamptz,ends_at timestamptz,timezone text,category text,location_name text,latitude double precision,longitude double precision,days_active text,source text,external_id text,status text,sort_order integer,created_at timestamptz default now(),updated_at timestamptz default now());
create unique index if not exists schedule_external on schedule_items(event_id,source,external_id) where external_id is not null;
truncate schedule_items,events;''')
    conn.execute('insert into events values (%s,%s)',(core.EVENT,'ipm-staging'))
    conn.execute('insert into schedule_items select * from jsonb_populate_recordset(null::schedule_items,%s)',(Jsonb(rows),))
    yield conn
    conn.close()


def read_pg(pg):
    return pg.execute("select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]') from schedule_items s").fetchone()[0]


def test_postgresql_atomic_insert_exact_rows_and_idempotent_rerun(pg,rows):
    before=read_pg(pg)
    pg.execute(core.sql_release(before,before))
    after=read_pg(pg)
    assert len(after)==228
    assert core.plan(after,before)['summary']['added']==0
    assert {r['id']:r for r in after if r['source']!=core.SOURCE}=={r['id']:r for r in before}
    pg.execute(core.sql_release(after,before))
    assert read_pg(pg)==after
    assert dict(pg.execute("select category,count(*) from schedule_items where source=%s group by 1",(core.SOURCE,)))==core.COUNTS


def test_postgresql_stale_snapshot_aborts_before_insert(pg,rows):
    import psycopg
    sql=core.sql_release(rows,rows)
    pg.execute("update schedule_items set description='Concurrent reviewed edit' where id=%s",(rows[0]['id'],))
    with pytest.raises(psycopg.Error,match='changed since preflight'):pg.execute(sql)
    pg.execute('rollback')
    assert len(read_pg(pg))==170
    assert pg.execute('select count(*) from schedule_items where source=%s',(core.SOURCE,)).fetchone()[0]==0


def test_postgresql_wrong_slug_aborts_without_insert(pg,rows):
    import psycopg
    pg.execute("update events set slug='ipm-2026'")
    with pytest.raises(psycopg.Error,match='Wrong schedule event'):pg.execute(core.sql_release(rows,rows))
    pg.execute('rollback')
    assert len(read_pg(pg))==170
