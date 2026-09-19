# Final map tutorial — staging, 2026-09-19

Reconciled on fa9e0d70226eb090f378ace30f41ddf7288d0f69. Historical tutorial commit cd3b8375dd8e0dab6d405aa32ab4b6bab934fb1c is already an ancestor of current staging. No old branch was merged or reset onto staging.

## Reused architecture

Maps tab hosts `MapsEducation`, with registered element refs, measured responsive spotlights and callouts. First ordinary Maps visit starts the tour. Destination arrivals from Schedule/Vendors still defer automatic education. Existing `?` Help replays it. Skip, Got it and Escape persist the existing `@ipm_maps_tour_seen_v1` flag; no version bump or clearing unrelated storage. Keyboard focus handling, safe-area placement and independent vendor/Schedule tips remain in place.

To spotlight real controls, the tour now briefly shows Grounds for parking and Tented City for the following steps. Completion or Skip returns to the starting map. It does not select a parade day, operate filters, change geometry or modify attendee records.

## Final steps in order

1. **Find parking:** Parking areas are shown on the Grounds map. The optional Parking view adds entrance markers.
2. **Find a place:** On Tented City, search for a vendor, booth, stage or place. Select a result to highlight its location.
3. **Follow the parade:** Tap Parade Routes to expand it. Choose Tuesday or Wednesday–Saturday. The blue line and arrows show that day’s route. Select Off to hide it.
4. **Move around the map:** Drag to move and pinch to zoom. Use this reset button to fit the map again.
5. **Find your campsite:** Open Camping Map to find individual RV and campsite locations.

Targets: Grounds tab, actual Tented City search field, actual Parade Routes button, actual reset button, Camping Map tab. No removed category controls or route-source caveats are taught.

## Review and persistence

On staging, open Maps and tap `?` to replay all five steps without clearing any data. This works for attendees with the old completion flag. To see an entirely fresh first run, open staging in a private browser window; no reset of favorites, itinerary or notification preferences is needed. Installed-PWA completion uses the same existing storage mechanism. Local generated-shell tests cover offline reload and replay; physical installed-device review remains Marc's final check.

## Validation

97 focused map/tutorial unit tests and staging frontend build pass. Browser coverage: five targeted steps, 15 widths (320–2560), completion/Skip, Help, independent storage flags, close/reopen, Escape/Tab/focus and reduced motion. Offline service-worker shell test verifies dismissal persists and Help works offline. Separate parade regression covers search/highlight, one route at a time, Off, pan/zoom, touch pinch and reset at phone/tablet/desktop widths.

No route definitions, artwork, Artisan/catalog data, Schedule, notification analytics or T-30 code changed. Known unrelated itinerary.tsx:225 TypeScript issue and broader baseline frontend failures remain outside this task; passing focused checks is not a clean-suite claim.
