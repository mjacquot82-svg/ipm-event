"""Offline, staging-only insert planner for reviewed public Show Guide sessions."""
import argparse
import copy
from collections import Counter
import json
from pathlib import Path
import uuid
from backend import audit_show_guide_2026 as prior
from backend import reconcile_landa_sept4 as landa

ROOT = Path(__file__).parent / 'import_manifests/show_guide_expansion'
SOURCE = 'ipm_show_guide_2026_public_programs'
EVENT = '51000000-0000-4000-8000-000000000001'
COUNTS = {'RAM Truck Corral': 20, 'Event Centre #1': 9, 'Great Canadian Lumberjack Show': 15, 'Plowing': 13, 'Church Service': 1}


def load_manifest():
    m = json.loads((ROOT / 'review.json').read_text())
    require(len(m['entries']) == 67, 'Source count changed')
    require(Counter(e['classification'] for e in m['entries']) == {'ADD_PUBLIC_EVENT': 58, 'TENTATIVE_REQUIRES_REVIEW': 9}, 'Eligibility accounting changed')
    old = prior.load_manifest()
    require(m['pdf_sha256'] == old['pdf_sha256'], 'Source checksum changed')
    candidates = {e['key']: e for e in old['entries'] if e['classification'] == 'CATEGORY_AMBIGUOUS' and not e['duplicate_of']}
    require({e['key'] for e in m['entries']} == set(candidates), 'Source identities changed')
    require(len({e['external_id'] for e in m['entries']}) == 67, 'Duplicate external identity')
    for e in m['entries']:
        source = candidates[e['key']]
        require(all(e[k] == source[k] for k in ['date', 'start', 'end', 'title', 'family', 'tentative']), 'Printed source changed')
        require((e['classification'] == 'ADD_PUBLIC_EVENT') == (not e['tentative']), 'Tentative entry authorized')
        require(e['category'] == m['categories'][e['family']] == e['proposed']['category'], 'Category mismatch')
    require(Counter(e['category'] for e in m['entries'] if e['classification'] == 'ADD_PUBLIC_EVENT') == COUNTS, 'Category counts changed')
    return m


def require(condition, message):
    if not condition:
        raise ValueError(message)


def desired_rows():
    return [dict(e['proposed'], id=str(uuid.uuid5(uuid.UUID(EVENT), SOURCE + ':' + e['external_id'])),
                 event_id=EVENT, source=SOURCE, external_id=e['external_id'])
            for e in load_manifest()['entries'] if e['classification'] == 'ADD_PUBLIC_EVENT']


def plan(rows, baseline):
    require(rows and all(r['event_id'] == EVENT for r in rows), 'Staging event required')
    originals = [r for r in rows if r['source'] != SOURCE]
    prior.audit(originals, baseline)
    require(len({r['id'] for r in rows}) == len(rows), 'Duplicate record ID')
    require(len({r['external_id'] for r in rows}) == len(rows), 'Duplicate external ID')
    wanted = desired_rows()
    wanted_ids = {r['external_id'] for r in wanted}
    require(all(r['external_id'] in wanted_ids for r in rows if r['source'] == SOURCE), 'Unreviewed imported record')
    by = {r['external_id']: r for r in rows}
    additions = []
    for w in wanted:
        existing = by.get(w['external_id'])
        if existing:
            require(all(landa.equal(existing.get(k), v, k) for k, v in w.items()), 'Existing imported record drift')
        else:
            require(not any(r['title'].casefold() == w['title'].casefold() and landa.equal(r['starts_at'], w['starts_at'], 'starts_at') and r['location_name'] == w['location_name'] for r in rows), 'Possible semantic duplicate')
            additions.append(w)
    final = copy.deepcopy(rows) + additions
    require(len(final) == 228, 'Unexpected final count')
    return dict(inserts=additions, updates=[], result=final, summary=dict(added=len(additions), existing_new=58-len(additions), active=218, original_rows_preserved=170))


def sql_release(rows, baseline):
    result = plan(rows, baseline)
    # Reuse the reviewed exact-snapshot event/lock fence, with NO update patches.
    sql = landa.sql_release(rows, result, EVENT, 'ipm-staging')
    expected = landa.literal(json.dumps(baseline))
    wanted = desired_rows()
    fields = ','.join(wanted[0])
    expected_new = landa.literal(json.dumps(wanted))
    verify = f"""DO $expansion$ BEGIN
IF EXISTS (SELECT 1 FROM (
(SELECT * FROM public.schedule_items WHERE event_id='{EVENT}'::uuid AND source<>'{SOURCE}' EXCEPT SELECT * FROM jsonb_populate_recordset(NULL::public.schedule_items,{expected}::jsonb))
UNION ALL
(SELECT * FROM jsonb_populate_recordset(NULL::public.schedule_items,{expected}::jsonb) EXCEPT SELECT * FROM public.schedule_items WHERE event_id='{EVENT}'::uuid AND source<>'{SOURCE}')
) differences) THEN RAISE EXCEPTION 'Original schedule changed'; END IF;
IF EXISTS (SELECT 1 FROM (
(SELECT {fields} FROM public.schedule_items WHERE event_id='{EVENT}'::uuid AND source='{SOURCE}' EXCEPT SELECT {fields} FROM jsonb_populate_recordset(NULL::public.schedule_items,{expected_new}::jsonb))
UNION ALL
(SELECT {fields} FROM jsonb_populate_recordset(NULL::public.schedule_items,{expected_new}::jsonb) EXCEPT SELECT {fields} FROM public.schedule_items WHERE event_id='{EVENT}'::uuid AND source='{SOURCE}')
) differences) THEN RAISE EXCEPTION 'New schedule differs from reviewed source'; END IF;
IF (SELECT count(*) FROM public.schedule_items WHERE event_id='{EVENT}'::uuid AND status<>'archived')<>218 THEN RAISE EXCEPTION 'Wrong active count'; END IF;
END $expansion$;
"""
    require('$expansion$' not in json.dumps(rows) + json.dumps(baseline) + json.dumps(wanted), 'SQL delimiter collision')
    return sql.removesuffix('COMMIT;\n') + verify + 'COMMIT;\n'


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('snapshot', type=Path)
    p.add_argument('--baseline', required=True, type=Path)
    p.add_argument('--sql-output', type=Path)
    args = p.parse_args()
    rows = json.loads(args.snapshot.read_text())
    baseline = json.loads(args.baseline.read_text())
    print(json.dumps(plan(rows, baseline)['summary'], indent=2))
    if args.sql_output:
        args.sql_output.write_text(sql_release(rows, baseline))
