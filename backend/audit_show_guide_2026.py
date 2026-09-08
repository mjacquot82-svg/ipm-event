"""Read-only Show Guide accounting; never connects to or writes a service."""
import argparse
from collections import Counter
import json
from pathlib import Path
from backend import reconcile_landa_sept4 as landa

MANIFEST = Path(__file__).parent / 'import_manifests/show_guide_2026/audit.json'
COUNTS = {'MATCHED_EXISTING': 98, 'MATCHED_EXISTING_WITH_NEWER_IPM_CORRECTION': 11,
          'CATEGORY_AMBIGUOUS': 73, 'NOT_AN_APP_SCHEDULE_EVENT': 24}
COVERAGE = {'ram_corral': 21, 'event_centre': 16, 'lumberjack': 15, 'plowing': 14, 'worship': 1}


def load_manifest():
    return json.loads(MANIFEST.read_text())


def require(condition, message):
    if not condition:
        raise ValueError(message)


def audit(rows, baseline, manifest=None):
    """Validate the zero-addition decision and preserve every complete baseline row."""
    m = manifest or load_manifest()
    entries = m['entries']
    require(Counter(e['classification'] for e in entries) == COUNTS, 'Unreviewed classification totals')
    require(Counter(e['occurrence'] for e in entries) == {'primary': 172, 'supplemental': 10, 'context': 24}, 'Source accounting changed')
    require(len({e['key'] for e in entries}) == len(entries), 'Duplicate source reference')
    references = {e['key']: e for e in entries}
    for e in entries:
        if e['duplicate_of']:
            target = references[e['duplicate_of']]
            require(target['occurrence'] == 'primary' and e['date'] == target['date']
                    and e['start'] == target['start'] and e['external_id'] == target['external_id'], 'Invalid repeated reference')
        if e['classification'].startswith('MATCHED_EXISTING'):
            require(e['category'] in m['categories'], 'Invalid matched category')
        else:
            require(e['category'] is None, 'Unreviewed category assignment')
    coverage = Counter(e['family'] for e in entries if e['classification'] == 'CATEGORY_AMBIGUOUS' and not e['duplicate_of'])
    require(coverage == COVERAGE, 'Missing-category coverage changed')
    require(len(rows) == len(baseline) == 170, 'Staging record count changed')
    require(len({r['id'] for r in rows}) == len(rows), 'Duplicate record ID')
    require({r['id']: r for r in rows} == {r['id']: r for r in baseline}, 'Existing record/content changed')
    require(len({r['event_id'] for r in rows}) == 1, 'Cross-event snapshot')
    require(set(r['category'] for r in rows) == set(m['categories']), 'Taxonomy changed')
    require(len({(r['source'], r['external_id']) for r in rows}) == len(rows), 'Duplicate external identity')
    by = {r['external_id']: r for r in rows}
    for e in entries:
        if e.get('expected'):
            r = by.get(e['external_id'])
            require(r is not None and all(landa.equal(r.get(k), v, k) for k, v in e['expected'].items()), 'Matched record drift: ' + e['key'])
    result = landa.plan(rows, rows[0]['event_id'])
    require(result['summary'] == dict(unchanged=116, updated=0, added=0, withdrawn=0, active=116), 'Landa source differs')
    active = [r for r in rows if r['status'] != 'archived']
    signatures = [(r['title'].casefold(), r['starts_at'], r['ends_at'], r['location_name']) for r in active]
    require(len(set(signatures)) == len(signatures), 'Duplicate active session')
    require(Counter(r['category'] for r in active) == dict(zip(m['categories'], [116, 17, 16, 6, 5])), 'Category filter counts changed')
    return dict(reviewed=len(entries), classifications=dict(COUNTS), missing_category_coverage=dict(coverage),
                additions=0, active_records=len(active), landa_active=116, withdrawn_preserved=10,
                all_baseline_fields_preserved=True, duplicates=0, category_counts=dict(Counter(r['category'] for r in active)))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('snapshot', type=Path)
    parser.add_argument('--baseline', required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(audit(json.loads(args.snapshot.read_text()), json.loads(args.baseline.read_text())), indent=2))
