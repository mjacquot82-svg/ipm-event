# Schedule Help physical replay failure

Baseline: staging `9d920226f1aa03ecefacbc1f23e386e1c55764e6`, Build 376049.

## Proven cause

On the published staging bundle, at 390×844 and 390×667, a returning attendee with all Schedule education completion keys set clicked the visible Schedule Help button, then Got it. There was no education card after four seconds. Scrolling to a mapped event caused the next card to appear without resetting any completion state.

Schedule Help correctly initializes both contextual pending steps. Got it acknowledges the introduction and hides it; it does not discard the pending steps. However, `ScheduleEventDetailsTip` previously required an entire mapped event card to be in the viewport before consuming its pending step. The real unfiltered staging list began with four published staging reminder test events at `Test Location A`, which is not a supported mapped destination. No eligible event was fully visible. No code selected/revealed a suitable event or explained the wait. The walkthrough looked finished while its next step remained pending.

The previous live regression searched for a known mapped event and called `scrollIntoViewIfNeeded()` after Got it. That supplied the missing attendee action and hid this failure. This reproduction did not use the preview flag or fixtures.

## Fix

After Got it, select a mapped event from the currently filtered results, preferring a viewable event. Reveal the selected card and restrict the event spotlight to that target. No event UUID is hard-coded. When filters have no mapped candidates, explain the situation and offer Show all events to continue, or Skip. If no mapped events exist at all, explain availability and retain Skip.

The event stage advances only through its highlighted action. Event detail automatically reveals and highlights the existing location action, with View event details guidance. Only that action adds a Schedule continuation token to the existing map navigation. A separate Schedule arrival callout shows Find this event on the destination map. Completing it clears the token. The approved Maps tour remains unchanged.

Manual Help creates a new pending sequence regardless of historical completion. Genuine first visits retain automatic launch; introduction completion and skips retain the existing acknowledgement rules.

## Verification

`frontend/tests/schedule-physical-replay.browser.mjs` exercises real public staging data with completion flags saved, no preview, no fixtures, and no test-side scrolling. It checks unfiltered replay, search-filter replay, empty-filter recovery, selected-day replay, unrelated taps, the actual location action, map title/arrival guidance, completion-token clearing, first-visit launch, and skip persistence at 390×844, 390×667, and 320×568. Browser writes to backend/provider endpoints are blocked.

The local export uses an unchanged-live-response CORS relay because localhost is outside the staging backend origin allowlist. Published staging verification uses normal network responses without that relay.

Focused unit tests and browser results, before/after screenshots, build logs, and scope checks are retained privately under `.artifacts/physical-replay/`. Type checking has the existing `itinerary.tsx:225 TS2367` error, also documented in the preceding staging release; no new type errors were introduced.

No Vendor tutorial, Maps tour, Schedule/vendor data, map controls/geometry, event View-on-Map pill styling, Artisan changes, notifications, T-30 logic, or production configuration was changed. No production deployment or database writes are part of this task.
