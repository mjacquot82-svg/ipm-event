# Recovered analytics completion

Continued from authoritative `fix/staging-accurate-notification-analytics-current` / `origin/staging` at `e517d32c38b11d9d4dadf24b20e7f6b20e816e1b`. The previous final report is preserved verbatim in PRESERVED_FINAL_REPORT.md; RECOVERY.md records why it was incomplete. This document describes the completed code, with deployment verification recorded separately in FINAL_REPORT.md when available.

No replacement migration. `20260918000200_accurate_notification_analytics.sql` remains byte-for-byte unchanged. Staging already records it as `accurate_notification_analytics`, version `20260918184432`. No live schema application was performed. Disposable PostgreSQL tests apply the original file to fresh and historical schemas, verify 13 nullable/default-free columns, historical nulls, existing concurrency/scope constraints/indexes, local idempotence and transactional rollback. Operational rollback means revert application code and leave the additive nullable columns; dropping columns would destroy telemetry and is not an automatic rollback.

## Provider identity and sending

Each persisted delivery attempt owns `ipm-{audience}-{delivery UUID}`; audience is `test` or `everyone`. Provider idempotency uses `announcement-test-{delivery UUID}` or `announcement-{delivery UUID}`. Reusing the same logical attempt preserves its identity. A definite rejected-send retry creates a new ledger row and independent provider identity. Repeated tests never share announcement-level campaign statistics. Legacy `ipm-announcement-test-*` campaigns are excluded from refresh because their historical attribution is ambiguous.

The existing one-active-broadcast database guard remains. An ambiguous timeout, HTTP 408 or 5xx keeps the row requested/unknown and keeps that guard, instead of permitting an unrelated duplicate broadcast after an uncertain outcome. An administrator must reconcile it before another broadcast; this implementation does not automatically resend. Successful broadcast behavior, payloads, TTL, test installation targeting and image handling are preserved. Statistics lookup failures cannot alter send outcomes.

## Exact metric meanings

| Metric | Meaning / unavailable condition |
| --- | --- |
| Notification requested | IPM delivery row exists; request time is separate from acceptance. |
| Known deliverable devices at send | Existing snapshot of provider-ready registrations; may include stale readiness. Not a people count or exact provider target population. |
| Targeted devices | Nullable provider-reported targeted installations. The currently documented reports endpoint does not supply this exact count; it stays null. Fixtures prove correct presentation if provided. Never infer it from sent/failed/receipt totals. |
| Provider accepted | Existing `sent` ledger status means HTTP 202 acceptance, never “Delivered.” |
| Sent to push service | Explicit `@NOTIFICATION_SENT` event count. |
| Provider-confirmed receipts | Explicit `@NOTIFICATION_RECEIVED` count; SDK/provider reporting coverage varies. Does not prove visible OS display. |
| Notification opens | Explicit `@NOTIFICATION_OPENED` events. Not people; separate from app visits. |
| Notification-origin app visits | Validated, deduplicated delivery/navigation pairs recorded by IPM. |
| Provider failures | Explicit `@NOTIFICATION_FAILED` count; distinct from failure of a statistics request. |
| Delivery unknown | Pending/ambiguous request or T-30 `delivery_unknown` state, not fabricated failure or success. |

WonderPush's observational `POST /stats/reports` requests four `campaign.events.type` metrics for the exact persisted campaign, from the original request time to now, with no overlapping platform/time/button breakdown. It does not call `/deliveries`. Missing groups/values stay null; explicit integer zero remains zero; invalid/negative/fractional counts never become zero. Approximate unique-installation counts are not presented as unique people. Exact historical provider HTTP codes were not persisted; internal diagnostics explicitly leave that field unavailable rather than manufacture 202.

Authoritative provider contracts inspected on 2026-09-18:
- https://docs.wonderpush.com/reference/post-stats-reports
- https://docs.wonderpush.com/docs/events
- https://docs.wonderpush.com/docs/website-sdk-reference
- https://docs.wonderpush.com/docs/api-analytics

The old `/stats/events` endpoint does not expose receipts; its compatibility normalizer no longer invents them from unsupported aliases. Detailed reports are the runtime adapter.

## Refresh policy

Automatic refresh is observational, only for accepted sends with usable identities:

| Send age | Minimum interval since last attempt |
| --- | --- |
| Under 10 seconds | No refresh |
| 10 seconds to under 1 hour | 60 seconds |
| 1 hour to under 24 hours | 15 minutes |
| 24 hours to under 7 days | 6 hours |
| 7 days or older | No automatic refresh |

No provider final-state marker is asserted; the seven-day age cutoff bounds automatic work. Owner-only explicit diagnostics can refresh older rows, at most once per minute. Any unavailable/rate-limited attempt imposes at least one hour backoff; older age intervals still apply. A 429 stops that load. At most five deliveries are queried per load, within a 12-second overall deadline and 8-second provider request timeout. Conditional PostgreSQL leases prevent simultaneous refreshes of the same row; abandoned leases expire after at least five minutes. Final writes compare the lease timestamp so stale workers cannot replace newer results. Errors are sanitized and do not erase existing metrics. HTTPX request logs for the statistics endpoint are suppressed because query authentication would otherwise expose the provider credential; a MockTransport/captured-log test verifies this.

Opening Announcements loads statistics. While that section is visible, the UI checks the backend at most once per minute; the backend policy prevents unnecessary provider calls. No provider call occurs on a React render. Historical/aged rows stop automatic provider polling. `Statistics last checked` makes a frozen snapshot explicit.

## Notification-origin attribution and privacy

URLs contain only the opaque delivery UUID as `notification_ref`, never tokens, installation IDs, capability hashes or credentials. The ingestion endpoint verifies UUIDs, event scope, accepted delivery, correct announcement, and that the stored target URL actually carried the reference. Wrong/unknown/historical references safely contribute no visit. Ordinary announcement opens remain distinct.

A random navigation UUID is stored in tab-scoped sessionStorage keyed by Expo Router's stable `history.state.id` and the delivery UUID. Expo may discard custom history fields on reload: the full browser test caught that behavior, so the implementation does not rely solely on a custom field. Reload and back/forward reuse the same entry identity; a fresh navigation creates another. A non-router entry can retain its own history marker. Unavailable durable browser storage fails closed. Attribution is a web/PWA navigation measure, not an authenticated identity or proof that a person tapped a displayed notification; copying an attributed link can also create a visit.

The backend derives a deterministic event key from delivery/navigation UUIDs, independent of analytics session/visitor changes. An idempotent Mongo `notification_origin_visits` ledger retains only event scope, delivery UUID, a derived visit key and receipt time. It contains no visitor/session/device identity. Its delivery index supports exact aggregation; retries repair interrupted event/ledger writes. Existing raw-event retention remains 400 days; the minimal visit ledger persists for deduplication and cumulative counts. Its deployment begins this measurement; unavailable historical telemetry is not backfilled. PostgreSQL caches the count with a monotonic conditional write; the Mongo ledger is authoritative. Historical sends without a URL reference remain unavailable, not zero.

## T-30 aggregation

The new organizer endpoint reads existing ledger/state only; it never claims, prunes, dispatches, changes gates, or modifies reminder behavior. Controlled-fixture delivery rows are excluded from normal claim totals. Reads are scoped to the deployment event and paginated, with a bounded 100,000-row ceiling per source; exceeding it fails rather than silently returning a partial total. Multiple reads are an operational snapshot, not a transactional historical census.

Organizer: active interests, scheduler-eligible due reminders, normal delivery claims, recorded provider requests, accepted/failed/unknown ledger states, removed interests and stale/unavailable interests. Due uses the actual normal scheduler's 25–30 minute window, early-star rule, fresh readiness, opt-in/token flag, retry delay and retry budget. The staging allowlist can still prevent sending even when eligibility exists.

Provider requests count recorded batch attempts plus explicit direct-send attempt timestamps, not claim retries guessed to be HTTP calls. Historical duplicate-suppression attempts have no durable counter: the UI says Not available. Owner diagnostics separately expose the current eligible interests already blocked by existing ledger state, not a fabricated cumulative duplicate-attempt count. Removed interests use the existing cumulative counter; stale interests are a current snapshot.

Marc/Owner only: delivery/announcement/provider references, ledger status and statistics timestamps; separate T-30 batch counts, backlog, latency, rate-limit/5xx counts and operational-alert totals. Organizer components contain no raw technical identifiers. Neither diagnostic endpoint includes push tokens, capability hashes, credentials, installation IDs or attendee histories.

## Image evidence

JEN IMAGE PUSH PHYSICAL EVIDENCE RECORDED: YES.

Jen physically observed the actual image inside her production notification. Production rich-image push is physically confirmed working. The earlier contrary static-audit conclusion was incomplete.

Working source path: `alerts.image.url` → `notify_announcement(image_url)` → `WonderPushClient.notification_content` → `_send_detailed` → `alert.web.image`. Existing image tests exercise this path with a mocked HTTP 202 provider response. Image upload/storage and image payload behavior are unchanged. Jen's statement remains external evidence, never provider telemetry.

## Validation and pre-existing failures

Backend requested coverage: 230 passed, 0 failed (16 selected files), including 49 completion cases, 13 T-30 analytics cases, 7 original-migration cases and a real disposable Mongo deduplication test. Disposable PostgreSQL/Mongo services never use live staging or production databases. Provider HTTP is mocked in tests.

Frontend analytics/admin targeted suite: 47 passed, 0 failed. Broader notification/announcement/admin-auth run: 71 passed, 5 failed. These five also fail in an isolated copy of recovered SHA e517d32c:
- admin-auth-network: assumes Content-Type on a bodyless request;
- admin-auth-network: obsolete production vendor proxy assertion;
- notification-prompt-eligibility: obsolete recurring-prompt copy assertion;
- notification-registration-retry: expects T-30 hard-disabled instead of existing staging gate;
- wonderpush-production: same obsolete hard-disabled staging assertion.

Recovered-base broad run: 64 passed / 8 failed. Two recovered analytics assertions were obsolete/leaky and are covered by corrected behavior tests; the old no-campaignId assertion conflicted with recovered analytics and is corrected. A first current run lacked TypeScript resolution in the dependency-free checkout; rerunning with the isolated dependency tree passed the image tests. No unrelated application behavior was changed to satisfy these stale tests.

TypeScript: one existing TS2367 at `frontend/app/(tabs)/itinerary.tsx:225`, `armState !== 'waiting' || armState === 'working'`. Exact same line exists at pre-analytics base `608d8227` and recovered `e517d32c`; this task leaves it unchanged. No full TypeScript success is claimed. The analytics-introduced section-name comparison was corrected.

Frontend build, Python compilation and git diff whitespace check pass. Browser checks use the real built app with authenticated organizer/API fixtures; all provider requests and unapproved network mutations are intercepted. Desktop 1440px and phone 390px show the correct metrics and historical nulls without horizontal overflow; T-30 shows aggregates. A separate real-browser flow proves notification navigation → 1, reload → 1, ordinary open → 1, new notification navigation → 2. Real Mongo independently verifies persisted count/deduplication and field privacy.

## Release isolation

PR #39 remains OPEN/UNMERGED at `bfa5d76342b446c16f06bacec1f6f1853cc85e33`. No candidate changes are required: this work reads its existing ledger contract and adds staging analytics around it. Do not merge staging into the production candidate. Main remains `5c41f907821cf11be9c3140d8b8c275c0f9b5c29`.

No notification was sent. No production code, data, configuration or deployment was changed. Staging's applied migration is unchanged. Before deployment, the active staging send allowlist count was zero; announcement ledger totals were 15 sent / 6 failed, and reminder ledger totals were one accepted.
