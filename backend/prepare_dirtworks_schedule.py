"""Prepare reviewed DirtWorks records offline. Never writes to a database.

Usage: python backend/prepare_dirtworks_schedule.py DATABASE_SNAPSHOT OUTPUT_DIR
The snapshot must contain all staging schedule_items, including unpublished rows.
"""
import copy
from datetime import datetime
import hashlib
import json
from pathlib import Path
import re
import sys
from uuid import NAMESPACE_URL, uuid5
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
EVENT_ID = '51000000-0000-4000-8000-000000000001'
MANIFEST = ROOT / 'backend/import_manifests/ipm_dirtworks_2026.json'
PATTERN = re.compile(r'dirt\s*works|mini\s+ex|track\s+loader|compact\s+ride|ride.*drive.*compact|dealer\s+demo', re.I)


def desired_rows():
    manifest = json.loads(MANIFEST.read_text())
    for source in manifest['sources']:
        assert hashlib.sha256((ROOT / source['path']).read_bytes()).hexdigest() == source['sha256']
    assert (ROOT / manifest['asset']).read_bytes() == (ROOT / manifest['sources'][1]['path']).read_bytes()
    rows = []
    for item in manifest['events']:
        row = {key: copy.deepcopy(item[key]) for key in (
            'external_id', 'title', 'description', 'category', 'location_name',
            'days_active', 'event_image', 'external_links')}
        for target, field in [('starts_at', 'start_time'), ('ends_at', 'end_time')]:
            dt = datetime.strptime(item['date'] + ' ' + item[field], '%Y-%m-%d %I:%M %p')
            row[target] = dt.replace(tzinfo=ZoneInfo(manifest['timezone'])).isoformat()
        row.update(id=str(uuid5(NAMESPACE_URL, manifest['source'] + ':' + row['external_id'])),
                   event_id=EVENT_ID, source=manifest['source'], timezone=manifest['timezone'],
                   status='published', sort_order=0, latitude=None, longitude=None, location_id=None)
        rows.append(row)
    return rows


def plan(existing):
    """Idempotent plan; refuse newly discovered matches rather than duplicate them."""
    wanted = desired_rows()
    inserts, unchanged = [], []
    candidates = [r for r in existing if r.get('event_id') == EVENT_ID and
                  PATTERN.search(' '.join(str(r.get(k, '')) for k in
                                          ('title', 'description', 'location_name', 'category', 'external_id')))]
    for row in wanted:
        matches = [r for r in candidates if r.get('external_id') == row['external_id']]
        if len(matches) > 1:
            raise ValueError('Duplicate existing identity: ' + row['external_id'])
        if matches:
            old = matches[0]
            for key, value in row.items():
                if key == 'id':
                    continue
                left = old.get(key)
                if key in ('starts_at', 'ends_at'):
                    left = datetime.fromisoformat(left.replace('Z', '+00:00'))
                    value = datetime.fromisoformat(value)
                if left != value:
                    raise ValueError('Existing record differs; review update before applying: ' + row['external_id'])
            unchanged.append(old)
        else:
            inserts.append(row)
    identities = {r['external_id'] for r in wanted}
    if any(r.get('external_id') not in identities for r in candidates):
        raise ValueError('Near-matching event found; review before creating any records')
    return {'insert': inserts, 'unchanged': unchanged}


def schedule_preview(before, rows):
    result = copy.deepcopy(before)
    existing_ids = {r['id'] for r in result['events']}
    for row in rows:
        if row['id'] in existing_ids:
            continue
        item = {k: copy.deepcopy(row[k]) for k in ('id', 'title', 'description', 'category',
                'location_name', 'latitude', 'longitude', 'days_active', 'event_image', 'external_links')}
        start = datetime.fromisoformat(row['starts_at'])
        end = datetime.fromisoformat(row['ends_at'])
        item.update(start_date=start.strftime('%Y-%m-%d'), start_time=start.strftime('%I:%M %p').lstrip('0'),
                    end_time=end.strftime('%I:%M %p').lstrip('0'))
        result['events'].append(item)
    result['total_count'] = len(result['events'])
    return result


if __name__ == '__main__':
    output = Path(sys.argv[2])
    output.mkdir(parents=True, exist_ok=True)
    result = plan(json.loads(Path(sys.argv[1]).read_text()))
    (output / 'dirtworks-plan.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    print(f"Prepared {len(result['insert'])} inserts; {len(result['unchanged'])} unchanged. No database writes.")
