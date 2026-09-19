# Contextual attendee help recovery — staging

Base: 1ff2aec3f5d9816207fffda0d05add1c8f791c56. Findings were reported before implementation. No historical branch was reset or merged onto staging.

## Recovery inventory

- **Schedule introduction:** eb91008d added `scheduleOnboardingState.ts` and “Plan your day”; fc3eb2a2 presented it as a modal. The Schedule/Itinerary work was ported through d99f5aa9 (an ancestor of current staging), rather than preserving those two original commit IDs in staging ancestry. Current `app/(tabs)/schedule.tsx` already retained the introduction and original star/reminder wording.
- **Schedule contextual tips:** cd3b8375 added `FindOnMapTip` (“Find this event”) around the existing location action. 597df7d6 added `ScheduleEventDetailsTip` (“View event details”) after the introduction and on a fully visible card. Both are staging ancestors. Existing tests include `schedule-onboarding.test.mjs`, `schedule-details-tip.browser.cjs`, `map-education-context.browser.cjs` and the navigation/itinerary tests.
- **Vendors:** cd3b8375 added `FindOnMapTip` (“Find this vendor”) around an eligible visible vendor's Find on Map action, with a separate once-only flag. The original body is “Tap here to jump directly to this vendor’s location on the map.” Repository history of the vendor screen and preserved tutorial branches contains this contextual tip, not a separate historical multi-page Vendor walkthrough.
- **Maps:** cd3b8375 created the shared callout/spotlight and map tour; a5550cea refined it; 3198ab11 deferred automatic tours during event/vendor destination arrivals. The current five-step, labelled Map Help version remains intact.

## Why help seemed absent

The code had not disappeared. `@ipm_schedule_itinerary_onboarding_v1`, `@ipm_schedule_event_details_tip_seen_v1`, `@ipm_schedule_find_on_map_tip_seen_v1` and `@ipm_vendor_find_on_map_tip_seen_v1` independently suppress previously dismissed learning. Tips additionally require their existing eligible, visible action and focused screen. Only Maps had replay UI. Schedule and Vendors had no replay entry point after completion. There is no evidence of an old branch needing wholesale restoration.

## Reconciliation

Schedule Help reopens the existing Plan your day modal and queues manual replay of its existing event-details and Find on Map tips when those targets become eligible. Original star and conditional approximately-30-minute reminder text is retained; a short browse/day/search sentence reflects the present page. T-30 delivery logic is unchanged.

Vendors Help uses the existing callout renderer for a concise browse/search/card-details explanation, then makes the original contextual Find on Map spotlight replayable when its target is visible. Automatic first-run behavior remains the original eligible-action tip, not a new global tour. If no vendor has a mapped action, the manual summary still works without inventing a location.

Manual replay does not delete keys or reset favorites, itinerary, notification preferences or other tutorials. A consumed replay request cannot open one modal for every vendor card. The original shared display lease, visibility checks and independent completion storage remain in use.

Map Help retains five steps and the approved Parade Routes text/target. Its parking step now distinguishes Grounds (overall site, plowing fields, RV Park) from the official Entrances / Parking diagram. Tented City search, gestures/reset and Camping remain as before.

## Event selection identity

Schedule's existing View on Map route now also carries event ID and title. Existing location resolution and highlight selection remain authoritative. Tented City and Grounds cards use the event title as primary text and the resolved venue/place as secondary text. Manual search, selection, reset and vendor navigation clear the event identity. Same-venue events reselect on their event ID/title, avoiding a stale title.

Removed the Tented City stage-event list and its extra Schedule fetch. It previously took up to four events for the selected stage and displayed start times without dates. Schedule/detail pages retain all date/time information; their data and stable IDs are unchanged.

## Validation and review

Focused unit checks, responsive returning-user tests, fresh contextual tips, generated-shell offline replay, event-to-map (Tented City and Grounds), same-stage event changes, vendor-to-map, and existing parade/search/gesture checks. Browser fixtures are local intercepted responses only; they do not write app data. Provider traffic and external writes are blocked.

Known unrelated baseline TypeScript diagnostic: itinerary.tsx:225 TS2367. It is not represented as a clean unrelated suite.

Marc: open Schedule Help; close the introduction, open an event and use its location action. Confirm the map card shows its title and location without times. Open Vendors Help, then a mapped vendor's Find on Map; confirm vendor identity. Replay Map Help to review the Grounds/parking distinction and preserved parade step. Help remains available after completion; no storage clearing is needed.
