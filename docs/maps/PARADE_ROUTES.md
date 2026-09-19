# Staging parade routes

Route authority (route markings only; never exhibitor assignments):

- `data/IPM 2026 Tented City Map - Parade Route Tues.pdf` — SHA256 `238be5b2ef0ece5e9a7481cbddab6cf2a88f6dc7517db57f7162461383af888b`
- `data/IPM 2026 Tented City Map - Parade Route Wed to Sat.pdf` — SHA256 `613663d32912b4577f5c6029fda73985af86c44c110d7403dc95933845088213`

The organizer-supplied PDFs remain in the working repository's data folder; they are not published to attendees.

## Approved interpretation, 2026-09-19

**PENDING ORGANIZER CLARIFICATION — CURRENTLY EXCLUDED:** Tuesday's dashed blue segment across Mutual Square at Third Street, from Grain Farmers Avenue to Hydro One Avenue. Marc authorized exclusion for this staging preview while awaiting the organizers. This is not a definitive interpretation of that marking. `PENDING_MUTUAL_SQUARE_SEGMENT` retains the two endpoints independently from active paths. If confirmed, add it as another path; do not invent a direction without confirmation.

Marc also confirmed that the northbound Hydro One Avenue return reaches First Street and turns west for BOTH routes, despite the PDF arrow stopping short of the intersection.

## Roads and coordinate architecture

Both enter through the assembly-area gate east of Accessible Parking, travel west on Bruce County North, south on Hydro One Avenue and west on First Street, then south on Dodge Avenue.

Tuesday: east on Fifth Street, north on Bruce Power Avenue, east on Second Street, south on Grain Farmers Avenue, east on Fifth Street, north on Hydro One Avenue, west on First Street.

Wednesday–Saturday: east on Fifth Street, north on Hydro One Avenue, west on First Street.

`tentedCityParadeRoutes.ts` holds identities, source names, road sequences, path points, arrow directions, assembly-area polygon and the excluded segment. All points use the unchanged base SVG's `0 0 774 603` viewBox. Paths follow road lanes offset from street-name text. They are constructed from intersections, not traced highlighter pixels.

`ParadeRouteOverlay.tsx` renders an SVG image with white-outlined blue paths and direction chevrons. Like the existing base artwork, it uses React Native Image. It shares the base image's transformed layer and has no pointer events. The temporary assembly-area polygon and label appear only with a selected route. No map artwork, geometry, vendor catalog, notification or reminder files are changed.

The controls start off, allow one route at a time, show a checkmark and label for selection, and provide Off. Existing Vendors/Food/Stages filters remain.

## Reproduction

- Unit and regression tests: `node --test tests/tented-city-*.test.mjs` in frontend.
- Browser checks: `IPM_TEST_URL=https://staging.theipm.ca PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs IPM_TEST_OUTPUT=.artifacts/parade-route-review/staging node frontend/tests/tented-city-parade.browser.mjs` from repository root, using the workspace tool-cache wrapper.
- Browser checks block all non-GET requests and external/provider calls. They verify off/default, exclusive switching, search/highlight, camera alignment, reset and Off at 390, 768 and 1440px. Comparison captures use the actual fitted map layer, with normal viewport screenshots captured separately.
- Compare both rendered route images to their matching PDFs, applying only the approved exceptions above.
