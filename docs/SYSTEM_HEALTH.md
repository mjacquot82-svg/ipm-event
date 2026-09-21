# Production System Health

Prepared for review; this PR does not deploy or configure a monitor.

After an approved production deployment, use a standard HTTP monitor against
`https://ipm-backend-eoiw.onrender.com/api/health`. GET and HEAD both perform the
same dependency check. HEAD emits no body. Use the backend URL, not the frontend
SPA URL. No authentication is required for this deliberately small public probe.

Each request verifies the configured production Supabase host and `ipm-2026`
event, then makes exactly one GET to `/rest/v1/events` selecting only `slug`,
filtered to `ipm-2026`, with `limit=1`. The total dependency deadline is five
seconds. Only the expected event result returns 200; wrong configuration,
timeouts, malformed responses, missing events and upstream errors return 503.
There are no retries: intermittent JWT rejection is reported as a dependency
failure. Responses are not cacheable and never contain credentials or upstream
error details. This is a REST dependency probe, not a database-wide audit.

The existing authenticated organizer Dashboard owns the System Health
section, below the Event / Role / Vendors / Schedule summary cards. It refreshes
on mount and on its own Refresh button, with overlapping refreshes prevented
and no polling. Three parallel read-only requests have
seven-second deadlines:

- `/api/health`: backend process and Supabase event-read status.
- `/content-manifest.json`: successful read, production/event identity, positive
  integer schedule/announcement revisions and valid update timestamps. This
  validates readability/shape, not freshness against authoritative revisions.
- `/api/notification-registrations/operations`: existing `provider_configured`
  boolean only. “Healthy” here explicitly means configured, not confirmed
  provider availability or device delivery. No WonderPush API call is made.

Frontend health means this admin page is running. Both **T-30 reminder cron**
and **Content manifest cron** remain **Not tracked in app** because no safe run
heartbeat is currently exposed. The disabled web-service scheduler flags are
not evidence of standalone cron failure and are deliberately ignored.

## Validation

- 68 backend tests: system health, analytics reporting, notification health,
  WonderPush web alerting and current reminder engine.
- 18 frontend tests: system health and existing analytics dashboard.
- TypeScript `tsc --noEmit`, focused ESLint, production `npm run build:web`.
- Explicit HEAD test at ASGI message level (not only a client that strips bodies).
- Mock transports cover JWT 401, 500, invalid/missing event data, timeout,
  malformed JSON, identity guards, and GET-only database access.
- UI rendering tests cover statuses, limitations, timestamp, Refresh and busy
  state; attendee route sources contain no System Health integration.

All dependency/provider responses in tests are mocked. No live monitor, live
notification, database write, cron change, staging change or deployment is part
of this preparation. Existing upstream deprecation warnings remain.
