# SHOW GUIDE SCHEDULE APPLY REPORT

**Date:** 2026-09-11 (America/Toronto)  
**Branch:** `fix/staging-show-guide-schedule-20260911`  
**Repo:** https://github.com/mjacquot82-svg/ipm-event  
**Scope:** STAGING-ONLY high-confidence Show Guide schedule corrections.  
**Production / main / WonderPush / unrelated events:** NOT touched.

## FINAL REPORT

### BASE SHA
| Item | Value |
|---|---|
| Base branch | `fix/staging-sept8-exhibitor-locations-20260911` |
| BASE SHA | `f4bd0b8e5cee5549bf8bf1ed574c95df11caeb90` |
| New branch | `fix/staging-show-guide-schedule-20260911` |

### INVESTIGATION — where schedule lives
| Path | Finding |
|---|---|
| Live API (prod) | `https://ipm-backend-eoiw.onrender.com/api/schedule` — 218 events, Supabase-backed |
| Live API (staging) | `https://ipm-staging-backend.onrender.com/api/schedule` — 218 events, **separate DB** (0 UUID overlap with prod) |
| Staging Netlify env | `EXPO_PUBLIC_BACKEND_URL=https://ipm-staging-backend.onrender.com`, `EXPO_PUBLIC_EVENT_ID=ipm-staging` |
| Staging Supabase | project `hooiqjcbcbwzjjvnwyxf` / event slug `ipm-staging` |
| Prod Supabase | project `hppboivlpqkfhhzfftuu` / event slug `ipm-2026` — **not written** |
| In-repo seeds | `backend/import_manifests/*` (entertainment / MNP / parade); no prior Lumberjack location seed |
| Netlify `/api/schedule` | Not proxied; SPA calls baked `EXPO_PUBLIC_BACKEND_URL` directly |
| Credentials on box | **No** staging Supabase service_role key — cannot safely PATCH staging DB from this environment |

### SAFEST STAGING-ONLY PATH USED
**Staging frontend override** (guarded by `EXPO_PUBLIC_IPM_APP_LABEL === 'staging'`, inlined `return true` only in staging builds):

- Patch JSON: `frontend/src/data/showGuideSchedulePatch.json` (+ mirror `backend/import_manifests/show_guide_schedule_patch_20260911.json`)
- Applier: `frontend/src/data/applyShowGuideSchedulePatch.ts` / `.mjs`
- Wired in: `frontend/src/services/spreadsheetDataService.ts` → `getScheduleData`
- Optional later DB sync: `backend/apply_show_guide_schedule_patch.py` (hard-refuses production; dry-run default; needs stdin service_role)

Production builds set `EXPO_PUBLIC_IPM_APP_LABEL=production` → patch function inlines to `false` → **no production schedule mutation**.

### APPLY DECISIONS

#### 1. Lumberjack — APPLIED (REQUIRED)
| Field | Value |
|---|---|
| Action | SET `location_name` = `1A-35-38` on all existing Great Canadian Lumberjack Show rows |
| Count | **15** (Sep 22–26 × 10:30 AM / 1:00 PM / 3:00 PM) |
| Times | Unchanged |
| Dupes | None created |
| Confidence | HIGH — Marc exact string + Show Guide exhibitor footprint |

#### 2. Southampton Olive Oil — ADDED
| Field | Value |
|---|---|
| Action | ADD discrete title (no live name-variant; Lavender had absorbed 2:45–3:30) |
| When | Thu 2026-09-24 **2:45 PM–3:15 PM** |
| Structure | `category=MNP Lifestyles Tent Events`, `location_name=The Beyond Wireless Stage` |
| Confidence | HIGH for Guide title presence; MEDIUM historically in reconciliation but Guide lists discrete title |

#### 3. TBC — HOLD (not added)
| Item | Result |
|---|---|
| Gregglea Clydesdales Tue TBC | **NOT added** (Wed–Sat Gregglea already in staging) |
| Lawn Mower Races ×7 | **NOT added** |

#### 4. Time conflicts — evidence then decide
| Event | Guide | Staging | Decision | Evidence |
|---|---|---|---|---|
| Opening Ceremonies | 11:30–**1:30** | 11:30–**1:00** | **PRESERVE staging** | `ipm_entertainment_2026.json` source `Aug 18, 2026_REVISED (2).pdf` |
| Susan Briggs | **3:00**–5:00 | **3:30**–5:00 | **PRESERVE staging** | Same Aug 18 revised entertainment import |
| Essentially Lavender (Beyond Wireless) | **3:15–3:30** | 2:45–3:30 | **CORRECT to Guide 3:15–3:30** | Guide + MNP manifest `2026-09-24-foodland-h27`; live merge was the outlier |
| Sat Doors Open afternoon | 12:00–1:00 | **12:30–1:30** Gina Livy | **PRESERVE staging** | MNP approved description `Doors open 12:30 PM` (`foodland-o18`) |

#### 5. Bruce RV Park location conflicts ×6 — PRESERVE staging
| Acts | Guide loc | Staging loc | Decision |
|---|---|---|---|
| Weekend Never Ends, Adam Cousins, Colt McLauchlin, The Skeleton Crew, Catfish Gumbo, Tandem | The Bruce RV Park | CKNX Centennial Pavilion (GFO Stage) Lounge | **PRESERVE CKNX** |

**Evidence:** commit `03b0fe57` (*fix: finalize IPM schedule venue details*) intentionally changed `BRUCE_LOCATION` from `The Bruce RV Park` → CKNX Lounge while keeping category `The Bruce RV Park - Nightly Entertainment`.

#### 6. Staging-only deletes
**0 deleted** (56 staging-only events preserved; total 218 → 219 with Southampton add in patched view).

### TESTS
| Suite | Result |
|---|---|
| `node --test frontend/tests/show-guide-schedule-patch.test.mjs` | **9/9 PASS** |
| `python3 -m unittest tests.test_show_guide_schedule_patch` | **4/4 PASS** |
| `npx tsc --noEmit` | PASS |
| `npm run build:web` (staging label) | PASS — entry `entry-5661bee3f3291344ce063099c034961e.js`, build **365835** |

### SHIP
| Item | Value |
|---|---|
| Branch | `fix/staging-show-guide-schedule-20260911` |
| Commit | `d71c9135403265d7e5fd2231423befaff7cbc50a` |
| Push | pushed to `origin/fix/staging-show-guide-schedule-20260911` |
| Staging deploy | Netlify `ipm-web-staging` — **YES** (frontend override visible) |
| Deploy URL | https://staging.theipm.ca |
| Unique deploy URL | https://6aa4a843875c3a03dbf75ed9--ipm-web-staging.netlify.app |
| Deploy ID | `6aa4a843875c3a03dbf75ed9` (prior rebuild `6aa4a808e0cb0e466df06a56`) |
| Netlify site | `ipm-web-staging` / `0932cc5d-9cb8-4cd3-8418-7e486df75bf1` |
| Live bundle guard | `shouldApplyShowGuideSchedulePatch=function(){return!0}` verified on staging.theipm.ca |
| Production deploy | **NOT performed** |
| Staging Supabase DB apply | **NOT performed** (no service_role on box). Live `/api/schedule` on staging backend still returns blank Lumberjack until `backend/apply_show_guide_schedule_patch.py --apply` is run with staging keys. **Staging UI still shows corrected locations** via client patch. |

### CAVEAT
**STAGING DEPLOYED** with caveat: schedule **API** rows on `ipm-staging-backend` are unchanged; **attendee staging PWA** applies the committed patch after fetch (`EXPO_PUBLIC_IPM_APP_LABEL=staging` → guard inlined true). Production PWA does not apply the patch. Production Supabase untouched.

### FILES
- `frontend/src/data/showGuideSchedulePatch.json`
- `frontend/src/data/applyShowGuideSchedulePatch.ts`
- `frontend/src/data/applyShowGuideSchedulePatch.mjs`
- `frontend/src/data/showGuideScheduleBaseline.staging.json`
- `frontend/src/services/spreadsheetDataService.ts`
- `frontend/tests/show-guide-schedule-patch.test.mjs`
- `backend/import_manifests/show_guide_schedule_patch_20260911.json`
- `backend/apply_show_guide_schedule_patch.py`
- `tests/test_show_guide_schedule_patch.py`
- `IPM_SHOW_GUIDE_SCHEDULE_RECONCILIATION.md` / `.csv` (read-only inputs, committed for audit trail)
