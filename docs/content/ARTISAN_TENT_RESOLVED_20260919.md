# Artisan Tent completion — staging only

This resolution supersedes the two unresolved items in `ARTISAN_TENT_STAGING_20260919.md`. The first eight presentations and their source manifest remain unchanged.

Authority: Marc supplied Pennie Wilhelm's “2026 IPM - Artisan's in the SHOW GUIDE” list and the instruction that all eleven display **Indoors at the Artisan Tent**. Marc also confirmed that Angie's intended day is Wednesday, September 23, not Friday, September 25.

## Vendor identity audit

The current canonical staging catalog, retained production snapshot, July vendor source and staging vendor database were checked for exact names, punctuation variants and plausible partial matches. Nine existing canonical records matched; Amabel Books and Rachel Joy Jewellery were absent. Existing names and IDs were retained. The two additions use the catalog's existing deterministic UUIDv5 convention.

Every row below now has attendee-facing location **Indoors at the Artisan Tent**:

| Vendor | Match | Previous location |
|---|---|---|
| Amabel Books — Allenford | CREATED IF TRULY ABSENT | No record |
| Equestrian Elite — Durham | MATCHED EXISTING | Blank |
| Flora and Fae — Tara | MATCHED EXISTING | Blank |
| Mike’s Wood — Elmwood | MATCHED EXISTING | Blank |
| Nana’s Sewing Basket — Walkerton | MATCHED EXISTING | Blank |
| Natural Stitch Designs — Amaranth | MATCHED EXISTING | Blank |
| Northern Flyer Design (Ken Thornburn) — Tara | MATCHED EXISTING | Blank |
| Paisley Drive Designs — Chesley | MATCHED EXISTING | Blank |
| Rachel Joy Jewellery — Kincardine | CREATED IF TRULY ABSENT | No record |
| Susan Seitz — Walkerton | MATCHED EXISTING | Blank |
| Wildflower Designs — Shallow Lake | MATCHED EXISTING | Blank |

`frontend/scripts/data/artisan-tent-vendors-2026.json` records the exact approved set and IDs. The scoped helper updates only their locations and creates only the two audited missing names. It normalizes punctuation for matching, blocks an ambiguous individual without changing that record, and continues the other confirmed matches. The existing catalog builder applies the same explicit overrides so a future regeneration retains them. The master exhibitor source and historical snapshot were not edited or rebuilt.

Catalog count: 224 → 226. All nine existing records differ only in location; all other existing records are identical. Vendor detail is shown inline in the existing Vendors cards; no new detail UI or map behavior was introduced.

## Angie

One new published occurrence:

- ID: `addedc7e-db44-5a7d-a7df-f3ab2a028e4f`
- Wednesday September 23, 2026, **2:00 PM America/Toronto**
- Title: **Flossie Mae Hats - & Feather Farmer Hats**
- Presenter: **Angie Smith-Eckensweiler**
- Location: **Artisan Tent Presentation Area**
- End time: unspecified/null, not invented.

No equivalent Artisan occurrence existed. Two distinct Flossie Mae events at other venues remain unchanged. The resolution patch inserts only Angie, protects every existing Schedule row with a before/after checksum, and refuses identity/data conflicts. No schema migration and no reapplication of the original eight presentations.

Database count 254 → 255. Checksum of all 254 pre-existing rows remains `3ae840a54cf69eb0d50cdc7896efe71c`. Public Schedule count 235 → 236, with all prior public records compared field-for-field. Artisan presentation count is **nine total across the two phases**, including the four Susan Sietz occurrences and Ken Thornburn's unchanged Thursday 1:30 PM occurrence. Susan Seitz's vendor spelling remains as supplied in the authoritative vendor list.

## Validation

Four backend data/identity tests passed. 119 targeted frontend tests passed; the sole failure remains the pre-existing `schedule-category-colours.test.mjs` assertion that staging contains no reminder functionality. No reminder code was changed. Fixed catalog-count assumptions in canonical cache tests were updated for authorized vendor additions.

Frontend build and `git diff --check` passed. Phone/desktop browser checks cover every vendor's search and inline details, and all nine presenters' search, day filtering, details and stable itinerary IDs. Browser tests block non-GET and provider requests. Raw verification snapshots and screenshots are retained in `.artifacts/artisan-resolution/` with checksums.

No unrelated vendor/Schedule changes, parade/map/control changes, notification/T-30 changes, production changes, or PR #39 actions.
