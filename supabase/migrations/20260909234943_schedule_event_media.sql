-- Optional detail content only; no schedule identity/timing/status changes.
ALTER TABLE public.schedule_items
  ADD COLUMN event_image jsonb,
  ADD COLUMN external_links jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.schedule_items ADD CONSTRAINT schedule_event_image_valid CHECK (
  event_image IS NULL OR (
    jsonb_typeof(event_image) = 'object'
    AND event_image ?& ARRAY['url','alt','width','height']
    AND jsonb_typeof(event_image->'url') = 'string'
    AND jsonb_typeof(event_image->'alt') = 'string'
    AND length(btrim(event_image->>'alt')) BETWEEN 1 AND 300
    AND (event_image->>'url') ~ '^https://[^/@[:space:]]+(/[^[:space:]]*)?$'
    AND jsonb_typeof(event_image->'width') = 'number'
    AND jsonb_typeof(event_image->'height') = 'number'
    AND (event_image->>'width')::numeric BETWEEN 1 AND 10000
    AND (event_image->>'height')::numeric BETWEEN 1 AND 10000
    AND (event_image->>'width')::numeric = trunc((event_image->>'width')::numeric)
    AND (event_image->>'height')::numeric = trunc((event_image->>'height')::numeric)
  )
);

-- Pure validation only: no table access, no SECURITY DEFINER privileges.
CREATE FUNCTION public.schedule_external_links_valid(links jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = '' AS $$
DECLARE item jsonb;
BEGIN
  IF jsonb_typeof(links) <> 'array' OR jsonb_array_length(links) > 10 THEN RETURN false; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(links) LOOP
    IF jsonb_typeof(item) <> 'object' OR NOT (item ?& ARRAY['label','url'])
       OR jsonb_typeof(item->'label') <> 'string' OR jsonb_typeof(item->'url') <> 'string'
       OR length(btrim(item->>'label')) NOT BETWEEN 1 AND 150
       OR (item->>'url') !~ '^https://[^/@[:space:]]+(/[^[:space:]]*)?$'
    THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;
$$;
ALTER TABLE public.schedule_items ADD CONSTRAINT schedule_external_links_valid
  CHECK (public.schedule_external_links_valid(external_links));
COMMENT ON COLUMN public.schedule_items.event_image IS 'Optional shared HTTPS image with mandatory alt text and intrinsic dimensions. Detail view only.';
COMMENT ON COLUMN public.schedule_items.external_links IS 'Optional labeled HTTPS links for the event detail. Omitted fields in legacy PATCH requests are preserved.';
