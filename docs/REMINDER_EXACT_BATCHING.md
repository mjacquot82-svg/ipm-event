# WonderPush exact-target reminder batching

Verified against the current official WonderPush Management API documentation on
2026-08-24:

- `targetInstallationIds` accepts one or more exact installation IDs, comma-separated
  in form encoding, with at most 10,000 target values per delivery request.
- only one `target*` family may be supplied; IPM supplies no segment, tag, user, device,
  campaign, `@ALL`, or fallback target.
- accepted requests return HTTP 202. Quota feedback is carried by
  `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`; a 429 must
  honor `Retry-After`.
- `X-WonderPush-Idempotency-Key` supports safe identical retries, is limited to 64
  permitted characters, and is retained by WonderPush for seven days.
- `push.expirationTime` is supported. T-30 batches use 10 minutes: enough for a brief
  gateway outage while preventing delivery close to or after event start.

The scheduler first performs and atomically persists every existing individual claim.
It then groups only equivalent claims by Schedule item, reminder type, title, location,
and canonical start; sorts exact IDs deterministically; chunks at the configured provider
maximum; and atomically assigns each chunk to a durable batch audit row. Each individual
delivery ledger row remains linked to its batch.

Provider acceptance is recorded as `provider_accepted`, never physical delivery. A
timeout, connection reset, or malformed response is `delivery_unknown` and is not
automatically retried. Definitive failures can reuse the same exact payload and provider
idempotency key after controlled backoff. A 429 uses `Retry-After`.

## Provider-free scale model

With the verified 10,000-target maximum and 10 request/second conservative local cap:

| Eligible | One event | Five events | Twenty events | Provider-bound within 1 minute |
|---:|---:|---:|---:|---:|
| 100 | 1 call | 5 calls | 20 calls | 100% |
| 1,000 | 1 call | 5 calls | 20 calls | 100% |
| 5,000 | 1 call | 5 calls | 20 calls | 100% |
| 10,000 | 1 call | 5 calls | 20 calls | 100% |

One 25,000-target event is safely chunked into 10,000, 10,000, and 5,000. A modeled
25,000-device population with 20% simultaneously eligible across five events uses five
provider requests. The twenty-event shape drains in 1.9 seconds in the provider-free
model. These timings exclude database and WonderPush processing latency.

## Remaining production gates

- The local request limiter and circuit breaker are still process-local. Production
  needs a shared Redis/database token bucket and shared breaker state.
- A database-backed 10,000-registration contention benchmark has not yet run; the
  staging database contains only real test registrations and was not polluted for this
  test.
- WonderPush account quota for `/v1/deliveries` and Subscriber Protection configuration
  require confirmation. Capping can drop a second valid reminder; IPM currently leaves
  `disableCapping` unset and must not change that policy without an explicit decision.
- Persistent alerting and a durable worker that independently drains/re-leases pending
  batches are required before production cutover.

Official references:

- https://docs.wonderpush.com/reference/post-deliveries
- https://docs.wonderpush.com/reference/rate-limiting
- https://docs.wonderpush.com/reference/idempotency-keys
- https://docs.wonderpush.com/reference/notification
- https://docs.wonderpush.com/docs/pressure-management
