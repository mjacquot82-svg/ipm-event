"""Generate the audited staging-only data patch; never changes a schema or calls providers."""
import json
from datetime import datetime
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5
from zoneinfo import ZoneInfo

STAGING_PROJECT = 'hooiqjcbcbwzjjvnwyxf'
EVENT_ID = '51000000-0000-4000-8000-000000000001'
SOURCE = 'artisan_presenters_pennie_20260919'
BASELINE_HASH = 'a76d129080c12590186a0fcaef2922c9'
MANIFEST = Path(__file__).parent / 'import_manifests/artisan_presenters_2026.json'

def desired_rows():
    manifest = json.loads(MANIFEST.read_text())
    assert manifest['source'] == SOURCE
    rows = []
    for i, item in enumerate(manifest['events']):
        start = datetime.strptime(f"{item['date']} {item['start_time']}", '%Y-%m-%d %I:%M %p').replace(tzinfo=ZoneInfo(manifest['timezone']))
        rows.append({
            'id': str(uuid5(NAMESPACE_URL, f"ipm:{EVENT_ID}:{SOURCE}:{item['external_id']}")),
            'event_id': EVENT_ID, 'title': item['title'],
            'description': f"Presenter: {item['presenter']}",
            'starts_at': start.isoformat(), 'ends_at': None,
            'timezone': manifest['timezone'], 'category': manifest['category'],
            'location_name': item['location_name'], 'days_active': start.strftime('%A'),
            'source': SOURCE, 'external_id': item['external_id'], 'status': 'published',
            'sort_order': 1400 + i,
        })
    assert len(rows) == len({r['id'] for r in rows}) == 8
    return rows

def staging_sql():
    payload = json.dumps(desired_rows(), ensure_ascii=False)
    # Audited existing records are fingerprinted before AND after. On any drift,
    # stop for re-audit; never overwrite an existing record or change its identity.
    return f"""-- Execute ONLY on Supabase project {STAGING_PROJECT}. Data patch, not migration.
BEGIN;
DO $patch$
DECLARE wanted jsonb := $records${payload}$records$::jsonb; baseline text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id='{EVENT_ID}' AND slug='ipm-staging' AND name='IPM Staging' AND timezone='America/Toronto')
     OR EXISTS (SELECT 1 FROM public.events WHERE slug='ipm-2026') THEN
    RAISE EXCEPTION 'Staging event identity check failed';
  END IF;
  LOCK TABLE public.schedule_items IN SHARE ROW EXCLUSIVE MODE;
  SELECT md5(string_agg(to_jsonb(s)::text,'' ORDER BY id)) INTO baseline FROM public.schedule_items s WHERE source <> '{SOURCE}';
  IF baseline IS DISTINCT FROM '{BASELINE_HASH}' THEN RAISE EXCEPTION 'Existing schedule changed: re-audit before applying'; END IF;
  INSERT INTO public.schedule_items (id,event_id,title,description,starts_at,ends_at,timezone,category,location_name,days_active,source,external_id,status,sort_order)
  SELECT id,event_id,title,description,starts_at,ends_at,timezone,category,location_name,days_active,source,external_id,status,sort_order
  FROM jsonb_populate_recordset(NULL::public.schedule_items,wanted)
  ON CONFLICT DO NOTHING;
  IF (SELECT count(*) FROM public.schedule_items WHERE source='{SOURCE}') <> 8
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(wanted) w WHERE NOT EXISTS (
       SELECT 1 FROM public.schedule_items s WHERE s.id=(w->>'id')::uuid
       AND s.event_id='{EVENT_ID}' AND s.title=w->>'title' AND s.description=w->>'description'
       AND s.starts_at=(w->>'starts_at')::timestamptz AND s.ends_at IS NULL
       AND s.timezone=w->>'timezone' AND s.category=w->>'category'
       AND s.location_name=w->>'location_name' AND s.days_active=w->>'days_active'
       AND s.source=w->>'source' AND s.external_id=w->>'external_id'
       AND s.status='published' AND s.sort_order=(w->>'sort_order')::integer
     )) THEN RAISE EXCEPTION 'Desired records conflict with existing identities or fields'; END IF;
  IF (SELECT md5(string_agg(to_jsonb(s)::text,'' ORDER BY id)) FROM public.schedule_items s WHERE source <> '{SOURCE}') IS DISTINCT FROM baseline THEN
    RAISE EXCEPTION 'Unrelated schedule record changed';
  END IF;
END $patch$;
COMMIT;
SELECT id,title,description,starts_at,ends_at,days_active,location_name,status FROM public.schedule_items WHERE source='{SOURCE}' ORDER BY starts_at;
"""

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sql', action='store_true', help='Print guarded SQL for the staging project; does not execute it')
    args = parser.parse_args()
    print(staging_sql() if args.sql else json.dumps({'project': STAGING_PROJECT, 'insert_only': desired_rows()}, indent=2))
