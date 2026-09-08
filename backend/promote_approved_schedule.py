"""Offline production schedule planner; emits one guarded transaction, never applies it."""
import argparse
from collections import Counter
import copy
import json
from pathlib import Path
import uuid
from backend import reconcile_landa_sept4 as landa
from backend import expand_show_guide_schedule as guide

EVENT = '5119d9d0-ea63-4677-9bea-36e32dbcfa46'
PRESERVE = {
    '2026-09-24-foodland-h18': ('description', 'will catch you'),
    '2026-09-24-harleys-i21': ('description', 'will catch you'),
    '2026-09-25-harleys-l16': ('description', 'performing'),
    '2026-09-23-foodland-e21': ('source', 'admin'),
    '2026-09-24-harleys-i27': ('title', 'Oil Sampling'),
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def keyed(rows):
    require(all(r.get('external_id') for r in rows), 'Missing external identity')
    require(len({r['external_id'] for r in rows}) == len(rows), 'Duplicate external identity')
    require(len({r['id'] for r in rows}) == len(rows), 'Duplicate UUID')
    return {r['external_id']: r for r in rows}


def matches(actual, expected, fields=None):
    return all(landa.equal(actual.get(k), expected.get(k), k) for k in (fields or expected.keys()))


def approved_result(baseline, staging):
    require(len(baseline) == 151 and all(r['event_id'] == EVENT for r in baseline), 'Wrong production baseline')
    pb = keyed(baseline)
    sb = keyed(staging)
    require(len(staging) == 228 and all(r['event_id'] == guide.EVENT for r in staging), 'Wrong staging reference')
    require(set(pb) <= set(sb), 'Production-only record would be lost')
    for ext, (field, required) in PRESERVE.items():
        require(required in pb[ext][field], 'Required production preservation wording changed')
        if field in ('title', 'source'):
            require(pb[ext][field] == required, 'Required production preservation value changed')
    result = landa.plan(baseline, EVENT)
    require(result['summary'] == dict(unchanged=30, updated=67, added=19, withdrawn=10, active=116), 'Approved Landa delta changed')
    show = []
    for row in guide.desired_rows():
        row = dict(row, event_id=EVENT, id=str(uuid.uuid5(uuid.UUID(EVENT), guide.SOURCE + ':' + row['external_id'])))
        show.append(row)
    result['inserts'] += show
    result['result'] += copy.deepcopy(show)
    require(len(result['inserts']) == 77 and len(result['result']) == 228, 'Approved addition count changed')
    final = keyed(result['result'])
    require(set(final) == set(sb), 'Unexplained source identity difference')
    fields = set(baseline[0]) - {'id', 'event_id', 'created_at', 'updated_at'}
    for ext, wanted in final.items():
        reference = dict(sb[ext])
        if ext in PRESERVE:
            field, _ = PRESERVE[ext]
            reference[field] = pb[ext][field]
        require(matches(wanted, reference, fields), 'Unrelated staging difference: ' + ext)
    for ext, original in pb.items():
        wanted = final[ext]
        allowed = set(next((u['patch'] for u in result['updates'] if u['external_id'] == ext), {}))
        require(allowed <= set(landa.FIELDS) | {'status'}, 'Unapproved existing-field write')
        require(matches(wanted, original, set(original) - allowed), 'Existing content or identity would change')
    for e in guide.load_manifest()['entries']:
        if e['classification'] == 'TENTATIVE_REQUIRES_REVIEW':
            require(e['external_id'] not in final, 'Tentative entry included')
    active = [r for r in final.values() if r['status'] != 'archived']
    require(len(active) == 218, 'Wrong final active count')
    signatures = [(r['title'].casefold(), r['starts_at'], r.get('ends_at'), r.get('location_name')) for r in active]
    # Normalize timestamp offsets before duplicate comparison.
    from datetime import datetime
    signatures = [(t, datetime.fromisoformat(s), datetime.fromisoformat(e) if e else None, v) for t,s,e,v in signatures]
    require(len(set(signatures)) == len(signatures), 'Duplicate active session')
    require(Counter(r['category'] for r in show) == guide.COUNTS, 'Unapproved new categories')
    result['summary'] = dict(updated=67, added=77, archived=10, unchanged=74, active=218,
                             unrelated_diff=0, production_only_lost=0, duplicates=0, tentative_excluded=9,
                             original_uuids_preserved=151, mandatory_preservations=5)
    return result


def verify(rows, baseline, staging):
    expected = approved_result(baseline, staging)
    actual = keyed(rows)
    final = keyed(expected['result'])
    require(set(actual) == set(final), 'Post-write identity/count mismatch')
    for ext, wanted in final.items():
        fields = set(baseline[0]) if ext in keyed(baseline) else set(baseline[0]) - {'created_at', 'updated_at'}
        require(matches(actual[ext], wanted, fields), 'Post-write content mismatch: ' + ext)
    require(landa.plan(rows, EVENT)['summary'] == dict(unchanged=116, updated=0, added=0, withdrawn=0, active=116), 'Post-write Landa mismatch')
    return expected['summary']


def plan(current, baseline, staging):
    expected = approved_result(baseline, staging)
    cb = keyed(current)
    bb = keyed(baseline)
    if set(cb) == set(bb) and all(matches(cb[k], v) for k, v in bb.items()):
        return expected
    # Only the exact completed state is accepted for an idempotent no-write rerun.
    verify(current, baseline, staging)
    return dict(updates=[], inserts=[], result=current, summary=dict(expected['summary'], updated=0, added=0, archived=0))


def sql_release(current, baseline, staging):
    result = plan(current, baseline, staging)
    sql = landa.sql_release(current, result, EVENT, 'ipm-2026')
    wanted = approved_result(baseline, staging)['result']
    expected = landa.literal(json.dumps(wanted, ensure_ascii=False))
    fields = ','.join(k for k in baseline[0] if k not in ('created_at','updated_at'))
    verify_sql = f"""DO $promotion$ DECLARE expected_rows jsonb := {expected}::jsonb; BEGIN
IF EXISTS (SELECT 1 FROM (
(SELECT {fields} FROM public.schedule_items WHERE event_id='{EVENT}'::uuid EXCEPT SELECT {fields} FROM jsonb_populate_recordset(NULL::public.schedule_items,expected_rows))
UNION ALL
(SELECT {fields} FROM jsonb_populate_recordset(NULL::public.schedule_items,expected_rows) EXCEPT SELECT {fields} FROM public.schedule_items WHERE event_id='{EVENT}'::uuid)
) differences) THEN RAISE EXCEPTION 'Final production schedule does not match approved delta'; END IF;
IF EXISTS (SELECT 1 FROM public.schedule_items a JOIN jsonb_populate_recordset(NULL::public.schedule_items,expected_rows) e ON a.id=e.id WHERE e.created_at IS NOT NULL AND (a.created_at IS DISTINCT FROM e.created_at OR a.updated_at IS DISTINCT FROM e.updated_at)) THEN RAISE EXCEPTION 'Original metadata changed'; END IF;
IF (SELECT count(*) FROM public.schedule_items WHERE event_id='{EVENT}'::uuid AND status<>'archived')<>218 THEN RAISE EXCEPTION 'Wrong production active count'; END IF;
END $promotion$;
"""
    require('$promotion$' not in json.dumps(wanted), 'SQL delimiter collision')
    return sql.removesuffix('COMMIT;\n') + verify_sql + 'COMMIT;\n'


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--current', type=Path, required=True)
    p.add_argument('--baseline', type=Path, required=True)
    p.add_argument('--staging', type=Path, required=True)
    p.add_argument('--sql-output', type=Path)
    args = p.parse_args()
    current,baseline,staging = [json.loads(f.read_text()) for f in (args.current,args.baseline,args.staging)]
    print(json.dumps(plan(current,baseline,staging)['summary'],indent=2))
    if args.sql_output:
        args.sql_output.write_text(sql_release(current,baseline,staging))
