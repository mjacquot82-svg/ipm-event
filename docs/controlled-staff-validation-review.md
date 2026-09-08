# Controlled staff validation — prepared, NOT deployed

Choose **B: random repair 0%** during this proof stage. Keep population observation
active and retain Marc's existing pilot reference and VERIFIED metadata. A reviewed
operator transition will keep `POPULATION_REPAIR_STAGED`, `enabled=true`,
`repair_enabled=true`, but set `repair_cohort_percent=0`. No such transition was
performed while preparing this release.

## Architecture and release scope

The deployed backend lineage is `1891003e1d010c46e9a8ae2187ffaae4fdba8c2c`, confirmed
through its public read-only health endpoint. The frontend source lineage is
`ec83d83e` (`release/production-pilot-controlled-binding-frontend`). Separate release
branches preserve these independently deployed lineages; neither merges staging.

The existing controls support one pilot or a percentage cohort, not an independent
staff cohort. Therefore a migration and small backend/frontend additions are needed.
Seven additive fields on the existing RLS-protected, service-role-only reconciliation
table record recent capability-owned observation, expiring membership bound to the
capability and installation digests, and a provider PATCH authorization counter.
No new table, secret, invitation, token, organizer account or notification is needed.

A read-only production endpoint returns the existing 10-character SHA-256-derived
support reference. Normal **About → Show notification support reference** displays
it only on demand. The endpoint accepts the existing capability header and **no
request body**, registration ID or installation ID. It cannot enroll anything.
The reference is a locator, not a bearer credential or staff authorization.

An operator privately calls `ipm_designate_staff_validation` with the consenting
staff member's reference and `consent=true`. The RPC is not callable by anon or
authenticated users and is not exposed through an enrollment HTTP route. Operator
staff/consent verification is required; do not identify people by activity recency,
user agent, account name guesses, or a list of attendees.

The RPC resolves exactly one production-event registration and requires a completed
normal capability-owned observation within 15 minutes. It rejects ambiguity, missing
controls, active work, changed identity, uncertainty, project failures and an open
circuit. Membership lasts 24 hours, is capped at three concurrent registrations,
and is rechecked at the pre-PATCH fence. Existing cooldowns, verification freshness,
leases, generation fences and rate limits are never cleared by designation.

The current SDK installation assertion in the existing reconciliation payload remains
an equality check against the capability-resolved server registration. It does not
select the target. The new reference/designation mechanism accepts neither raw
registration IDs nor installation IDs. Provider PATCH still uses the RPC's private
server-resolved target. Staff status supplies no permission, provider, subscription,
key or identity eligibility.

Healthy comparison follows the unchanged VERIFYING/browser-confirm/VERIFIED protocol
without PATCH. Eligible stale material follows the unchanged guarded PATCH/read-back/
browser-confirm protocol. KEY_MISMATCH, identity ambiguity and unsafe readiness are
excluded. Uncertainty disables staff repair authorization; no uncertain PATCH is
replayed. Registration rebinding invalidates membership rather than following the
replacement installation. No browser subscription/permission/SDK mutation was added.

## Migration and review

Migration: `supabase/migrations/20260908135443_controlled_staff_validation.sql`

SHA-256: `176eeb9fe35539afb4091c7e1ab90c47d558906e374b48287f3cf4851295a8fc`

Apply transactionally only after review and explicit production authorization.
The migration itself adds inactive fields and replaces private functions; it does
not change operating mode, percentages, flags, existing pilot or notification data.
All function EXECUTE grants are revoked from PUBLIC/anon/authenticated and granted
only to service_role, consistent with the existing private coordination model and
[Supabase's function privilege guidance](https://supabase.com/docs/guides/database/functions#function-privileges).

After authorization: first change the random percentage to 0 under the existing
project lock and wait for active operations to settle. Apply the migration, deploy
the reviewed backend and frontend source revisions, verify release identity and
sanitized health, then begin staff observations. If anything is uncertain, stop.
Do not distribute the local compilation artifact; its WonderPush key is a build-only
placeholder. Deployment must build reviewed source with existing production settings.

Rollback: set `repair_enabled=false` and random percent 0 under the project lock;
keep observation enabled. Retain all metadata and let in-flight operations settle.
Expire memberships under the same project-first lock ordering. Do not drop fields,
clear counters, clear client storage, reset permission, or recreate installations.
There is no automatic promotion or automatic reset of project failure counters.

## Exact staff procedure, after authorized deployment

1. Marc and the operator identify a known consenting staff member privately.
2. Staff opens normal `https://theipm.ca` in their usual supported browser/profile
   (the existing installed app on iOS). Enable notifications only if wanted and not
   already enabled. Do not disable/re-enable working notifications.
3. Let normal setup establish the capability registration and normal reconciliation
   observe. An existing healthy capability bypasses legacy replacement/rebinding.
4. In **About**, tap **Show notification support reference** and privately give that
   reference to the operator. No diagnostic page, copied credentials or raw IDs.
5. The operator verifies the recent completed observation and consent, then invokes
   the private designation RPC with bound parameters in the approved secure tool.
   An ambiguous/failed designation stops the flow; do not guess another registration.
6. After the operator confirms designation, foreground or close/reopen normal IPM.
   Respect `next_attempt_at` and rate limits. A fresh VERIFIED result stays cached;
   the immediately preceding healthy read/confirmation is the no-write evidence.
   Do not expire verification merely to manufacture another provider read. A stale
   mismatch waits its normal cooldown and then follows the same permanent lifecycle.
7. Record only the sanitized evidence below. A cached VERIFIED record predating this
   exercise is not a new independent device execution. If freshness prevents a new
   observation, wait for its normal expiry or use another consenting staff device.

The operator does not manually invoke reconcile or PATCH. Marc's prior VERIFIED
record is retained; reconfirm his sanitized state without resetting its freshness.
Stop on uncertainty, identity crossing, unexpected installation, permission or
subscription mutation, provider error spike, circuit opening or retry storm.

## Evidence record

No new physical staff validation has occurred. Marc's earlier repair, verification,
controlled delivery and deep link are user-supplied evidence, not re-executed here.
The health read confirmed one VERIFIED record but cannot identify it as Marc.

For each device report only these fields (use `unknown` until actually evidenced):

| Field | Allowed report |
|---|---|
| Registration ownership proven | true / false / unknown |
| Permission granted | true / false / unknown |
| Browser subscription present | true / false / unknown |
| Provider identity consistent | true / false / unknown |
| applicationServerKey match | true / false / unknown |
| Initial state | HEALTHY / MISMATCH / KEY_MISMATCH / INELIGIBLE / OTHER |
| Provider PATCH occurred | true / false / unknown |
| Final state | sanitized reconciliation state |
| VERIFIED | true / false / unknown |
| Browser subscription preserved | true / false / unknown |
| Installation identity preserved | true / false / unknown |
| Permission preserved | true / false / unknown |
| Failures / uncertainty | sanitized classification and count |

Record a private pre/post counter baseline and the normal lifecycle result. The new
`patch_attempts` counter records authorization to attempt PATCH, not proof that an
ambiguous network request was received. A completed mismatch → PATCH authorization
→ successful read-back → browser confirmation supports `PATCH occurred=true`;
a healthy comparison with counter delta 0 supports false. Any uncertain/unfinished
attempt remains unknown and stops validation. Never infer preservation from a
server comparison alone: final VERIFIED includes the existing browser reread and
confirmation checks. Do not export references, IDs, hashes or subscription material.

At preparation, production health reported: mode staged, random 1%, observation and
repair enabled, VERIFIED 1, MISMATCH 1, INELIGIBLE 2, no active leases/retries,
uncertain 0, circuit closed, and accumulated per-registration `failure_count=5`.
This counter includes non-VERIFYING finishes in existing code and is different from
project/provider failures. The user reported project failures 0; the public health
endpoint does not expose that separate counter. Establish a baseline and investigate
new increments by classification instead of silently treating all counters as zero.

## Evidence value and next decision

One additional independent device completing normal reconciliation gives multi-device
production evidence beyond Marc: healthy no-write behavior or guarded stale-material
repair, with the same identity and preservation gates. That is enough to remove the
inactive random 1% registration as the immediate **mechanism-validation** blocker.
It does not establish population success rates or delivery to every attendee.

Two additional independent devices provide stronger reproducibility and, if naturally
available, browser/profile diversity and coverage of both healthy and stale states.
Do not manufacture a mismatch or mutate a subscription to obtain coverage.

After success, recommend a separately reviewed **5% deterministic registration cohort**,
then 10% only after meaningful completed observations and no stop conditions. Use the
existing server hash bucket, never manually chosen attendees. Remove/expire temporary
staff memberships after proof. Do not jump to 100% or wait on the original idle 1%
registration specifically. No-activity is absent evidence, not a repair failure.

Notify Everyone is **BLOCKED now**: the additional-device validation is still pending.
After staff success, the reconciliation mechanism proof blocker is removed. READY
requires the existing authorization, production audience/targeting, provider readiness,
deep-link/delivery evidence and no-stop checks to be independently satisfied. This
release does not certify those broader send-path checks or guarantee offline-device
reachability. If those prior checks are still valid, successful staff proof can close
this blocker; otherwise the smallest remaining task is a read-only verification of
the outstanding send-path/audience gate. READY is not authorization to send.

## Verification performed

- 92 backend/unit/real PostgreSQL tests passed in the complete focused run; four
  additional endpoint origin/capability/exception privacy guards passed afterward
  (23 endpoint tests in that final targeted run, 96 unique passing tests overall).
- Real PostgreSQL 16 on isolated loopback port 55439: multiple-instance coordination,
  1,000 nonpilot exclusions, healthy no-write, guarded mismatch repair, KEY_MISMATCH,
  ambiguity, changed identity, expiry, revocation, circuit changes, capacity races,
  missing controls, role privileges, uncertain outcomes, generation and lease fences.
- 22 frontend lifecycle/deep-link/card/privacy tests passed; TypeScript passed.
- Changed frontend files linted with zero errors and one pre-existing colors-import
  warning. Python compilation and diff whitespace checks passed.
- Production-mode frontend export passed using a non-deployable placeholder web key;
  the output contains the new support-reference flow and existing reconciliation.
- Migration applied successfully to disposable PostgreSQL. No production/staging DB
  writes, deployment, notification, Notify Everyone action, or staff mutation occurred.

**One next action: Marc reviews the prepared backend/frontend revisions and migration.**
Keep Jen's device unchanged until production deployment is explicitly authorized.
