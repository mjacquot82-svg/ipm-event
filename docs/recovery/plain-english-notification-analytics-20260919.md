# Plain-English notification analytics — staging only

Based on staging d7575f6d. No production changes, sends, registration repairs, scheduler changes or migrations.

Organizer announcement summary and per-announcement cards now distinguish accepted requests, confirmed receipts, taps, attributed link visits and provider-reported failures. Definitions are shared. Unknown values show Unavailable; measured zero remains 0. Exact targeting is displayed only with provider-target evidence; a local snapshot is labelled Estimated available registrations at send time. Historical sends get an evidence-based explanation without exposing provider IDs. Each aggregate metric keeps independent coverage; detailed coverage means at least one supported receipt/tap/visit/failure metric is known, not that every metric is complete.

Health summary adds registration and stale-readiness counts to the existing read-only report. Positive readiness is explicitly stored evidence, not readiness now. Diagnostics remain collapsed and Owner-only. Reconciliation state/logic is unchanged.

Existing future-send pipeline preserved and exercised with mocks: persisted delivery UUID -> audience-separated unique campaign ID and provider idempotency key -> opaque notification_ref deep link -> validated, navigation-deduplicated visit ledger. Repeated test sends have distinct IDs; duplicate/ambiguous broadcasts remain guarded. Read-only provider reports use exact campaigns, bounded refresh and nullable counts. Gateway sent counts are not presented as receipts or exact targets. Rich-image payload remains unchanged.

Validation before publication:
- Backend notification/announcement/analytics/readiness/registration/migration selection: 161 passed.
- Frontend focused analytics/announcement/attribution/auth selection: 71 passed.
- Broader frontend selection: 73 passed, two existing admin-auth-network failures (obsolete bodyless Content-Type expectation and superseded vendor proxy expectation). Unrelated expectations were not changed.
- TypeScript: only existing itinerary.tsx:225 TS2367; not a clean typecheck claim.
- Production-style frontend build passed. Python compilation and git diff --check passed.
- Real built app with intercepted organizer fixtures: overview empty/historical/full/partial/zero/failure states at 320/390/768/1440; per-announcement labels and unknowns; Communications no diagnostics request, Owner collapsed/expandable diagnostics; no overflow. Attribution browser: notification navigation one, reload still one, ordinary navigation adds no attributed visit, new navigation adds one.
- All browser API traffic mocked, external/provider traffic blocked. No live notification requests.

Historical fixture: Celebration of Excellence Banquet and THE BRUCE RV PARK IS OPEN! -> 2 accepted, detail coverage 0 of 2, four detailed metrics Unavailable. These are browser fixtures, not records inserted into staging or production. Screenshots retained locally under .artifacts/plain-analytics.

Publication and final SHA/build recorded in .artifacts/plain-analytics/verification.json after published-bundle checks.
