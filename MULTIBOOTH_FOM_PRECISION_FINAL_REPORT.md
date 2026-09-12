# FINAL REPORT — Multi-booth Find-on-Map precision (staging)

**Date:** 2026-09-12 (America/Toronto)  
**Branch:** `fix/staging-multibooth-fom-precision-20260912` → `staging`  
**Scope:** staging only (no main / production / WonderPush)

## Root cause

1. **Match geometry was already correct** for Ontario Government when `booths[]` is present: `footprintForVendor` returned the exact child-cell union for `3B-19`…`3B-24` (~half the width of parent `3B 13-24`, correct strip Y ≈ 52.744).
2. **UI forced parent-only paint** for any multi-lot footprint: `TentedCityMap` treated `vendorFootprint.lotIds.length !== 1` as `parentOnlyFootprint`, so FoM painted the full parent yellow fill instead of the exact union.
3. **Label-only ranges** like `3B-19-24` (API `location` without booths) did not expand to child lots (`parseLotToken` glued to `3B-1924`). Map FoM uses static vendors with booths, but the matcher needed systemic sub-range expansion anyway.
4. Static Ontario Government `rect` was stale (Mutual Square Y / oversized AABB). FoM prefers footprint, but the rect was corrected to the exact union.

## Fix

| Area | Change |
|------|--------|
| `tentedCityVendorMatch.ts` | Expand inclusive spans (`3B-19-24`) and full safe parent labels into child lots via `parseInclusiveLotSpan` / `lots` |
| `tentedCityGeometry.ts` | Add `parseInclusiveLotSpan`; harden `clusterLotRects` with `Array.from(Map.values())` |
| `TentedCityMap.tsx` | Parent-only only for `range_or_named` / trusted-parent-only; exact multi-booth uses cyan fill + yellow outline on child union |
| `tentedCityVendorsPart1.ts` | Correct Ontario Government static `rect` to exact union |
| Tests + audit | `tests/multibooth-fom-precision.test.mjs`; `diagnostics/MULTIBOOTH_FOM_AUDIT.*`; QA SVG overlay |

## Audit summary (multi-booth candidates)

- exact: 152  
- parent_only: 43  
- unavailable: 3 (Hanover / Dodge RAM `5A-01-04` ambiguous; Maitland `5B-10-12` unmapped)  
- wrong: 0  

## Verification

- `node --test` map/geometry suite: 100 pass (incl. new multibooth tests)
- `tsc --noEmit`: clean
- `npm run build:web`: success (staging build embedded)

### Live check after deploy to https://staging.theipm.ca

1. Open Tented City map → search **Ontario Government** → Find on Map  
2. Highlight must cover **only** 3B-19–24 (smaller than full 3B 13-24 strip), cyan + yellow outline — not Mutual Square Y, not “map location not available”  
3. Spot-check Transit Trailer (`2A-03-04`), University of Guelph (`3B-16-17`), Cottrill / Bambrook single booths, Quilt Tent parent-only yellow  

## Out of scope / unchanged

Production/main, WonderPush, inventing 5B / missing 5A geometry, vendor identity changes.
