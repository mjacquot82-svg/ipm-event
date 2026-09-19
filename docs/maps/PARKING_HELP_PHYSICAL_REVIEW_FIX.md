# Parking map and discoverable Map Help — physical review recovery

Base: staging 5320d4287705c3978b94c5b441126d773b479da4 (Netlify 6aade6302c006c0008763d9d).

## What was actually published

The staging release probe referenced `entry-b3e2a380cb2d71c7e2d4c6005f6fe94f.js`. That downloaded bundle contained the replay label and old Grounds view selector; it did not contain the official entrances/parking artwork. Fresh and completed-state browser checks at 390px both showed the old `?` control, with a valid hit target. Completion did not hide it.

The exact state of Marc's phone was not available, so an entirely missing replay control was not conclusively reproduced. A real narrow-layout defect was reproduced against that published bundle: at 320px with Grounds search text present, the replay button occupied x=292..336, exceeding the viewport. At 360/390px it fit. Search inputs retained their intrinsic minimum width. The icon-only label also gave no visible indication that it replayed a tutorial. This change fixes both issues, without attributing the report to stale PWA assets or asking anyone to erase app data. No incorrect deployment SHA was found. A device-specific stale/offline bundle cannot be ruled in or out without that device's evidence.

Visibility conditions: `MapEducationHelpButton` requires the existing replay context and matching active map mode. It does not depend on the seen flag. First-run automatic education is separately suppressed for completed users or destination arrivals. The current service worker uses online navigation refresh with an offline fallback; no worker/credential/notification behavior is changed here.

## Recovered parking work

`release/entrances-parking-map-20260917`, commit d6a2334cc44279ad8a3b8fcc88553409157d8230, added `EntrancesParkingMap.tsx`, `staticMapLayout.ts`, and `entrances-parking-map.png`. Its intended navigation is a fourth top-level Maps mode, Entrances/Parking. It reached release/main history (merge 6be7addc), but was not an ancestor of the current staging branch. Staging retained the earlier General/Parking prototype. Prior tutorial wording described that prototype rather than reconciling this separate completed work.

Recovered the original artwork byte-for-byte (SHA256 9a815932434540bb8129de73562e223a0e0ed432bfbec19899d96b6703635df5), viewer and shared gesture engine, map mode, offline asset inclusion, and approved removal of West/North parking overlay zones/search entries. Reconciled only these parts onto current staging; no main merge, branch reset, or old Map screen replacement.

The old Grounds General/Parking selector and marker overlay are retired from the rendered UI. Historical unused prototype modules remain in the repository. Grounds traffic, unrelated zones and artwork remain intact. The recovered viewer is fitted inside current responsive chrome, with existing pan/zoom/Fit controls. All four tabs fit the phone row with wrapping labels.

## Help and tutorial

Every map displays **Map Help**, including Entrances / Parking. Search inputs can shrink so search text and its clear button cannot push Help off a narrow screen. Completion and dismissal keep the same v1 flag; returning users are not forced through the tour again.

Parking step: “Open Entrances / Parking for the official entrance and parking map. Pinch to zoom for a closer look.” The step shows the recovered map and spotlights its actual tab. The other four steps remain search, approved Parade Routes, gestures/reset, and Camping Map. Parade definitions, renderer and geometry are untouched.

## Verification

177 focused unit tests; frontend build; diff check. Fresh and returning browser flows at 390/768/1440 include all five steps, parking artwork, parade spotlight, visible four-tab navigation, usable Map Help after completion, reload and tab revisit, plus parking zoom/Fit. Safe-area checks include 320px with populated searches on all three searchable maps. Separate map regression checks cover vendor search/highlighting, parade switching/Off, pan/zoom, pinch and reset. Offline generated-shell checks preserve completion and replay.

All browser verification blocks writes and provider loading. Known unrelated TypeScript itinerary.tsx:225 and wider baseline frontend failures are not repaired or represented as a clean full suite.

## Marc's review

Open staging Maps. Tap the visible **Map Help** button and complete five steps. Verify the first step shows the official parking diagram and the third points to Parade Routes. Complete or Skip, then reopen Map Help. Select Grounds: the old General/Parking toggle must be absent. Select Entrances / Parking: inspect the diagram, zoom and Fit. Reopen Maps and confirm Map Help remains available. Use a private browser window only if fresh first-run behavior is desired; no existing app data needs to be cleared.
