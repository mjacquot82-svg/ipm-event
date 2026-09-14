-- Staging-only content reconciliation. One existing event; no schema or routing changes.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
LOCK TABLE public.schedule_items IN SHARE ROW EXCLUSIVE MODE;
DO $landa$
DECLARE previous jsonb; changed integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id='51000000-0000-4000-8000-000000000001' AND slug='ipm-staging') THEN
    RAISE EXCEPTION 'Not the approved staging event';
  END IF;
  SELECT to_jsonb(s) INTO previous FROM public.schedule_items s WHERE id='69f9ab32-bee3-5ac4-b97f-8c97d4b99bf7';
  IF previous IS DISTINCT FROM '{"id": "69f9ab32-bee3-5ac4-b97f-8c97d4b99bf7", "title": "Carrick Farm Market - All things Canning", "source": "mnp_lifestyles_2026_workbook", "status": "published", "ends_at": "2026-09-24T21:00:00+00:00", "category": "MNP Lifestyles Tent Events", "event_id": "51000000-0000-4000-8000-000000000001", "latitude": null, "timezone": "America/Toronto", "longitude": null, "starts_at": "2026-09-24T20:15:00+00:00", "created_at": "2026-09-08T16:48:23.611549+00:00", "sort_order": 117, "updated_at": "2026-09-08T16:48:23.611549+00:00", "days_active": "Thursday", "description": null, "event_image": null, "external_id": "sept4-2026-09-24-main-b49", "location_id": null, "location_name": "The Beyond Wireless Stage", "external_links": []}'::jsonb THEN
    RAISE EXCEPTION 'Target changed since reconciliation; inspect before applying';
  END IF;
  IF (SELECT count(*) FROM public.schedule_items) <> 229 OR
     (SELECT md5(coalesce(jsonb_agg(to_jsonb(s) ORDER BY id)::text,'')) FROM public.schedule_items s WHERE id <> '69f9ab32-bee3-5ac4-b97f-8c97d4b99bf7') <> 'a1d517f81adf187ab5a280a2a93fcaf1' THEN
    RAISE EXCEPTION 'Schedule baseline changed; inspect before applying';
  END IF;
  UPDATE public.schedule_items SET description='Carol has been growing food and preserving it for a few decades.   As a child her meals were filled with home preserves and vegetables from a large garden.  From these early days and meals, Carol has maintained this tradition, enjoying the rewards and benefits of home canning.

Take a peak in Carol’s pantry and you will find family ready jars of Soups, Chili, Beef Street Tacos, Tikka Masala Simmering Sauce, Marinara Sauce, Ketchups, Jams, Jellies and Pickles and more.  Chat briefly with Carol and you will realize this interest and passion is directly related to her dedication to eating food from local gardens and farms throughout the year, a focus on sustainability and budget friendly meal planning for families.  Carol is also committed to providing encouragement, education and support to others who share this goal and anyone with curiosity and interest in Water Bath and Pressure Canning.

After many years of working in community health services and manufacturing, Carol now has the luxury of working on many interesting projects that align with her values and skills.  She has moved from filling her own pantry shelves to commercial production of a large selection of preserves with Carrick Farm Market/Greenock Food Collective.  Hundreds of jars of Dilly Beans, Salsas, Pickled Carrots and Beets, Dill Pickles, Rhubarb Ketchup, Strawberry Rhubarb Jam and Summers End Jam are available at Carrick Farm Market in South Bruce.  Broadfork Produce and Pantry in Toronto’s west end also sells Carrick Creek Farmstead preserves.

Carol lives with her husband on their organic farm in South Bruce where you will find her in the garden, making hand crafted soap, tending the chickens, turkeys and ducks, or cleaning up her kitchen or the Carrick Farm Market commercial kitchen after the latest day of harvesting, cooking and canning.   Carol looks forward to meeting you in the Lifestyles Tent at the IPM.', event_image='{"url": "https://staging.theipm.ca/event-media/carol-weigel-fd34e6e0d994.jpg", "alt": "Carol Weigel", "width": 480, "height": 640}'::jsonb
  WHERE id='69f9ab32-bee3-5ac4-b97f-8c97d4b99bf7' AND event_id='51000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Expected exactly one updated event'; END IF;
  IF (SELECT to_jsonb(s)-'description'-'event_image'-'updated_at' FROM public.schedule_items s WHERE id='69f9ab32-bee3-5ac4-b97f-8c97d4b99bf7')
     IS DISTINCT FROM previous-'description'-'event_image'-'updated_at' THEN
    RAISE EXCEPTION 'Protected event fields changed';
  END IF;
  IF (SELECT md5(coalesce(jsonb_agg(to_jsonb(s) ORDER BY id)::text,'')) FROM public.schedule_items s WHERE id <> '69f9ab32-bee3-5ac4-b97f-8c97d4b99bf7') <> 'a1d517f81adf187ab5a280a2a93fcaf1' THEN
    RAISE EXCEPTION 'Unrelated schedule content changed';
  END IF;
END $landa$;
SELECT id,title,starts_at,ends_at,location_name,description,event_image FROM public.schedule_items WHERE id='69f9ab32-bee3-5ac4-b97f-8c97d4b99bf7';
COMMIT;
