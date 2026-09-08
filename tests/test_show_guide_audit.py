"""Accounting and preservation regressions; live snapshots remain local artifacts."""
import copy
import json
import os
from pathlib import Path
from collections import Counter
import pytest
from backend import audit_show_guide_2026 as core


def test_every_source_reference_accounted_once():
    entries = core.load_manifest()['entries']
    assert len(entries) == len({e['key'] for e in entries}) == 206
    assert Counter(e['classification'] for e in entries) == core.COUNTS
    assert Counter(e['occurrence'] for e in entries) == dict(primary=172, supplemental=10, context=24)


def test_missing_category_counts_are_sessions_not_repeated_mentions():
    entries = core.load_manifest()['entries']
    missing = [e for e in entries if e['classification'] == 'CATEGORY_AMBIGUOUS']
    assert len(missing) == 73
    assert Counter(e['family'] for e in missing if not e['duplicate_of']) == core.COVERAGE
    assert sum(bool(e['duplicate_of']) for e in missing) == 6
    assert all(e['category'] is None for e in missing)
    assert sum(e['tentative'] for e in missing if not e['duplicate_of']) == 9


def test_withdrawn_printed_sessions_are_not_additions_or_repurposed():
    entries = core.load_manifest()['entries']
    archived = [e for e in entries if e.get('expected', {}).get('status') == 'archived']
    assert len(archived) == 2
    assert all(e['classification'] == 'MATCHED_EXISTING_WITH_NEWER_IPM_CORRECTION' for e in archived)
    assert any('Greenock' in e['title'] for e in archived)
    assert any('Southampton' in e['title'] for e in archived)
    assert not any(e['classification'] == 'ADD_MISSING' for e in entries)


@pytest.fixture
def rows():
    path = os.environ.get('IPM_SHOW_GUIDE_SNAPSHOT')
    if not path:
        pytest.skip('Set IPM_SHOW_GUIDE_SNAPSHOT to the read-only staging snapshot')
    return json.loads(Path(path).read_text())


def test_actual_staging_matches_audit_and_all_landa_items(rows):
    before = copy.deepcopy(rows)
    result = core.audit(rows, before)
    assert result['landa_active'] == 116 and result['active_records'] == 160
    assert rows == before and result['all_baseline_fields_preserved']


@pytest.mark.parametrize('field,value', [('description','Lost biography'), ('category','Invented category'), ('id','replacement-id'), ('status','archived')])
def test_any_existing_content_identity_or_category_change_rejected(rows, field, value):
    changed = copy.deepcopy(rows)
    changed[0][field] = value
    with pytest.raises(ValueError, match='Existing record/content changed'):
        core.audit(changed, rows)


def test_duplicate_insertion_rejected(rows):
    with pytest.raises(ValueError, match='record count changed'):
        core.audit(rows + [copy.deepcopy(rows[0])], rows)


def test_no_ambiguous_event_can_be_silently_reclassified(rows):
    m = core.load_manifest()
    next(e for e in m['entries'] if e['classification'] == 'CATEGORY_AMBIGUOUS')['classification'] = 'ADD_MISSING'
    with pytest.raises(ValueError, match='classification totals'):
        core.audit(rows, rows, m)


def test_landa_drift_detected_even_with_changed_snapshot_baseline(rows):
    changed = copy.deepcopy(rows)
    next(r for r in changed if r['title'] == 'Hayley Wilhelm MUA')['title'] = 'MakeUp Artist'
    with pytest.raises(ValueError, match='Matched record drift|Unreviewed schedule edit'):
        core.audit(changed, changed)


def test_real_postgresql_read_only_accounting(rows):
    dsn = os.environ.get('IPM_SHOW_GUIDE_TEST_DSN')
    if not dsn:
        pytest.skip('Set IPM_SHOW_GUIDE_TEST_DSN to disposable local PostgreSQL')
    import psycopg
    from psycopg.types.json import Jsonb
    # Only the disposable local fixture is written. All audit reads run READ ONLY.
    with psycopg.connect(dsn) as conn:
        assert conn.info.host in ('127.0.0.1', 'localhost')
        assert conn.info.dbname == 'ipm_show_guide_audit'
        conn.execute('create table if not exists audit_snapshot (id text primary key, record jsonb not null)')
        conn.execute('truncate audit_snapshot')
        conn.cursor().executemany('insert into audit_snapshot values (%s,%s)', [(r['id'], Jsonb(r)) for r in rows])
    with psycopg.connect(dsn) as conn:
        conn.execute('set transaction read only')
        before = [r[0] for r in conn.execute('select record from audit_snapshot order by id')]
        result = core.audit(before, rows)
        after = [r[0] for r in conn.execute('select record from audit_snapshot order by id')]
        assert before == after and result['additions'] == 0
        assert conn.execute("select current_setting('transaction_read_only')").fetchone()[0] == 'on'
        categories = dict(conn.execute("select record->>'category', count(*) from audit_snapshot where record->>'status' <> 'archived' group by 1"))
        assert categories == result['category_counts']
