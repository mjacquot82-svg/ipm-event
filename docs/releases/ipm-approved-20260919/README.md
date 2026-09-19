# Approved IPM production release candidate — review only

Built from `origin/main` (`5c41f907821cf11be9c3140d8b8c275c0f9b5c29`), selectively reconciled with frozen staging Build 376616 (`d7575f6d4eb8a9dd4730b317c182e0f91450f670`). Branch: `release/ipm-approved-staging-20260919`. No staging merge, production deployment, production database write, environment change, notification send, load test, or scaling occurred.

This is a code/content candidate for Marc's review, not authorization to deploy or activate reminders. See [baselines](baselines.md), [every staging-delta path](file-audit.md), [migrations/environment](migration-environment-audit.md), and [validation](validation.md).

## Included

- Current production's Tented City semantic map, search, exact multi-location vendor identity and existing Grounds/Camping camera/gesture behavior. Approved removal of All/Vendors/Food/Stages map chips; official Entrances / Parking remains, without the superseded Grounds Parking overlay.
- Approved Tuesday and Wednesday–Saturday blue parade routes, arrows, Assembly Area, discoverable route control and Off state. Route geometry/overlay files are byte-for-byte frozen staging. Mutual Square dotted segment stays excluded.
- Independent Schedule, Vendors and Maps completion state; first-visit auto-launch, no repeat after skip/completion, full manual Help replay. Interaction-gated Schedule event → real View on Map → Find this event and Vendor Find on Map → selected vendor/final guidance. Shared yellow Click here cues and Skip tutorial. No progression redesign.
- Event map selection shows event title first, venue second, without old schedule-time rows. Vendor identity is retained; stale selections are replaced.
- Eleven Artisan catalog location labels, all 227 existing catalog IDs/order preserved. Nine approved presentation occurrences and matching database vendor labels are prepared in [review-only SQL](../artisan-content-review.sql), not applied. Two vendors already in the production catalog but absent from production DB use their existing catalog IDs on insert. Other nine DB vendor IDs remain unchanged.
- Accurate notification analytics: 202 is provider acceptance, unknown stays unavailable, installations/devices rather than people, per-announcement and main Analytics summaries, T-30 aggregates, compact health and owner-restricted diagnostics, origin attribution/deduplication and bounded statistics reads. Existing announcement preview/send workflow and `alerts.image.url` → content → `alert.web.image` path preserved.
- Generic PR #39 star synchronization, stale-favorite reconciliation, bound-installation provider-readiness verification, current Schedule refresh in My Itinerary, normal T-30 claim rules, exact-target delivery, durable batch/idempotency/ambiguous-outcome protection. Scheduler and delivery are hard-disabled, as on main. Starring requires no Arm action.

## Excluded

- Device A/B labels/identifiers, check-in/discovery endpoints, controlled claims, Arm reminder test UI/routes, delivery arms, five-minute acceleration, fixture authorizations, normal-T30 staging allowlists and ambiguity-fix migrations, synthetic Schedule rows and test provider installations.
- Controlled/benchmark methods embedded in PR #39; the mixed staging real-engine migration. Required generic batch/lease/rate/circuit SQL dependencies were extracted separately and tested. A reproducible PL/pgSQL `target_count`/`batch_id` ambiguity was corrected before promotion.
- Staging `previewWalkthrough` behavior: the retained compatibility hook always returns false; the query string cannot launch tutorials in production. No staging preview switches/proxies/build manifests/service worker bundle are transplanted.
- Staging provider/subscription repair/compare tools, PWA resume test versions and launch harnesses, generated bundles, historical test exports, controlled devices, fixtures in runtime data. Isolated test fixtures under `frontend/tests` remain validation-only and are not bundled/imported by app code.
- Staging regressions of main's Home/share/accessibility, Emergency/What3Words privacy, offline shell, notification SDK/reconciliation, multi-location vendor grouping, announcement preview/send safeguards and current content import scripts.
- PR #39's unrelated blanket disabling of Schedule import and legacy title editing. Main behavior is preserved; stale favorites are reconciled. ID-changing organizer content operations still need their existing editorial care.
- Unapproved additional content/media branches (DirtWorks/Nicole/Landa/MNP variants) and unresolved Sharon/JW assignments. All five named exhibitor records match main exactly; any pre-existing production assignments remain.

Existing production notification diagnostics and organizer test-send functionality are preserved from main, not new staging harnesses. They were not activated or used. Existing production reconciliation is already enabled; this preparation did not change its mode.

## Pending before a later authorized release

1. Marc reviews candidate and explicit release scope; do not merge yet.
2. Separately authorize/apply the six generic migrations and reviewed Artisan content patch, after backup/production-schema recheck. Do not bulk replay historical migrations: production's migration ledger is incomplete relative to its actual schema.
3. Confirm backend environment metadata through Render before deployment. No new variable is required by this code delta; existing production services are verified separately, without revealing credentials.
4. A public deploy preview was deliberately not created. Netlify's preview backend setting points to an obsolete Codespaces endpoint and the shared build fallback points at production. An isolated preview needs separately reviewed configuration; this run does not change production site settings.
5. T-30 activation, real-device delivery retest, infrastructure readiness and the 100,000-attendee load test are separate work. No activation route/scheduler is added here.

The current live frontend differs from main. This candidate intentionally starts at current main as requested and retains its production-approved intervening content/work. See exact runtime/source baselines in the audit.
