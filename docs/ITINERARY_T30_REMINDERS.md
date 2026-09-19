# Production candidate: itinerary T-30 reminders

Scheduler and delivery are hard-disabled in `backend/server.py`. This release preparation does not authorize activation.

Included: capability-bound installation registration, real star-set synchronization, stale favorite reconciliation, provider readiness verification, current Schedule refresh, normal T-30 eligibility, exact-installation targeting, durable claims and idempotency.

Excluded: controlled device check-in/labels, controlled claims, accelerated fixtures, synthetic events, delivery arms, allowlists, benchmark endpoints and load-test infrastructure.

Before a separately approved activation: apply the reviewed generic migrations, verify provider settings and runtime isolation, and complete the separate infrastructure/readiness phase. No provider messages are sent by candidate validation.
