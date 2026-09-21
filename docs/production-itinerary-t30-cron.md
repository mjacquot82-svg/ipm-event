# Production itinerary T-30 cron — pending Marc's approval

This PR prepares a standalone command; it does not activate or deploy reminders.
Do not merge, create/enable the cron, or trigger a live run until Marc approves.
No test notification, broadcast, synthetic production device/event, announcement
change, staging operation, or production claim is part of preparation.

## Exact Render configuration after approval

| Setting | Value |
| --- | --- |
| Service type | Cron Job |
| Name | `production-itinerary-t30` |
| Repository | `https://github.com/mjacquot82-svg/ipm-event` |
| Branch | `main` |
| Runtime | Python |
| Root directory | Repository root (leave blank) |
| Build command | `pip install -r backend/requirements.txt` |
| Command | `python backend/run_itinerary_t30.py` |
| Schedule | `* * * * *` (every minute, UTC) |
| Region | Oregon |
| Compute | 0.5 CPU / 512 MB (smallest compute) |

Set only the production values on this cron service:

```text
SUPABASE_URL=https://hppboivlpqkfhhzfftuu.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<production secret, supplied privately in Render>
WONDERPUSH_ACCESS_TOKEN=<production WonderPush secret, supplied privately in Render>
DEFAULT_EVENT_ID=ipm-2026
PUBLIC_APP_URL=https://theipm.ca
ITINERARY_T30_LIVE=true
```

Values must match exactly after trimming surrounding whitespace. The live flag
must be lowercase `true`; absent/false/other values refuse execution before any
client construction, readiness write, claim, or provider request. No `.env` file
is loaded. Unexpected arguments (including `--dry-run` or target/event overrides)
are rejected before execution; this command has no dry-run mode.

Keep exactly one cron service. Render guarantees one active run per cron service
and delays the next run until an active run exits. A manual trigger cancels an
active run; avoid manual triggers while delivery is in progress.
[Render cron documentation](https://render.com/docs/cronjobs)

## Runtime and boundaries

The command constructs `SupabaseContentClient`,
`SupabaseItineraryReminderRepository`, `WonderPushClient`, and
`ItineraryReminderEngine`, passes current UTC time to one `run()` call, then exits.
It retains the engine's production claims, provider-readiness refresh, exact
installation batches, idempotency, ambiguous-outcome handling and durable rate
controls. The destination is always `https://theipm.ca/itinerary`.

No web server import or second scheduler loop is introduced. Both existing
`ITINERARY_REMINDER_DELIVERY_ENABLED` and
`ITINERARY_REMINDER_SCHEDULER_ENABLED` constants remain hard-disabled. The legacy
Expo event-change scheduler and announcement broadcasting are unchanged.

Logs contain only allowlisted numeric counts and fixed status/breaker fields.
HTTPX/provider logging is suppressed for this process because readiness URLs can
contain credentials and installation IDs. Raw exceptions, provider responses,
installation IDs, event titles, tokens and tracebacks are not printed.

Exit codes: `0` completed cycle; `1` cycle exception or reported failed/unknown
provider outcomes; `2` missing live authorization, wrong identity or credentials.
A completed cycle does not mean every attendee was reachable; inspect the
suppressed count, provider outcomes and breaker state.

## Read-only eligibility check

Run `tools/check_itinerary_t30_eligibility.sql` only against production project
`hppboivlpqkfhhzfftuu`. It uses `BEGIN READ ONLY`, SELECTs and COMMIT; it never calls
a claim, readiness-refresh, batch, or provider function and returns aggregates.
The current-eligibility count includes readiness freshness and delivery-ledger
exclusions from the actual production claim function. The next-event prediction
uses stored readiness flags; readiness will be rechecked when that event is due.

Preparation snapshot at **2026-09-21 19:26:37 UTC**:

| Measure | Count |
| --- | ---: |
| Registered | 118 |
| Reminders enabled | 118 |
| Provider deliverable (stored status) | 118 |
| Synchronized stars | 1,126 |
| Eligible now, including fresh readiness | 0 |
| Due before readiness refresh | 0 |
| Existing delivery claims/outcomes | 0 |
| Empty/broadcast/comma-separated target rows | 0 |

The next candidate is **Weekend Never Ends**, starting **September 21 at 23:00 UTC
/ 7:00 p.m. Toronto**, with 13 currently starred/enabled targets. Its T-30 window
opens **22:30 UTC / 6:30 p.m. Toronto today**. Activation before that window can
send real opted-in itinerary reminders tonight, even though the main event opens
tomorrow. No claim or notification was made to obtain this information.

## Validation and operational risks

Tests cover missing/wrong guards before side effects, one UTC cycle, wiring to
the existing engine/provider, exact claimed installation targeting with no
broadcast fallback, aggregate-only output and secret-bearing failure paths.
HTTPX MockTransport is used for provider tests; disposable network-isolated
PostgreSQL/PostgREST is used for existing migration, batch and engine tests.
No live credential is used by test delivery paths. The focused validation passed
151 tests, including the existing reminder/readiness, migration/engine/batch,
production-schema analytics, provider and Supabase retry suites.

- Supabase's intermittent JWT rejection can still interrupt a cycle. The shared
  client's existing bounded read retries remain; uncertain writes are not blindly
  retried. No replay is forced for unknown provider outcomes.
- Delivery depends on current provider readiness, stars predating T-30, and the
  strict event window `>25` and `<=30` minutes away. Today's snapshot cannot
  guarantee future eligibility or device receipt.
- Existing engine defaults remain: 250 new claims/cycle, 1,000 candidate
  registrations for readiness, concurrency 20, and 10 provider sends/second.
  Long calls or a backlog can delay cron ticks and miss the five-minute window;
  monitor duration, claimed/suppressed/failed/unknown counts and backlog after
  approved activation. Render's singleton guarantee applies per cron service,
  not across duplicate services.
- Stopping a run after submission can leave an unknown outcome; durable engine
  recovery preserves that ambiguity instead of sending a duplicate automatically.
- Rollback/kill switch: disable the cron or remove/set `ITINERARY_T30_LIVE=false`
  for future invocations. An already-running cycle has already validated its
  environment; cancellation is a separate operational action with the ambiguity
  above. Do not enable the web-service schedulers as a fallback.

**STOP for Marc: PR only. No merge, cron activation, or notification send.**
