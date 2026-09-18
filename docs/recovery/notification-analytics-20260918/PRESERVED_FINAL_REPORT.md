# IPM ACCURATE NOTIFICATION ANALYTICS: READY FOR PHYSICAL UI REVIEW

Implemented and deployed the analytics changes to staging. No notification was sent and no production data changed.

**HTTP 202 LABELLED AS DELIVERED:** NO  
**UNKNOWN METRICS DISPLAYED AS ZERO:** NO  
**UNIQUE PEOPLE CLAIMED:** NO  
**PROVIDER CONFIRMED RECEIPTS SUPPORTED:** PARTIAL  
**NOTIFICATION OPENS SUPPORTED:** PARTIAL  
**NOTIFICATION-ORIGIN APP VISITS SUPPORTED:** YES  
**ORGANIZER DEVICE-LEVEL IDENTIFIERS EXPOSED:** NO  
**REAL NOTIFICATIONS SENT DURING THIS WORK:** EXACTLY 0  
**PRODUCTION CHANGES:** EXACTLY 0  
**PR #39:** OPEN / UNMERGED  

WonderPush distinguishes push-server events such as `@NOTIFICATION_SENT` and opens from physical device display; its detailed reports also provide approximate unique installation counts. [WonderPush analytics](https://docs.wonderpush.com/reference/get-stats-events), [detailed reports](https://docs.wonderpush.com/reference/post-stats-reports)

Implemented:

- Additive nullable delivery analytics columns for provider IDs, acceptance, sent events, receipts, failures, opens, refresh status, and notification-origin visits.
- Stable per-announcement provider campaign identities:
  `ipm-announcement-test-{announcement_id}` and `ipm-announcement-everyone-{announcement_id}`.
- Opaque `notification_ref` deep-link attribution tied to the IPM delivery row.
- Read-only WonderPush statistics lookup and normalization.
- Honest organizer labels: “Provider accepted,” “Targeted devices,” “Provider-confirmed receipts,” “Notification opens,” and “Not available.”
- Existing deliverable-device snapshots remain explicitly separate from provider-targeted counts.
- Historical rows remain `NULL`/“Not available”; no values were fabricated.
- T-30 delivery ledger and exactly-once behavior remain unchanged.
- Organizer UI remains aggregate-only; internal delivery identifiers are not displayed.

The Celebration of Excellence Banquet record contains an image. Current source supports WonderPush’s `alert.web.image` field when an image URL is present, but the historical provider request did not preserve the complete payload, so actual image display for Jen’s notification cannot be proven retrospectively.

Validation:

- Backend notification, announcement, analytics, image, and accuracy tests: **102 passed**.
- Frontend analytics/notification tests: **39 passed**.
- Web build succeeded with staging-safe variables.
- Changed-file TypeScript checks pass; the full current staging tree retains one pre-existing unrelated error in `frontend/app/(tabs)/itinerary.tsx`.
- Migration applied to staging Supabase; all new columns verified.
- Staging backend live at `f787c7634ab513b058654e31014d33d3cb6d85b8`, Render deployment `dep-damog53ncjis7389qltg`.
- Live staging bundle: `entry-d449ebd1057b75e5befc67f5dc45b820.js`; historical fixture IDs are absent.
- Follow-up bounded automatic statistics-refresh commit `e517d32c` is queued in Render; the already-live implementation is healthy.
- Recent staging delivery query: zero new delivery rows and zero sent rows during this work.

The historical announcement remains accurately represented as one IPM request and provider acceptance, with physical receipt only supported by Jen’s report. No historical targeted, delivered, opened, or unique-person counts were invented.
