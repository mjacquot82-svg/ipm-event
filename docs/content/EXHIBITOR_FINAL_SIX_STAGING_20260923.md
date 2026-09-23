# Sharon’s final six exhibitor decisions — staging only

Authority: Sharon McCorquodale’s September 23, 2026 13:29:59 UTC reply in “RE: Exhibitor List Updates” (Gmail message `1a0ce758cf66c9b0`). Base staging commit: `1f9624efc2b0ca7fe2cd0145ef917476aa54b3c1`.

Catalog: **304 → 303**. Remove two cancelled entries, rename three existing records, add one record for the split RONA assignment. All other 299 catalog records are unchanged. No existing record for any of the four replacement names was present in the approved baseline.

| Decision | Catalog outcome | ID |
| --- | --- | --- |
| Gilligan’s Juice Bar | Cancelled; removed | `87a6f85f-b903-584b-a8e1-c92458076dc6` removed |
| Brightshores Health System – Saugeen Shores Hospital Foundation | Cancelled; removed | `b5263806-99c3-4979-af82-5c08f1d598e7` removed |
| 4B 10 | Real Time Fun and Rentals → Bellario Café | `6e77cda5-7713-5ed5-83f5-e2a8b85d69a7` preserved |
| 2A 37 | RONA Doidge Kincardine, Kincardine → Doc MacCheesey | `2c76a419-cfec-4413-9d8c-e1944dda6add` preserved |
| 4B 29 | WASTE MANAGEMNT → MJ Burnt Creations, Mike’s Diecast, Hill Top Farm | `e32ebc10-ce2b-5bac-8bb4-c21650a2effb` preserved |
| 2A 36 | Pronano Solutions | `53ee0ece-6172-5f47-899f-d3f0c0d0c299` new |

RONA was one catalog/map record covering 2A 36–38. Its ID is retained for Doc MacCheesey; Pronano receives the existing project’s deterministic UUIDv5 name convention. Both resolve to their specific existing booth rectangles. Booth 2A 38 remains in site geometry, without assigning an unconfirmed exhibitor. No geometry source changes. Neither cancelled exhibitor had a bundled map identity to remove. Superseded names no longer match vendors in either catalog or map search.

Validation: 39 focused catalog, confirmed-assignment, unavailable-state and map/search tests pass, including exact footprint/ID checks for these six decisions and unchanged unrelated catalog/map records. Production-mode frontend build passes with the existing staging environment. An additional older map UX test expects Valard at EAST-06; the approved baseline already places it at 5A 39–42. That unrelated stale assertion is unchanged.

Reproduction: run `node --test` with `sept23-final-six.test.mjs`, `staging-vendors-catalog.test.mjs`, `sept22-confirmed-decisions.test.mjs`, `sept22-source-replacements.test.mjs`, `unmapped-vendor-state.test.mjs`, and `tented-city-search.test.mjs` under `frontend/tests/`, through `scripts/with_tool_cache.py`. Mobile deploy-preview verification passed all 18 cases (nine per viewport). Mobile staging verification uses `frontend/tests/sept23-final-six.browser.mjs` at 320px and 390px, checking absent cancelled/superseded names and all four Find on Map highlights.

Only frontend vendor data, focused tests and this report change. No backend, Supabase, notification, schedule, announcement, main or production changes. Deploy only to the verified `ipm-web-staging` Netlify site, then stop for Marc.
