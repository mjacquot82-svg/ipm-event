# Schedule chronological day order — preview candidate

Verified live base: Build **368195**, SHA `220edd0b1e6a9032e4d75172d116d4c6d028ffa8`, deploy `6aa6d09275582e0008d2b15d`, entry `/_expo/static/js/web/entry-937bb24b7c6bc507e39455c996ef2e25.js`.

Branch: `feat/schedule-date-order-20260913`. Production-style local validation Build **368211**. Preview only; production promotion requires Marc's approval.

## Audit and correction

Root cause: Schedule's `dayOptions` explicitly ranked weekdays with a Monday-first array. This was not a locale or today-selection rule. Weekday labels come from the event's calendar `start_date` and existing `days_active` labels. Live schedule data contains 218 events spanning September 20–26, 2026: one Sunday event, one Monday event, then Tuesday–Saturday programming.

Old selector order: Monday → Tuesday → Wednesday → Thursday → Friday → Saturday → Sunday.

New selector order for the actual event dates:

| Date | Day |
|---|---|
| September 20, 2026 | Sunday |
| September 21, 2026 | Monday |
| September 22, 2026 | Tuesday |
| September 23, 2026 | Wednesday |
| September 24, 2026 | Thursday |
| September 25, 2026 | Friday |
| September 26, 2026 | Saturday |

The screen now collects weekday filters from a date-sorted copy of the events, retaining first occurrence and existing weekday-filter membership. Date sections are explicitly sorted by actual event date, rather than API insertion order. No generic Sunday-first rotation is introduced. Multi-week/year tests confirm dates remain ascending. Existing weekday filters still span matching weekdays as before; they have not been redesigned into date-specific filters.

The initial selection remains **All days** (`selectedDay = null`). There was no today/next-event automatic-selection rule. Selecting an active weekday still toggles it off. Sunday is first in order, not forcibly selected.

Events are still grouped by their original formatted `start_date`; their objects and data are unchanged. Existing within-day `parseTime(start_time)` sorting is untouched. Search, categories, weekday matching, star/favourite handlers and Schedule-to-map navigation are unchanged. Itinerary separately filters API events by stored favourite IDs and retains that API order; its source and stored data are untouched.

## Files changed

- `frontend/app/(tabs)/schedule.tsx`: chronological weekday-filter and date-section order only.
- `frontend/src/utils/scheduleDate.ts`: date comparator; existing date formatting functions unchanged.
- `frontend/tests/schedule-date-order.test.mjs`: executes the actual screen memo/callback bodies, including shuffled-input, multi-week, grouping, within-day sorting, membership, selection and filter/favourite checks.
- `frontend/tests/schedule-date-order.browser.cjs`: actual Schedule UI order, Sunday/Monday membership, unchanged local favourites/itinerary, and Schedule → MNP map navigation. Uses read-only schedule responses and blocks remote writes/provider requests.
- This report.

## Validation

- Focused Schedule/itinerary/navigation/Home source tests: **69 PASS**.
- Core map/preload/vendor/updater/offline source regressions: **90 PASS**.
- New Schedule browser suite: **PASS**. Sunday first, actual Sunday September 20 section first, All selected, Sunday/Monday only their proper events, favourites/itinerary unchanged, Find-on-Map reaches MNP, no browser runtime errors.
- Core browser: Home, Schedule, 224 vendors, CAN-AM/Valard unavailable messaging, Grounds/Tented City/Camping, M27, MNP, Ontario exact multi-booth, search, gestures/Fit, updater Later/no reload: **PASS**.
- Existing map artwork loading browser suite: **PASS**, including Home preload/cache reuse, persistent TC lifecycle, delayed artwork, errors/retry, 15-second timeout, stale callback, switching, offline cached/unavailable assets.
- WebKit standalone iPhone safe-area at 393px and simulated 0/20/44/59 top insets: **PASS** for all map modes, search, controls and Fit.
- Real-worker updater integration: **PASS**, including explicit Refresh, ten-minute boundary, same release no-op, offline fallback, storage and permission retention.
- TypeScript: **PASS**.
- Production `build:web`: **PASS**.
- Offline/SW preflight: **PASS**; generated worker logic unchanged, normal fingerprints only, artwork bytes unchanged.

Only the two listed runtime files differ from current production. No event/itinerary/vendor/schedule data, backend/API, map assets/geometry/search/gestures/preload/loading, safe-area implementation, updater/currentLaunch, service-worker logic, or WonderPush was changed. No database writes, notifications, announcements, production deployment, or staging deployment were performed.

The mobile screenshot shows the existing horizontally scrollable weekday controls beginning Sunday, Monday, Tuesday, followed by the Sunday and Monday event sections. Remaining weekday controls retain normal horizontal scrolling. Marc should verify the preview's ordering and ordinary day filtering before any production promotion.
