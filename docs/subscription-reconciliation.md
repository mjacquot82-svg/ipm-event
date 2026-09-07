# Permanent subscription reconciliation — staging rollout

Staging physical delivery and announcement deep-link PASS on September 7 remain
established. The original cause of subscription divergence remains unknown;
billing is not asserted as its cause. No notification is part of this rollout.

## Architecture and states

The browser reads an existing root PushSubscription and existing capability,
allows the already-running supported SDK ten seconds to become available plus
one second to settle, then reads its public installation/user/subscribed APIs.
It never initializes or forces the SDK, subscribes, unsubscribes, registers or
updates a worker, changes permission, or creates an installation.

The authenticated backend owns provider credentials and selects the registration
by event, capability hash and matching SDK installation identity. Anonymous IPM
sessions are supported; conflicting/named/missing identity safely defers. The
ordinary explicit first opt-in remains a separate workflow. For existing
capabilities, automatic registration no longer enters legacy replacement recovery.

States are INELIGIBLE, OFFLINE_PENDING, CHECK_DUE, SDK_SETTLING, COMPARING,
VERIFIED, MISMATCH, PATCH_PENDING, VERIFYING, OUTCOME_UNKNOWN, DEFERRED,
IDENTITY_UNRESOLVED. Browser-only states need no provider/database write.
A verified provider read is VERIFYING until a browser reread and authenticated
confirmation establish the same generation. A further browser reread protects
against rotation during confirmation. Historical equality never proves receipt.

Canonical endpoint bytes and URL-safe decoded p256dh/auth/applicationServerKey
are shared with temporary comparison tooling. The full endpoint is not rewritten.
Only reliably decoded four-field equality is a match. Any same-application-key
mismatch can be repaired; the exact three-field failure is not special-cased.

## Durable safety

`notification_reconciliation` stores no raw subscription material. Its HMAC
uses a domain-separated key derived from the existing provider credential and is
scoped to database environment, event, installation and capability owner. It is
never returned or logged. Credential rotation deliberately invalidates fingerprints.
Provider check/readiness timestamps are separate from subscription verification.

A service-role-only PostgreSQL RPC handles claims, 120-second leases, generation
fences, confirmation and outcomes. New generations invalidate old confirmation;
late old checks must reread the browser before using a returned newer generation.
One process-local promise and cross-tab Web Lock complement database coordination.
The global project row has a fixed lock order; external provider HTTP requests
never run inside a database transaction.

Unchanged VERIFIED fingerprints expire after six hours. Until then no provider
request/write occurs. New fingerprints invalidate equality immediately.
Limits: four provider-check cycles per installation/hour, 120 cycles/project/minute;
a cycle has at most two projected GETs and one PATCH. Frontend retries are bounded
to three scheduled retries (30 seconds, two minutes, ten minutes plus jitter),
respecting server next-attempt timestamps. Database scheduling is durable across
restarts. Authentication/billing/policy failures open a one-hour-or-longer circuit;
429 honors Retry-After; repeated network/provider failures also open the circuit.

PATCH requires current provider opt-in, notifications subscribed/visible, matching
application-server key, reliable mismatch, enabled repair flag and atomic claim
fence. Only four pushToken fields are patched on the existing installation.
No preferences are patched. A timeout is followed by one read, never mutation
replay. Definitive HTTP rejection plus read-back of the unchanged prior token permits a
bounded future attempt; authentication/billing/policy circuits still apply.
Uncertain writes remain read-only until equality is established; operator
investigation may be required if mismatch persists. Lease expiry cannot authorize
replaying an uncertain mutation. Independent SDK writes cannot be remotely fenced:
post-write verification and future lifecycle checks detect subsequent divergence.

Raw material exists transiently in TLS request bodies and memory. Provider
transport uses restricted urllib GET/PATCH without redirects/retries or raw
exception logging. Responses contain only allowlisted states, classifications,
timestamps and generation counts. SQL RPC identifiers/HMACs travel in private
request bodies, not logged query URLs. RLS/revokes deny public client access.

## Attendee and worker behavior

Checks are debounced five seconds on launch, foreground and online events. Hidden
pages do not poll; offline state leaves app usage intact. No persistent raw-token
queue exists: retries reread the current browser. Healthy verified users see no
prompt; pending/failed delivery verification is not labelled healthy. Unsubscribed
and setup-failed cards remain visible regardless of optional prompt frequency.

The existing WonderPush worker integration handles pushsubscriptionchange. No
competing push/click handlers are added. A normal Expo deployment regenerates the
offline manifest/version because the existing worker serves a cached app shell;
keeping the old manifest would strand existing users on the previous frontend.
Push loader/init and click/deep-link handler code remain unchanged.

## Rollout and rollback

The backend route is mounted only when the exact staging Render hostname, public
URL and Supabase URL agree. Frontend additionally requires staging origin/backend.
The migration defaults both observation and repair switches OFF. Enable observation
first, then guarded recovery after tests/deployment checks. No main/production
configuration or database change is included.

The temporary pages remain. While permanent recovery is enabled the old manual
repair endpoint returns PERMANENT_RECONCILIATION_ACTIVE instead of bypassing
coordination. Read-only Pixel/comparison/provider diagnostics remain available.
Disable repair first for rollback; disabling observation prevents new claims.
Allow in-flight requests to finish. The migration includes explicit drop-order
rollback instructions; do not drop metadata with active callers or unknown outcomes.

## Verification

Unit tests cover exact proven mismatch, single-field mismatches, healthy no-write
paths, SDK-first settling, malformed data, identities, consent, provider failures,
privacy canaries, lost PATCH responses and generation fencing. Node lifecycle
tests run real coordinator code against controlled timers, reconnect storms and
shared Web Locks. Isolated PostgreSQL tests exercise concurrent sessions/restarts,
rotation fences, fresh no-provider claims, quotas/circuits, and 1,000 attendee claims.

Run optional SQL tests against an isolated loopback PostgreSQL database only:
install `tests/requirements-reconciliation.txt`; set IPM_RECONCILIATION_TEST_DSN
for 127.0.0.1:55439. Apply migration to a test schema containing events and
notification_installations and the Supabase roles. Never point these tests at staging.

Infrastructure cannot read the live Pixel PushSubscription. A stored provider
record and historical match do not establish current browser equality. Physical
follow-up is opening staging normally in the existing Chrome profile, with no send
or repair-page tap. Production promotion requires explicit authorization, reviewed
limits/provider identity behavior, and a single controlled production installation
with verified equality/readiness, one separately authorized send, receipt and tap.
Temporary diagnostic retirement is a later reviewed change after that passes.
