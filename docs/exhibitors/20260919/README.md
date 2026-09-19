# Indoor exhibitor reconciliation — review hold

No directory, map, production or staging deployment changes have been made.
**All suggested locations in UNCONFIRMED-locations-for-organizers.csv are hypotheses, NOT app data.** The last two columns are blank for organizer completion.

## Baseline and sources

- Remote main: `85c7e8c678c8554bf5cc497b8973e963d986c365`.
- Live https://theipm.ca/api/vendors.json and main agree on all **228 records**.
- Sharon: `2026 Exhibitor List - for printing.xlsx`, tab **Sept 17**, reattached to her September 19 16:31 UTC email, Gmail message `1a0ba81e5c240068`.
- **342 data rows** (343 including header): 319 main-list rows and 23 site/attraction rows. RAM Truck Corral is another site feature in the main-list section.
- Sept 16 update inspected independently. It uses an unsplit Rural Living category; Sept 17 distinguishes Rural Living 1 and 2 and takes precedence.
- User-confirmed eight containing-area mappings apply only to those categories. No Education/Nuclear tent inferred.
- Newer approved assignments remain unchanged: B Town 1B 07; JW 5A 21; Fellowship 2A 16–17; Mitchell 2A 18–19; Bailey 2A 20. Source workbook older assignments do not overwrite these corrections.
- Sharon's September 17 cancellation email excludes RONA Doidge Kincardine, WM, Real-time Fun and Rentals/Route 66, and AmSpec; none is proposed for addition.

## Count distinction requiring a decision

**68 missing print/activity entries represent 66 company names.** CarePartners appears three times with distinct print names, in Agriculture, Rural Living 2 and Rural Expo Courtyard. No other candidate company repeats. The requested approximate 66 is reproducible as company count, not as separately named directory records.

The exact names are in `proven-indoor-candidates.csv`. Before writes, decide whether CarePartners should have one record with all three names/locations or three distinct activity records. No CarePartners identity or location should silently be discarded. This hold is about representation, not uncertainty about those three containing areas.

| Category | Missing print entries |
|---|---:|
| Agriculture | 19 |
| Commercial | 14 |
| Artisan | 1 |
| Rural Expo Courtyard | 14 |
| Rural Living 1 | 9 |
| Rural Living 2 | 9 |
| Antiques | 2 |
| Quilts | 0 |

## Remaining review

**19 entries in the organizer confirmation file:** 9 Education, 7 Nuclear, 2 known assignment conflicts, plus Fruitage of the Field (explicit lot but shared occupancy unconfirmed). Education includes **Grain Farmers of Ontario** in addition to the eight anticipated names. Its Education row is not the existing stage or VIP-tent feature.

Nine further missing directory names have explicit lots but are outside this indoor-only addition scope: Bruce County; Chepstow & District Lions Club; Doc MacCheesey; Fruitage of the Field; Iron-Haven Structures; Little Bowl; The Back 40 Smoke Box; Tilly's Fresh Fair Style Lemonade; Turquesa Mexican Food. Fruitage shares the printed 4B 24 assignment with existing Old Country Leather; do not assume whether this is legitimate sharing or a conflict.

Four more rows may already be represented by truncated names: Hanover Chrysler / DODGE DEALERS, Hanover Honda & Volkswagen / Hanover, Walkerton & District Hospital Foundation / Walkerton, Women's House / Kincardine. They are explicitly held for identity review, not counted as safe additions or silently duplicated. No unrelated name cleanup was performed.

The 342-row reconciliation classifies: 219 represented rows; 68 proven indoor print candidates; 24 site/attraction rows; 16 unknown indoor group locations; 2 known conflicts; 9 other directory omissions; 4 uncertain truncated identities. These sum to 342. Represented-row count is not a count of unique app records.

## Matching and map boundaries

Punctuation, legal suffixes, apostrophes and appended city names were normalized. Reviewed aliases include ENJO Canada / ENJO Chemical Free Cleaning System (existing confirmed commit 0fed35f7), Fellowship, DJ's, Metcalf / Metalf, Bell and Rogers cell towers, Ontario Cattle Feeders and Maitland Valley Conservation. A shared booth alone was not accepted as identity proof for the four truncated names.

Existing map catalog contains many of the missing directory names and containing-tent areas, but also stale merged Rural Living geometry. It cannot be blindly copied. Before candidate implementation, each added record needs strict resolution to its approved containing area or text-only fallback. No new geometry has been created. Browser/search/highlight validation has not run because no candidate data was changed.

## Safety

App records added: 0. Existing records changed: 0. Duplicates created: 0. Notifications: 0. Production changes: 0. T-30 unchanged. No deployment, migration, backend or Render changes.
