# Interactive Schedule walkthrough — staging

Base: 065e3103646553f0376de1ee94e311e531a6688e.

## Historical interaction finding

`eb91008d` introduced Plan your day; `fc3eb2a2` made it a dismissible modal. `cd3b8375` added Find this event as a dismissible contextual spotlight, without a location-action callback. `597df7d6` introduced the tappable event-card spotlight: its target callback dismissed the tip and opened the selected event. It still included Got it. Therefore history supports reusing the real event-card action, but does not prove that both steps originally required target interaction.

The requested refinement uses that existing spotlight/callback mechanism for both Schedule action steps. It does not replace the tutorial architecture.

## Attendee sequence

1. Plan your day remains unchanged: Got it starts the practical portion; Skip ends it.
2. View event details highlights a currently visible event. It prefers a visible event with a usable mapped location, falling back to the existing visible-event strategy. It tells the attendee to tap the highlighted event. Only that action advances into the event details. There is no Got it/Next continuation on the action step.
3. Find this event explains that the detail has time, date and location, and highlights the actual location action. Tapping that target invokes the same `openSelectedEventOnMap` handler as the ordinary location button. Completing the step opens the existing correct map/highlight, with event title primary and venue secondary and no ambiguous time list.

Both interactive steps expose Skip. Escape/back dismisses education. Unrelated taps do not progress. Keyboard focus includes the highlighted action and Skip. No event ID is hard-coded. Empty data or unavailable/unmeasurable targets do not create a blocking tutorial; normal navigation and Help remain available.

First-visit, section completion flags, staging preview links and Schedule Help remain unchanged. Vendor and Map callouts retain their prior Got it/Next behavior because they do not supply the Schedule interaction callback. No map tutorial, location data, geometry, delivery or reminder changes.

## Validation

`interactive-schedule.browser.mjs` exercises fresh and manual-replay flows at 320/768/1440 widths, taps outside the target, absence of Got it/Next on action steps, keyboard target/Skip access, correct detail-to-map identity/highlight, persistence, Skip, and empty-Schedule fallback. Existing first-visit section independence, Vendor/Maps behavior, offline replay and event/vendor map identity suites were adapted only to perform the newly required Schedule target action.

Targeted unit checks, production-style frontend build and diff check are required. The existing unrelated itinerary.tsx:225 TS2367 diagnostic remains separately reported. No production deployment, notification send or data mutation is involved in validation; browser fixtures and provider/write blocking remain enabled.

## Marc review

On staging open `/schedule?previewWalkthrough=1`, or Schedule Help. Tap Got it on Plan your day. Tap outside the event spotlight: it should stay. Tap the highlighted event: detail should open and highlight its location. Tap that location: the map should show the event name and venue with the correct highlight. Return to normal Schedule: no automatic repeat; Schedule Help replays the same interaction. Use Skip at either step to leave the walkthrough safely.
