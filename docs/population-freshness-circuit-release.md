# Population lifecycle freshness and circuit authorization

Prepared from deployed backend `1891003e1d010c46e9a8ae2187ffaae4fdba8c2c`.
This release replaces only `public.ipm_reconciliation(jsonb)`. It does not include
any controlled-staff-cohort implementation, frontend change, configuration write,
notification, subscription enrollment, or provider installation creation.

## Root causes and corrections

The claim action returned VERIFIED when its stored six-hour verification expiry
was still in the future and the browser fingerprint was unchanged. That bypassed
both the provider GET and current comparison, hiding provider-side drift.
The shortcut is removed. Historical verification timestamps remain available;
every admitted check now claims COMPARING and uses the unchanged backend's fresh
provider read. A healthy comparison performs no PATCH. Same-key safe drift uses
the existing repair and all-four-field read-back/confirmation protocol.

Existing admission limits remain four comparisons per registration per hour and
120 per project per minute, with operation leases, browser coalescing, and bounded
retries. Each admitted healthy check uses one GET; a repair also uses a read-back
GET. An exhausted budget returns DEFERRED/RATE_LIMIT, never cached VERIFIED as
fresh proof. Drift is detected on the next admitted normal lifecycle; there is no
promise to check every foreground while throttled and no new polling scheduler.

The PATCH action already locked the project row but did not inspect its current
circuit state. A failure in another request after claim could therefore open the
circuit without fencing the impending PATCH. The replacement checks open_until
under that same project lock immediately before PATCH_PENDING. A denied owned
claim becomes DEFERRED/CIRCUIT_OPEN, releases its operation/lease, and carries the
circuit deadline. It does not change uncertainty or failure counters. All earlier
ownership, configuration, cohort, fingerprint, generation, status and lease gates
remain in place. Time is refreshed after lock acquisition to avoid stale lease
and circuit decisions after contention.

The authorization is serialized with circuit opening. An already authorized
external HTTP request cannot be recalled by a later circuit opening; this change
fences openings that precede PATCH authorization, including after claim.

## Validation

- Real PostgreSQL 16: 47 population acceptance cases (A-L and supporting gates),
  plus all 16 existing coordination cases: **63 passed**.
- Backend reconciliation/production routes/registration regressions: **51 passed**
  (five existing dependency/deprecation warnings).
- Deployed frontend core/lifecycle modules: **17 passed**; no frontend changes.
- Python compilation and deployed frontend TypeScript `tsc --noEmit`: passed.
- Privacy canaries include changed freshness and circuit paths, with synthetic
  capability, registration, installation, credential and subscription material.
- Migration reapplication preserves all test project/registration metadata;
  role privileges and RLS remain restricted. Diff whitespace checks passed.

Provider transport is fake in acceptance tests; coordination runs against real
local PostgreSQL, with concurrent transactions. No production provider mutation
or new real-device validation was performed. Existing production evidence is
unchanged. Passing at 100% establishes guarded lifecycle eligibility, not delivery
success on every attendee device or broadcast readiness.

### Reproduce PostgreSQL tests

Use a disposable PostgreSQL 16 database named `ipm_freshness_fix` at loopback
port 55439; never point these truncating fixtures at production. Set
`IPM_RECONCILIATION_TEST_DSN` to that disposable database and install
`tests/requirements-reconciliation.txt`. Provision roles `anon`, `authenticated`,
`service_role`, extension `pgcrypto`, and the test-only event stub:
`create table public.events(id uuid primary key, slug text unique);`.
Apply these migration files in order:

1. `20260829000100_production_notification_installations.sql`
2. `20260907000100_subscription_reconciliation.sql`
3. `20260907000200_subscription_reconciliation_binding.sql`
4. `20260908000300_reconciliation_population_modes.sql`
5. `20260908155153_reconciliation_freshness_circuit_fences.sql`

Run `python -m pytest -q tests/test_reconciliation_postgres.py tests/test_population_100_eligibility.py`.
For backend regressions run `python -m pytest -q tests/test_subscription_reconciliation.py tests/test_production_reconciliation.py tests/test_notification_registrations.py`.

## Production sequence — requires separate approval

1. Review this isolated diff against the deployed backend. Check deployed RPC and
   configuration still match the reviewed baseline. Capture private rollback
   function definition and sanitized health counters.
2. Apply only `supabase/migrations/20260908155153_reconciliation_freshness_circuit_fences.sql`
   transactionally, recording migration version `20260908155153`. SHA-256:
   `04fa8b241749441c385dacee712118af6a0053f23a057f20e88b281b7f429aa9`.
   Do not run a bulk migration push that could include unrelated pending files.
   This function-only migration is compatible with the currently deployed backend;
   neither a backend nor frontend redeploy is required.
3. Verify the installed function/privileges and preserved state: staged mode,
   enabled=true, repair_enabled=true, cohort=3; pilot, target and allowlist unchanged;
   zero uncertainty/project failures and closed circuit. Observe normal lifecycle
   results with the existing stop conditions.
4. Only with separate authorization, set **repair_cohort_percent 3 → 100**, preserving
   every other field. This permits naturally participating capability owners to
   enter the guarded path; it schedules no work and touches no offline device.

If unsafe behavior appears, use the established separately authorized stop process:
POPULATION_OBSERVE, enabled=true, repair_enabled=false, cohort=0. Do not silently
restore the old defective function while leaving population repair enabled.

**POPULATION SELF-HEALING 100% ELIGIBILITY = SAFE for this tested release after the
migration is approved and installed.** The current live function still contains
both blockers. Notify Everyone targeting and readiness are unchanged; it remains
BLOCKED pending the required real non-pilot evidence. No production changes or
notifications were made while preparing this release.
