# CODEX Tented City Individual Booth Precision Layer Report

## Scope and safety

This isolated map branch extends the existing official app-ready SVG interaction layer. The official coloured SVG remains the visual source of truth; no artwork, production data, shared staging deployment, or vendor records were changed. Existing parent range regions remain available as the fallback.

## Branch and sources

- Starting branch/SHA: `feature/tented-city-vector-map-20260910` at `edce2bf036f737c66f3a4b315a1e16eb22984437` (`edce2bf0`).
- Final branch/SHA before this recovery: `0e7bc2842aa58ce4d165c0f35a439b29929a5890`.
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

Totals: **29 booth ranges**, mathematical total **326 booths** (`end - start + 1`), **26 ranges safely subdivided**, **310 individual booths exposed**, and **3 ranges deliberately left range-only** (`3A 39-44`, `3B 39-44`, `6B 26-29`).

## Orientation and uncertainty

The 26 exposed ranges are ordinary, high-confidence horizontal rectangles in the audited geometry file. Their equal-width horizontal L→R subdivision is explicitly marked in generated records with provenance `audited PDF-extracted rectangular range; consistent horizontal L-to-R split`. The app-ready SVG artwork does not expose individual stall wall outlines, so these are interaction cells within official range geometry, not claims that the artwork contains visible stall boundaries. The two medium-confidence special ranges (`3A 39-44`, `3B 39-44`) and the flagged vertical range (`6B 26-29`) remain parent-only because endpoint numbering is not sufficiently proven.

`3A 39-44`, `3B 39-44`, and `6B 26-29` are the complete orientation-unverified list. Their parent ranges remain selectable through the official manifest; no exact booth navigation is exposed.

## Implementation

- `frontend/src/config/tentedCityGeometry.ts` exposes a deterministic individual-booth layer only for high-confidence ordinary ranges. It derives count from `lot_end - lot_start + 1`, creates equal-width cells along the audited L→R axis, assigns IDs such as `booth-1a-09`, preserves parent range IDs/labels, and provides compact lookup for `1A-09`, `1A 09`, and `1A09` forms. Medium-confidence special ranges and flagged ranges return no individual layer.
- `frontend/src/components/TentedCityMap.tsx` keeps the official SVG and parent hitboxes, then resolves a confident single-lot vendor through normalized individual booth data to its parent geometry and authoritative manifest area before rendering the individual touch regions. Multi-lot/range/named/ambiguous matches retain existing footprint or parent-range behavior. Exact booth touch selects, centers, zooms, and highlights the cell without changing the artwork.
- `findSemanticAreaForGeometryArea` matches the authoritative manifest’s extended labels (including `1B 25-38 W`, quilt/rural-expo labels) from section and numeric range; no new labels are invented.
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

## Recovery validation and limitations

- The recovery fix was made from pushed tip `0e7bc2842aa58ce4d165c0f35a439b29929a5890` in an isolated checkout.
- Parent lookup now uses normalized individual booth → audited geometry parent → official manifest area. The three manifest label mismatches are handled through the existing SVG labels; their medium-confidence ranges remain parent-only, so their 26 mathematical cells are intentionally not exposed.
- Orientation evidence is grouped as follows: 26 high-confidence ordinary ranges use the existing PDF-extracted rectangular geometry and repeated horizontal L→R arrangement; `3A 39-44` and `3B 39-44` are medium-confidence special cases with no endpoint proof; `6B 26-29` is medium-confidence vertical/B→T and flagged. Only the first group is exposed.

## Validation

- Focused semantic/geometry/1A/search/camera tests after the recovery fix: **55 passed, 0 failed**. The legacy `tented-city-map.test.mjs` runner requires a missing `frontend/data` compatibility directory and was not counted.
- TypeScript `tsc --noEmit`: **passed**.
- `npm run lint`: **passed with 60 pre-existing warnings, 0 errors**.
- Production web export with staging-safe environment (`CONTEXT=deploy-preview`, staging backend, placeholder staging key): **passed**, generated frontend build `363062`; no production endpoint or deployment was used.
- The generated layer was checked programmatically for exact counts, unique IDs, parent containment, and exclusion of flagged `6B 26-29`.
- Existing 99-region semantic functionality and range fallback tests remain passing.
- Mobile/desktop behavior: no browser automation or isolated preview deployment was available in this recovery environment. Physical 320px/common-phone/desktop verification remains required for Marc; pinch gesture is explicitly PHYSICAL TEST REQUIRED.

## Preservation and limitations

- Shared `https://staging.theipm.ca` was not overwritten. Production was not changed. Landa staging content/media, PWA update work, schedule (218 active events), vendors (127 production records), maps, What3Words, notifications, and reconciliation were untouched.
- The only intentionally withheld precision range is `6B 26-29`; vendors resolving there continue to highlight the official parent range. Named/irregular areas and ambiguous/unmatched vendor records retain existing behavior.
- Individual cell boundaries are interaction geometry derived from audited parent rectangles; they do not alter or redraw the official coloured map.

## Recommended next step

Marc should review an isolated/local map build on a phone at 320px and common phone width, selecting first/middle/last booths in several ranges and confirming pan, pinch zoom, reset, and vendor search. A future milestone can add stronger destination emphasis after positional accuracy is accepted.

## Current recovery status

The work remains partial. The exact remaining gates are real end-to-end running-app vendor lookups for ACE/JCB, GGS Structures, Kodiak Boots, Hip Town Hype, StumpedIt, and Harkness Equipment; browser checks at 320px, a common phone width, and desktop; overflow/blank-SVG/highlight checks; and physical pinch validation. No isolated individual-booth preview was created. Shared staging, production, Landa content/media, schedule, vendors, PWA lifecycle, notifications, reconciliation, Notification Health, WonderPush, what3words, announcements, and production data were not changed by this recovery checkout. No notification was sent.
