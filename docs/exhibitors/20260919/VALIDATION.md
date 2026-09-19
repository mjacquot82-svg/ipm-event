# Approved indoor candidate — staging review

Marc approved **three distinct CarePartners activity entries**. Exactly **68** directory records were added, bringing **228 → 296**. Existing 228 records retain every field and stable ID; the test checks their complete serialized SHA256. No unknown metadata was invented. IDs use deterministic UUIDv5 names.

Exact additions: [68-record CSV](proven-indoor-candidates.csv). All three CarePartners printed names and locations remain separate. Group counts: Agriculture 19; Commercial 14; Artisan 1; Rural Expo Courtyard 14; Rural Living 1 nine; Rural Living 2 nine; Antiques two; Quilts zero.

## Preview

- URL: https://6aaedfd8353144cbee69e4b0--ipm-web-staging.netlify.app
- Candidate source SHA: `f878711e5d7c1712e9fefadc7f41a5f244e705b3`
- Embedded Build: **376995**
- Netlify deployment: `6aaedfd8353144cbee69e4b0`, ready, draft preview on staging site `0932cc5d-9cb8-4cd3-8418-7e486df75bf1`.
- Shared staging publication and production publication were not replaced.
- Published directory equals the candidate JSON exactly; published JavaScript is byte-identical to the local build. Build wrapper logged 376997 on the final cached export; actual embedded/user-facing build is 376995. Source includes the final map-alias reconciliation.

## Validation

- **96/96 focused tests passed**, including all 68 exact-name searches, locations, unique directory/map identities, valid canonical containing footprints, three distinct CarePartners activities, map overlay idempotency, canonical fetch/cache behavior and existing map/exhibitor regressions.
- TypeScript: PASS. Frontend build: PASS. `git diff --check`: PASS.
- Published browser: all **68** new names searchable with correct location text at 390px.
- Published browser: **19** Find-on-Map interactions across 390px, 320px, 768px and 1440px; all seven added group categories exercised, and all three CarePartners activities exercised at every width. Correct selection title and visible containing-area highlight verified.
- Provider scripts and all non-GET/OPTIONS requests blocked during browser validation. No subscriptions, notifications, or production records touched.
- The 19 organizer-confirmation entries, nine explicit-lot omissions and four uncertain identities were not added or modified. No original directory record changed.
- Historical map city/print aliases belonging only to these additions were reconciled to avoid duplicate search results; unrelated map entries and geometry are unchanged. Full containing ranges/named areas are used, never an invented individual stall.
- Production main remains `85c7e8c678c8554bf5cc497b8973e963d986c365`; live production directory remains 228.

## Marc's review

Open the preview, choose Vendors, search each CarePartners activity and CIBC, and tap Find on Map. Compare additional names against the CSV. Production promotion remains unauthorized and has not occurred.

Production changes: 0. Backend/Render/migrations: 0. Notifications: 0. T-30 changes: 0. Duplicates created: 0. Unrelated vendors changed: 0.
