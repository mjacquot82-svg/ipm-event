# Itinerary T-30 reminders

The reminder interest is keyed by the event's stable `schedule_items.id` and the
hashed capability of one WonderPush installation. The browser keeps the existing
`@event_navigator_favorites` ID set and reconciles the complete set whenever the
Schedule or Itinerary screen is focused. Reconciliation is idempotent and removes
unstarred interests in one service-role transaction.

The worker reads the current `schedule_items.starts_at`, `title`, `location_name`,
and `status` at claim time. It considers only published events in the 25–30 minute
window, uses the event's `timestamptz` (IPM timezone: `America/Toronto`), and does
not claim late stars, started events, cancelled events, or deleted rows. The unique
`(registration_id, schedule_item_id, reminder_type)` ledger entry prevents duplicate
claims; ambiguous provider outcomes become `delivery_unknown` and are never blindly
retried.

The provider boundary accepts exactly one installation for the normal path (the
worker may form bounded exact-target batches for one event) and never falls back to
`@ALL`. Announcement delivery remains a separate path. Browser/PWA notification
permission is required for delivery, but starring remains local and works offline;
the next online focus reconciles the server interest.

`ITINERARY_REMINDER_DELIVERY_ENABLED` and
`ITINERARY_REMINDER_SCHEDULER_ENABLED` remain hard release gates in this branch.
They are deliberately false until the additive migrations and a controlled,
allowlisted one-device test have been reviewed. No production provider calls are
made by this change.

## Controlled-test environment

Use the existing isolated IPM Staging environment only after a fresh identity
check: Supabase project `hooiqjcbcbwzjjvnwyxf`, staging event
`51000000-0000-4000-8000-000000000001` (`ipm-staging`), staging Render service
`srv-da4adt7qj5pc73bl63j0`, and staging Netlify site `0932cc5d-9cb8-4cd3-8418-7e486df75bf1`.
The production project/event are separate (`hppboivlpqkfhhzfftuu` /
`5119d9d0-ea63-4677-9bea-36e32dbcfa46`). The reminder migrations have not been
applied to either environment by this work.

Before testing, apply the migrations only to a disposable staging database or a
Supabase branch cloned from that staging project, verify the backend commit and
event UUID, and register exactly one allowlisted installation. Create a synthetic
fixture in that database with a test-only accelerated lead time (for example,
two minutes); never alter a real Schedule row. Star the fixture, observe one
targeted delivery, move its start and location, reconcile once, then unstar and
confirm suppression. Remove the fixture, stars, delivery ledger rows, and test
registration during cleanup. Production remains on the 30-minute value and both
release gates remain false.

## Schedule mutation safety

- `PUT /api/admin/schedule/events/{event_id}` against Supabase is **SAFE**: it
  patches the existing UUID, so time, location, and title edits retain identity.
- The same endpoint against the legacy Google Sheets source is **SAFE for time,
  location, and description edits** and **BLOCKED for title edits**, because the
  legacy `gs_<row>_<title>` ID would otherwise change.
- `POST /api/admin/schedule/import` is **BLOCKED** for all sources: its full
  replacement semantics can regenerate IDs.
- The reviewed MNP external-identity PATCH importer is **SAFE** and is separate
  from the blocked full-replacement endpoint.
- Historical `replace_schedule` and row-index/title identity behavior are
  **HISTORICAL/unsafe**; no unknown current production mutation path was found.
