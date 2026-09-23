# Eight confirmed exhibitor decisions — staging only

Base SHA: `6767d0aa1857c2fda67183e6dc2b99c76d287b37`. Catalog: **304 → 306**.

## Exact record changes

- `5e1c39f7-d7c4-4bc7-9353-1b426bbbd4fd`: K and S Boat and Sled → K and S Boat and Sled; (blank) → 4B 34.
- `5041c4ee-0da8-5174-b73c-2451f95aa2ac`: DODGE DEALERS → Dodge RAM; 5A-01-04 → 5A 01-04.
- `d9e22660-ba30-5f2e-a36d-91888a9f2cc7`: Clinton → Treemendous Tree Sales & Transplanting; 5A-32 → 5A 32.
- `380ac022-0c50-43fa-8580-e4493f794556`: Kincardine → Women's House Serving Bruce and Grey; 4B-06 → 4B 06.
- Added `02042ba2-214b-5841-bb7a-f17f5ba0dd60`: Fruitage of the Field — 4B 24.
- Added `77353df6-d87b-5afc-a209-67793fa5d8af`: Northern Fabrication — 4A 14.
- Restored `64319171-ef84-58ee-b1f9-00189522f700`: ENJO Chemical Free Cleaning System → ENJO Canada — 4A 16-21. The current candidate lacked ENJO; its existing ID was recovered from the preserved September 16 staging catalog.
- Consolidated the blank Treemendous duplicate `9efea015-7697-44b4-a27f-5c1b605b81d6` into the confirmed Clinton replacement; the Clinton ID is retained.
- Kreations Candy and Treats, Old Country Leather and Hip Town Hype remain unchanged beside their confirmed booth partners.
- Partnership Park remains a site-area map entry and is absent from the ordinary vendor catalog.

## Validation

- 75 focused vendor, confirmed-assignment, map-matching and geometry tests passed.
- 299 unrelated existing catalog records and every unrelated map record are unchanged.
- No broad audit rerun. The frontend build is needed only to publish the changed map bundle. Deployment/browser evidence is retained in the final report.
- Only the three explicitly authorized shared-booth pairs are accepted; other deferred assignments remain untouched.

## Remaining unresolved groups (10)

- Bambrook Farm Equipment / iLGi Canada: 1A 05 ownership conflict; both unchanged.
- Style Catering / Chris's Barbeque and Country Style Catering: 5A 23-24 ownership conflict; both unchanged.
- Gilligan's Juice Bar: Explicit hold; unchanged.
- Brightshores Health System - Saugeen Shores Hospital Foundation: Explicit hold; unchanged.
- Bellario Café: Existing booth claim: Real Time Fun and Rentals.
- Diesel Creek Supply Co: Existing booth claim: Shiva Fashion Inc, Scarborough.
- Doc MacCheesey: Existing booth claim: RONA Doidge Kincardine, Kincardine.
- Ecoflo - Septic Solutions: Existing booth claim: Premier Tech Water & Environment.
- MJ Burnt Creations, Mike's Diecast, Hill Top Farm: Existing booth claim: WASTE MANAGEMNT.
- Pronano Solutions: Existing booth claim: RONA Doidge Kincardine, Kincardine.

Main/production, backend, Supabase, notifications, schedules and announcements are outside this change. Stop for Marc after staging verification.
