"""Generate reviewed Artisan content SQL. Prints only; never connects to a database."""
import json
from datetime import datetime
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
EVENT_ID = '5119d9d0-ea63-4677-9bea-36e32dbcfa46'
SOURCE = 'artisan_approved_20260919'


def desired_rows():
    rows = []
    for filename in ('artisan_presenters_2026.json', 'artisan_angie_resolution_2026.json'):
        manifest = json.loads((ROOT / 'backend/import_manifests' / filename).read_text())
        for item in manifest['events']:
            start = datetime.strptime(f"{item['date']} {item['start_time']}", '%Y-%m-%d %I:%M %p').replace(tzinfo=ZoneInfo(manifest['timezone']))
            rows.append(dict(id=str(uuid5(NAMESPACE_URL, f"ipm:{EVENT_ID}:{SOURCE}:{item['external_id']}")),
                event_id=EVENT_ID, title=item['title'], description=f"Presenter: {item['presenter']}",
                starts_at=start.isoformat(), ends_at=None, timezone=manifest['timezone'],
                category=manifest['category'], location_name=item['location_name'], days_active=start.strftime('%A'),
                source=SOURCE, external_id=item['external_id'], status='published', sort_order=1400+len(rows)))
    assert len(rows) == len({(r['title'], r['starts_at']) for r in rows}) == 9
    return rows


def reviewed_sql():
    schedule = json.dumps(desired_rows(), ensure_ascii=False)
    manifest = json.loads((ROOT/'frontend/scripts/data/artisan-tent-vendors-2026.json').read_text())
    vendors = json.dumps([dict(id=v['id'], name=v['name'], create_if_absent=v['create_if_absent']) for v in manifest['vendors']])
    return f"""-- REVIEW ONLY. Requires separate production data-write authorization.
-- Production project hppboivlpqkfhhzfftuu; no schema changes or provider calls.
BEGIN;
DO $patch$
DECLARE item jsonb; existing_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id='{EVENT_ID}' AND slug='ipm-2026') THEN
    RAISE EXCEPTION 'Production event identity mismatch';
  END IF;
  LOCK TABLE public.schedule_items, public.vendors IN SHARE ROW EXCLUSIVE MODE;
  FOR item IN SELECT value FROM jsonb_array_elements($schedule${schedule}$schedule$::jsonb) LOOP
    IF (SELECT count(*) FROM public.schedule_items WHERE event_id='{EVENT_ID}'
        AND title=item->>'title' AND starts_at=(item->>'starts_at')::timestamptz) > 1 THEN
      RAISE EXCEPTION 'Duplicate presentation: re-audit before applying';
    END IF;
    SELECT id INTO existing_id FROM public.schedule_items WHERE event_id='{EVENT_ID}'
      AND title=item->>'title' AND starts_at=(item->>'starts_at')::timestamptz;
    IF existing_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.schedule_items WHERE id=existing_id AND status='published'
          AND location_name=item->>'location_name' AND description=item->>'description') THEN
        RAISE EXCEPTION 'Existing presentation conflicts: preserve identity and re-audit';
      END IF;
    ELSE
      INSERT INTO public.schedule_items (id,event_id,title,description,starts_at,ends_at,timezone,category,location_name,days_active,source,external_id,status,sort_order)
      SELECT id,event_id,title,description,starts_at,ends_at,timezone,category,location_name,days_active,source,external_id,status,sort_order
      FROM jsonb_populate_record(NULL::public.schedule_items,item);
    END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements($vendors${vendors}$vendors$::jsonb) LOOP
    SELECT id INTO existing_id FROM public.vendors WHERE id=(item->>'id')::uuid AND event_id='{EVENT_ID}';
    IF existing_id IS NULL THEN
      IF NOT (item->>'create_if_absent')::boolean OR EXISTS (SELECT 1 FROM public.vendors
          WHERE event_id='{EVENT_ID}' AND lower(name)=lower(item->>'name')) THEN
        RAISE EXCEPTION 'Vendor identity changed: re-audit before applying';
      END IF;
      INSERT INTO public.vendors(id,event_id,name,type,location,source,external_id,status)
      VALUES((item->>'id')::uuid,'{EVENT_ID}',item->>'name','Indoor','Indoors at the Artisan Tent',
          '{SOURCE}',item->>'id','published');
    ELSE
      UPDATE public.vendors SET location='Indoors at the Artisan Tent' WHERE id=existing_id;
    END IF;
  END LOOP;
END $patch$;
COMMIT;
"""


if __name__ == '__main__':
    print(reviewed_sql(), end="")
