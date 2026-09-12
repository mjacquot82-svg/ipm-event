# SEPT8 STAGING APPLY REPORT

**Date:** 2026-09-11 (America/Toronto)  
**Branch:** `fix/staging-sept8-exhibitor-locations-20260911`  
**Repo:** https://github.com/mjacquot82-svg/ipm-event  
**Scope:** STAGING-ONLY static Tented City exhibitor location corrections from Sept 8 list.  
**Production / main / WonderPush / Schedule / Itinerary / Emergency / cyan selection / parent yellow hierarchy:** NOT touched.

## BASE SHA

| Item | Value |
|---|---|
| Preferred base | `origin/fix/staging-tented-visibility-amspec-20260911` (recently deployed staging tip) |
| BASE SHA | `3d535e15769b5457e4373973201004ff25c7716e` |
| `origin/staging` tip (older) | `71dd56d1` — not used; amspec/cyan tip is newer staging deploy |

## Data location

- Static Find-on-Map vendors: `frontend/src/data/tentedCityVendorsPart{1,2,3}.ts`
- Crosswalk alias update: `frontend/src/config/vendorMapCrosswalk.ts` (removed obsolete GBFSA → `(GBFSA), Hanover` alias after rename)
- **Staging API / Supabase:** no safe in-repo seed path for these Sept8 location fields. Staging `/api/vendors` remains proxied to production list (`netlify.toml`). **Static map updated; staging API location fields were not mutated.** Do not mutate production Supabase.

## Conflicts applied

| Vendor | From | To | Notes |
|---|---|---|---|
| Cottrill Heavy Equipment, Kincardine | `2A-04` | `2A-05` | booths `2A-05` only; Transit Trailer owns `2A-03-04` |
| Ontario PC Caucus | `3B-19` | `3B-18` | |
| Ontario Government | `3B-20-24` | `3B-19-24` | booths 3B-19…3B-24 |
| University of Guelph, Guelph | `3B-17-18` | `3B-16-17` | |
| Scatterbrain Creations by Paige & Mom | rural-living `4A-16-21, 4B-17-22` | outdoor `4A-13` | tent=null; parent assignment removed |
| Can-Am Demo Area, Montreal, QC | `WEST-4` | `WEST-02` | string update; kept existing special-area rect; no fake lot |
| Valard Construction, Vaughan | `5A-39-42` | `EAST-06` | string update; **rect=null** (no invent EAST-06 / 5A geometry) |
| DeDell Seeds Inc., Melbourne | `2B-15` | `2B-19-20` | existing De Dell spelling variant updated (no duplicate) |

## Backfills applied (truncated stubs → Sept8 names at correct lots)

| Was | Now | Location |
|---|---|---|
| Wroxeter | DJ's Handcrafted Solid Wood | `4A-29-30` |
| Alexandria | Fellowship of Christian Farmers | `2A-17-18` |
| (GBFSA), Hanover | Georgian Bay Funeral Services Association (GBFSA) | `4B-05` |
| Brucefield | Millroad Manufacturing & Sales | `1B-23-24` |

## Adds / stub renames

### Must-add
| Vendor | Location | How |
|---|---|---|
| Transit Trailer Ltd | `2A-03-04` | new outdoor row + sibling geometry |
| Bambrook Farm Equipment | `1A-05` | new outdoor row (garbled Hydro One Education… stub at 1A-05 left in place — NOT deleted) |
| Teeswater Agro Parts Ltd | `1A-21` | new outdoor row + interpolated geometry |
| Maitland Valley Conservation | `5B-10-12` | renamed former 5B Wroxeter stub / geometry |
| DeDell Seeds Inc., Melbourne | `2B-19-20` | location update (see conflicts) |

### Also-add if absent (applied)
| Vendor | Location | How |
|---|---|---|
| Cedarport Window & Door Centre | `2B-29` | renamed Thornbury stub |
| Florence Leather | `4B-15` | new |
| Gerry's Truck Centre | `4A-04` | new |
| Heavenly Dreams Ice Cream Inc | `4A-37` | renamed Cream Inc. Etobicoke stub; food |
| Metalf Food & Beverage | `3B-13-14` | renamed Mannheim stub; food |
| Ontario Cattle Feeders Association | `2B-07` | renamed Corn Fed Beef, London stub (sensible full name) |
| Premier Tech Water & Environment | `2A-28` | renamed Riviere-de-Loup, QC stub |
| Pro Cart | `5A-19` | new |
| Real Time Fun and Rentals | `4B-10` | new; food |
| What's Cookin' Food Trailer | `2A-12` | renamed West Montrose stub; food |
| WASTE MANAGEMNT | `4B-29` | new; Sept8 spelling kept; no Waste Management duplicate |

## HOLD verify

| Check | Result |
|---|---|
| AmSpec Group, Hamilton | **UNCHANGED** — `locationLabel=1B-16-22`, `tent=farming-for-the-future`, indoor |
| NOT_ON_SEPT_8 vendors deleted? | **No** — no deletions of E-class vendors |
| Vendor count | **318 → 326** (+8 net new rows; renames preserved slots) |

## Intentionally NOT done

- No NORTH / EAST-05 / CXD / invented map-gap geometry
- No Valard EAST-06 rect invention (`rect=null`)
- No CAN-AM fake lot (kept prior special-area rect under WEST-02 label)
- No H/human-review items except the explicit high-confidence list above
- No production Supabase / main merge / WonderPush / Schedule / Itinerary / Emergency / cyan / yellow hierarchy changes
- Orillia stub still present at `4A-13` alongside Scatterbrain (not deleted)

## Tests

| Suite | Result |
|---|---|
| `node --test tests/sept8-exhibitor-locations.test.mjs` | PASS |
| `node --test tests/tented-city-*.test.mjs` (+ grounds-map, sept8) | **101/101 PASS** |
| `npx tsc --noEmit` | PASS |
| `npm run build:web` | PASS (entry `entry-4281219111c7bb248894b451520d778c.js`, staging build 365794) |

## Ship

| Item | Value |
|---|---|
| Branch | `fix/staging-sept8-exhibitor-locations-20260911` |
| Commit | `c89066f002f6235632712bcc3604adc9f3dffdb6` |
| Push | pushed to `origin/fix/staging-sept8-exhibitor-locations-20260911` |
| Staging deploy | Netlify deploy `6aa49e5f3e51c857e96a69c1` live on staging site only |
| Deploy URL | https://staging.theipm.ca |
| Unique deploy URL | https://6aa49e5f3e51c857e96a69c1--ipm-web-staging.netlify.app |
| Deploy ID | `6aa49e5f3e51c857e96a69c1` |
| Netlify site | `ipm-web-staging` / `0932cc5d-9cb8-4cd3-8418-7e486df75bf1` |
| Production deploy | **NOT performed** |

## Staging API note

Static Tented City map data is the Find-on-Map source of truth for these corrections. Staging vendor API locations were not updated in-repo (no safe seed). Production Supabase untouched.
