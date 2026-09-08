#!/usr/bin/env python3
"""Offline, dry-run-first Sept. 4 planner. Emits reviewed SQL; never connects/applies."""
from __future__ import annotations
import argparse
import copy
from datetime import datetime
import hashlib
import json
from pathlib import Path
import uuid

ROOT = Path(__file__).parent / 'import_manifests' / 'landa_sept4'
CATEGORY = 'MNP Lifestyles Tent Events'
SOURCE = 'mnp_lifestyles_2026_workbook'
FIELDS = ('title', 'starts_at', 'ends_at', 'location_name', 'days_active')
TARGETS = {'ipm-2026', 'ipm-staging'}

class Conflict(ValueError):
    pass

def load_manifest():
    m = json.loads((ROOT / 'reconciliation.json').read_text())
    if hashlib.sha256((ROOT / 'schedule.xlsx').read_bytes()).hexdigest() != m['workbook_sha256']:
        raise Conflict('Authoritative workbook checksum changed')
    if len(m['items']) != 116 or len(m['withdrawals']) != 10:
        raise Conflict('Reviewed source counts changed')
    if len({r['cell'] for r in m['items']}) != 116:
        raise Conflict('Duplicate source cell')
    ids = [r['external_id'] for r in m['items'] + m['withdrawals']]
    if len(set(ids)) != 126:
        raise Conflict('Duplicate or repurposed external identity')
    return m

def equal(a, b, field):
    if a is None or b is None:
        return a is b
    if field in ('starts_at', 'ends_at', 'created_at', 'updated_at'):
        return datetime.fromisoformat(a.replace('Z', '+00:00')) == datetime.fromisoformat(b.replace('Z', '+00:00'))
    return a == b

def accepted(row, wanted, baseline):
    for key in FIELDS:
        options = [wanted[key], baseline[key]]
        # Existing staging typos, documented in the read-only preflight.
        if key == 'title':
            options += {'Cottage Springs': ['Coattage Springs'], 'Oil Sampling': ['Oil Samplng']}.get(baseline[key], [])
        if not any(equal(row.get(key), value, key) for value in options):
            raise Conflict('Unreviewed schedule edit: ' + row['external_id'] + '/' + key)

def plan(rows, event_id, manifest=None):
    m = manifest or load_manifest()
    if not rows or any(r['event_id'] != event_id for r in rows):
        raise Conflict('Snapshot is empty or crosses event boundaries')
    by = {}
    for row in rows:
        if row.get('external_id'):
            by.setdefault(row['external_id'], []).append(row)
    if any(len(v) != 1 for v in by.values()):
        raise Conflict('Duplicate external identities in event')
    known = {x['external_id'] for x in m['items'] + m['withdrawals']}
    if any(r['category'] == CATEGORY and r['external_id'] not in known for r in rows):
        raise Conflict('Unreviewed Lifestyles record; audit again')
    updates, inserts, unchanged = [], [], 0
    final = copy.deepcopy(rows)
    final_by_id = {r['id']: r for r in final}
    for item in m['items'] + m['withdrawals']:
        ext = item['external_id']
        row = by.get(ext, [None])[0]
        withdrawal = 'proposed' not in item
        if row is None:
            if withdrawal or item.get('existing'):
                raise Conflict('Required existing identity missing: ' + ext)
            new = dict(item['proposed'], id=str(uuid.uuid5(uuid.UUID(event_id), SOURCE + ':' + ext)),
                       event_id=event_id, external_id=ext, source=SOURCE, category=CATEGORY,
                       timezone='America/Toronto', description=item['description'], status='published',
                       sort_order=107 + sum(1 for i in m['items'][:m['items'].index(item)] if not i['existing']))
            inserts.append(new); final.append(copy.deepcopy(new))
            continue
        allowed_sources = {SOURCE}
        if ext == '2026-09-23-foodland-e21':
            allowed_sources.add('admin')
        if row['category'] != CATEGORY or row['source'] not in allowed_sources or row['timezone'] != 'America/Toronto':
            raise Conflict('Identity/category/source conflict: ' + ext)
        if row['status'] not in (('published', 'archived') if withdrawal else ('published',)):
            raise Conflict('Unreviewed publication state: ' + ext)
        if withdrawal:
            accepted(row, item['baseline'], item['baseline'])
            patch = {} if row['status'] == 'archived' else {'status': 'archived'}
        else:
            accepted(row, item['proposed'], item.get('baseline', item['proposed']))
            patch = {k: v for k, v in item['proposed'].items() if not equal(row[k], v, k)}
        if patch:
            updates.append({'id': row['id'], 'external_id': ext, 'patch': patch})
            final_by_id[row['id']].update(patch)
        elif not withdrawal:
            unchanged += 1
    active = [r for r in final if r['category'] == CATEGORY and r['status'] != 'archived']
    if len(active) != 116:
        raise Conflict('Result does not contain exactly 116 active Lifestyles items')
    signatures = [(datetime.fromisoformat(r['starts_at']), datetime.fromisoformat(r['ends_at']), r['location_name'], r['title'].casefold()) for r in active]
    if len(set(signatures)) != len(signatures):
        raise Conflict('Duplicate active session')
    for item in m['items']:
        matches = [r for r in active if r['external_id'] == item['external_id']]
        if len(matches) != 1 or any(not equal(matches[0][k], v, k) for k, v in item['proposed'].items()):
            raise Conflict('Result failed source reconciliation')
    summary = dict(unchanged=unchanged, updated=sum('status' not in u['patch'] for u in updates),
                   added=len(inserts), withdrawn=sum('status' in u['patch'] for u in updates), active=116)
    return dict(summary=summary, updates=updates, inserts=inserts, result=final)

def literal(value):
    return "'" + value.replace("'", "''") + "'"

def sql_release(rows, result, event_id, event_slug):
    if event_slug not in TARGETS:
        raise Conflict('Unapproved event slug')
    # Exact snapshot comparison occurs inside the same transaction/lock as writes.
    expected = literal(json.dumps(rows, ensure_ascii=False))
    statements = ["BEGIN;", "SET LOCAL lock_timeout = '5s';", "SET LOCAL statement_timeout = '30s';",
        "LOCK TABLE public.schedule_items IN SHARE ROW EXCLUSIVE MODE;",
        f"DO $guard$ DECLARE snapshot_rows jsonb := {expected}::jsonb; BEGIN",
        f"IF NOT EXISTS (SELECT 1 FROM public.events WHERE id={literal(event_id)}::uuid AND slug={literal(event_slug)}) THEN RAISE EXCEPTION 'Wrong schedule event'; END IF;",
        "IF EXISTS (SELECT 1 FROM (",
        f"(SELECT * FROM public.schedule_items WHERE event_id={literal(event_id)}::uuid EXCEPT SELECT * FROM jsonb_populate_recordset(NULL::public.schedule_items,snapshot_rows))",
        "UNION ALL",
        f"(SELECT * FROM jsonb_populate_recordset(NULL::public.schedule_items,snapshot_rows) EXCEPT SELECT * FROM public.schedule_items WHERE event_id={literal(event_id)}::uuid)",
        ") differences) THEN RAISE EXCEPTION 'Schedule changed since preflight; abort and re-audit'; END IF; END $guard$;"]
    for u in result['updates']:
        if not set(u['patch']) <= set(FIELDS) | {'status'}:
            raise Conflict('Attempt to overwrite protected content')
        assignments = ', '.join(k + '=' + literal(v) for k, v in u['patch'].items())
        statements.append(f"UPDATE public.schedule_items SET {assignments} WHERE id={literal(u['id'])}::uuid AND event_id={literal(event_id)}::uuid;")
    for row in result['inserts']:
        values = ', '.join('NULL' if v is None else str(v) if isinstance(v, int) else literal(v) for v in row.values())
        statements.append(f"INSERT INTO public.schedule_items ({', '.join(row)}) VALUES ({values});")
    statements += ["DO $verify$ BEGIN",
        f"IF (SELECT count(*) FROM public.schedule_items WHERE event_id={literal(event_id)}::uuid AND category={literal(CATEGORY)} AND status<>'archived')<>116 THEN RAISE EXCEPTION 'Wrong final Lifestyles count'; END IF;",
        "END $verify$;", "COMMIT;"]
    sql = '\n'.join(statements) + '\n'
    # A snapshot can contain arbitrary biography text, including dollar delimiters.
    if '$guard$' in json.dumps(rows):
        raise Conflict('Snapshot contains SQL block delimiter; review before release')
    return sql

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', type=Path, required=True)
    parser.add_argument('--event-slug', choices=sorted(TARGETS), required=True)
    parser.add_argument('--sql-output', type=Path)
    parser.add_argument('--result-output', type=Path)
    args = parser.parse_args()
    rows = json.loads(args.snapshot.read_text())
    result = plan(rows, rows[0]['event_id'])
    print(json.dumps(result['summary'], indent=2))
    if args.sql_output:
        args.sql_output.write_text(sql_release(rows, result, rows[0]['event_id'], args.event_slug))
    if args.result_output:
        args.result_output.write_text(json.dumps(result['result'], indent=2, ensure_ascii=False) + '\n')

if __name__ == '__main__':
    main()
