# File-by-file staging delta audit

Compared full trees (not only merge-base commits): main `5c41f907821cf11be9c3140d8b8c275c0f9b5c29` and approved staging `d7575f6d4eb8a9dd4730b317c182e0f91450f670`. 409 paths including rename endpoints. Every path is deliberately included, reconciled, or retained from main. New candidate integration/tests/release documents are enumerated by the candidate PR diff.

| Path | Decision | Reason |
|---|---|---|
| `.gitattributes` | EXCLUDED — not introduced | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `AGENTS.md` | EXCLUDED — not introduced | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `CODEX_EVENT_BACK_NAVIGATION_REPORT.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `CODEX_TENTED_CITY_VECTOR_MAP_INTEGRATION_REPORT.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `SHOW_GUIDE_STAGING_SUPABASE_CANONICALIZE_REPORT.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `backend/analytics.py` | INCLUDED unchanged | Approved accurate analytics/generic reminder integration, preserving production announcement send and operational paths. |
| `backend/announcement_images.py` | EXCLUDED — retain main | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `backend/apply_daily_event_schedule_update.py` | EXCLUDED — retain main | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `backend/event_media.py` | EXCLUDED — retain main | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `backend/import_manifests/artisan_angie_resolution_2026.json` | INCLUDED unchanged | Approved Artisan content reconciled to production IDs; nine presentations are a separate review-only SQL patch. |
| `backend/import_manifests/artisan_presenters_2026.json` | INCLUDED selectively reconciled | Approved Artisan content reconciled to production IDs; nine presentations are a separate review-only SQL patch. |
| `backend/import_manifests/daily_event_schedule_2026.json` | EXCLUDED — retain main | Preserve current production content/IDs; only explicitly approved Artisan additions are promoted separately. |
| `backend/import_manifests/ipm_dirtworks_2026.json` | EXCLUDED — not introduced | Preserve current production content/IDs; only explicitly approved Artisan additions are promoted separately. |
| `backend/import_manifests/ipm_dirtworks_2026_review.md` | EXCLUDED — not introduced | Preserve current production content/IDs; only explicitly approved Artisan additions are promoted separately. |
| `backend/import_manifests/landa_content_20260909/approved-content.json` | EXCLUDED — not introduced | Preserve current production content/IDs; only explicitly approved Artisan additions are promoted separately. |
| `backend/import_manifests/landa_content_20260909/assets.json` | EXCLUDED — not introduced | Preserve current production content/IDs; only explicitly approved Artisan additions are promoted separately. |
| `backend/import_manifests/mnp_lifestyles_2026.json` | EXCLUDED — retain main | Preserve current production content/IDs; only explicitly approved Artisan additions are promoted separately. |
| `backend/import_manifests/mnp_lifestyles_2026_fri_sat.json` | EXCLUDED — not introduced | Preserve current production content/IDs; only explicitly approved Artisan additions are promoted separately. |
| `backend/import_manifests/mnp_lifestyles_2026_thu.json` | EXCLUDED — not introduced | Preserve current production content/IDs; only explicitly approved Artisan additions are promoted separately. |
| `backend/import_manifests/mnp_lifestyles_2026_tue.json` | EXCLUDED — not introduced | Preserve current production content/IDs; only explicitly approved Artisan additions are promoted separately. |
| `backend/import_manifests/mnp_lifestyles_2026_wed.json` | EXCLUDED — not introduced | Preserve current production content/IDs; only explicitly approved Artisan additions are promoted separately. |
| `backend/import_manifests/nicole_schneider_20260915.json` | EXCLUDED — not introduced | Preserve current production content/IDs; only explicitly approved Artisan additions are promoted separately. |
| `backend/import_mnp_lifestyles_schedule.py` | EXCLUDED — retain main | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `backend/itinerary_reminders.py` | INCLUDED selectively reconciled | Generic T-30/star/readiness functionality only; staging controls excluded and delivery disabled. |
| `backend/notification_analytics.py` | INCLUDED unchanged | Approved accurate analytics/generic reminder integration, preserving production announcement send and operational paths. |
| `backend/notification_health.py` | INCLUDED unchanged | Approved accurate analytics/generic reminder integration, preserving production announcement send and operational paths. |
| `backend/notification_overview.py` | INCLUDED selectively reconciled | Approved accurate analytics/generic reminder integration, preserving production announcement send and operational paths. |
| `backend/notification_registrations.py` | INCLUDED unchanged | Approved accurate analytics/generic reminder integration, preserving production announcement send and operational paths. |
| `backend/platform_services.py` | INCLUDED selectively reconciled | Approved accurate analytics/generic reminder integration, preserving production announcement send and operational paths. |
| `backend/prepare_artisan_presenters.py` | EXCLUDED — not introduced | Preserve current production content/IDs; only explicitly approved Artisan additions are promoted separately. |
| `backend/prepare_artisan_resolution.py` | EXCLUDED — not introduced | Preserve current production content/IDs; only explicitly approved Artisan additions are promoted separately. |
| `backend/prepare_dirtworks_schedule.py` | EXCLUDED — not introduced | Preserve current production content/IDs; only explicitly approved Artisan additions are promoted separately. |
| `backend/production_binding_diagnostic.py` | EXCLUDED — retain main | Keep existing production behavior, privacy and operational integrations. |
| `backend/production_push_diagnostic.py` | EXCLUDED — retain main | Keep existing production behavior, privacy and operational integrations. |
| `backend/production_push_material.py` | EXCLUDED — retain main | Keep existing production behavior, privacy and operational integrations. |
| `backend/production_reconciliation.py` | EXCLUDED — retain main | Keep existing production behavior, privacy and operational integrations. |
| `backend/reminder_scale.py` | INCLUDED selectively reconciled | Generic T-30/star/readiness functionality only; staging controls excluded and delivery disabled. |
| `backend/server.py` | INCLUDED selectively reconciled | Approved accurate analytics/generic reminder integration, preserving production announcement send and operational paths. |
| `backend/staging_provider_diagnostic.py` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `backend/staging_subscription_compare.py` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `backend/staging_subscription_repair.py` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `backend/subscription_reconciliation.py` | EXCLUDED — retain main | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `backend/what3words.py` | EXCLUDED — retain main | Keep existing production behavior, privacy and operational integrations. |
| `data/IMG_20260915_133655.png` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `data/IMG_20260915_133702.png` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `diagnostics/map-startup/REPORT.md` | EXCLUDED — retain main | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `diagnostics/map-startup/ablation.json` | EXCLUDED — retain main | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `diagnostics/map-startup/gates.json` | EXCLUDED — retain main | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `diagnostics/map-startup/measurements.json` | EXCLUDED — retain main | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `diagnostics/map-startup/tested-source.json` | EXCLUDED — retain main | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `diagnostics/staging-subscription-compare/README.md` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `diagnostics/staging-subscription-compare/browser.test.mjs` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `diagnostics/staging-subscription-compare/build.mjs` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `diagnostics/staging-subscription-compare/compare.mjs` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `diagnostics/staging-subscription-compare/compare.test.mjs` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `diagnostics/staging-subscription-compare/index.html` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `diagnostics/staging-subscription-compare/page.mjs` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `diagnostics/staging-subscription-repair/README.md` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `diagnostics/staging-subscription-repair/browser.test.mjs` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `diagnostics/staging-subscription-repair/build.mjs` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `diagnostics/staging-subscription-repair/index.html` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `diagnostics/staging-subscription-repair/page.mjs` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `diagnostics/staging-subscription-repair/repair.mjs` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `diagnostics/staging-subscription-repair/repair.test.mjs` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `docs/ITINERARY_T30_REMINDERS.md` | INCLUDED selectively reconciled | Generic T-30/star/readiness functionality only; staging controls excluded and delivery disabled. |
| `docs/MAPS_EDUCATION_STAGING.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/analytics/notification-overview.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/analytics/organizer-notification-health.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/browser-first-onboarding.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/consolidated-staging-20260908.md` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `docs/content/ARTISAN_TENT_RESOLVED_20260919.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/content/ARTISAN_TENT_STAGING_20260919.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/content/nicole-dirtworks-staging-20260916.md` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `docs/grounds-layers-staging-approval.md` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `docs/landa-event-media-staging-20260909.md` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `docs/maps/ATTENDEE_TUTORIAL_FINAL.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/maps/CONTEXTUAL_ATTENDEE_HELP_RECOVERY.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/maps/FIRST_VISIT_CONTEXTUAL_WALKTHROUGHS.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/maps/INTERACTIVE_SCHEDULE_WALKTHROUGH.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/maps/PARADE_ROUTES.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/maps/PARKING_HELP_PHYSICAL_REVIEW_FIX.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/maps/TENTED_CITY_CONTROLS.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/notification-health-analytics.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/qa/vendor-interactive-walkthrough-20260919.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/recovery/notification-analytics-20260918/IMPLEMENTATION.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/recovery/notification-analytics-20260918/PRESERVED_FINAL_REPORT.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/recovery/notification-analytics-20260918/RECOVERY.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/recovery/notification-analytics-20260918/provenance.json` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/recovery/notification-analytics-ux-20260918/VALIDATION.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/releases/production-pwa-resume-20260912.md` | EXCLUDED — retain main | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/releases/pwa-resume-current-20260912.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/schedule-help-physical-replay.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/staging-analytics-event-fix-20260908.md` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `docs/subscription-reconciliation.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `docs/tutorial-click-cues.md` | EXCLUDED — not introduced | Historical/source material outside the approved runtime delta; preserve production records. |
| `frontend/app/(tabs)/_layout.tsx` | EXCLUDED — retain main | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `frontend/app/(tabs)/about.tsx` | EXCLUDED — retain main | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `frontend/app/(tabs)/emergency-services.tsx` | EXCLUDED — retain main | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `frontend/app/(tabs)/index.tsx` | EXCLUDED — retain main | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `frontend/app/(tabs)/itinerary.tsx` | INCLUDED selectively reconciled | Generic T-30/star/readiness functionality only; staging controls excluded and delivery disabled. |
| `frontend/app/(tabs)/map.tsx` | INCLUDED selectively reconciled | Approved contextual tutorials/map controls/selection identity; production-only behavior preserved. |
| `frontend/app/(tabs)/schedule.tsx` | INCLUDED selectively reconciled | Approved contextual tutorials/map controls/selection identity; production-only behavior preserved. |
| `frontend/app/(tabs)/vendors.tsx` | INCLUDED selectively reconciled | Approved contextual tutorials/map controls/selection identity; production-only behavior preserved. |
| `frontend/app/_layout.tsx` | EXCLUDED — retain main | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `frontend/app/admin/index.tsx` | INCLUDED selectively reconciled | Approved accurate analytics/generic reminder integration, preserving production announcement send and operational paths. |
| `frontend/app/announcements/[announcement_id].tsx` | INCLUDED unchanged | Approved contextual tutorials/map controls/selection identity; production-only behavior preserved. |
| `frontend/dist/_expo/static/js/web/entry-80f6a7aba23f89cecf81bf478b7e29d6.js` | EXCLUDED — not introduced | Do not transplant the staging bundle; production source is rebuilt. |
| `frontend/dist/_expo/static/js/web/entry-e648524f1b72d92dec49127d8fc4c51a.js` | INCLUDED unchanged | Approved contextual tutorials/map controls/selection identity; production-only behavior preserved. |
| `frontend/dist/_redirects` | INCLUDED selectively reconciled | Approved contextual tutorials/map controls/selection identity; production-only behavior preserved. |
| `frontend/dist/index.html` | INCLUDED selectively reconciled | Approved contextual tutorials/map controls/selection identity; production-only behavior preserved. |
| `frontend/dist/manifest.json` | INCLUDED selectively reconciled | Approved contextual tutorials/map controls/selection identity; production-only behavior preserved. |
| `frontend/dist/webpushr-sw.js` | INCLUDED selectively reconciled | Approved contextual tutorials/map controls/selection identity; production-only behavior preserved. |
| `frontend/package.json` | EXCLUDED — retain main | Preserve production build/routing; no staging proxy or preview control activation. |
| `frontend/public/_redirects` | EXCLUDED — retain main | Preserve production build/routing; no staging proxy or preview control activation. |
| `frontend/public/api/production-push-compare.mjs` | EXCLUDED — retain main | Keep existing production behavior, privacy and operational integrations. |
| `frontend/public/api/production-push-diagnostic.html` | EXCLUDED — retain main | Keep existing production behavior, privacy and operational integrations. |
| `frontend/public/api/vendors.json` | INCLUDED selectively reconciled | Approved Artisan content reconciled to production IDs; nine presentations are a separate review-only SQL patch. |
| `frontend/public/event-media/carol-weigel-fd34e6e0d994.jpg` | EXCLUDED — not introduced | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `frontend/public/event-media/cheryl-mcnair-b939c515fcc1.jpg` | EXCLUDED — not introduced | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `frontend/public/event-media/gina-livy-a94c541cec05.png` | EXCLUDED — not introduced | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `frontend/public/event-media/nikk-wise-572a68bc731a.jpg` | EXCLUDED — not introduced | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `frontend/public/webpushr-sw.js` | EXCLUDED — retain main | Preserve existing production notification/PWA/content integrations. |
| `frontend/scripts/artisan-vendor-updates.mjs` | INCLUDED unchanged | Approved Artisan content reconciled to production IDs; nine presentations are a separate review-only SQL patch. |
| `frontend/scripts/build-staging-vendors-catalog.mjs` | EXCLUDED — retain main | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `frontend/scripts/build-web.js` | EXCLUDED — retain main | Preserve production build/routing; no staging proxy or preview control activation. |
| `frontend/scripts/data/artisan-tent-vendors-2026.json` | INCLUDED selectively reconciled | Approved Artisan content reconciled to production IDs; nine presentations are a separate review-only SQL patch. |
| `frontend/scripts/data/sept8_exhibitors_grouped.json` | EXCLUDED — not introduced | Preserve current production content/IDs; only explicitly approved Artisan additions are promoted separately. |
| `frontend/scripts/generate-offline-worker.js` | EXCLUDED — retain main | Preserve existing production notification/PWA/content integrations. |
| `frontend/scripts/package-production-pilot.py` | EXCLUDED — retain main | Keep existing production behavior, privacy and operational integrations. |
| `frontend/src/analytics/notificationAttribution.ts` | INCLUDED unchanged | Approved accurate analytics/generic reminder integration, preserving production announcement send and operational paths. |
| `frontend/src/analytics/notificationMetrics.ts` | INCLUDED unchanged | Approved accurate analytics/generic reminder integration, preserving production announcement send and operational paths. |
| `frontend/src/components/AnnouncementCard.tsx` | EXCLUDED — retain main | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `frontend/src/components/AppStatus.tsx` | EXCLUDED — not introduced | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `frontend/src/components/EntrancesParkingMap.tsx` | INCLUDED unchanged | Approved contextual tutorials/map controls/selection identity; production-only behavior preserved. |
| `frontend/src/components/EventDetailMedia.tsx` | EXCLUDED — retain main | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `frontend/src/components/GroundsMap.tsx` | INCLUDED selectively reconciled | Approved contextual tutorials/map controls/selection identity; production-only behavior preserved. |
| `frontend/src/components/GroundsParkingOverlay.tsx` | EXCLUDED — not introduced | Superseded parking overlay is not imported; official Entrances / Parking map is retained. |
| `frontend/src/components/GroundsTrafficOverlay.tsx` | EXCLUDED — retain main | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `frontend/src/components/GroundsViewSelector.tsx` | EXCLUDED — not introduced | Superseded parking overlay is not imported; official Entrances / Parking map is retained. |
| `frontend/src/components/MapEducation.tsx` | INCLUDED selectively reconciled | Approved contextual tutorials/map controls/selection identity; production-only behavior preserved. previewWalkthrough hook is deliberately inert (always false). |
| `frontend/src/components/MapModeSelector.tsx` | INCLUDED unchanged | Approved contextual tutorials/map controls/selection identity; production-only behavior preserved. |
| `frontend/src/components/NotificationOptIn.tsx` | INCLUDED selectively reconciled | Approved contextual tutorials/map controls/selection identity; production-only behavior preserved. |
| `frontend/src/components/ParadeRouteOverlay.tsx` | INCLUDED unchanged | Exact approved staging geometry/overlay, including no Mutual Square dotted segment. |
| `frontend/src/components/RvParkDetailMap.tsx` | INCLUDED unchanged | Approved contextual tutorials/map controls/selection identity; production-only behavior preserved. |
| `frontend/src/components/TentedCityMap.tsx` | INCLUDED selectively reconciled | Approved contextual tutorials/map controls/selection identity; production-only behavior preserved. |
| `frontend/src/components/VendorTutorial.tsx` | INCLUDED unchanged | Approved contextual tutorials/map controls/selection identity; production-only behavior preserved. |
| `frontend/src/components/admin/AnalyticsDashboard.tsx` | INCLUDED selectively reconciled | Approved accurate analytics/generic reminder integration, preserving production announcement send and operational paths. |
| `frontend/src/components/admin/NotificationMetrics.tsx` | INCLUDED unchanged | Approved accurate analytics/generic reminder integration, preserving production announcement send and operational paths. |
| `frontend/src/components/admin/NotificationOverview.tsx` | INCLUDED unchanged | Approved accurate analytics/generic reminder integration, preserving production announcement send and operational paths. |
| `frontend/src/components/admin/ReminderAnalytics.tsx` | INCLUDED unchanged | Generic T-30/star/readiness functionality only; staging controls excluded and delivery disabled. |
| `frontend/src/config/groundsParking.ts` | EXCLUDED — not introduced | Superseded parking overlay is not imported; official Entrances / Parking map is retained. |
| `frontend/src/config/groundsPhoneLayout.ts` | INCLUDED unchanged | Approved contextual tutorials/map controls/selection identity; production-only behavior preserved. |
| `frontend/src/config/mapAvailability.ts` | EXCLUDED — retain main | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `frontend/src/config/pwaResumeTestVersion.ts` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `frontend/src/config/staticMapLayout.ts` | EXCLUDED — retain main | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `frontend/src/config/tentedCityParadeRoutes.ts` | INCLUDED unchanged | Exact approved staging geometry/overlay, including no Mutual Square dotted segment. |
| `frontend/src/config/tentedCitySearch.ts` | EXCLUDED — retain main | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `frontend/src/config/tentedCitySemanticMap.ts` | EXCLUDED — retain main | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `frontend/src/config/vendorPresentation.ts` | EXCLUDED — retain main | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `frontend/src/data/tentedCityVendors.ts` | EXCLUDED — retain main | Preserve current production content/IDs; only explicitly approved Artisan additions are promoted separately. |
| `frontend/src/data/tentedCityVendorsConsolidated.ts` | EXCLUDED — retain main | Preserve current production content/IDs; only explicitly approved Artisan additions are promoted separately. |
| `frontend/src/data/tentedCityVendorsPart2.ts` | EXCLUDED — retain main | Preserve current production content/IDs; only explicitly approved Artisan additions are promoted separately. |
| `frontend/src/data/tentedCityVendorsPart3.ts` | EXCLUDED — retain main | Preserve current production content/IDs; only explicitly approved Artisan additions are promoted separately. |
| `frontend/src/services/adminAnalyticsService.ts` | INCLUDED unchanged | Approved accurate analytics/generic reminder integration, preserving production announcement send and operational paths. |
| `frontend/src/services/adminAuthService.ts` | INCLUDED selectively reconciled | Approved accurate analytics/generic reminder integration, preserving production announcement send and operational paths. |
| `frontend/src/services/itineraryReminderSync.web.ts` | INCLUDED selectively reconciled | Generic T-30/star/readiness functionality only; staging controls excluded and delivery disabled. |
| `frontend/src/services/mapEducationEligibility.ts` | INCLUDED unchanged | Approved contextual tutorials/map controls/selection identity; production-only behavior preserved. |
| `frontend/src/services/mapEducationState.ts` | INCLUDED unchanged | Approved contextual tutorials/map controls/selection identity; production-only behavior preserved. |
| `frontend/src/services/notificationRegistration.ts` | INCLUDED selectively reconciled | Approved accurate analytics/generic reminder integration, preserving production announcement send and operational paths. |
| `frontend/src/services/notificationRegistration.web.ts` | INCLUDED selectively reconciled | Approved accurate analytics/generic reminder integration, preserving production announcement send and operational paths. |
| `frontend/src/services/reminderUxService.ts` | INCLUDED unchanged | Generic T-30/star/readiness functionality only; staging controls excluded and delivery disabled. |
| `frontend/src/services/reminderUxService.web.ts` | INCLUDED unchanged | Generic T-30/star/readiness functionality only; staging controls excluded and delivery disabled. |
| `frontend/src/services/scheduleOnboardingState.ts` | INCLUDED unchanged | Approved contextual tutorials/map controls/selection identity; production-only behavior preserved. |
| `frontend/src/services/spreadsheetDataService.ts` | EXCLUDED — retain main | Preserve existing production notification/PWA/content integrations. |
| `frontend/src/services/subscriptionReconciliation.ts` | EXCLUDED — retain main | Preserve existing production notification/PWA/content integrations. |
| `frontend/src/services/subscriptionReconciliation.web.ts` | EXCLUDED — retain main | Preserve existing production notification/PWA/content integrations. |
| `frontend/src/services/tutorialCueLayout.ts` | INCLUDED unchanged | Approved contextual tutorials/map controls/selection identity; production-only behavior preserved. |
| `frontend/src/services/wonderPushRuntimeDiagnostic.ts` | EXCLUDED — retain main | Preserve existing production notification/PWA/content integrations. |
| `frontend/src/services/wonderPushRuntimeDiagnostic.web.ts` | EXCLUDED — retain main | Preserve existing production notification/PWA/content integrations. |
| `frontend/src/services/wonderPushRuntimeDiagnosticCore.ts` | EXCLUDED — retain main | Preserve existing production notification/PWA/content integrations. |
| `frontend/src/services/wonderPushService.ts` | EXCLUDED — retain main | Preserve existing production notification/PWA/content integrations. |
| `frontend/src/services/wonderPushService.web.ts` | EXCLUDED — retain main | Preserve existing production notification/PWA/content integrations. |
| `frontend/src/utils/scheduleTime.ts` | INCLUDED unchanged | Approved contextual tutorials/map controls/selection identity; production-only behavior preserved. |
| `frontend/src/utils/shareIpm.ts` | EXCLUDED — retain main | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `frontend/tests/admin-auth-network.test.mjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/analytics-dashboard.test.mjs` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/announcement-create-send-regression.test.mjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/announcement-dismissal.test.mjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/announcement-image.test.mjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/announcement-preview-safety.test.mjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/announcement-workflow-preview.test.mjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/approved-release.browser.mjs` | INCLUDED selectively reconciled | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/artisan-presenters.browser.mjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/artisan-vendors.browser.mjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/artisan-vendors.test.mjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/camping-page.test.mjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/canonical-staging-feature-manifest.test.mjs` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `frontend/tests/consolidated-exhibitor-update.test.mjs` | INCLUDED selectively reconciled | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/consolidated-staging.browser.mjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/contextual-help-live.browser.mjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/contextual-help-offline.browser.mjs` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/contextual-help.browser.mjs` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/controlled-arm-ui.test.mjs` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `frontend/tests/desktop-map-mobile-comparison.cjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/desktop-map-workspace.browser.cjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/emergency-privacy.browser.mjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/emergency-privacy.test.mjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/emergency-services.test.mjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/entrances-parking-map.test.mjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/event-detail-header-spacing.test.mjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/event-image.test.mjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/event-media.test.mjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/first-visit-walkthroughs.browser.mjs` | INCLUDED selectively reconciled | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/fixtures/map-education-schedule.json` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/fixtures/notification-analytics.json` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/fixtures/notification-health.json` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/fixtures/notification-overview.json` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/grounds-layers-mobile.browser.cjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/grounds-layers.browser.cjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/grounds-layers.test.mjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/grounds-phone-header.test.mjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/grounds-staging-approval.browser.cjs` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `frontend/tests/grounds-traffic-overlay.browser.cjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/grounds-traffic-refinement.test.mjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/home-action-groups.test.mjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/home-presentation.browser.mjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/home-space.browser.mjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/interactive-schedule.browser.mjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/iphone-safe-area-offline.browser.cjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/iphone-safe-area.browser.cjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/itinerary-reminder-sync.test.mjs` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/itinerary-reminder-ux-copy.test.mjs` | INCLUDED selectively reconciled | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/map-education-context.browser.cjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/map-education-itinerary.browser.cjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/map-education-offline.browser.cjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/map-education-safe-area.browser.cjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/map-education-server.cjs` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/map-education-staging-smoke.browser.cjs` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `frontend/tests/map-education.browser.cjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/map-education.test.mjs` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/map-loading-layout.browser.cjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/map-startup-measure.browser.cjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/map-startup.browser.cjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/maps-navigation-intent-offline.browser.cjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/maps-navigation-intent.browser.cjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/maps-navigation-variants.browser.cjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/notification-analytics.browser.mjs` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/notification-analytics.test.mjs` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/notification-attribution.browser.mjs` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/notification-health-layout.browser.mjs` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/notification-initialization-resilience.test.mjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/notification-onboarding-modal.test.mjs` | INCLUDED selectively reconciled | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/notification-overview.browser.mjs` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/notification-registration-retry.test.mjs` | INCLUDED selectively reconciled | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/offline-cache-remediation.test.mjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/offline-service-worker.test.mjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/onboarding-runtime.test.mjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/parking-map-help.browser.mjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/production-pilot-card.test.mjs` | EXCLUDED — retain main | Keep existing production behavior, privacy and operational integrations. |
| `frontend/tests/production-safe-area-regression.browser.cjs` | EXCLUDED — retain main | Keep existing production behavior, privacy and operational integrations. |
| `frontend/tests/pwa-production-compatibility.test.mjs` | INCLUDED selectively reconciled | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/pwa-resume.browser.cjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/rv-park-detail-map.test.mjs` | INCLUDED selectively reconciled | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/schedule-date-order.browser.cjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/schedule-details-tip-offline.browser.cjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/schedule-details-tip.browser.cjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/schedule-event-back-navigation.test.mjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/schedule-event-map-navigation.test.mjs` | INCLUDED selectively reconciled | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/schedule-onboarding.test.mjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/schedule-physical-replay.browser.mjs` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/schedule.test.mjs` | INCLUDED selectively reconciled | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/sept8-exhibitor-locations.test.mjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/share-ipm.browser.mjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/share-ipm.test.mjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/staging-safe-area-regression.browser.cjs` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `frontend/tests/staging-vendors-catalog.test.mjs` | EXCLUDED — retain main | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `frontend/tests/staging-vendors-proxy.test.mjs` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `frontend/tests/subscription-reconciliation-lifecycle.test.mjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/subscription-reconciliation.test.mjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/tented-city-camera.test.mjs` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/tented-city-event-location.test.mjs` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/tented-city-highlight.browser.mjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/tented-city-map.test.mjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/tented-city-parade.browser.mjs` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/tented-city-parade.test.mjs` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/tented-city-search.test.mjs` | INCLUDED selectively reconciled | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/tented-city-semantic-map.test.mjs` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/tutorial-click-cue-assertions.mjs` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/tutorial-click-cue.test.mjs` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/upgrade-install.test.mjs` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/vendor-interactive.browser.mjs` | INCLUDED selectively reconciled | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/vendor-tutorial-unavailable.browser.mjs` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/vendors-canonical-runtime.browser.cjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/vendors-canonical-runtime.test.mjs` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `frontend/tests/wonderpush-production.test.mjs` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `frontend/tests/wonderpush-runtime-diagnostic.test.mjs` | INCLUDED selectively reconciled | Isolated local regression coverage only; no fixtures shipped as application data. |
| `netlify.toml` | EXCLUDED — retain main | Preserve production build/routing; no staging proxy or preview control activation. |
| `release-artifacts/landa-final-20260914/RECONCILIATION.md` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/landa-final-20260914/apply-staging.sql` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/landa-final-20260914/carol-biography.txt` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/landa-final-20260914/landa-sept12-original-attachments.zip` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/landa-final-20260914/sources.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/landa-final-20260914/verify-browser.cjs` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/landa-final-20260914/verify-offline.cjs` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/A-draft.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/A-identity.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/A-published.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/B-browser320-fresh.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/B-closed-fresh.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/B-desktop-fresh.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/B-draft.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/B-failed-asset-fallback.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/B-failed-asset-fresh.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/B-identity.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/B-installed360-fresh.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/B-offline-fresh.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/B-partial-results.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/B-published.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/B-slow-fallback.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/B-slow-fresh.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/B-transition-results.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/B-waiting-fresh.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/C-browser320-fresh.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/C-closed-fresh.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/C-desktop-fresh.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/C-draft.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/C-identity.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/C-installed360-fresh.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/C-offline-fresh.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/C-partial-results.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/C-published.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/C-slow-fallback.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/REPORT.md` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/artifact-verification.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/clients-ready.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/control.py` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/final-verification.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/focused-unit.log` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/network-sanitized.jsonl` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/supplemental-results.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/supplemental.log` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/supplemental.mjs` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/transition.mjs` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/transitions-host.log` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/transitions.log` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-final-20260909/verified-refs.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-resumed-20260909/A-identity.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-resumed-20260909/B-identity.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-resumed-20260909/B-published.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-resumed-20260909/C-identity.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-resumed-20260909/REPORT.md` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-resumed-20260909/clients-ready.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-resumed-20260909/resume-attempt2/B-transition-results.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-resumed-20260909/resume-attempt2/C-partial-results.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-resumed-20260909/resume-attempt2/C-published.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-resumed-20260909/resume-attempt2/transitions.log` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-resumed-20260909/resumed-artifact-verification.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-resumed-20260909/resumed-final-verification.json` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-resumed-20260909/transition.mjs` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `release-artifacts/launch-update-resumed-20260909/transitions.log` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `security/f02/run_tests.py` | EXCLUDED — not introduced | Outside approved additive release scope; main version/absence retained, avoiding staging regressions. |
| `supabase/migrations/20260823000100_itinerary_reminder_targeting.sql` | INCLUDED selectively reconciled | Generic T-30/star/readiness functionality only; staging controls excluded and delivery disabled. |
| `supabase/migrations/20260823000200_two_device_targeting_test.sql` | EXCLUDED — not introduced | See migration audit for schema-specific disposition. |
| `supabase/migrations/20260823000300_controlled_targeting_test_claim.sql` | EXCLUDED — not introduced | See migration audit for schema-specific disposition. |
| `supabase/migrations/20260823000400_controlled_targeting_test_kinds.sql` | EXCLUDED — not introduced | See migration audit for schema-specific disposition. |
| `supabase/migrations/20260823000500_harden_itinerary_reminder_readiness.sql` | INCLUDED selectively reconciled | Generic T-30/star/readiness functionality only; staging controls excluded and delivery disabled. |
| `supabase/migrations/20260823000600_real_itinerary_reminder_engine.sql` | EXCLUDED — not introduced | See migration audit for schema-specific disposition. |
| `supabase/migrations/20260907000100_subscription_reconciliation.sql` | EXCLUDED — not introduced | See migration audit for schema-specific disposition. |
| `supabase/migrations/20260909234943_schedule_event_media.sql` | EXCLUDED — not introduced | See migration audit for schema-specific disposition. |
| `supabase/migrations/20260918000100_staging_controlled_real_star_arm.sql` | EXCLUDED — not introduced | See migration audit for schema-specific disposition. |
| `supabase/migrations/20260918000200_accurate_notification_analytics.sql` | EXCLUDED — not introduced | See migration audit for schema-specific disposition. |
| `supabase/migrations/20260918000200_staging_controlled_arm_timing.sql` | EXCLUDED — not introduced | See migration audit for schema-specific disposition. |
| `supabase/migrations/20260918000200_staging_normal_t30_allowlist.sql` | EXCLUDED — not introduced | See migration audit for schema-specific disposition. |
| `supabase/migrations/20260918000200_stale_favorite_reconciliation.sql` | INCLUDED unchanged | Generic required schema only; see migration audit. |
| `supabase/migrations/20260918000300_fix_staging_t30_allowlist_ambiguity.sql` | EXCLUDED — not introduced | See migration audit for schema-specific disposition. |
| `tests/requirements-reconciliation.txt` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `tests/test_analytics.py` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `tests/test_announcement_images.py` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `tests/test_announcement_send_workflow.py` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `tests/test_announcements.py` | INCLUDED selectively reconciled | Isolated local regression coverage only; no fixtures shipped as application data. |
| `tests/test_artisan_presenters.py` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `tests/test_artisan_resolution.py` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `tests/test_controlled_real_star_arm.py` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `tests/test_daily_event_schedule_update.py` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `tests/test_dirtworks_schedule.py` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `tests/test_dynamic_controlled_arm_discovery.py` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `tests/test_event_image.py` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `tests/test_event_media.py` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `tests/test_itinerary_reminder_contract.py` | INCLUDED selectively reconciled | Isolated local regression coverage only; no fixtures shipped as application data. |
| `tests/test_itinerary_reminders_current.py` | INCLUDED selectively reconciled | Isolated local regression coverage only; no fixtures shipped as application data. |
| `tests/test_mnp_schedule_import.py` | EXCLUDED — retain main | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `tests/test_notification_analytics.py` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `tests/test_notification_analytics_accuracy.py` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `tests/test_notification_analytics_completion.py` | INCLUDED selectively reconciled | Isolated local regression coverage only; no fixtures shipped as application data. |
| `tests/test_notification_analytics_migration.py` | INCLUDED selectively reconciled | Isolated local regression coverage only; no fixtures shipped as application data. |
| `tests/test_notification_health.py` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `tests/test_notification_overview.py` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `tests/test_notification_visit_storage.py` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `tests/test_reconciliation_postgres.py` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `tests/test_staging_analytics_scope.py` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `tests/test_staging_normal_t30_allowlist.py` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `tests/test_staging_provider_diagnostic.py` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `tests/test_staging_subscription_compare.py` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `tests/test_staging_subscription_repair.py` | EXCLUDED — not introduced | Staging/test/diagnostic infrastructure or historical evidence; no production promotion. |
| `tests/test_stale_favorite_reconciliation.py` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `tests/test_subscription_reconciliation.py` | EXCLUDED — not introduced | Retain main regression coverage; exclude unrelated/staging-only test delta. |
| `tests/test_t30_analytics.py` | INCLUDED unchanged | Isolated local regression coverage only; no fixtures shipped as application data. |
| `tests/test_what3words.py` | EXCLUDED — not introduced | Keep existing production behavior, privacy and operational integrations. |
| `tests/test_what3words_privacy.py` | EXCLUDED — retain main | Keep existing production behavior, privacy and operational integrations. |
