# Reminder scale and failure-safety testing

Run the provider-free simulation with:

```bash
python -m scripts.reminder_scale_test
```

The model uses the staging defaults: batch 250, concurrency 20, send rate 10/second,
and 60-second scheduler cycles. It concretely constructs and claims up to 10,000
eligible reminder identities plus late, unstarred, unreachable, and duplicate/racing
candidates. It never imports or calls WonderPush.

| Eligible | Drain lower bound | <=1 min | <=2 min | <=5 min |
|---:|---:|---:|---:|---:|
| 100 | 9.9s | 100% | 100% | 100% |
| 1,000 | 204.9s | 25.1% | 50.1% | 100% |
| 5,000 | 1,164.9s | 5.02% | 10.02% | 25.02% |
| 10,000 | 2,364.9s | 2.51% | 5.01% | 12.51% |

The 25,000-device/20%-eligible model is the 5,000 row case. These are optimistic
lower bounds because network and database latency are excluded. The current five-minute
eligibility window and 250-row batch mean a large backlog can age out before claim.
Production cutover is therefore blocked pending a queue-ahead design, a provider-approved
numeric quota, and database-backed load/query-plan validation.

Runtime controls are configurable with `ITINERARY_REMINDER_BATCH_SIZE`,
`ITINERARY_REMINDER_CONCURRENCY`, and `ITINERARY_REMINDER_MAX_SENDS_PER_SECOND`.
The default rate of 10/second is deliberately conservative; WonderPush documents
Management API rate limiting and HTTP 429 behavior but does not publish a numeric quota
in its public reference. The provider boundary continues to send exactly one installation
per call.

The in-process circuit breaker opens when at least 20 calls have a 50% failure rate in
the latest 50 outcomes and tests half-open after 60 seconds. This limits a single worker,
but a shared database/queue-backed circuit breaker is required before multi-process
production deployment. The independent global reminder kill switch stops new normal
claims and does not affect announcements.

Official provider references:

- https://docs.wonderpush.com/reference/rate-limiting
- https://docs.wonderpush.com/reference/post-deliveries
