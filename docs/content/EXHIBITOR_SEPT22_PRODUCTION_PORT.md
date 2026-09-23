# September 22 exhibitor catalog: narrow production port

Base main: `b776e6f823488b93a0e58c884285593934a8519d`.
Approved source: `1f9624efc2b0ca7fe2cd0145ef917476aa54b3c1`.
Branch: `feat/sept22-exhibitor-catalog-production`.

Catalog **238 → 315**: 78 September 22 additions plus Fruitage of the Field and Northern Fabrication; 57 existing-record updates; three blank duplicate consolidations (iLGi, Chris's catering, Treemendous). Existing replacement IDs match the approved staging decisions. No unrelated production vendor was removed. The unchanged production grouping behavior displays 314 exhibitor cards because the two Beef Farmers location records share one card.

This applies the approved reconciliation and follow-up changes at record level. It does not merge staging or copy staging's full catalog. All 18 unrelated production records absent from staging remain identical. The production vendor loader and attendee presentation are unchanged, including offline behavior. PR #65 countdown, notification/T-30 behavior, schedules, announcements, backend, Supabase, map geometry definitions, and deployment configuration are unchanged.

Only required map matching data, aliases, and Hometown's production override are updated. All other production assignment overrides remain intact. Geometry comparison passes for 167 unaffected mapped production records and six same-booth replacements. Dodge RAM retains its existing unavailable-geometry result; no geometry is invented. Shared outdoor claims are limited to the three approved exhibitor pairs. Partnership Park remains a site area.

The six unresolved groups retain their production state, including absence of Real Time Fun, RONA, WASTE MANAGEMNT and their proposed replacements:

- Gilligan's Juice Bar
- Brightshores Health System - Saugeen Shores Hospital Foundation
- Bellario Café / Real Time Fun
- Doc MacCheesey / RONA
- MJ Burnt Creations, Mike's Diecast, Hill Top Farm / WASTE MANAGEMNT
- Pronano Solutions / RONA

Validation:

- 77 focused catalog, confirmed assignment, map matching/geometry/collision, and canonical vendor-loading tests passed.
- TypeScript (`npx --no-install tsc --noEmit`) passed.
- Production frontend build (`npm run build:web`, production configuration) passed; generated dist files are excluded from the PR.
- Local mobile browser, 390 × 844: 19 search/map cases passed plus Partnership Park exclusion. Includes all eight replacements, all six exhibitors in the three shared pairs, Can-Am, Valard, Hometown, Action First Aid, and preserved B Town Farm Supply.
- Exact comparison: all 80 additions and 57 updated records equal approved staging values; all unaffected production records are preserved. Two existing test response fixtures now include the revision required by the unchanged production API validator.
- No broad audit, manual deployment, or merge performed.

Focused reproduction:

```sh
node --test tests/sept22-production-port.test.mjs tests/staging-vendors-catalog.test.mjs tests/consolidated-exhibitor-update.test.mjs tests/tented-city-geometry.test.mjs tests/tented-city-map.test.mjs tests/tented-city-search.test.mjs tests/unmapped-vendor-state.test.mjs tests/vendors-canonical-runtime.test.mjs
npx --no-install tsc --noEmit
npm run build:web
# Serve the local export with SPA fallback and /api/vendors → /api/vendors.json.
IPM_TEST_URL=http://127.0.0.1:8776 node tests/sept22-production-port.browser.mjs
```

Exact files changed:

- `docs/content/EXHIBITOR_SEPT22_PRODUCTION_PORT.md`
- `frontend/public/api/vendors.json`
- `frontend/scripts/data/sept22-production-port.json`
- `frontend/src/config/tentedCitySemanticMap.ts`
- `frontend/src/config/tentedCityVendorMatch.ts`
- `frontend/src/config/vendorMapCrosswalk.ts`
- `frontend/src/data/tented-city-vendor-match-report.json`
- `frontend/src/data/tentedCityVendorsConsolidated.ts`
- `frontend/src/data/tentedCityVendorsPart1.ts`
- `frontend/src/data/tentedCityVendorsPart2.ts`
- `frontend/src/data/tentedCityVendorsPart3.ts`
- `frontend/tests/consolidated-exhibitor-update.test.mjs`
- `frontend/tests/helpers/load-ts.mjs`
- `frontend/tests/sept22-production-port.browser.mjs`
- `frontend/tests/sept22-production-port.test.mjs`
- `frontend/tests/staging-vendors-catalog.test.mjs`
- `frontend/tests/tented-city-geometry.test.mjs`
- `frontend/tests/tented-city-map.test.mjs`
- `frontend/tests/tented-city-search.test.mjs`
- `frontend/tests/unmapped-vendor-state.test.mjs`
- `frontend/tests/vendors-canonical-runtime.test.mjs`

The 18 unrelated production records retained verbatim:

- B Town Farm Supply
- National Energy Equipment Inc.
- Weldesign Hardware Inc., Burgessville
- Huron-Bruce Provincial Liberal Association
- CSN Auto Reset Group
- Maple Court Retirement
- Amabel Books, Allenford
- Rachel Joy Jewellery, Kincardine
- AgScape
- Canadian Agricultural Safety Association (CASA)
- DGFO - Dairy Goat Farmers of Ontario
- FIRST Robotics Canada
- Grain Farmers of Ontario
- Gregglea Clydesdales
- Grey Bruce Pork Producers
- Ontario Association of Agriculture Societies
- Ontario Sheep Farmers
- Set Free Healing

Stop for Marc: PR only; do not merge or deploy.
