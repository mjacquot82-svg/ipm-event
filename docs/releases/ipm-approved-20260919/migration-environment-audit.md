# Migration and environment audit

Read-only production inspection: Supabase project `hppboivlpqkfhhzfftuu`, event `5119d9d0-ea63-4677-9bea-36e32dbcfa46` (`ipm-2026`). No migrations/data were applied. Production has notification registration/delivery/reconciliation tables; no itinerary reminder tables. Existing relevant tables have RLS enabled. Notification delivery audience snapshot columns, event images and alert images exist; the new analytics outcome columns do not.

## Candidate migration inventory

Apply only after separate authorization, in this order. These scripts contain no scheduler activation, test devices, synthetic content or provider requests.

| Migration | Classification | Purpose |
|---|---|---|
| `20260822000100_schedule_external_identity.sql` | ALREADY PRESENT IN PRODUCTION | Identity/index prerequisite, also recorded in ledger. |
| `20260823000100_itinerary_reminder_targeting.sql` | PRODUCTION REQUIRED | Installation capability binding, stars, unique device/event reminder claims. |
| `20260823000500_harden_itinerary_reminder_readiness.sql` | PRODUCTION REQUIRED | Provider reachability/token freshness; staging controlled-test statements removed. |
| `20260829000100_production_notification_installations.sql` | ALREADY PRESENT IN PRODUCTION | Existing notification opt-in registrations; schema confirmed. |
| `20260829000200_allow_wonderpush_delivery_provider.sql` | ALREADY PRESENT IN PRODUCTION | Existing provider support. |
| `20260901000100_notification_analytics_snapshots.sql` | ALREADY PRESENT IN PRODUCTION | Existing audience snapshot columns/constraints. |
| `20260911000100_announcement_images.sql` | ALREADY PRESENT IN PRODUCTION | Existing image/Storage behavior, unchanged. |
| `20260918000100_production_itinerary_reminder_engine.sql` | PRODUCTION REQUIRED | Normal T-30 windows, claims, outcomes and operational metrics; generic PR #39 schema. |
| `20260918000200_stale_favorite_reconciliation.sql` | PRODUCTION REQUIRED | Ignore/reconcile stale canonical IDs while refusing cross-event IDs. |
| `20260919131605_release_reminder_batch_dependencies.sql` | PRODUCTION REQUIRED | Exact batch audit, leases/recovery, provider control and alerts needed by engine; no benchmark or synthetic dataset. Includes column-qualification correction reproduced by local engine regression. |
| `20260919131634_release_notification_analytics.sql` | PRODUCTION REQUIRED | Accurate analytics outcome/statistics/attribution metadata columns. Renamed from duplicate `20260918000200` version. |

Six required migrations. The four older reminder prerequisites are absent from production and precede later recorded production ledger versions: future deployment must use an explicitly reviewed include-all/targeted migration plan, not assume a plain push will apply them. No ledger repair was performed. Unique candidate versions and fresh-schema ordering were tested.

## Other staging/history migrations

| Migration | Classification | Reason |
|---|---|---|
| `20260823000200_two_device_targeting_test.sql` | STAGING-ONLY — EXCLUDE | Device test machinery. |
| `20260823000300_controlled_targeting_test_claim.sql` | STAGING-ONLY — EXCLUDE | Controlled claims. |
| `20260823000400_controlled_targeting_test_kinds.sql` | STAGING-ONLY — EXCLUDE | Controlled kinds. |
| `20260823000600_real_itinerary_reminder_engine.sql` | NOT NEEDED | Mixed historical/staging engine; generic replacement/dependencies listed above. |
| `20260907000100_subscription_reconciliation.sql` | ALREADY PRESENT IN PRODUCTION | Existing production functionality/ledger uses its own versions; no duplicate replay. |
| `20260909234943_schedule_event_media.sql` | NOT NEEDED | Unapproved extended-media scope; existing production event-image feature preserved. |
| `20260918000100_staging_controlled_real_star_arm.sql` | STAGING-ONLY — EXCLUDE | Arm and controlled fixtures. |
| `20260918000200_staging_controlled_arm_timing.sql` | STAGING-ONLY — EXCLUDE | Accelerated timing. |
| `20260918000200_staging_normal_t30_allowlist.sql` | STAGING-ONLY — EXCLUDE | Test allowlists. |
| `20260918000300_fix_staging_t30_allowlist_ambiguity.sql` | STAGING-ONLY — EXCLUDE | Only repairs excluded staging harness. |
| `20260918000200_accurate_notification_analytics.sql` | NOT NEEDED under old filename | Same approved schema promoted with unique `20260919131634` version. |
| Historical `20260824000300` exact-batch / `20260824000400` distributed-control SQL | NOT NEEDED under old filenames | Required generic bodies extracted into reviewed dependency migration above; no historical harness/benchmark migration is promoted. |

Production ledger observed: `20260822000100`, `20260907223253`, `20260907224529`, `20260908001008`, `20260908011627`, `20260908160401`. Existing `controlled_target_binding` belongs to already deployed production reconciliation; it is neither recreated nor activated by this candidate. Actual schema was checked because the ledger does not describe every existing production object.

## Content, not schema

`docs/releases/artisan-content-review.sql` is a separate, transactional, review-only data patch generated by `backend/prepare_release_artisan_content.py`. It verifies production event identity, preserves existing vendor IDs, rejects conflicting/duplicate presentations and is idempotent. All nine starts use America/Toronto. Existing duplicate matching presentations are not inserted again. Production currently lacks the nine approved occurrences and two catalog vendors in DB; no rows were changed during this audit.

Tutorials store independent local completion keys and require no migration. Route geometry and map assets require no DB migration.

## Environment variables (names only)

| Variable/group | Classification |
|---|---|
| New variables required by this candidate | NONE |
| `EXPO_PUBLIC_BACKEND_URL`, `EXPO_PUBLIC_EVENT_ID`, `EXPO_PUBLIC_WONDERPUSH_WEB_KEY` | ALREADY CONFIGURED in Netlify production; metadata read only. |
| `CONTENT_SOURCE`, `DEFAULT_EVENT_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WONDERPUSH_ACCESS_TOKEN`, `PUBLIC_APP_URL`, existing admin/CORS settings | Existing runtime prerequisites; backend service/database read paths are active. Exact Render configured-key metadata remains unverified pending connector workspace confirmation. No values exposed or changed. |
| `ITINERARY_REMINDER_DELIVERY_ENABLED`, `ITINERARY_REMINDER_SCHEDULER_ENABLED` | NOT ACTIVATABLE through environment in candidate: both hard constants `False`. |
| Staging allowlist/arm/fixture/timing/preview flags | STAGING-ONLY — EXCLUDE; not consumed by candidate. |
| Existing organizer notification test configuration (`WONDERPUSH_TEST_INSTALLATION_IDS`, `WONDERPUSH_TEST_CAMPAIGN_ID`, legacy Webpushr equivalents) | Existing main behavior preserved, not newly required or changed; never invoked for this validation. |
| Optional new production settings | NONE |

No production environment change is required by the code delta. Deployment readiness still requires checking the existing Render configuration. No preview is published: the current preview backend setting is obsolete and the build fallback uses production, so normal preview workflow has not been proven isolated.
