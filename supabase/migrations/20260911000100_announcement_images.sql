-- Optional announcement images for in-app display and WonderPush alert.web.image.
-- Upload path is backend-authenticated (service role) into Supabase Storage;
-- this migration adds the alerts.image column and the public storage bucket.

ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS image jsonb;

ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_image_valid;
ALTER TABLE public.alerts ADD CONSTRAINT alerts_image_valid CHECK (
  image IS NULL OR (
    jsonb_typeof(image) = 'object'
    AND image ?& ARRAY['url','alt','width','height','storage_path']
    AND jsonb_typeof(image->'url') = 'string'
    AND jsonb_typeof(image->'alt') = 'string'
    AND jsonb_typeof(image->'storage_path') = 'string'
    AND length(btrim(image->>'alt')) BETWEEN 1 AND 300
    AND length(btrim(image->>'storage_path')) BETWEEN 1 AND 512
    AND (image->>'url') ~ '^https://[^/@[:space:]]+(/[^[:space:]]*)?$'
    AND (image->>'storage_path') !~ '[.]{2}|^/|\\\\'
    AND jsonb_typeof(image->'width') = 'number'
    AND jsonb_typeof(image->'height') = 'number'
    AND (image->>'width')::numeric BETWEEN 1 AND 10000
    AND (image->>'height')::numeric BETWEEN 1 AND 10000
    AND (image->>'width')::numeric = trunc((image->>'width')::numeric)
    AND (image->>'height')::numeric = trunc((image->>'height')::numeric)
  )
);

COMMENT ON COLUMN public.alerts.image IS
  'Optional HTTPS announcement image (JPEG/PNG/GIF) with alt, intrinsic dimensions, and storage_path for replace/remove cleanup. Used for in-app display and WonderPush alert.web.image when notifying.';

-- Public bucket so WonderPush and browsers can fetch durable HTTPS URLs without auth.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'announcement-images',
  'announcement-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read for durable notification/in-app URLs.
DROP POLICY IF EXISTS "announcement_images_public_read" ON storage.objects;
CREATE POLICY "announcement_images_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'announcement-images');

-- Writes go through the backend service role (bypasses RLS). No direct client INSERT/UPDATE/DELETE.
DROP POLICY IF EXISTS "announcement_images_no_anon_write" ON storage.objects;
-- Intentionally omit INSERT/UPDATE/DELETE policies for anon/authenticated:
-- organizers upload only via /api/admin/announcements/images using SUPABASE_SERVICE_ROLE_KEY.
