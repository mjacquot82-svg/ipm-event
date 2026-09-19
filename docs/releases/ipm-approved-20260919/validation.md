# Release candidate validation

Validation used the candidate's production-configured local export, Build **376644**, bundle `entry-18b88113ed82fca3ad2c1b2f0d8b3f8f.js`. No candidate was published to either live domain. Browser routes blocked external writes and provider requests; analytics/organizer fixtures were fulfilled locally. Read-only live Schedule data was used for the physical replay regression.

| Check | Final result |
|---|---|
| Backend full suite (`pytest -q tests`) | **397 passed, 165 warnings, 8 subtests passed**, 80.28 seconds. |
| Frontend full `tests/*.test.mjs` suite | **599 passed, 0 failed, 0 skipped**. Includes maps, tutorials, Schedule, Vendors, itinerary/favorites, notifications, analytics, PWA and safety. |
| Fresh-schema/local reminder and importer contract subset | **7 passed**. Disposable PostgreSQL 17, network disabled, fake provider only. |
| Final isolation/migration/importer subset after removing unused load-model helpers | **13 passed**. |
| TypeScript (`tsc --noEmit`) | PASS, no diagnostics. |
| Frontend production build | PASS, Expo web export and offline worker generation. |
| Python `compileall -q backend` | PASS. |
| `git diff --check` | PASS. |

The backend warnings are dependency/deprecated UTC and FastAPI lifecycle warnings, not test failures. PostgreSQL tests include RLS/RPC access, ordered migrations, no controlled/synthetic tables, repeatable content patch, exact eligible T-30 claim, rejection of late stars, disabled-engine zero sends and one fake-provider submission across two normal engine runs.

## Browser regressions

- Schedule Help after all tutorial keys completed, current public Schedule: **390×844, 390×667, 320×568**. Unfiltered/filtered/empty recovery, event spotlight, required real event tap, details, required View on Map tap, final guidance, unrelated-tap rejection, first visit and skip persistence.
- Fresh Schedule → Vendors → Maps at **320px**: independent completion, automatic first visits, no normal repeat, Help replay, skip; `previewWalkthrough=1` deliberately inert.
- Vendors at **320×568, 390×844**, plus contextual walkthrough coverage at **390, 768, 1440px**: real Find on Map spotlight/cue, valid current vendor target/fallback, exact mapped identity, stale selection replacement, final guidance, skip/close, completed replay and no repeat.
- Contextual Schedule/Vendors/Maps at **390, 768, 1440px**: two events at one venue retain distinct event titles, venue secondary, no ambiguous schedule-time rows.
- Parade routes at **390, 768, 1440px**: initial Off, exclusive day selection, geometry/camera alignment, search highlight, reset and Off. Geometry source/overlay identical to approved staging.
- Cached/offline contextual replay completes. Existing production worker, camera interactions and What3Words implementation remain byte-identical to main; their full regressions pass.
- Organizer Analytics at **390, 768, 1440px**: historical nulls stay unavailable, T-30 aggregate, statistics failure does not claim no send, empty/historical/full/mixed/failure/reminder/partial overview scenarios and error/navigation cases. Zero API mutations/provider calls.
- Existing Home/Schedule/My Itinerary save/remove, confirmation, notification offer dismissal/cooldown, no overflow at **390, 1440px**; granted permission never prompts. External write attempts were blocked, not sent.
- Notification attribution browser: notification entry/reload/ordinary entry/new entry deduplicate correctly; every API request mocked.

Visual inspection of saved 320px vendor interaction/final-location screenshots and 390px parade rendering confirms cue/target separation, legible Skip tutorial and vendor identity. The snapshot/evidence manifest records SHA-256 checksums of local screenshots and logs under `.artifacts/release-candidate/`. Raw evidence remains in this worktree; no broad evidence directory or credentials are committed.

## Failures investigated and resolved

- Initial importer tests lacked authoritative workbook/PDF/poster files in this reused worktree. Reused existing verified source files locally; they are not added to the release.
- Historical source assertions described removed map chips, old labels/formatters and incompatible old multi-target organizer tests. Reconciled assertions to the approved behavior and preserved production's single-device test-send restriction; runtime was not weakened to satisfy them.
- PR #39 omitted batch/distributed SQL dependencies. Added only the generic dependencies, then the real local engine exposed ambiguous `target_count`/`batch_id` references in assignment. Qualified those references; the new regression runs the actual functions through completion and deduplication.
- Disposable PostgreSQL startup briefly reported ready during its temporary initialization server. The fixture now waits on its final TCP listener; no production or application behavior changed.
- A test adapter initially represented a one-column table RPC as a scalar; corrected the adapter to return named records as PostgREST does.

## Reported `itinerary.tsx:225 TS2367`

Frozen staging contains `disabled={armState !== 'waiting' || armState === 'working'}` in the **Arm reminder test** block. Once the first comparison is false, the narrowed state is `waiting`, making the second comparison impossible. This expression exists in approved staging before candidate construction. The entire staging-only arm block is excluded, not cosmetically fixed in production. Candidate full TypeScript checking and the production build pass. It does not block this candidate's build/runtime.

## Limits

This is not a live production smoke test, a fresh installed-phone retest, a real push-delivery test or the deferred 100,000-attendee load test. Browser automation cannot substitute for Marc's physical release review. Production migrations, Artisan data writes and T-30 activation remain unapplied/disabled. No unsupported claim of exactly-once delivery by the external provider is made: durable claims/idempotency and ambiguous-outcome no-retry protection were validated locally.
