# Itinerary reminder engine

The worker reads current `schedule_items` rows on every run. A reminder is due when the
current start is more than 25 and no more than 30 minutes away, the star predates T-30,
the event is published, and the device registration passes the hardened WonderPush
readiness checks. Times are stored as `timestamptz`; attendee display and boundary tests
use `America/Toronto`.

## Delivery safety

`ITINERARY_REMINDER_DELIVERY_ENABLED` is the independent delivery kill switch and
defaults to `false`. `ITINERARY_REMINDER_SCHEDULER_ENABLED` controls inspection runs.
Normal announcements do not use either setting.

Claims are atomic and unique by registration, schedule item, and `itinerary_t30` type.
A definitive provider rejection is retryable after one minute, at most three attempts
while the event remains in the due window. A timeout or worker crash after claim is
recorded as `delivery_unknown` and is not automatically retried because the provider may
already have accepted it. HTTP/provider acceptance is `provider_accepted`, never proof
of physical delivery.

## Batching and scale

Each run refreshes provider readiness concurrently, claims a bounded database batch,
and issues exactly one targeted provider request per claim with bounded concurrency.
Configure `ITINERARY_REMINDER_BATCH_SIZE` (1–1000),
`ITINERARY_REMINDER_CONCURRENCY` (1–100), and
`ITINERARY_REMINDER_INTERVAL_SECONDS` (minimum 30). Provider request throughput and
provider installation lookups are the expected bottlenecks. Load testing at 1,000,
5,000, and 10,000+ simultaneous reminders remains a separate milestone.

## Synthetic staging proof

The staging-only synthetic fixture stores no Schedule row and uses the same readiness
refresh, due-window predicates, atomic claim, ledger, and one-installation provider path.
Associating or removing the fixture requires the device capability. Running its worker
requires organizer authorization. Keep delivery disabled until both devices have been
prepared and explicit send authorization has been given. Association creates the demo
start 31 minutes ahead; after approximately one minute it enters the real 25–30 minute
claim window without weakening the strict “starred more than 30 minutes before” rule.
The separate late-star fixture starts 20 minutes ahead and therefore exercises the same
worker's suppression rule without modifying a real event.

Rollback removes the synthetic tables/functions and added ledger columns, then restores
the prior claim RPC. The migration is additive and never updates Schedule records.
