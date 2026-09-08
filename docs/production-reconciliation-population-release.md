# Production population reconciliation rollout

This release adds explicit operating modes to the existing private singleton:

- `PILOT`: only `pilot_registration_id` is eligible (default and rollback mode).
- `POPULATION_OBSERVE`: every capability-owned registration for `ipm-2026` may
  observe; repair remains disabled.
- `POPULATION_REPAIR_STAGED`: observation remains global and repair is limited
  to the deterministic private registration cohort selected by
  `repair_cohort_percent`.

`pilot_registration_id` is never interpreted as “everyone”. In population
modes it remains a private rollback reference and is not used to select a
 browser registration. Every request still proves capability ownership, event,
 installation identity, permission, subscription material and provider
 readiness before durable coordination. Equality performs no provider PATCH.

The cohort bucket is derived inside the service-role RPC from the registration
UUID with `hashtextextended`; the browser cannot select or observe its bucket.
The existing lease, generation, retry, circuit-breaker, read-back and privacy
rules remain authoritative. Setting the mode back to `POPULATION_OBSERVE` or
`PILOT` disables repair immediately without deleting metadata.

## Rollout

1. Apply the migration with mode `PILOT` and cohort `0`; verify Marc remains
   `VERIFIED` and metadata is unchanged.
2. Deploy the isolated backend release and verify health, ordinary APIs and the
   pilot state.
3. Set mode `POPULATION_OBSERVE`, keep `repair_enabled=false`, and let normal
   attendee lifecycles accumulate metadata.
4. Review state counts, provider readiness, identity failures, uncertain
   outcomes, retries, failures and circuit state. Offline or not-yet-observed
   registrations are not failures.
5. Set mode `POPULATION_REPAIR_STAGED`, enable repair, and increase the cohort
   only after the prior stage has no safety stop condition.

Stop and return to observation-only on any identity-crossing evidence,
uncertain outcome, provider error spike, circuit opening, retry storm, duplicate
installation, permission/subscription mutation, or repair failure rate above
the reviewed threshold. No notification send is part of this rollout.
