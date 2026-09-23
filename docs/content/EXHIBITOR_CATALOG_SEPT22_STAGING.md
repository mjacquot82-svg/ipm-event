# September 22 exhibitor catalog — staging review

Source: Sharon McCorquodale, RE: Exhibitor List Updates, September 22, 2026; IPM 2026 Exhibitor List - September 22.pdf

Base: `1614b1863eb16bcb4f93e4c7659a8ee7fb2e82d9`. Branch: `fix/catalog-sept22-staging-20260923`. Staging URL: https://staging.theipm.ca.

Catalog: **226 → 304**, **78 additions**, **48 existing updates**, **18 deferred ambiguity groups**. All 226 existing IDs retained; 178 existing records byte-for-byte unchanged. UUIDv5 URL namespace and the existing `ipm-vendor:` normalized-name convention used for additions. De Dell Seeds skipped as the existing DeDell Seeds variant.

All 202 previously mapped catalog records retain usable geometry. No new outdoor booth collisions. Existing K and S/Kreations overlap at 4B 34 remains; protected Dairy Farmers duplicates/multiple entries remain. No infrastructure added as an ordinary vendor. No geometry source files modified.

Hometown was actually 2B-25 on remote/live staging; changed to Lounge from the PDF. Walkerton’s truncated catalog name was expanded using its existing ID and the confirmed Foundation map identity. Seven confirmed PDF line-wrap fragments were consolidated in map matching data only. Shared-tent labels use the whole confirmed tent location, never invented indoor stalls.

The staging source had regressed to fetching vendors from the backend. A vendor-only web request correction uses same-origin `/api/vendors`, a separate environment-scoped canonical cache, and connectivity-only offline fallback. Native vendor fetching, Schedule and Announcement behavior remain unchanged.

## Validation

- Vendor/catalog/assignment/map suite: 141 passing; two pre-existing Schedule/Announcement cache assertions remain failing in the broad suite. Baseline suite failed seven runtime tests before correction of its JS-module loader and vendor path.
- TypeScript: nine errors, identical to unchanged origin/staging baseline; all in Itinerary, Schedule, AnnouncementCard and EventDetailMedia. No new errors.
- Production frontend build with staging configuration: passed.
- Lint: passed, 0 errors and 82 warnings.
- Mobile browser search and Find on Map: passed at 320px and 390px for eight corrected/new/previously mapped vendors, all using same-origin catalog requests.
- Preservation audit: 226 IDs retained; 202 mapped records retained; zero new individually mapped outdoor collision pairs.

## Deferred for Marc

- **Bambrook Farm Equipment / iLGi Canada**: 1A 05 ownership conflict; both unchanged.
- **Clinton / Treemendous Tree Sales & Transplanting**: 5A 32 ownership conflict; both unchanged.
- **Style Catering / Chris's Barbeque and Country Style Catering**: 5A 23-24 ownership conflict; both unchanged.
- **K and S Boat and Sled / Kreations Candy and Treats**: 4B 34 ownership conflict; both unchanged.
- **DODGE DEALERS / Dodge RAM**: Identity ambiguity; unchanged.
- **ENJO Chemical Free Cleaning System / ENJO Canada**: Identity ambiguity; no addition or rename.
- **Gilligan's Juice Bar**: Explicit hold; unchanged.
- **Brightshores Health System - Saugeen Shores Hospital Foundation**: Explicit hold; unchanged.
- **Bellario Café** — 4B 10: Existing booth claim: Real Time Fun and Rentals.
- **Diesel Creek Supply Co** — 4A 24: Existing booth claim: Shiva Fashion Inc, Scarborough.
- **Doc MacCheesey** — 2A 37: Existing booth claim: RONA Doidge Kincardine, Kincardine.
- **Ecoflo - Septic Solutions** — 2A 28: Existing booth claim: Premier Tech Water & Environment.
- **Fruitage of the Field** — 4B 24: Existing booth claim: Old Country Leather, Chesley.
- **MJ Burnt Creations, Mike's Diecast, Hill Top Farm** — 4B 29: Existing booth claim: WASTE MANAGEMNT.
- **Northern Fabrication** — 4A 14: Existing booth claim: Hip Town Hype, Trent Lakes.
- **Partnership Park**: Site area, not an ordinary vendor; existing map entry unchanged.
- **Pronano Solutions** — 2A 36: Existing booth claim: RONA Doidge Kincardine, Kincardine.
- **Women's House Serving Bruce and Grey** — 4B 06: Existing booth claim: Kincardine.

## Protected groups

Dairy Farmers of Ontario; Beef Farmers of Ontario & Bruce County Beef Farmers; McDougall Energy; Grain Farmers of Ontario / VIP Tent; Hydro One / Education Centre; DC Foods; Bell / Rogers towers; Teeswater Concrete / Farming for the Future Tent. Existing catalog records were preserved unchanged.

Main and production are excluded. No backend or Supabase changes, notifications, schedules, announcements, credentials, or production configuration changes. Stop for Marc after staging verification.

The machine-readable audit in `frontend/scripts/data/sept22-catalog-reconciliation.json` lists every addition, existing update, old location, ID, and deferred item.
