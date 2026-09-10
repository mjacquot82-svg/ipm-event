# Tented City Vector Map Integration Report

## Result

Staging-only integration of the supplied official app-ready SVG. Production was not modified or deployed.

## Git

- Starting branch/SHA: `staging` / `fadb31d6c176ff480a600898cb3bbb2e2463459a`
- Working branch: `feature/tented-city-vector-map-20260910`
- Final SHA: recorded after commit

## Files inspected

- `frontend/src/components/TentedCityMap.tsx`
- `frontend/src/config/tentedCityLayout.ts`
- `frontend/src/config/tentedCityGeometry.ts`
- `frontend/src/config/tentedCitySearch.ts`
- `frontend/src/config/tentedCityVendorMatch.ts`
- `frontend/src/config/tentedCityTypes.ts`
- supplied `README-CODEX.md`, SVG, and manifest
- existing map tests and Metro configuration

## Supplied-file validation

The SVG parses and has viewBox `0 0 774 603`. The manifest contains 99 unique areas, and every manifest ID occurs in the SVG. The SVG has no scripts, foreign objects, event-handler attributes, or remote URLs. Its 16 embedded image elements are data-embedded artwork from the supplied official export. The transparent overlay regions are separate from the artwork and do not alter it. The source artwork file is preserved byte-for-byte at `frontend/assets/images/tented-city-map-app-ready.svg`.

## Architecture

The existing camera and gesture implementation remains the owner of pan, pinch, wheel, double-tap, bounds, and reset behavior. The official SVG is now the map image. A small manifest adapter converts PDF-point rectangles to the existing percentage coordinate space. It renders transparent, accessible React Native touch targets over the image; the selected target receives a separate border/fill highlight. Exact vendor booth/location labels are matched to manifest labels only. Unmatched vendors retain the existing reviewed geometry fallback, so no individual booth location is invented.

No database or API schema change is needed: semantic map metadata is static application data. What3Words/GPS and emergency behavior are untouched.

## Files added/changed

- Added official SVG asset and preserved source README/manifest under `frontend/src/data`.
- Added `frontend/src/config/tentedCitySemanticMap.ts`.
- Updated `frontend/src/components/TentedCityMap.tsx` to use the SVG, render 99 semantic regions, select/focus regions, and expose accessible labels.
- Added `frontend/tests/tented-city-semantic-map.test.mjs`.

## Existing implementation and limitations

The prior raster map, hard-coded geometry, vendor crosswalk, and GPS separation remain intact as compatibility fallback. The semantic overlay is intentionally transparent when inactive and does not add schedule-list imagery. Native device visual and pinch checks still require Marc/Jen phone verification after staging publication.

## Checks

- `npm run test:map`: passed (5 tests)
- `node --test tests/tented-city-semantic-map.test.mjs`: passed (3 tests)
- `npm run lint`: passed with 0 errors and existing warnings
- `npm run build:web`: passed; SVG bundled successfully
- Schedule data, vendors, maps outside Tented City, notifications, PWA, What3Words, and production were not changed.

## Staging

Deployment is intentionally staging-only and will be recorded after the feature branch is pushed and the established staging workflow completes. No production deployment or promotion is authorized in this task.

## Ambiguities and next milestone

Manifest ranges such as `1A 1-12` are range-level regions, not individual booth polygons. The next milestone is staging visual verification at approximately 320px, common phone width, and desktop, including touch pan/pinch, region selection, reset, and search-to-range behavior. Old geometry can be removed only after that verification proves parity.
