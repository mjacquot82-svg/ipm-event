# Grounds full-artwork mobile fix — staging only

The 182-source-pixel phone header crop removed the top of the official Grounds image. GroundsMap now uses the original groundsLayerLayout(viewport) for every screen size and renders MAP_SOURCE without a nested crop or offset. The unused phone helper and its crop-approval test are removed. No map image, geometry, traffic overlay, other map, data, cache, install guidance, backend or database code changed.

Baseline: current remote staging 29e848d0322bec9d8af1e17a7c46d6d7b7dda52f. Runtime fix: 83987f94289aa03bb3662c4524166bbeeb602bdd. The groundsLayout.ts helper is byte-identical to the version before f3dbe04a introduced the phone crop.

Validation against staging:

- 78 targeted unit tests passed (Grounds geometry, shared gestures, full artwork, install guidance, caches).
- Real Chromium rendering at 320×568, Android-like 360×800 and 412×915, 390×844, tablet 768×1024 and desktop 1440×900: all four image edges inside every clipping ancestor and screen, correct 1344:2006 aspect ratio, centered maximum complete fit, identical traffic-overlay bounds.
- Pan, two-touch pinch, double-tap, reset/fit, browser fullscreen, zone tap/highlight, place search, vendor search, all five Map Help tutorial steps and anchors, Tented City switching, RV switching, and schedule Find on Map title/location: passed.
- Detailed traffic arrows, road labels, notice and caption alignment/clearance passed at 15 widths from 320 to 2560.
- The new full-artwork browser regression fails against the preceding deployed staging version. It checks actual image bounds, not merely component existence.
- Screenshots visually inspected: full printed title/top and artwork bottom are visible, with controls and bottom navigation outside the fitted image.
- TypeScript checking remains blocked by an existing TS2367 at frontend/app/(tabs)/itinerary.tsx:225. That file is unchanged from the staging baseline; no new type errors were reported.

Reproduction:

```sh
python /workspaces/ipm-event/scripts/with_tool_cache.py -- node --test tests/grounds*.test.mjs tests/*install*.test.mjs tests/*cache*.test.mjs
python /workspaces/ipm-event/scripts/with_tool_cache.py -- node tests/grounds-full-artwork.browser.cjs
python /workspaces/ipm-event/scripts/with_tool_cache.py -- node tests/grounds-full-artwork-interactions.browser.cjs
```

Run from frontend. Browser scripts accept IPM_PREVIEW_URL and IPM_PLAYWRIGHT. Their default target is staging; they block non-GET traffic and notification/analytics providers. Evidence is preserved locally under docs/recovery/grounds-full-artwork-20260919 with checksums; screenshots and raw bounds remain in the existing checkout's .artifacts/grounds-full-artwork.

Production changes, database changes and notifications sent: exactly zero. T-30 state unchanged. Stop for Marc's physical Android review before any production promotion.
