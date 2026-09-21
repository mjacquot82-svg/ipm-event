# Most Popular Reminder Events

Admin Analytics reads `GET /api/admin/analytics/reminders/popular-events` using
existing organizer authentication. Both organizer and configured event must be
`ipm-2026`. The response contains `items`, with at most ten objects containing
`schedule_item_id`, `title`, `starts_at`, `location_name` and `reminder_count`.

The backend reads existing `itinerary_reminder_stars` joined to `schedule_items`
through the schedule-item foreign key. It filters the schedule event and
`status=published`, groups by exact schedule-item ID, sorts count descending,
start instant ascending and finally ID for deterministic ties. Repeated titles
are separate occurrences. Counts are current stored stars, not provider-ready
recipients, successful deliveries or historical interest; no readiness filter or
new tracking is introduced.

Reads use the existing Supabase client, with its existing safe-read retry
behavior. The report has a 12-second total deadline and at most 20 star-page
requests of 500 rows each. Pagination advances by the actual returned count and
requires an empty final page, so a server-imposed smaller page size does not
silently truncate results. Exhaustion, errors and invalid data return a generic
503, never a partial ranking. Responses use `Cache-Control: no-store`.
Pagination is a current read, not a transaction-wide snapshot: simultaneous
star edits can affect counts while pages are read. Refresh gets a new ranking.
No migrations, database writes, provider calls or reminder-engine changes.

The compact ranked rows show Toronto date/time, location and count, with a
320px scroll area. They use the existing Analytics aggregate load/Refresh path,
including range changes, without adding polling. The section states that it
covers current stars across all event dates, independent of the date filter.
Loading, empty and unavailable states are explicit.

## Verification

- 21 backend tests: popularity aggregation, authorization, isolation, pagination,
  limits, failures, GET-only access; existing T-30 analytics/reminder tests.
- 21 frontend tests: popularity rendering/Toronto times/top ten, authenticated
  service integration, existing Analytics and System Health regressions.
- TypeScript, focused ESLint and production frontend build.
- Local PostgreSQL/PostgREST fixture verification with a two-row server cap,
  using the real Supabase client and join/filter syntax. Only synthetic local
  test records are created; production is not accessed.

Mock examples (America/Toronto): Livestock Parade: 5 stars; Tractor Show,
September 22 at 10:00 AM: 3 stars; Tractor Show, September 22 at 2:00 PM: 3 stars.
These are test fixtures, not production rankings.

Prepared for PR review only. No merge, deploy, staging changes or notifications.
