# Announcement notification images

Optional images on announcements for in-app display and WonderPush `alert.web.image`.

## Decisions

- Persist optional `alerts.image` JSON (`url`, `alt`, `width`, `height`, `storage_path`) so in-app and push share one source of truth.
- WonderPush payload sets `alert.web.image` **only** when an HTTPS image URL exists; otherwise the web object is icon-only (text-only path unchanged).
- Image is never required to create, publish, or notify.
- Upload is backend-authenticated (Owner|Communications) into Supabase Storage bucket `announcement-images` (public read for durable HTTPS URLs). Clients do not write storage directly.

## Required configuration (do not invent secret values)

Apply migration `supabase/migrations/20260911000100_announcement_images.sql` to the target Supabase project.

Backend (already used for content):

- `CONTENT_SOURCE=supabase`
- `SUPABASE_URL=https://<project-ref>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=<service role key from Supabase project settings>`

No new WonderPush env vars. Existing `WONDERPUSH_ACCESS_TOKEN` / test installation / campaign vars unchanged.

Public object URL shape:

`{SUPABASE_URL}/storage/v1/object/public/announcement-images/{event_id}/{uuid}.{ext}`

## Limits

- Types: JPEG, PNG, GIF (Content-Type + magic bytes)
- Size: ≤ 5MB
- Dimensions: ≤ 4096px on each side

## Orphan policy

1. `POST /api/admin/announcements/images` uploads and returns metadata; it does **not** attach to an announcement until create/update saves `image`.
2. If the organizer discards an upload before save, call `DELETE /api/admin/announcements/images` with `{ "storage_path": "..." }`.
3. Replace/remove on announcement save deletes the previous storage object when the path changes.
4. Deleting an announcement best-effort deletes its storage object.
5. Ops cleanup: remove `announcement-images` objects older than 24h whose `name` is not referenced by any `alerts.image->>'storage_path'`.

## Platform behavior

- Web / PWA: may show the large image when the client supports `alert.web.image`; title/text/targetUrl always present.
- iOS/Android/unsupported clients: ignore missing/unsupported image field; still receive title, text, and deep link.
- In-app: AnnouncementCard/detail show the image when present; failed loads hide the image only and keep title/body.
