# Grounds layers prototype

Base: `f3dbe04a48eb61401b830a0379ff700d876dba25`, Build 368630. Isolated branch: `prototype/grounds-map-layers-20260913`.

General is the default. The same mounted aerial image, phone header crop and camera serve all views. The two views are General and Parking; the separate Traffic button is removed. General retains the original printed areas, enhanced roads, Walkerton and Horse Plowing, and enables the exact approved arrow rendering, Flow of traffic caption and barricade information. Parking hides those traffic-only details and adds clickable arrival markers with concise source labels. Existing search and zone selection are independent of the view. The view control occupies a reserved footer above mobile navigation, without adding a row below search. Short phone viewports fit the map above the footer; desktop workspace sizing is unchanged.

## Reference sources

Read-only originals in `/workspaces/ipm-event/data`:

- `IPM 2026 - Entrances (8-26-2026).pdf` — SHA-256 `bb5b850862a5945306e56cb433cfb0fcf8a7fd7377856a58f03f2401ceea22e5`
- `IPM 2026 Site Map -911- Aug 26-26.pdf` — SHA-256 `df72476b820c88036aeb60a4beee1275344fc53c2415189a1993be413d357710`
- `Traffic Flow Map.docx` — SHA-256 `72c1ee8cbfc6309ff7cad63632a464c26380f20a2a9fec7990c67d1c202f93d2`

The 911 filename in this workspace has no `(1)` suffix. The titles, same-date area arrangement and road network were inspected directly. Its address values remain in that reference PDF for a possible future emergency view; no address numbers are included in the prototype overlay data. Mike Dupuis's DOCX retains the Huron Tractor barricade instruction and remains unchanged. Neither PDF replaces the app JPEG.

## Alignment and confidence

The Entrances PDF explicitly supplies every numbered label below. Triangular entrance arrow tips were read from its vector geometry. Tented City, North Parking, Horse Plowing and West Parking corners were matched to the current artwork, with the same-date 911 aerial providing the geographic cross-check. A local affine estimate over ten shared corners has about 0.14–0.99 percentage-point residuals within this arrival region. RV Park frontage was checked beside West Parking. The large Tractor Plowing outline differs in detail from the app's simplified coloured field; no new plowing POI is derived from it.

The numbered locations are MEDIUM-confidence prototype arrival anchors, not surveyed driveways. Bus Parking #3 is geographically distinct from the existing shuttle Bus Stop: the source puts the bus lot across Bruce Road 3 from Tented City. Its marker anchor is placed on that opposite frontage at [34.2,33], instead of using the uncorrected affine arrow-tip estimate [34.24,36.58] on the wrong side of the artwork's road. Accessible Parking uses the already digitized wheelchair symbol, cross-checked against the PDFs' accessible area beside the same Tented City/Durham frontage. It is HIGH confidence as an orientation POI, not a surveyed accessible-space boundary.

The small numbered disks use screen-space offsets and leader dots to keep adjacent entries distinct, especially #9/#10. The dots are the arrival anchors; zoom preserves marker legibility. Exact normalized anchors and offsets live in `frontend/src/config/groundsParking.ts`.

| POI | Display label | Confidence |
| --- | --- | --- |
| 1 | Tented City Entrance — Buses Only | MEDIUM |
| 2 | Tented City Entrance — Buses Only | MEDIUM |
| 3 | Bus Parking | MEDIUM |
| 4A | Tented City Entrance | MEDIUM |
| 4B | Tented City Entrance | MEDIUM |
| 5 | Exhibitor Entrance | MEDIUM |
| 7 | North Parking Entrance | MEDIUM |
| 8 | North Parking Entrance | MEDIUM |
| 9 | RV Park Entrance | MEDIUM |
| 10 | West Parking Entrance | MEDIUM |
| 11 | West Parking Entrance | MEDIUM |
| 12 | West Parking Entrance | MEDIUM |
| 13 | West Parking Entrance | MEDIUM |
| 14 | West Parking Entrance | MEDIUM |
| Accessible | Accessible Parking | HIGH |

The legend calls #7/#8 North Parking and #10–#14 West Parking; “Entrance” reflects the corresponding entrance arrows. It contains no #6 entrance, so none is invented. No LOW-confidence POI is displayed. No new POIs are inserted into search or backend data.

This is a UX prototype. Any future adoption should include a closer physical/source review of the approximate gate anchors, particularly the Bus Parking frontage, before production release.

## Two-view refinement

Continues from prototype `5e445dd3706865132d6a468ecd4bdf5577ef6fe4` / Build 368675. General has no added parking POIs. Green P symbols and accessibility/shuttle symbols baked into the JPEG remain; the artwork and actual North Parking, West Parking and RV Park areas are unchanged. All Parking coordinates remain prototype positions pending final verification.
