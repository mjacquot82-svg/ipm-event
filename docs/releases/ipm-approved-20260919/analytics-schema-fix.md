# Production analytics schema leak — release-candidate correction

Prior candidate: `949d7abaf379d8a68cfae5f506b7e601ee91e1e6`. This correction changes only one query filter and one organizer help sentence in production runtime. No delivery, targeting, claiming, idempotency, scheduler, migration, data or tutorial behavior changes.

## Root cause and correction

The analytics reader came from a mixed staging ledger. `controlled_fixture_id=is.null` excluded controlled fixture-linked deliveries there, but the deliberately cleaned production schema has no such column. The previous empty-list mock accepted arbitrary query parameters and masked the mismatch.

Production uses event-scoped `itinerary_reminder_deliveries` and `reminder_type=itinerary_t30`; the table constrains that reminder type. Retain both event scope and the normal reminder-type filter, remove the unsupported fixture filter. No replacement staging column or infrastructure is added. Organizer copy now reads “Current interests and all-time reminder outcomes.”

## Production-schema regression

`tests/test_reminder_analytics_production_schema.py` runs actual PostgREST 13.0.7 against disposable PostgreSQL 17. The database container has `--network none`, no published ports, no live credentials, and tmpfs data. PostgREST binds only inside that container. The shared fixture applies production prerequisites and all six intended candidate migrations, unchanged. Test-only service-role grants mirror Supabase access and never reach production.

Three integration tests prove:

1. The schema has no controlled fixture column; the original HTTP filter returns 400.
2. The actual FastAPI T-30 analytics endpoint succeeds through real PostgREST queries/RPC: five active interests, four claims, one accepted, one failed, one unknown, one due and four already-claimed eligible interests. Another event is excluded; unrecorded duplicate-suppression totals remain unavailable. Repeated reads preserve the complete delivery ledger.
3. A historical announcement row retains null provider metrics; organizer overview reports acceptance without inventing receipt/open/failure counts.

Full backend suite: **400 passed, 165 warnings, 8 subtests passed**. Frontend analytics: **23 passed**. TypeScript, production build (local Build **376689**), Python compilation and diff checks pass. Organizer overview browser checks also pass at 390, 768 and 1440 pixels across seven data scenarios, plus failure/navigation checks, with zero provider calls or API mutations. Earlier full candidate frontend coverage remains documented separately. No real notification was sent. Delivery engine, server, provider transport and all migrations were compared byte-for-byte with the prior candidate.

To reproduce the schema tests, provide `POSTGREST_BIN=/path/to/static/postgrest` and run `pytest -q tests/test_reminder_analytics_production_schema.py` with the repository tooling wrapper. Missing PostgREST fails explicitly instead of silently skipping. Binary used: official [PostgREST v13.0.7 release](https://github.com/PostgREST/postgrest/releases/tag/v13.0.7), linux-static-x86-64 archive SHA-256 `4153f81ccc40e7b735edc89cd84b49da25ba27eb37d57c7f6a82c9005a0b762b`. No application dependency was added. Test configuration follows [PostgREST configuration documentation](https://docs.postgrest.org/en/stable/references/configuration.html).

## Exclusion audit

Every tracked text file, including tracked generated bundles, was scanned, plus the new schema regression. The two production matches requiring removal were the query filter and organizer sentence; both are removed. Below are all remaining matches at the audit checkpoint. This new report itself is an inert audit document.

| Match | Classification |
|---|---|
| `docs/ITINERARY_T30_REMINDERS.md:7` | PRODUCTION-SAFE INERT TEST/DOC REFERENCE |
| `docs/releases/ipm-approved-20260919/README.md:19` | PRODUCTION-SAFE INERT TEST/DOC REFERENCE |
| `docs/releases/ipm-approved-20260919/README.md:21` | PRODUCTION-SAFE INERT TEST/DOC REFERENCE |
| `docs/releases/ipm-approved-20260919/file-audit.md:146` | PRODUCTION-SAFE INERT TEST/DOC REFERENCE |
| `docs/releases/ipm-approved-20260919/file-audit.md:381` | PRODUCTION-SAFE INERT TEST/DOC REFERENCE |
| `docs/releases/ipm-approved-20260919/migration-environment-audit.md:30` | PRODUCTION-SAFE INERT TEST/DOC REFERENCE |
| `docs/releases/ipm-approved-20260919/migration-environment-audit.md:35` | PRODUCTION-SAFE INERT TEST/DOC REFERENCE |
| `docs/releases/ipm-approved-20260919/migration-environment-audit.md:36` | PRODUCTION-SAFE INERT TEST/DOC REFERENCE |
| `docs/releases/ipm-approved-20260919/migration-environment-audit.md:38` | PRODUCTION-SAFE INERT TEST/DOC REFERENCE |
| `docs/releases/ipm-approved-20260919/validation.md:21` | PRODUCTION-SAFE INERT TEST/DOC REFERENCE |
| `docs/releases/ipm-approved-20260919/validation.md:42` | PRODUCTION-SAFE INERT TEST/DOC REFERENCE |
| `frontend/tests/first-visit-walkthroughs.browser.mjs:35` | PRODUCTION-SAFE INERT TEST/DOC REFERENCE |
| `frontend/tests/notification-analytics.test.mjs:74` | PRODUCTION-SAFE INERT TEST/DOC REFERENCE |
| `frontend/tests/schedule-category-colours.test.mjs:105` | PRODUCTION-SAFE INERT TEST/DOC REFERENCE |
| `tests/test_organizer_account_api.py:56` | PRODUCTION-SAFE INERT TEST/DOC REFERENCE |
| `tests/test_organizer_account_api.py:78` | PRODUCTION-SAFE INERT TEST/DOC REFERENCE |
| `tests/test_organizer_account_api.py:89` | PRODUCTION-SAFE INERT TEST/DOC REFERENCE |
| `tests/test_organizer_account_api.py:200` | PRODUCTION-SAFE INERT TEST/DOC REFERENCE |
| `tests/test_release_candidate_isolation.py:19` | PRODUCTION-SAFE INERT TEST/DOC REFERENCE |
| `tests/test_reminder_analytics_production_schema.py:71` | PRODUCTION-SAFE INERT TEST/DOC REFERENCE |
| `tests/test_reminder_analytics_production_schema.py:72` | PRODUCTION-SAFE INERT TEST/DOC REFERENCE |
| `tests/test_reminder_analytics_production_schema.py:111` | PRODUCTION-SAFE INERT TEST/DOC REFERENCE |

Production-runtime exclusions: no Device A data, Arm UI, controlled fixture/claim infrastructure, staging T-30 allowlists, accelerated reminder timing, synthetic reminder events, hard-coded test UUIDs or test provider installation values are introduced or required. The tutorial preview compatibility hook always returns false. Real production content UUIDs and isolated test fixtures are not test-device targeting.

Existing production organizer announcement test-send configuration and restricted production diagnostics remain unchanged from main; they are not staging reminder harnesses and were not invoked. Existing map/outbound analytics use “controlled” to mean allowlisted source/destination IDs, not controlled test deliveries, and are unchanged.

## Release status and deployment safety

The proven analytics code/schema blocker is fixed. The separate final preflight remains pending actual Render configuration verification and explicit deployment authorization. PR #43 remains draft. No production database operation, migration, notification, deployment, main update or frozen staging update is authorized by this fix.

PR #43's title includes `[skip netlify]` to suppress its Deploy Preview before pushing. The previous commit-only marker did not cover PR previews; [Netlify documents the PR-title mechanism](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/). No production settings are changed.

## Local evidence checksums

Raw logs/screenshots remain under `.artifacts/analytics-schema-fix/`; no credentials or broad evidence folders are committed.

| File | SHA-256 |
|---|---|
| `backend.txt` | `46e40c8b388d78c613856b49328fc1eaf4734c4f2d5b208c1776b5f90d0ac745` |
| `browser.txt` | `99348713dc3cd36aa19e9205d7392dcf04ec85d8b68d5dda5f5d27eda9234505` |
| `build.txt` | `5d65a634d4411055be08af62f7842d18c28da824954af5ef8f9dc10c0149a560` |
| `exclusion-matches.json` | `8e23014fb369a97acad17a8d1591440a9f16d7afb15e59763fb0042125a52867` |
| `frontend.txt` | `e8f3c79d36f0900389bb0b5cb21c4990bb46c8258c5008b572c08d14590178c1` |
| `schema.txt` | `255faeac1114efa3a492bebc44e4a339756286e899dbfa26921ac80fb9acb84a` |
| `types.txt` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
