# WonderPush readiness mirror (staging)

The normal T-30 scheduler never calls `GET /v1/installations/{id}`. It claims only
registrations whose durable mirror is `optIn`, has a push token, is deliverable, and
was verified within `ITINERARY_REMINDER_PROVIDER_READINESS_MAX_AGE_SECONDS`.

The independent readiness worker uses `GET /v1/installations` with `sort=none`, a
1,000-row page request, field selection, and the provider's returned cursor URLs.
Results are intersected with IPM reminder registrations. Raw push tokens are reduced
to a boolean and never persisted. A full refresh marks registered installations absent
from the provider listing as unknown and non-deliverable. Incremental refresh via
`updateDateFrom` is supported, but periodic full reconciliation remains required to
detect missing records.

Recommended starting configuration:

- readiness maximum age: 900 seconds
- full refresh interval: 300 seconds
- page request: 1,000 installations (the API may adjust the actual page size)
- priority warning window: T-45 through T-30
- stale upcoming threshold: one or more recipients
- scheduler fallback lookups: disabled (zero)

The refresh worker is configuration-gated. It remains disabled during this staging
change so the two physical Device A/B registrations are not mutated. Enable it only
after confirming the staging account's installation-list quota. A failed refresh keeps
the previous timestamps unchanged; old rows naturally become ineligible after 900
seconds. Missing rows from a full refresh become fresh-but-unknown and cannot be sent.

WonderPush documentation confirms cursor pagination, `updateDateFrom`, reachability
filters, and field selection. Cursor URLs are short-lived and must be followed unchanged.
The `/v1/batch` endpoint accepts at most 100 subrequests, so it is not used for readiness
listing.

## Staging results and remaining gate

The isolated 10,000-row mirror benchmark modeled ten 1,000-row provider pages and
recorded zero provider-readiness calls in the scheduler. All synthetic rows were
removed, with Schedule remaining at 151 and the two real registrations remaining two.

Independent `supabase db query --linked` processes were then started simultaneously.
Committed claims were unique and PostgreSQL reported no deadlocks or waiting locks at
the observation points. However, only 1/2, 2/4, and 1/8 initial workers completed within
the 30-second Management API query timeout; the other transactions rolled back. Later
single-worker drain calls safely claimed the remaining rows. This does not invalidate
the readiness mirror, but it means the current staging database/Management-API path has
not passed the requested multi-worker latency test. Production should begin with one
claim worker and must not scale worker count until direct pooler-based contention testing
and database capacity tuning pass.
