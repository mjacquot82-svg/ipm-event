# Staging Analytics event authorization correction

## Diagnosis

The consolidated frontend requests these authenticated, same-origin GET routes:

- `/api/admin/analytics/summary?range=7d` (Overview)
- `/api/admin/analytics/traffic?range=7d` (Traffic)
- `/api/admin/analytics/content?range=7d` (Engagement)
- `/api/admin/analytics/live` (Live Activity)
- `/api/admin/analytics/notification-health` (Notification Health)

They send the organizer session cookie, not an event-ID query parameter. Backend
authorization resolves the event from the server-stored organizer. The login form
has an explicit event field; its default in the published bundle is `ipm-2026`.
That default does not override an already-authenticated organizer's stored event.

On staging backend `fb80d44a`, every route above enters
`require_analytics_reporting_repository`, which rejects any organizer event other
than the hard-coded analytics storage label `ipm-2026`. It returns HTTP 403 with
`{"detail":"Analytics are unavailable for this event"}` before any reporting query.
This is the exact message Marc observed. The staging Supabase project
`hooiqjcbcbwzjjvnwyxf` contains the active event `ipm-staging`.

Local tests exercising cookie authentication and server-side session/user lookup
reproduced the rejection. Live authenticated network capture remains pending; no
claim is made that a local fixture is Marc's live session.

## Correction

Authorize against the event configured in the existing deployment EventService.
Keep the legacy analytics storage label and ingestion/reporting queries unchanged
so existing analytics are retained. Wrong-event organizers still receive 403;
unauthenticated requests still receive 401; missing storage still receives 503.
No frontend fallback, migration, data write, or environment change is included.

Before deployment, verify the Render staging service's configured event and Mongo
database isolation. Render workspace confirmation is pending. No staging deployment
of this correction has occurred yet.

## Verification so far

- Focused backend analytics/authentication/privacy tests: 99 passed.
- Reconciliation and what3words regressions: 39 passed.
- Focused frontend analytics/onboarding/itinerary/Emergency tests: 80 passed.
- Python compilation and git diff whitespace checks passed.
- All frontend source and all notification/reconciliation implementation files
  remain identical to consolidated staging `92eadf2b`.

Read-only staging SQL at approximately 2026-09-08 23:48 UTC found registrations 1,
checked 1, not-yet-checked 0, VERIFIED 1, repairable MISMATCH 0, KEY_MISMATCH 0,
other INELIGIBLE 0, uncertainty 0, current check failures 0, active/expired leases 0,
due/scheduled retries 0, circuit CLOSED, provider-ready 1 (stale 1), and expired
verification 1. These are database aggregates, **not verified displayed values**.
Historical repairs remain unprovable and the unchanged UI labels them Not recorded.
No private notification identifiers or subscription material were selected for
these diagnostic outputs.

## Remaining acceptance checks

Verify staging service configuration and request logs; deploy only the backend
correction with Netlify skipped. Then use a normal authenticated staging organizer
session to read all five routes and verify all panels and actual displayed counts.
The current Netlify deployment must remain `6aa091b2b8f161cc3b981158`.

Production is excluded. No notification was sent and no provider, subscription,
permission, reconciliation, schedule, vendor, map, what3words, itinerary, or
onboarding behavior was changed by this correction.
