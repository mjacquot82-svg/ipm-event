# STAGING VENDORS RECONCILE REPORT

**Date:** 2026-09-12T14:28:36.764Z (UTC)  
**Scope:** STAGING-ONLY static `/api/vendors` catalog  
**Production / main / WonderPush / Supabase:** NOT touched

## Architecture

- **Before:** Netlify proxied `/api/vendors` → production Render Google Sheets list (127 UUID vendors, blank locations)
- **After:** Netlify serves baked `frontend/public/api/vendors.json` (status 200). Other `/api/*` unchanged.
- **Map geometry:** still `tentedCityVendorsPart*.ts` (326 booth rows)

## Counts

| Metric | Value |
|---|---|
| Sept8 unique (incl. parent placeholders) | 166 |
| Sept8 unique exhibitors (excl. parents) | 153 |
| Parent placeholders skipped | 13 |
| Matched production UUIDs (updates) | 56 |
| New uuid5 inserts | 97 |
| NOT_ON_SEPT8 preserved | 71 |
| **Expected attendee vendor count** | **224** |

Difference from Sept8's 166 unique: 166 includes 13 parent tent placeholders (not Vendor cards). Catalog = 153 Sept8 exhibitors + 71 preserved production-only rows.

## Must-haves

- **CAN-AM** → `WEST-02`: OK Can-Am Demo Area, Montreal, QC @ WEST-02
- **Valard** → `EAST-06`: OK Valard Construction, Vaughan @ EAST-06
- **Bambrook** → `1A-05`: OK Bambrook Farm Equipment @ 1A-05
- **Cottrill** → `2A-05`: OK Cottrill Heavy Equipment, Kincardine @ 2A-05
- **Transit Trailer** → `2A-03-04`: OK Transit Trailer Ltd @ 2A-03-04
- **Ontario Government** → `3B-19-24`: OK Ontario Government @ 3B-19-24
- **UGuelph** → `3B-16-17`: OK University of Guelph, Guelph @ 3B-16-17
- **Scatterbrain** → `4A-13`: OK Scatterbrain Creations by Paige & Mom @ 4A-13
- **DJ's** → `4A-29-30`: OK DJ's Handcrafted Solid Wood @ 4A-29-30
- **Fellowship** → `2A-17-18`: OK Fellowship of Christian Farmers @ 2A-17-18
- **Georgian Bay Funeral** → `4B-05`: OK Georgian Bay Funeral Services Association (GBFSA) @ 4B-05
- **Millroad** → `1B-23-24`: OK Millroad Manufacturing & Sales @ 1B-23-24
- **Teeswater Agro** → `1A-21`: OK Teeswater Agro Parts Ltd @ 1A-21
- **Maitland** → `5B-10-12`: OK Maitland Valley Conservation @ 5B-10-12
- **DeDell** → `2B-19-20`: OK DeDell Seeds Inc., Melbourne @ 2B-19-20

## AmSpec HOLD

- AmSpec Group id=a0d0ef38-08bd-47ed-a65f-4e89c44c44e1 location=`1B-16-22`

## Output

- Script: `frontend/scripts/build-staging-vendors-catalog.mjs`
- JSON: `frontend/public/api/vendors.json`
- Snapshots: `frontend/scripts/data/sept8_exhibitors_grouped.json`, `frontend/scripts/data/production-vendors-snapshot.json`
