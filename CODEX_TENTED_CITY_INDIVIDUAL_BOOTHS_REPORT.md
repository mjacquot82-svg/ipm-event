# CODEX Tented City Individual Booth Precision Layer Report

## Scope and safety

This isolated map branch extends the existing official app-ready SVG interaction layer. The official coloured SVG remains the visual source of truth; no artwork, production data, shared staging deployment, or vendor records were changed. Existing parent range regions remain available as the fallback.

## Branch and sources

- Starting branch/SHA: `feature/tented-city-vector-map-20260910` at `edce2bf036f737c66f3a4b315a1e16eb22984437` (`edce2bf0`).
- Final branch/SHA: `feature/tented-city-vector-map-20260910` (tip pushed to origin; SHA is recorded by the accompanying commit history).
- Authoritative artwork: `frontend/assets/images/tented-city-map-app-ready.svg`.
- Existing semantic manifest: `frontend/src/data/tented-city-map-manifest.json` (99 regions; unchanged).
- Range geometry evidence: `frontend/src/data/tented-city-geometry-areas.json`, an existing PDF-extracted geometry audit from `tented-city.pdf` page 17. It records official range labels and rectangular bounds; no screenshot, OCR, recreated image, or AI artwork was used.
- Vendor evidence: `frontend/src/data/tented-city-vendor-match-report.json` and existing deterministic vendor matching code.

## Complete booth-range audit

| Official label | Range ID | Numbers | Count | Geometry/orientation | Evidence | Individual subdivision |
|---|---|---:|---:|---|---|---|
| 1A 1-12 | `range-1A-1-12` | 1–12 | 12 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 1A 13-24 | `range-1A-13-24` | 13–24 | 12 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 1A 25-38 | `range-1A-25-38` | 25–38 | 14 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 1B 1-12 | `range-1B-1-12` | 1–12 | 12 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 1B 13-24 | `range-1B-13-24` | 13–24 | 12 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 1B 25-38 | `range-1B-25-38` | 25–38 | 14 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 2B 1-12 | `range-2B-1-12` | 1–12 | 12 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 2B 13-24 | `range-2B-13-24` | 13–24 | 12 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 2B 25-38 | `range-2B-25-38` | 25–38 | 14 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 2A 1-12 | `range-2A-1-12` | 1–12 | 12 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 2A 13-24 | `range-2A-13-24` | 13–24 | 12 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 2A 25-38 | `range-2A-25-38` | 25–38 | 14 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 3A 1-12 | `range-3A-1-12` | 1–12 | 12 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 3A 13-24 | `range-3A-13-24` | 13–24 | 12 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 3B 13-24 | `range-3B-13-24` | 13–24 | 12 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 3A 39-44 | `range-3A-39-44` | 39–44 | 6 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 3B 39-44 | `range-3B-39-44` | 39–44 | 6 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 5A 39-44 | `range-5A-39-44` | 39–44 | 6 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 4A 1-12 | `range-4A-1-12` | 1–12 | 12 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 4A 13-24 | `range-4A-13-24` | 13–24 | 12 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 4A 25-38 | `range-4A-25-38` | 25–38 | 14 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 4B 1-12 | `range-4B-1-12` | 1–12 | 12 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 4B 13-24 | `range-4B-13-24` | 13–24 | 12 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 4B 25-38 | `range-4B-25-38` | 25–38 | 14 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 3B 1-6 | `range-3B-1-6` | 1–6 | 6 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 5A 13-24 | `range-5A-13-24` | 13–24 | 12 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 5A 25-38 | `range-5A-25-38` | 25–38 | 14 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |
| 6B 26-29 | `range-6B-26-29` | 26–29 | 4 | vertical / `B_to_T` | Existing geometry audit flags numbering direction as unproven | NO — preserve range-level only |
| 5A 5-12 | `range-5A-5-12` | 5–12 | 8 | horizontal / `L_to_R` | Existing audited PDF-extracted rectangular geometry; consistent L-to-R split | YES |

Totals: **29 booth ranges**, mathematical total **326 booths** (`end - start + 1`), **28 ranges safely subdivided**, **322 individual booths generated**, and **1 range left range-only** (`6B 26-29`).

## Orientation and uncertainty

The 28 safe ranges are regular rectangles already represented by the audited geometry file. Their equal-width horizontal L→R subdivision is consistent across the audited range set and is explicitly marked in generated records with provenance `audited PDF-extracted rectangular range; consistent horizontal L-to-R split`. The app-ready SVG artwork is unchanged. The geometry audit does not expose individual stall wall outlines, so these are interaction cells within official range geometry, not claims that the artwork contains visible stall boundaries.

`6B 26-29` is the only range flagged by the existing evidence. Its vertical/B→T geometry is retained for parent-range selection, but no individual booth IDs or individual-booth navigation are exposed. This is the complete list of ranges where numbering direction, geometry, or booth association is not fully verified.

## Implementation

- `frontend/src/config/tentedCityGeometry.ts` now exposes a deterministic individual-booth layer. It derives count from `lot_end - lot_start + 1`, creates equal-width cells along the audited L→R axis, assigns IDs such as `booth-1a-09`, preserves parent range IDs/labels, and provides compact lookup for `1A-09`, `1A 09`, and `1A09` forms. Flagged ranges return no individual layer.
- `frontend/src/components/TentedCityMap.tsx` keeps the official SVG and parent hitboxes, then renders individual touch regions only for the selected parent range. A confident single-lot vendor search selects and highlights the exact booth; multi-lot/range/named/ambiguous matches retain existing footprint or parent-range behavior. Exact booth touch selects, centers, zooms, and highlights the cell without changing the artwork.
- Individual regions are rendered conditionally for the selected range, avoiding hundreds of permanent listeners and preserving the current zoomed-out appearance. Accessibility labels identify each booth.
- No official manifest/artwork/data-model replacement was needed; the existing semantic map and vendor matching architecture were extended.

## Real vendor lookups

| Vendor | Stored booth | Individual ID(s) | Parent range |
|---|---|---|---|
| ACE / JCB, Harriston | `1A-09` | `booth-1a-09` | `range-1A-1-12` |
| GGS Structures Inc., Vineland Station | `2B-23` | `booth-2b-23` | `range-2B-13-24` |
| Kodiak Boots, Cambridge | `2B-06` | `booth-2b-06` | `range-2B-1-12` |
| Hip Town Hype, Trent Lakes | `4A-14` | `booth-4a-14` | `range-4A-13-24` |
| StumpedIt, Clinton | `5A-33` | `booth-5a-33` | `range-5A-25-38` |
| Harkness Equipment, Harriston | `1B-15` | `booth-1b-15` | `range-1B-13-24` |

The preserved vendor report contains 230 confident-lot matches, 49 range/named matches, 3 ambiguous matches, and 3 unmatched records. The ACE/JCB record is the audited concrete example (`1A-09`); no vendor records were edited or invented. Existing parser normalization covers hyphen, space, and compact booth variants.

## Validation

- Focused semantic/geometry/camera/map tests: **42 passed, 0 failed**.
- TypeScript `tsc --noEmit`: **passed**.
- `npm run lint`: **passed with 60 pre-existing warnings, 0 errors**.
- Production web export with staging-safe environment (`CONTEXT=deploy-preview`, staging backend, placeholder staging key): **passed**, generated frontend build `363062`; no production endpoint or deployment was used.
- The generated layer was checked programmatically for exact counts, unique IDs, parent containment, and exclusion of flagged `6B 26-29`.
- Existing 99-region semantic functionality and range fallback tests remain passing.
- Mobile/desktop behavior: the implementation uses the existing responsive pan/zoom surface and conditional overlays; no isolated preview was deployed because no safely separate Netlify site/preview target was available without risking the shared staging site. Physical phone verification remains for Marc.

## Preservation and limitations

- Shared `https://staging.theipm.ca` was not overwritten. Production was not changed. Landa staging content/media, PWA update work, schedule (218 active events), vendors (127 production records), maps, What3Words, notifications, and reconciliation were untouched.
- The only intentionally withheld precision range is `6B 26-29`; vendors resolving there continue to highlight the official parent range. Named/irregular areas and ambiguous/unmatched vendor records retain existing behavior.
- Individual cell boundaries are interaction geometry derived from audited parent rectangles; they do not alter or redraw the official coloured map.

## Recommended next step

Marc should review an isolated/local map build on a phone at 320px and common phone width, selecting first/middle/last booths in several ranges and confirming pan, pinch zoom, reset, and vendor search. A future milestone can add stronger destination emphasis after positional accuracy is accepted.
