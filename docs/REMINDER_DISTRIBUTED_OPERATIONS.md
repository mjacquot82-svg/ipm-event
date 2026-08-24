# Itinerary reminder distributed operations (staging)

## Implemented shared controls

- PostgreSQL token bucket, locked per IPM event, shared by every worker.
- Durable circuit state with a 60-second outcome window, 20-call minimum,
  50% failure threshold, 60-second open interval, and one atomic half-open probe.
- 90-second batch leases. Expired `assigned` (pre-submit) work is released for
  re-leasing. Before the HTTP call, a worker atomically marks the batch
  `provider_attempted`; an expired post-submit lease becomes `delivery_unknown`
  and is never automatically resent.
- Persistent alerts for backlog age, an open provider circuit, and ambiguous
  delivery outcomes. Persistent metrics include backlog, oldest age, 429/5xx,
  accepted/failed/unknown batches, target counts, and average/p95 processing time.
- The global itinerary-reminder kill switch still returns before recovery,
  claiming, provider-budget acquisition, or sending. Announcements are separate.

## Recommended initial production configuration

These are IPM starting values, not a claim about WonderPush account capacity:

- workers: 2, with capacity to increase to 4 after account/quota confirmation
- individual claim batch: 10,000
- exact provider targets per request: 10,000 (provider-documented maximum)
- provider request budget: 10 requests/second, burst 10, further constrained by
  WonderPush response headers
- lease duration: 90 seconds
- definitive failure backoff: honor `Retry-After`; otherwise 60 seconds, maximum
  three claim attempts using the same WonderPush idempotency key
- ambiguous timeout/reset/malformed response: no automatic retry
- breaker: open at >=20 outcomes and >=50% failures in 60 seconds; probe after 60 seconds
- backlog warning: oldest pending 60 seconds; critical: 180 seconds
- any `delivery_unknown`: warning requiring operator review

## Remaining gates

The staging database benchmark concretely creates 10,000 registrations and synthetic
associations in a separate event, runs analyzed/buffered candidate queries and repeated
atomic claims, records timing, and deletes the event cascade. The migration aborts if
Schedule or pre-existing registration counts change. Its 2/4/8 labels model cooperative
claimers in one database session; they are not simultaneous independent connections, so
a true concurrent lock-contention run is still required.

The normal scheduler also refreshes provider reachability with one installation lookup
per due registration before batching. That provider-side N-call readiness audit remains
a scaling blocker unless WonderPush confirms a safe bulk lookup or IPM adopts a rigorously
fresh provider-status feed. It must not be silently removed.
