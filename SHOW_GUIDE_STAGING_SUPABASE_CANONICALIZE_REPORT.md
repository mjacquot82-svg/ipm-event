# Show Guide Staging Supabase Canonicalize Report

**Date:** 2026-09-11 (America/Toronto)  
**UI candidate:** `ecfee1b19b53f12e0a6cf17fbdfbd14735771df7`  
**Scope:** Canonicalize already-approved Show Guide schedule corrections into **staging Supabase** so `/api/schedule` matches the staging UI without relying on the client patch as the source of truth.

## SAFETY / ACCESS CHECK

| Check | Result |
|---|---|
| Staging backend | `https://ipm-staging-backend.onrender.com` → Supabase project **`hooiqjcbcbwzjjvnwyxf`** / event slug **`ipm-staging`** |
| Production backend | `https://ipm-backend-eoiw.onrender.com` → project **`hppboivlpqkfhhzfftuu`** / **`ipm-2026`** |
| Event UUID overlap staging↔prod | **0** (separate databases) |
| Credential used | `/workspace/secrets/staging-supabase-service-role.txt` |
| JWT `ref` | **`hooiqjcbcbwzjjvnwyxf`** (staging) |
| JWT `role` | **`service_role`** |
| Production write | **REFUSED** by script hard-guards + credential project ref |

## APPLIED (staging Supabase `schedule_items`)

### Great Canadian Lumberjack Show
- Updated **15** existing rows only → `location_name = 1A-35-38`
- Dates Sep 22–26; times 10:30 AM / 1:00 PM / 3:00 PM **unchanged**
- Titles unchanged; **no duplicates**
- Verified via staging `/api/schedule`: all 15 locations `1A-35-38`

### Southampton Olive Oil
- **INSERTED** (was absent): Thu 2026-09-24 **2:45–3:15 PM**, Beyond Wireless / MNP Lifestyles
- `external_id=2026-09-24-show-guide-southampton-olive-oil`
- Staging total events **218 → 219**

### Essentially Lavender (Beyond Wireless)
- Times corrected to Guide **3:15–3:30 PM** (stored UTC equivalent `19:15–19:30Z`)
- Harley’s 4:00–5:00 Lavender row **untouched**

### Intentionally NOT changed
- Opening Ceremonies, Susan Briggs, Sat Doors Open afternoon — preserved (newer sources)
- Bruce RV ×6 CKNX Lounge — preserved (newer venue finalize)
- TBC Gregglea / Lawn Mower Races — **not added**
- Staging-only extras — **not deleted**
- **Production Supabase** — lumberjack still blank; no Southampton

## POST-APPLY VERIFICATION

| Check | Result |
|---|---|
| Staging API Lumberjack ×15 @ `1A-35-38` | PASS |
| Staging Southampton present | PASS |
| Staging Lavender Beyond Wireless 3:15–3:30 | PASS |
| Prod Lumberjack still blank | PASS |
| Prod Southampton absent | PASS |
| Re-dry-run update/insert counts | **0 / 0** (after UTC compare fix) |

## CLIENT PATCH STATUS

Staging frontend client-side patch remains in the UI build as an **idempotent safety net** (now a no-op for Lumberjack/Southampton/Lavender because DB already matches). Canonical source of truth is now **staging Supabase**. Production builds never apply the patch.

## TOOLING FIX

`backend/apply_show_guide_schedule_patch.py` now compares timestamptz with UTC-normalized equality so post-write verification does not false-fail on `-04:00` vs `+00:00` forms.

## PRODUCTION TOUCHED
**NO**

## MAIN TOUCHED
**NO**
