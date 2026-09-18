# Main organizer Notifications overview

Staging-first follow-up to 1f1b8d2d. Announcements retains its completed per-announcement presentation. Analytics now shows a separate Notifications section, with announcement sends and event reminders clearly separated. Notification Health and engagement sections remain available.

## Semantics

The announcement overview is an all-time, event-scoped snapshot independent of the attendee-engagement date selector. Only audience=everyone enters the summary; controlled test sends are excluded. A send means a ledger row accepted by the provider, never confirmed display. Failed send requests and pending/unknown requests are separate from provider-reported failure events on accepted sends.

Each metric sums valid known values and returns value, covered_sends and total_sends. No known values means null/Not available; explicit measured zero remains zero. Coverage is per metric, not one shared instrumented-send count. Metrics: targeted devices, provider-confirmed receipt events, notification open events, notification-origin app visits and provider failure events. Device totals across multiple sends are not unique devices or people. The older readiness snapshot is not mixed with provider-targeted devices. Duplicate persisted campaign identities are excluded from provider totals to avoid counting shared statistics twice.

Receipt/open percentages are deliberately not calculated. Existing normalized counts are provider events, not guaranteed unique-device numerators; exact targeted-device denominators are often unavailable. Even complete or partially overlapping coverage cannot justify claiming a device conversion percentage. The partial fixture has different covered populations for targets, receipts and opens; it produces no misleading rate. Existing Announcements synchronization is untouched.

The latest stored provider-check timestamp is shown, with a note that other sends can have older data. Refresh performs database reads only, never a provider request or cache write. Attributed visits are read from the authoritative Mongo ledger in 500-ID batches; successful missing groups mean zero, failed ledger reads mean unavailable. PostgreSQL history is paginated with an event/time cutoff, stable ordering, 100,000-row/201-page ceiling and 12-second route deadline. Exceeding bounds fails instead of returning partial totals. This is an operational snapshot across reads, not a transactionally frozen historical census.

A compact list shows the five most recent provider-accepted announcement sends (stored title and request time, Toronto-local). The details link navigates to Announcements. No delivery/provider/device IDs, secrets, raw attendee histories, or unique-people claims are exposed.

T-30 uses the existing read-only aggregate endpoint: active interests, normal provider-accepted reminders, provider failures and delivery-unknown outcomes. Controlled-fixture deliveries remain excluded by that endpoint. No reminder claiming, sending, scheduling, gates, or diagnostics changed. The existing Owner-only diagnostic routes and detailed implementation remain intact. Physical receipt observations are not inserted as analytics.

## Validation

- Backend analytics/reporting, notification analytics/accuracy/completion, T-30 and new overview tests: 156 passed.
- Main Analytics/admin/frontend notification analytics tests: 52 passed.
- Browser fixture matrix: no sends, historical unknown, full data, mixed coverage, failures/pending requests, separate T-30, partial metric coverage. All pass at 1440/768/390 widths, plus request failure and Announcements navigation.
- Completed Announcements UX regression browser checks pass at all three widths.
- Production-style frontend build with staging configuration passed; git diff --check passed.
- TypeScript retains only the pre-existing itinerary.tsx:225 TS2367. Broader frontend tests retain the five known baseline failures: Content-Type on a bodyless request, obsolete vendor proxy, recurring prompt copy, and two obsolete hard-disabled T-30 assertions. Do not claim a completely clean unrelated suite.

Browser tests run the actual built/published application with clearly marked staging fixtures. API requests are intercepted, non-GET mutations blocked, and external/provider traffic blocked. Responsive content is checked after entering Analytics through desktop navigation; this does not certify every existing tablet/mobile navigation interaction. Final screenshots/deployment verification are retained locally with checksums in .artifacts/notification-overview.

No migration, notification send, provider mutation, image-push change, production deployment or production data/configuration change is part of this work.
