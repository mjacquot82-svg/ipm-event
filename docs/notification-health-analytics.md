# Notification health analytics — staging change

## Audit and design

The old Analytics card said “Notifications Enabled” for a stored provider mirror.
It did not display registration totals or reconciliation coverage and could imply
that each record represented a person with working notifications. Announcement
history said “Known deliverable devices at send”; it is now labelled “Provider-ready
registrations at send.” Provider acceptance is explicitly distinguished from receipt.

Existing engagement reporting already covers anonymous visitors, sessions, launches,
installed-PWA visitors, announcement impressions/opens and open sources. Those metrics
are retained. Announcement delivery history already reports send status, provider
acceptance and immutable audience snapshots. It is not duplicated by another ledger.
A `sent` ledger status follows successful provider acceptance; `failed` is a send
failure and does not necessarily prove a definitive provider rejection. Historical
records without audience snapshots remain unavailable. Announcement opens by source
include tracked notification deep-link engagement where recorded; these are not
provider click totals, unique recipients or device-delivery receipts.

## Exact metric definitions

All health counts are event-scoped registrations, independent of the engagement date
filter. The endpoint uses service-role **GETs only**, projected columns and paginated
reads; it never calls reconciliation RPCs or notification providers. The result is
an aggregate taken during the read, not a transactionally frozen snapshot across
multiple pages and the project circuit read. Refresh reads again.

| UI metric | Definition |
| --- | --- |
| Notification registrations | Distinct stored notification registration records for the configured event. Not people, opt-ins or guaranteed recipients. |
| Checked | Registrations with reconciliation metadata, including incomplete checks. |
| Not yet checked | Registrations minus checked. Not automatically broken. |
| Verified | Current status VERIFIED: equality confirmed at the most recent successful check, not guaranteed current receipt. |
| Repairable mismatch | Current MISMATCH with normal MISMATCH or absent outcome. May become eligible on fresh device activity; eligibility is not changed. |
| Key mismatch | Current INELIGIBLE with KEY_MISMATCH. Intentionally excluded from automatic repair. |
| Other ineligible | Current INELIGIBLE excluding KEY_MISMATCH. |
| Other checked states | Remaining checked records, including deferred and in-progress states. These five status groups partition Checked. |
| Provider-ready at last check | Latest timestamped evidence per registration: legacy provider_deliverable or reconciliation provider_ready. Newer negative evidence overrides old positive evidence; reconciliation wins ties. Readiness is separate from equality and receipt. |
| Stale provider-ready | Ready records whose evidence is older than 24 hours. |
| Verified due for check | VERIFIED records with expired or absent equality expiry. |
| Repairs attempted / verified / failed | Null / “Not recorded”; no historical count can be proven. |
| Current check failures | Current DEFERRED or OUTCOME_UNKNOWN with NETWORK, PROVIDER, AUTH, BILLING, POLICY, RATE_LIMIT, DATA or IDENTITY outcome. Registrations, not historical repair failures. |
| Uncertain outcomes | Uncertain flag or OUTCOME_UNKNOWN status, counted once per registration. May overlap active operations. |
| Active operations | Unexpired stored leases. Does not prove a worker is running. |
| Expired leases | Stored leases at or before the read time. |
| Retries due / scheduled | Non-null next_attempt_at at/before now or in the future. Device activity and existing guards still apply; not a batch queue. |
| Circuit | OPEN if project open_until is in the future, otherwise CLOSED. Missing project record is UNKNOWN. Project-wide; not proof of readiness or repair enablement. |
| Latest activity | Maximum valid reconciliation updated_at or provider-check timestamp among event registrations. Configuration changes are not included. |
| Loaded | Time the aggregate was computed. |

## Historical repair limits and privacy

Healthy checks and repaired checks both finish VERIFYING, then VERIFIED. The current
metadata does not retain repair provenance. Failure counters include non-repair
checks, reset on success and are not lifetime totals. Population-mode and freshness
fence migrations inspected in the production release branches do not change this
limitation. No counts are inferred, and **no migration is added** (user option A).
A future durable repair ledger would require a separately reviewed scope decision.

Database registration IDs are used only internally for deduplication. Neither IDs,
installation identities, fingerprints, hashes, subscription material, provider
credentials nor error messages are returned. The endpoint requires the existing
organizer authentication and event authorization, returns `Cache-Control: no-store`,
and returns only a generic storage error on failure. Missing health storage is shown
as unavailable rather than zero or silently hidden.

## Validation

- Focused backend analytics/reconciliation/privacy/auth tests: 125 passed.
- Existing isolated PostgreSQL 16 reconciliation tests: 13 passed. No migration needed.
- Full backend suite after making existing local source assets available: 269 passed,
  5 failed, 1 optional PostgreSQL module skipped in this invocation. All five failures
  reproduce on unchanged origin/staging: MNP workbook descriptions differ from the
  approved import fixture. No source data or schedule code was changed.
- Full frontend suite: 310 passed, 2 failed. Both reproduce on unchanged staging:
  obsolete map import assertion and missing frontend/data fixture directory.
- Focused frontend analytics tests: 43 passed.
- TypeScript and lint for changed frontend files: passed.
- Python compilation: passed.
- Staging-configured Expo build: passed; new health UI and staging backend verified
  in the generated bundle.
- Chromium fixture browser checks: desktop 1440px and mobile 390px passed, no document
  overflow. The fixture test blocks external providers and rejects API mutations.
  Other analytics are deliberately unavailable in this fixture to test independence.

Browser test: serve `frontend/dist` on localhost:8094 with SPA fallback, then run
`node frontend/tests/notification-health-layout.browser.mjs`. Supply PLAYWRIGHT_MODULE
and CHROMIUM_PATH if Playwright/Chromium are installed outside normal resolution.
Screenshots are written to /tmp/ipm-health-*.png.

## Deployment and interpretation

Base: remote staging 2d1350ad. Work branch: codex/notification-health-analytics-20260908.
Staging deployment and direct authenticated staging verification remain pending.
Render requested confirmation of “marc's workspace” before service access; an existing
staging admin login/session is also needed for direct authenticated verification.

Marc/Jen should start with registration coverage, then read the current status groups.
Unchecked is not broken; verified is historical agreement, not a receipt promise.
Readiness can coexist with mismatch. Review key mismatches, uncertainty, current errors
and circuit pauses separately. “Not recorded” must never be read as zero repairs.

Production, reconciliation behavior/guards, repair eligibility/cohort/configuration,
WonderPush state, browser subscriptions/permissions, sends, announcement sending,
schedule, vendors, maps and onboarding are unchanged. No notification was sent.
