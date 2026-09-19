# Tented City controls — staging review, 2026-09-19

Scope: controls only, based on staging 7095df208503cd29a9c9889155872ec9e7d03c0f.

## Filter audit and decision

- **Vendors removed:** restricted `searchEventMap` results to vendors. It produced no dots or overlay on its own. All-place search already finds vendors and preserves individual booth highlighting.
- **Food removed:** consumed the 17 `category: food` records in the existing `tentedCityVendorsPart*` data and put a dot at the centre of each resolved bounding rectangle. That is not an independently verified current food-service layer. The entries include Dairy Farmers of Ontario and Real Time Fun and Rentals; DC Foods lists two separate lots (1B-38 and 4B-12), for which a bounding-box centre is not a safe food-location marker. No food assignments or category data have been changed.
- **Stages removed:** used only explicit rectangles in `tentedCityVenues`: Ontario Mutuals Main Stage/Britespan and CKNX Centennial Pavilion/GFO. Quality Homes, Beyond Wireless and Harley's have no individual stage footprint and were omitted; their existing search fallback is MNP Lifestyles. These are existing geometry mappings, but this narrow audit cannot establish them as a complete, current stage overview. No venue or schedule records have been changed. Individual place/stage search remains available.
- **All removed:** no remaining category filters need a reset chip. Search always uses its existing default all-place mode. Parade Off restores the ordinary map; Reset map zoom retains its existing camera/selection behavior.

## Parade control

Bordered pale-blue button, map icon, chevron, explicit Off/selected-day label, expanded tint and accessible expanded state. Opening reveals the existing Off, Tuesday and Wednesday–Saturday radio choices. Collapsing preserves the selected route. Route defaults off. No renderer, route points, arrows, assembly geometry or map artwork changes.

The Mutual Square dotted segment is confirmed excluded by Marc. This task does not alter the approved route definitions.

## Parking wording for the upcoming tutorial

Open **Maps → Grounds** to see parking areas on the underlying map; zoom or search for West Parking, North Parking or Accessible Parking to locate them. No overlay toggle is required to see the basic parking areas.

There is an existing optional **Grounds view → Parking** selector: General is the default; Parking adds numbered entrance/bus/accessible markers that can be tapped for details. Do not describe that optional detailed view as a prerequisite for seeing parking. No Parking button or parking behavior was added or changed in this task. The tutorial itself is not changed yet.

## Validation

92 focused Tented City unit tests pass, including route geometry, search, booth highlighting and camera helpers. Production-style staging frontend build passes. Browser suite covers 390/768/1440 px: default Off, removed filter chips, accessible expansion/collapse, retained route while collapsed, exclusive day switching, vendor search/highlighting, pan/zoom, touch pinch, reset and Off. All browser writes and external/provider traffic are blocked.

Known unrelated baseline: itinerary.tsx:225 TypeScript comparison issue and broader frontend baseline failures are not fixed by this controls task; this is not a claim that the entire unrelated suite is clean.
