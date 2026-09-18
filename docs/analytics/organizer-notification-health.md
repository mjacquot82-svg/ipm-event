# Organizer-friendly notification health

Follow-up to staging 1a931e57. Announcement notification performance and Event reminders / T-30 remain unchanged and prominent. The default Notification health panel now contains the stored provider-readiness count, explicitly qualified as “ready at last check”, a short health message, and a reminder that readiness does not confirm delivery. Stale evidence is called out. No fake counts or physical-delivery claims are introduced.

The summary is a presentation of existing health counts; build_health, health_report, notification sending, provider synchronization, image payloads, reminder logic, and analytics calculations are unchanged. No migration or data mutation is required. Overlapping operational categories are never added into a fictitious distinct-device issue count. Unchecked, expired, stale, and unknown evidence cannot produce a blanket healthy message.

Advanced notification diagnostics retains every existing technical metric, explanatory note, warning, and underlying read-only data source. It is collapsed by default and rendered only for Owner. Opening mounts the diagnostics view and fetches the detailed snapshot; Refresh diagnostics performs a new read. Ordinary dashboard loads request only the concise summary. Closing removes the detailed cards.

The existing health endpoint supports view=summary for authenticated organizers in the current event. The default/detailed response now requires Owner, enforced server-side before reading health storage. The summary exposes only ready_devices, readiness_outdated, status, message, and snapshot_at. Owner diagnostics remains aggregate-only; neither response includes tokens, capability hashes, credentials, raw device identifiers or histories. The frontend safely rejects an older backend's full payload during staggered deployment instead of misrepresenting it as a summary.

Validation:
- Backend health/authorization, overview, notification analytics and T-30 tests: 108 passed.
- Frontend Analytics/admin/notification selection: 54 passed.
- Production-style frontend build with staging configuration passed.
- Browser checks on the actual build/published app use isolated, clearly marked staging fixtures and block external/provider traffic and all non-GET API mutations. At 1440/768/390 widths: organizer summary stays compact, announcement and T-30 summaries remain present, non-Owners never request detailed data, Owner diagnostics starts collapsed, expands with all technical values preserved, and refreshes correctly. Unknown/stale/empty/error summaries are verified separately.
- All seven notification-overview fixture cases and completed per-announcement UI regressions pass at the same three widths.
- Broader frontend baseline retains 73 passed / 5 known unrelated failures. TypeScript retains the pre-existing itinerary.tsx:225 TS2367 only. No completely clean unrelated suite is claimed.
- git diff --check passed. Final deployment evidence, test logs, screenshots, and checksums are preserved locally in .artifacts/organizer-health.

No provider calls, notification sends, production deployment, or production data/configuration changes were performed.
