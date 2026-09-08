import copy
from collections import Counter
from datetime import datetime
import json
import os
from pathlib import Path
import re
import uuid
import xml.etree.ElementTree as ET
import zipfile
from zoneinfo import ZoneInfo
import pytest
from backend import reconcile_landa_sept4 as core

EVENT = '11111111-1111-1111-1111-111111111111'

def snapshot():
    m = core.load_manifest()
    rows = []
    for item in m['items'] + m['withdrawals']:
        if 'baseline' not in item:
            continue
        rows.append(dict(item['baseline'], id=str(uuid.uuid5(uuid.UUID(EVENT), item['external_id'])),
            event_id=EVENT, external_id=item['external_id'], source=core.SOURCE,
            description='Preserved bio, image https://example.invalid/image.jpg and deep link',
            location_id=None, latitude=44.0, longitude=-81.0, timezone='America/Toronto',
            category=core.CATEGORY, status='published', sort_order=len(rows),
            created_at='2026-08-22T00:00:00+00:00', updated_at='2026-08-22T00:00:00+00:00'))
    rows.append(dict(rows[0], id=str(uuid.uuid5(uuid.UUID(EVENT),'unrelated')),external_id='unrelated',
        category='Unrelated entertainment',source='admin'))
    return rows


def test_authoritative_workbook_exact_coverage_dates_times_and_stages():
    m = core.load_manifest(); actual = {i['cell']: i['proposed'] for i in m['items']}
    ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(core.ROOT/'schedule.xlsx') as z:
        strings=[''.join(x.itertext()) for x in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',ns)]
        tree=ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    day=None; seen=[]
    for row in tree.findall('.//s:sheetData/s:row',ns):
        cells={}
        for c in row:
            v=c.find('s:v',ns)
            if v is not None:cells[re.sub(r'\d','',c.attrib['r'])]=strings[int(v.text)] if c.attrib.get('t')=='s' else v.text
        for col in ['A','C','E']:
            match=re.search(r'(\d\d)Sep2026',cells.get(col,''))
            if match:day='2026-09-'+match[1]
        for a,b,stage in [('A','B','The Beyond Wireless Stage'),('C','D',"Harley's Pub & Perk - Stage"),('E','F','Quality Homes - Stage')]:
            times=re.findall(r'(\d{1,2}):(\d{2})',cells.get(a,''))
            if len(times)!=2:continue
            cell=b+row.attrib['r'];seen.append(cell);desired=actual[cell]
            assert desired['location_name']==stage
            for field,(hour,minute) in zip(['starts_at','ends_at'],times):
                hour=int(hour);hour=hour+12 if hour<9 else hour
                dt=datetime.fromisoformat(desired[field])
                assert dt.date().isoformat()==day and (dt.hour,dt.minute)==(hour,int(minute))
                assert dt.utcoffset().total_seconds()==-14400
    assert set(seen)==set(actual) and len(seen)==116
    assert Counter(x['days_active'] for x in actual.values())==dict(Tuesday=30,Wednesday=26,Thursday=27,Friday=29,Saturday=4)


def test_exact_counts_idempotency_and_unrelated_preservation():
    rows=snapshot();before=copy.deepcopy(rows);p=core.plan(rows,EVENT)
    assert p['summary']==dict(unchanged=30,updated=67,added=19,withdrawn=10,active=116)
    assert rows==before
    assert p['result'][-20]==rows[-1]
    again=core.plan(p['result'],EVENT)
    assert again['summary']==dict(unchanged=116,updated=0,added=0,withdrawn=0,active=116)


def test_retained_and_archived_ids_bios_images_maps_sources_never_repurposed():
    rows=snapshot();p=core.plan(rows,EVENT);after={r['id']:r for r in p['result']}
    allowed=set(core.FIELDS)|{'status'}
    for old in rows:
        assert all(after[old['id']][k]==v for k,v in old.items() if k not in allowed)
    for anchor in ['2026-09-22-foodland-b14','2026-09-22-harleys-c16','2026-09-24-foodland-h31','2026-09-22-quality-homes-d26']:
        old=next(r for r in rows if r['external_id']==anchor)
        assert after[old['id']]==dict(old,status='archived')
    new=[r for r in p['inserts'] if 'Carrick' in r['title'] or 'Soul Journey' in r['title']]
    assert len(new)==5
    assert not {r['id'] for r in new}&{r['id'] for r in rows}
    assert all(r['description'] is None for r in new if 'Carrick' in r['title'])
    assert all('Jen' in r['description'] for r in new if 'Soul Journey' in r['title'])


def test_corrected_names_brewery_moves_and_saturday():
    rows=core.plan(snapshot(),EVENT)['result'];active=[r for r in rows if r['category']==core.CATEGORY and r['status']=='published']
    for title in ['Hayley Wilhelm MUA','Forest Maiden Facial & Beauty Room','Flossie Mae']:
        assert sum(r['title']==title for r in active)==2
    for anchor,day in [('2026-09-25-quality-homes-m27','Wednesday'),('2026-09-23-quality-homes-g27','Thursday'),('2026-09-24-quality-homes-j31','Friday')]:
        assert next(r for r in active if r['external_id']==anchor)['days_active']==day
    sat=sorted([r for r in active if r['days_active']=='Saturday'],key=lambda r:datetime.fromisoformat(r['starts_at']))
    assert [(datetime.fromisoformat(r['starts_at']).astimezone(ZoneInfo('America/Toronto')).strftime('%H:%M'),datetime.fromisoformat(r['ends_at']).astimezone(ZoneInfo('America/Toronto')).strftime('%H:%M')) for r in sat]==[('09:00','10:00'),('10:00','11:00'),('12:30','13:30'),('13:30','14:30')]
    assert all(r['location_name']=="Harley's Pub & Perk - Stage" for r in sat)

@pytest.mark.parametrize('problem',['missing','duplicate','wrong-source','changed-time','changed-title','extra-lifestyles','wrong-event'])
def test_unreviewed_edits_fail_closed(problem):
    rows=snapshot()
    if problem=='missing':rows.pop(0)
    if problem=='duplicate':rows.append(dict(rows[0],id=str(uuid.uuid4())))
    if problem=='wrong-source':rows[0]['source']='unreviewed'
    if problem=='changed-time':rows[0]['starts_at']='2026-09-22T07:00:00-04:00'
    if problem=='changed-title':rows[0]['title']='A different presenter'
    if problem=='extra-lifestyles':rows.append(dict(rows[0],external_id='new-unreviewed',id=str(uuid.uuid4())))
    if problem=='wrong-event':rows[0]['event_id']=str(uuid.uuid4())
    with pytest.raises(core.Conflict):core.plan(rows,EVENT)


def test_newer_bios_and_admin_heather_identity_are_preserved():
    rows=snapshot();row=next(r for r in rows if r['external_id']=='2026-09-23-foodland-e21')
    row['source']='admin';row['description']='A newer deliberate biography'
    p=core.plan(rows,EVENT)
    assert next(r for r in p['result'] if r['id']==row['id'])==row


DSN=os.environ.get('IPM_LANDA_TEST_DSN')
@pytest.fixture
def pg():
    if not DSN:pytest.skip('Requires disposable local PostgreSQL')
    assert '127.0.0.1:55439/ipm_landa_sept4' in DSN
    import psycopg
    with psycopg.connect(DSN,autocommit=True) as c:
        c.execute('truncate schedule_items,events cascade')
        c.execute('insert into events values(%s,%s)',(EVENT,'ipm-staging'))
        rows=snapshot()
        c.execute('insert into schedule_items select * from jsonb_populate_recordset(null::schedule_items,%s::jsonb)',(json.dumps(rows),))
        yield c


def test_postgres_transaction_exact_result_and_rerun(pg):
    rows=pg.execute('select to_jsonb(s) from schedule_items s order by sort_order').fetchall();rows=[r[0] for r in rows]
    p=core.plan(rows,EVENT);pg.execute(core.sql_release(rows,p,EVENT,'ipm-staging'))
    result=[r[0] for r in pg.execute('select to_jsonb(s) from schedule_items s').fetchall()]
    expected={r['id']:r for r in p['result']}
    for row in result:
        for k,v in expected[row['id']].items():assert core.equal(row[k],v,k)
    again=core.plan(result,EVENT);assert not again['updates'] and not again['inserts']
    pg.execute(core.sql_release(result,again,EVENT,'ipm-staging'))
    assert pg.execute("select count(*) from schedule_items where status='archived'").fetchone()[0]==10


def test_postgres_concurrent_content_edit_aborts_all_mutation(pg):
    import psycopg
    rows=[r[0] for r in pg.execute('select to_jsonb(s) from schedule_items s').fetchall()]
    release=core.sql_release(rows,core.plan(rows,EVENT),EVENT,'ipm-staging')
    pg.execute("update schedule_items set description='New organizer edit' where external_id='unrelated'")
    with pytest.raises(psycopg.Error,match='changed since preflight'):pg.execute(release)
    pg.execute('rollback')
    assert pg.execute('select count(*) from schedule_items').fetchone()[0]==108
    assert pg.execute("select count(*) from schedule_items where status='archived'").fetchone()[0]==0
    assert pg.execute("select description from schedule_items where external_id='unrelated'").fetchone()[0]=='New organizer edit'


def test_postgres_wrong_event_slug_aborts(pg):
    import psycopg
    rows=[r[0] for r in pg.execute('select to_jsonb(s) from schedule_items s').fetchall()]
    with pytest.raises(psycopg.Error,match='Wrong schedule event'):
        pg.execute(core.sql_release(rows,core.plan(rows,EVENT),EVENT,'ipm-2026'))
    pg.execute('rollback')
    assert pg.execute('select count(*) from schedule_items').fetchone()[0]==108


def test_sql_snapshot_delimiters_fail_closed_and_quotes_are_escaped():
    rows=snapshot();rows[0]['description']="Presenter's biography"
    release=core.sql_release(rows,core.plan(rows,EVENT),EVENT,'ipm-staging')
    assert "Presenter''s biography" in release
    rows[0]['description']='$guard$ arbitrary biography'
    with pytest.raises(core.Conflict):core.sql_release(rows,core.plan(rows,EVENT),EVENT,'ipm-staging')
