# IPM Show Guide ↔ Staging Schedule Reconciliation

**Generated:** 2026-09-11 ~20:58 EDT (America/Toronto)  
**Mode:** READ-ONLY (no staging/production/code/schedule mutations)  
**Show Guide:** https://www.plowingmatch.org/ipm2026/wp-content/uploads/2026/08/IPM-2026-Show-Guide.pdf → `/tmp/IPM-2026-Show-Guide.pdf` and `/workspace/show-guide/IPM-2026-Show-Guide.pdf` (`pdftotext -layout`)  
**Staging API:** https://ipm-backend-eoiw.onrender.com/api/schedule (`total_count` 218). `staging.theipm.ca/api/schedule` did not return JSON.  
**Authority:** Show Guide stronger than older imports unless an explicit newer correction/withdrawal is documented.  
**Withdrawals searched:** `/workspace/ipm-event-pkg1`, `/workspace/ipm` — no schedule WITHDRAWN list found (vendor A-001 “NOT withdrawn” is unrelated). No known withdrawn showtimes excluded.  
**Lumberjack empty-location context:** `IPM_MASTER_LOCATION_PUNCH_LIST.md` E-001…E-015.  

## Dashboard

| Metric | Count |
|---|---:|
| **SHOW_GUIDE_EVENTS_REVIEWED** | **171** |
| **EXACT_MATCHES** | **135** |
| **PARTIAL_MATCHES** | **17** |
| **MISSING_FROM_STAGING** | **9** |
| **TIME_CONFLICTS** | **4** |
| **LOCATION_CONFLICTS** | **6** |
| **STAGING_ONLY_EVENTS** | **56** |
| **LUMBERJACK_SHOW_OCCURRENCES** | **15** |
| **LUMBERJACK_MISSING_OR_CONFLICTING** | **15** |
| **STAGING_TOTAL** | **218** |

### Matching notes
- Guide MNP pages print one condensed column + “*2 demo stages running*”; staging uses multi-stage workbook (Beyond Wireless / Quality Homes / Harley’s). Staging stage names under MNP count as **compatible / more precise**, not location conflicts.
- **Real location conflicts (6):** all Bruce RV Park nightly acts currently have staging `location_name` = CKNX Lounge.
- Opening Ceremonies: Guide **11:30 AM–1:30 PM** vs staging **11:30 AM–1:00 PM** (entertainment import / Aug 18 revised PDF) — TIME CONFLICT.
- Susan Briggs: Guide **3:00–5:00 PM** vs staging **3:30–5:00 PM** — TIME CONFLICT on start.
- Afternoon Sat Doors Open: Guide **12:00–1:00 PM** vs staging **12:30–1:30 PM** — TIME CONFLICT.
- Essentially Lavender: Guide **3:15–3:30 PM** vs staging **2:45–3:30 PM** (absorbs Southampton Olive Oil Guide slot) — TIME CONFLICT / related missing Southampton title.
- Lawn Mower Races (TBC) ×7 and Tue Gregglea (TBC) appear in Guide, absent from staging.
- Lumberjack: Guide **10:30 AM, 1:00 PM & 3:00 PM** Tue–Sat (**15**). Staging has all 15 showtimes; **`location_name` blank** on all.

## 1. Great Canadian Lumberjack Show — every Guide occurrence

| DATE | START_TIME | END_TIME | LOCATION | PRESENT_IN_STAGING | STAGING_TITLE | STAGING_TIME | STAGING_LOCATION | MATCH | RECOMMENDED_ACTION | CONFIDENCE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-09-22 | 10:30 AM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | yes | Great Canadian Lumberjack Show | 10:30 AM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| 2026-09-22 | 1:00 PM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | yes | Great Canadian Lumberjack Show | 1:00 PM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| 2026-09-22 | 3:00 PM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | yes | Great Canadian Lumberjack Show | 3:00 PM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| 2026-09-23 | 10:30 AM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | yes | Great Canadian Lumberjack Show | 10:30 AM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| 2026-09-23 | 1:00 PM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | yes | Great Canadian Lumberjack Show | 1:00 PM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| 2026-09-23 | 3:00 PM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | yes | Great Canadian Lumberjack Show | 3:00 PM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| 2026-09-24 | 10:30 AM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | yes | Great Canadian Lumberjack Show | 10:30 AM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| 2026-09-24 | 1:00 PM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | yes | Great Canadian Lumberjack Show | 1:00 PM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| 2026-09-24 | 3:00 PM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | yes | Great Canadian Lumberjack Show | 3:00 PM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| 2026-09-25 | 10:30 AM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | yes | Great Canadian Lumberjack Show | 10:30 AM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| 2026-09-25 | 1:00 PM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | yes | Great Canadian Lumberjack Show | 1:00 PM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| 2026-09-25 | 3:00 PM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | yes | Great Canadian Lumberjack Show | 3:00 PM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| 2026-09-26 | 10:30 AM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | yes | Great Canadian Lumberjack Show | 10:30 AM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| 2026-09-26 | 1:00 PM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | yes | Great Canadian Lumberjack Show | 1:00 PM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| 2026-09-26 | 3:00 PM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | yes | Great Canadian Lumberjack Show | 3:00 PM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |

### Lumberjack findings
- **Guide occurrences:** 15 (2026-09-22 … 2026-09-26 × 10:30 AM / 1:00 PM / 3:00 PM).
- **Each exists in staging:** yes — all 15 date/start matches.
- **Exact dates/times (America/Toronto):** Sep 22–26 at 10:30 AM, 1:00 PM, 3:00 PM.
- **Guide location:** schedule pages name the show only; exhibitor directory **Great Canadian Lumberjacks 1A 35-38**.
- **Staging location:** empty ×15 → **partial** (less precise than Guide+directory). Same P0 as punch-list E-001…E-015.
- **Missing showtimes:** 0. **Time conflicts:** 0. **LUMBERJACK_MISSING_OR_CONFLICTING:** 15 (location-blank partials only).

## 2. Guide events missing from staging

| SHOW_GUIDE_TITLE | DATE | START_TIME | END_TIME | LOCATION | CATEGORY | PRESENT_IN_STAGING | STAGING_TITLE | STAGING_TIME | STAGING_LOCATION | MATCH | RECOMMENDED_ACTION | CONFIDENCE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Gregglea Clydesdales | 2026-09-22 | 11:00 AM |  | RAM Truck Corral | RAM Truck Corral | no |  |  |  | missing | Guide lists Gregglea Clydesdales Tue 11:00 AM (TBC) at RAM Truck Corral — missing in staging; confir | MEDIUM |
| Lawn Mower Races (to be confirmed) | 2026-09-22 | 3:30 PM |  | Event Centre #1 — West 2 | Event Centre #1 | no |  |  |  | missing | Guide TBC item absent from staging — confirm with organizers before adding; do not invent. | MEDIUM |
| Lawn Mower Races (to be confirmed) | 2026-09-23 | 9:30 AM |  | Event Centre #1 — West 2 | Event Centre #1 | no |  |  |  | missing | Guide TBC item absent from staging — confirm with organizers before adding; do not invent. | MEDIUM |
| Lawn Mower Races (to be confirmed) | 2026-09-23 | 3:30 PM |  | Event Centre #1 — West 2 | Event Centre #1 | no |  |  |  | missing | Guide TBC item absent from staging — confirm with organizers before adding; do not invent. | MEDIUM |
| Southampton Olive Oil | 2026-09-24 | 2:45 PM | 3:15 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | no |  |  |  | missing | Guide Southampton Olive Oil Thu 2:45–3:15 not a discrete staging title (workbook described under Foo | MEDIUM |
| Lawn Mower Races (to be confirmed) | 2026-09-24 | 9:30 AM |  | Event Centre #1 — West 2 | Event Centre #1 | no |  |  |  | missing | Guide TBC item absent from staging — confirm with organizers before adding; do not invent. | MEDIUM |
| Lawn Mower Races (to be confirmed) | 2026-09-24 | 3:30 PM |  | Event Centre #1 — West 2 | Event Centre #1 | no |  |  |  | missing | Guide TBC item absent from staging — confirm with organizers before adding; do not invent. | MEDIUM |
| Lawn Mower Races (to be confirmed) | 2026-09-25 | 9:30 AM |  | Event Centre #1 — West 2 | Event Centre #1 | no |  |  |  | missing | Guide TBC item absent from staging — confirm with organizers before adding; do not invent. | MEDIUM |
| Lawn Mower Races (to be confirmed) | 2026-09-26 | 9:30 AM |  | Event Centre #1 — West 2 | Event Centre #1 | no |  |  |  | missing | Guide TBC item absent from staging — confirm with organizers before adding; do not invent. | MEDIUM |

## 3. Time conflicts

| SHOW_GUIDE_TITLE | DATE | START_TIME | END_TIME | LOCATION | CATEGORY | PRESENT_IN_STAGING | STAGING_TITLE | STAGING_TIME | STAGING_LOCATION | MATCH | RECOMMENDED_ACTION | CONFIDENCE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Opening Ceremonies | 2026-09-22 | 11:30 AM | 1:30 PM | Ontario Mutuals Main Stage in the Britespan Building | Ontario Mutuals Main Stage | yes | Opening Ceremonies | 11:30 AM–1:00 PM | Ontario Mutuals Main Stage - In the Britespan Building | conflict | TIME CONFLICT: Guide 11:30 AM–1:30 PM vs staging 11:30 AM–1:00 PM. Prefer Show Guide unless newer re | HIGH |
| Susan Briggs | 2026-09-22 | 3:00 PM | 5:00 PM | Ontario Mutuals Main Stage in the Britespan Building | Ontario Mutuals Main Stage | yes | Susan Briggs | 3:30 PM–5:00 PM | Ontario Mutuals Main Stage - In the Britespan Building | conflict | TIME CONFLICT: Guide 3:00 PM–5:00 PM vs staging 3:30 PM–5:00 PM. Prefer Show Guide unless newer revi | HIGH |
| Essentially Lavender | 2026-09-24 | 3:15 PM | 3:30 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Essentially Lavender | 2:45 PM–3:30 PM | The Beyond Wireless Stage | conflict | TIME CONFLICT: Guide 3:15 PM–3:30 PM vs staging 2:45 PM–3:30 PM. Prefer Show Guide unless newer revi | HIGH |
| Doors Open | 2026-09-26 | 12:00 PM | 1:00 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Doors Open — Gina Livy (Afternoon) | 12:30 PM–1:30 PM | Harley's Pub & Perk - Stage | conflict | TIME CONFLICT: Guide 12:00 PM–1:00 PM vs staging 12:30 PM–1:30 PM. Prefer Show Guide unless newer re | HIGH |

## 4. Location conflicts

| SHOW_GUIDE_TITLE | DATE | START_TIME | END_TIME | LOCATION | CATEGORY | PRESENT_IN_STAGING | STAGING_TITLE | STAGING_TIME | STAGING_LOCATION | MATCH | RECOMMENDED_ACTION | CONFIDENCE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Weekend Never Ends | 2026-09-21 | 7:00 PM | 10:00 PM | The Bruce RV Park | The Bruce RV Park - Nightly Entertainment | yes | Weekend Never Ends | 7:00 PM–10:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | conflict | LOCATION CONFLICT: Guide 'The Bruce RV Park' vs staging 'CKNX Centennial Pavilion (GFO Stage) Lounge | HIGH |
| Adam Cousins | 2026-09-22 | 7:00 PM | 10:00 PM | The Bruce RV Park | The Bruce RV Park - Nightly Entertainment | yes | Adam Cousins | 7:00 PM–10:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | conflict | LOCATION CONFLICT: Guide 'The Bruce RV Park' vs staging 'CKNX Centennial Pavilion (GFO Stage) Lounge | HIGH |
| Colt McLauchlin | 2026-09-23 | 7:00 PM | 10:00 PM | The Bruce RV Park | The Bruce RV Park - Nightly Entertainment | yes | Colt McLauchlin | 7:00 PM–10:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | conflict | LOCATION CONFLICT: Guide 'The Bruce RV Park' vs staging 'CKNX Centennial Pavilion (GFO Stage) Lounge | HIGH |
| The Skeleton Crew | 2026-09-24 | 7:00 PM | 10:00 PM | The Bruce RV Park | The Bruce RV Park - Nightly Entertainment | yes | The Skeleton Crew | 7:00 PM–10:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | conflict | LOCATION CONFLICT: Guide 'The Bruce RV Park' vs staging 'CKNX Centennial Pavilion (GFO Stage) Lounge | HIGH |
| Catfish Gumbo | 2026-09-25 | 7:00 PM | 10:00 PM | The Bruce RV Park | The Bruce RV Park - Nightly Entertainment | yes | Catfish Gumbo | 7:00 PM–10:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | conflict | LOCATION CONFLICT: Guide 'The Bruce RV Park' vs staging 'CKNX Centennial Pavilion (GFO Stage) Lounge | HIGH |
| Tandem | 2026-09-26 | 7:00 PM | 10:00 PM | The Bruce RV Park | The Bruce RV Park - Nightly Entertainment | yes | Tandem | 7:00 PM–10:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | conflict | LOCATION CONFLICT: Guide 'The Bruce RV Park' vs staging 'CKNX Centennial Pavilion (GFO Stage) Lounge | HIGH |

## 5. Staging location blank or less precise than Guide

| SHOW_GUIDE_TITLE | DATE | START_TIME | LOCATION | STAGING_TITLE | STAGING_LOCATION | MATCH | RECOMMENDED_ACTION |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Great Canadian Lumberjack Show | 2026-09-22 | 10:30 AM | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo |
| Great Canadian Lumberjack Show | 2026-09-22 | 1:00 PM | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo |
| Great Canadian Lumberjack Show | 2026-09-22 | 3:00 PM | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo |
| Great Canadian Lumberjack Show | 2026-09-23 | 10:30 AM | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo |
| Great Canadian Lumberjack Show | 2026-09-23 | 1:00 PM | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo |
| Great Canadian Lumberjack Show | 2026-09-23 | 3:00 PM | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo |
| Great Canadian Lumberjack Show | 2026-09-24 | 10:30 AM | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo |
| Great Canadian Lumberjack Show | 2026-09-24 | 1:00 PM | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo |
| Great Canadian Lumberjack Show | 2026-09-24 | 3:00 PM | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo |
| Great Canadian Lumberjack Show | 2026-09-25 | 10:30 AM | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo |
| Great Canadian Lumberjack Show | 2026-09-25 | 1:00 PM | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo |
| Great Canadian Lumberjack Show | 2026-09-25 | 3:00 PM | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo |
| Great Canadian Lumberjack Show | 2026-09-26 | 10:30 AM | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo |
| Great Canadian Lumberjack Show | 2026-09-26 | 1:00 PM | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo |
| Great Canadian Lumberjack Show | 2026-09-26 | 3:00 PM | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo |

## 6. Staging-only events (in staging, not discrete Guide lines)

Count: **56**. Mostly MNP multi-stage workbook rows. Flag for review; not automatic errors.

| Category | Staging-only count |
|---|---:|
| MNP Lifestyles Tent Events | 56 |

<details><summary>Full staging-only list</summary>

| DATE | STAGING_TITLE | STAGING_TIME | STAGING_LOCATION | CATEGORY | RECOMMENDED_ACTION |
| --- | --- | --- | --- | --- | --- |
| 2026-09-22 | DK Salon | 10:15 AM–11:15 AM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-22 | Bombshell Salon - Head spa | 10:15 AM–11:15 AM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-22 | Sour Dough Sampling - The Bread Barn | 11:15 AM–11:45 AM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-22 | Davishill Nursery | 11:30 AM–12:00 PM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-22 | Ionic Foot Bath — Jen Fitzgerald, Soul Journey | 11:45 AM–12:30 PM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-22 | Jenna Lee Lethbridge — SheWolf Reiki | 12:00 PM–1:00 PM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-22 | Carrick Farm Market - Sampling | 12:30 PM–1:15 PM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-22 | Hayley Wilhelm MUA | 1:00 PM–2:00 PM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-22 | Harley's Pub and Perk - Charcuterie Sampling | 1:15 PM–1:45 PM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-22 | Liesemer Home Hardware - Sampling smoked meats | 1:45 PM–2:15 PM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-22 | Chelsea Spackman — All Bodies Studios | 2:00 PM–3:00 PM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-22 | GG Sips | 2:15 PM–2:45 PM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-22 | Indian Head Massage — Jen Fitzgerald, Soul Journey | 3:00 PM–4:00 PM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-22 | Wine Ontario | 3:00 PM–4:00 PM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-22 | Thornbury Craft Co. Cider and Brew House | 4:00 PM–5:00 PM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-22 | Shroom Soda - West Shore | 4:00 PM–4:30 PM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-23 | Wood Working Demo - Mark Grubb | 10:15 AM–11:00 AM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-23 | Mary Kay (Cheryl McNair) | 11:00 AM–11:45 AM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-23 | Liza Weltz — Essential Wellness | 11:00 AM–11:45 AM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-23 | Reiki Master — Rachel Stroeder, Evergreen Connections | 11:45 AM–12:30 PM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-23 | Labour of Love - Cupcake Decorating | 11:45 AM–12:30 PM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-23 | Flossie Mae | 12:30 PM–1:30 PM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-23 | Simply Potts by Lauriss | 1:45 PM–2:30 PM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-23 | Bombshell Salon - Head spa | 2:00 PM–3:00 PM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-23 | Willow Home | 2:30 PM–3:00 PM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-23 | Cody's Egg Shack | 3:00 PM–4:00 PM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-23 | Neustadt Brewery | 3:15 PM–4:00 PM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-23 | Grey Matter Beer Company | 4:00 PM–5:00 PM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-24 | Country Garden Greenhouse - Christmas Urns | 10:15 AM–11:00 AM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-24 | Bombshell Salon - Head spa | 10:15 AM–11:15 AM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-24 | Susan Seitz — Susan Seitz Studio / Creative Circle | 11:30 AM–12:00 PM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-24 | The Guest House - Replanting House Plants | 11:30 AM–12:00 PM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-24 | LaDel's Café - The Guest House - Cold Brew Sampling | 12:00 PM–12:45 PM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-24 | Doterra with Jodi | 12:30 PM–1:15 PM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-24 | D’elle Calhoun — Inside Out Art Studio | 1:15 PM–2:45 PM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-24 | Ashley Grant — Soul Purpose Reiki | 1:45 PM–2:30 PM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-24 | Mary Kay (Cheryl McNair) | 2:30 PM–3:15 PM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-24 | Corderro - Lamb Sampling | 2:45 PM–3:30 PM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-24 | Mixology | 3:15 PM–4:00 PM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-24 | Junction 56 Distillery | 3:30 PM–4:15 PM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-24 | Essentially Lavender | 4:00 PM–5:00 PM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-24 | Cottage Springs | 4:15 PM–5:00 PM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-25 | Coastal Coffee | 10:15 AM–11:00 AM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-25 | Simply Potts by Lauriss | 10:15 AM–11:00 AM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-25 | All things honey -Jody | 11:00 AM–11:30 AM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-25 | Sara Porter — Re:mind Wellness Spa & Apothecary | 11:00 AM–11:45 AM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-25 | Harley's Pub and Perk - Sampling | 11:30 AM–12:15 PM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-25 | Flowers by Uss - The Perfect Christmas Tree | 12:15 PM–1:15 PM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-25 | Michelle Knoll — The Dragonfly Spa | 12:30 PM–1:15 PM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-25 | Fire Cider & Honey - Homesteading | 1:15 PM–2:00 PM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-25 | The Farmhouse Shop | 1:30 PM–2:00 PM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-25 | Organic Facial — Sara Porter, Re:mind Wellness Spa & Apothecary | 2:00 PM–3:15 PM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-25 | Forest Maiden Facial & Beauty Room | 2:15 PM–3:15 PM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-25 | Macleans Beer | 3:15 PM–4:00 PM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-25 | Connor Fischer — IncREDible Light | 3:15 PM–4:00 PM | Harley's Pub & Perk - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |
| 2026-09-25 | Crafty Elk | 4:00 PM–5:00 PM | Quality Homes - Stage | MNP Lifestyles Tent Events | In staging but not a discrete Show Guide line — often MNP multi-stage workbook detail or app extra;  |

</details>

## 7. Full Guide→Staging match table

| SHOW_GUIDE_TITLE | DATE | START_TIME | END_TIME | LOCATION | CATEGORY | PRESENT_IN_STAGING | STAGING_TITLE | STAGING_TIME | STAGING_LOCATION | MATCH | RECOMMENDED_ACTION | CONFIDENCE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Church Service | 2026-09-20 | 2:30 PM |  | CKNX Centennial Pavilion (GFO Stage) | Church Service | yes | Church Service | 2:30 PM | CKNX Centennial Pavilion (GFO Stage) | exact | No change | HIGH |
| Weekend Never Ends | 2026-09-21 | 7:00 PM | 10:00 PM | The Bruce RV Park | The Bruce RV Park - Nightly Entertainment | yes | Weekend Never Ends | 7:00 PM–10:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | conflict | LOCATION CONFLICT: Guide 'The Bruce RV Park' vs staging 'CKNX Centennial Pavilion (GFO Stage) Lounge | HIGH |
| Bruce Power Opening Day Parade | 2026-09-22 | 10:00 AM |  | Parade route (Guide does not specify assembly point) | Parade Week | yes | Bruce Power Opening Day Parade | 10:00 AM | Parade route coming soon | exact | No change | HIGH |
| Opening Ceremonies | 2026-09-22 | 11:30 AM | 1:30 PM | Ontario Mutuals Main Stage in the Britespan Building | Ontario Mutuals Main Stage | yes | Opening Ceremonies | 11:30 AM–1:00 PM | Ontario Mutuals Main Stage - In the Britespan Building | conflict | TIME CONFLICT: Guide 11:30 AM–1:30 PM vs staging 11:30 AM–1:00 PM. Prefer Show Guide unless newer re | HIGH |
| Dave & The Retros | 2026-09-22 | 1:30 PM | 3:00 PM | Ontario Mutuals Main Stage in the Britespan Building | Ontario Mutuals Main Stage | yes | Dave & The Retros | 1:30 PM–3:00 PM | Ontario Mutuals Main Stage - In the Britespan Building | exact | No change | HIGH |
| Susan Briggs | 2026-09-22 | 3:00 PM | 5:00 PM | Ontario Mutuals Main Stage in the Britespan Building | Ontario Mutuals Main Stage | yes | Susan Briggs | 3:30 PM–5:00 PM | Ontario Mutuals Main Stage - In the Britespan Building | conflict | TIME CONFLICT: Guide 3:00 PM–5:00 PM vs staging 3:30 PM–5:00 PM. Prefer Show Guide unless newer revi | HIGH |
| Riverside Blues Band | 2026-09-22 | 1:30 PM | 3:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | CKNX Centennial Pavilion (GFO Stage) Lounge | yes | Riverside Blues Band | 1:30 PM–3:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | exact | No change | HIGH |
| He Said, She Said | 2026-09-22 | 3:30 PM | 5:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | CKNX Centennial Pavilion (GFO Stage) Lounge | yes | He Said, She Said | 3:30 PM–5:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | exact | No change | HIGH |
| Tractors | 2026-09-22 | 9:30 AM |  | Plowing Fields | Plowing | yes | Tractor Plowing | 9:30 AM | Plowing Fields | exact | No change | HIGH |
| Horse Plowing | 2026-09-22 | 10:00 AM |  | Plowing Fields | Plowing | yes | Horse Plowing | 10:00 AM | Plowing Fields | exact | No change | HIGH |
| Tractors | 2026-09-22 | 11:00 AM |  | Plowing Fields | Plowing | yes | Tractor Plowing | 11:00 AM | Plowing Fields | exact | No change | HIGH |
| Gregglea Clydesdales | 2026-09-22 | 11:00 AM |  | RAM Truck Corral | RAM Truck Corral | no |  |  |  | missing | Guide lists Gregglea Clydesdales Tue 11:00 AM (TBC) at RAM Truck Corral — missing in staging; confir | MEDIUM |
| Canadian Cowgirls Precision Drill Team | 2026-09-22 | 2:00 PM |  | RAM Truck Corral | RAM Truck Corral | yes | Canadian Cowgirls Precision Drill Team | 2:00 PM | RAM Truck Corral | exact | No change | HIGH |
| Beef Farmers of Ontario, FARMER OLYMPICS, PLOWING MATCH STYLE | 2026-09-22 | 3:00 PM |  | RAM Truck Corral | RAM Truck Corral | yes | Beef Farmers of Ontario, Farmer Olympics, Plowing Match Style | 3:00 PM | RAM Truck Corral | exact | No change | HIGH |
| Start of Day Movement - Definition Fitness | 2026-09-22 | 10:00 AM | 10:15 AM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Christie Thomson — Definition Fitness | 10:00 AM–10:15 AM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Aaniin Collective | 2026-09-22 | 10:15 AM | 10:50 AM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Aaniin Collective (Hannah Wheeler) | 10:15 AM–10:50 AM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Davishill Nursery | 2026-09-22 | 10:50 AM | 11:20 AM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Davishill Nursery | 10:50 AM–11:20 AM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Sleepers Bed Gallery | 2026-09-22 | 11:25 AM | 11:45 AM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Sleepers Bed Gallery (Sadie Al) | 11:25 AM–11:45 AM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Carrick Farm Market | 2026-09-22 | 12:00 PM | 12:30 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Carrick Farm Market | 12:00 PM–12:30 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Harley's Charcuterie | 2026-09-22 | 12:30 PM | 1:00 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Harley's Pub and Perk - Charcuterie | 12:30 PM–1:00 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Liesemer Home Hardware - Meat Smoking | 2026-09-22 | 1:00 PM | 1:30 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Liesemer Home Hardware - Meat Smoking | 1:00 PM–1:30 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Photography Beitz Studio | 2026-09-22 | 1:45 PM | 2:15 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Photography Beitz Studios | 1:45 PM–2:15 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| MakeUp Artist - Hayley Wilhelm | 2026-09-22 | 2:15 PM | 2:45 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Hayley Wilhelm MUA | 2:15 PM–2:45 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| West Shore | 2026-09-22 | 2:45 PM | 3:10 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | West Shore Clothing and Surf Shop | 2:45 PM–3:10 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Makeover Reveal! | 2026-09-22 | 3:10 PM | 3:15 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Makeover Reveal! | 3:10 PM–3:15 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| The Space Between | 2026-09-22 | 3:30 PM | 4:00 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | The Space Between with Alicia | 3:30 PM–4:00 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| The Nature Babe | 2026-09-22 | 4:00 PM | 4:30 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | The Nature Babe | 4:00 PM–4:30 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| The WOMB - Bruce County | 2026-09-22 | 4:30 PM | 5:00 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Jessica Connor & Rebecca Grubb — The WOMB Bruce County | 4:30 PM–5:00 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Great Canadian Lumberjack Show | 2026-09-22 | 10:30 AM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show | yes | Great Canadian Lumberjack Show | 10:30 AM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| Great Canadian Lumberjack Show | 2026-09-22 | 1:00 PM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show | yes | Great Canadian Lumberjack Show | 1:00 PM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| Great Canadian Lumberjack Show | 2026-09-22 | 3:00 PM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show | yes | Great Canadian Lumberjack Show | 3:00 PM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| Foxton Fuels Farmall Square Dancing Tractors | 2026-09-22 | 11:00 AM |  | Event Centre #1 — West 2 | Event Centre #1 | yes | Foxton Fuels Farmall Square Dancing Tractors | 11:00 AM | Event Centre #1 — West 2 | exact | No change | HIGH |
| Lawn Mower Races (to be confirmed) | 2026-09-22 | 3:30 PM |  | Event Centre #1 — West 2 | Event Centre #1 | no |  |  |  | missing | Guide TBC item absent from staging — confirm with organizers before adding; do not invent. | MEDIUM |
| Adam Cousins | 2026-09-22 | 7:00 PM | 10:00 PM | The Bruce RV Park | The Bruce RV Park - Nightly Entertainment | yes | Adam Cousins | 7:00 PM–10:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | conflict | LOCATION CONFLICT: Guide 'The Bruce RV Park' vs staging 'CKNX Centennial Pavilion (GFO Stage) Lounge | HIGH |
| Trucks and Tractors Parade | 2026-09-23 | 11:00 AM |  | Parade route (Guide does not specify assembly point) | Parade Week | yes | Trucks and Tractors Parade | 11:00 AM | Parade route coming soon | exact | No change | HIGH |
| PJ Mack & Gord Cottrill | 2026-09-23 | 10:30 AM | 12:30 PM | Ontario Mutuals Main Stage in the Britespan Building | Ontario Mutuals Main Stage | yes | PJ Mack & Gord Cottrill | 10:30 AM–12:30 PM | Ontario Mutuals Main Stage - In the Britespan Building | exact | No change | HIGH |
| Dennis Bushell | 2026-09-23 | 1:00 PM | 2:30 PM | Ontario Mutuals Main Stage in the Britespan Building | Ontario Mutuals Main Stage | yes | Dennis Bushell | 1:00 PM–2:30 PM | Ontario Mutuals Main Stage - In the Britespan Building | exact | No change | HIGH |
| Bernie Hale | 2026-09-23 | 3:00 PM | 5:00 PM | Ontario Mutuals Main Stage in the Britespan Building | Ontario Mutuals Main Stage | yes | Bernie Hale | 3:00 PM–5:00 PM | Ontario Mutuals Main Stage - In the Britespan Building | exact | No change | HIGH |
| Dave & The Retros | 2026-09-23 | 10:30 AM | 12:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | CKNX Centennial Pavilion (GFO Stage) Lounge | yes | Dave & The Retros | 10:30 AM–12:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | exact | No change | HIGH |
| Lisa McEwen | 2026-09-23 | 12:30 PM | 1:30 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | CKNX Centennial Pavilion (GFO Stage) Lounge | yes | Lisa McEwen | 12:30 PM–1:30 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | exact | No change | HIGH |
| Blake Wilson | 2026-09-23 | 2:00 PM | 3:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | CKNX Centennial Pavilion (GFO Stage) Lounge | yes | Blake Wilson | 2:00 PM–3:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | exact | No change | HIGH |
| Armow Grinders | 2026-09-23 | 3:30 PM | 5:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | CKNX Centennial Pavilion (GFO Stage) Lounge | yes | Armow Grinders | 3:30 PM–5:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | exact | No change | HIGH |
| Tractors | 2026-09-23 | 9:30 AM |  | Plowing Fields | Plowing | yes | Tractor Plowing | 9:30 AM | Plowing Fields | exact | No change | HIGH |
| Horse Plowing | 2026-09-23 | 10:00 AM |  | Plowing Fields | Plowing | yes | Horse Plowing | 10:00 AM | Plowing Fields | exact | No change | HIGH |
| Tractors | 2026-09-23 | 11:00 AM |  | Plowing Fields | Plowing | yes | Tractor Plowing | 11:00 AM | Plowing Fields | exact | No change | HIGH |
| Gregglea Clydesdales | 2026-09-23 | 10:30 AM |  | RAM Truck Corral | RAM Truck Corral | yes | Gregglea Clydesdales | 10:30 AM | RAM Truck Corral | exact | No change | HIGH |
| Canadian Cowgirls Precision Drill Team | 2026-09-23 | 11:00 AM |  | RAM Truck Corral | RAM Truck Corral | yes | Canadian Cowgirls Precision Drill Team | 11:00 AM | RAM Truck Corral | exact | No change | HIGH |
| Canadian Cowgirls Precision Drill Team | 2026-09-23 | 3:00 PM |  | RAM Truck Corral | RAM Truck Corral | yes | Canadian Cowgirls Precision Drill Team | 3:00 PM | RAM Truck Corral | exact | No change | HIGH |
| Start of Day Movement - Freezer Fitness | 2026-09-23 | 10:00 AM | 10:15 AM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Start of Day Movement - Freezer Fitness | 10:00 AM–10:15 AM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Essential Wellness | 2026-09-23 | 10:15 AM | 10:45 AM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Liza Weltz — Essential Wellness | 10:15 AM–10:45 AM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Doula Panel | 2026-09-23 | 10:45 AM | 11:15 AM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Doula Panel — Rachel Stroeder, Katie Franklin & Madison Kittel | 10:45 AM–11:15 AM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Susan Seitz Art Studio | 2026-09-23 | 11:15 AM | 11:45 AM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Susan Seitz — Susan Seitz Studio / Creative Circle | 11:15 AM–11:45 AM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Energy in the Home | 2026-09-23 | 12:00 PM | 12:30 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | The Maven Project — Ruth Montgomery | 12:00 PM–12:30 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Enjo | 2026-09-23 | 12:30 PM | 1:00 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Laurie Convay, ENJO Canada | 12:30 PM–1:00 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Upstage Design | 2026-09-23 | 1:00 PM | 1:30 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Angela Wainscott, Upstaged Design | 1:00 PM–1:30 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Willow Home - Furniture Refresh | 2026-09-23 | 1:45 PM | 2:30 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Heather Stark, Willow Home | 1:45 PM–2:30 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Cody's Egg Shack | 2026-09-23 | 2:30 PM | 3:00 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Cody's Egg Shack | 2:30 PM–3:00 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Lake Huron Home | 2026-09-23 | 3:00 PM | 3:30 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Sadie Al, Lake Huron Home | 3:00 PM–3:30 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| J&H Women's Fashions | 2026-09-23 | 3:30 PM | 4:00 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | J&H Women's Fashions | 3:30 PM–4:00 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Flossy May | 2026-09-23 | 4:00 PM | 4:30 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Flossie Mae | 4:00 PM–4:30 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Mary Kay | 2026-09-23 | 4:30 PM | 4:55 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Mary Kay (Cheryl McNair) | 4:30 PM–4:55 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Makeover Reveal! | 2026-09-23 | 4:55 PM | 5:00 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Makeover Reveal! | 4:55 PM–5:00 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Great Canadian Lumberjack Show | 2026-09-23 | 10:30 AM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show | yes | Great Canadian Lumberjack Show | 10:30 AM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| Great Canadian Lumberjack Show | 2026-09-23 | 1:00 PM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show | yes | Great Canadian Lumberjack Show | 1:00 PM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| Great Canadian Lumberjack Show | 2026-09-23 | 3:00 PM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show | yes | Great Canadian Lumberjack Show | 3:00 PM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| Lawn Mower Races (to be confirmed) | 2026-09-23 | 9:30 AM |  | Event Centre #1 — West 2 | Event Centre #1 | no |  |  |  | missing | Guide TBC item absent from staging — confirm with organizers before adding; do not invent. | MEDIUM |
| Foxton Fuels Farmall Square Dancing Tractors | 2026-09-23 | 12:00 PM |  | Event Centre #1 — West 2 | Event Centre #1 | yes | Foxton Fuels Farmall Square Dancing Tractors | 12:00 PM | Event Centre #1 — West 2 | exact | No change | HIGH |
| Foxton Fuels Farmall Square Dancing Tractors | 2026-09-23 | 1:30 PM |  | Event Centre #1 — West 2 | Event Centre #1 | yes | Foxton Fuels Farmall Square Dancing Tractors | 1:30 PM | Event Centre #1 — West 2 | exact | No change | HIGH |
| Lawn Mower Races (to be confirmed) | 2026-09-23 | 3:30 PM |  | Event Centre #1 — West 2 | Event Centre #1 | no |  |  |  | missing | Guide TBC item absent from staging — confirm with organizers before adding; do not invent. | MEDIUM |
| Colt McLauchlin | 2026-09-23 | 7:00 PM | 10:00 PM | The Bruce RV Park | The Bruce RV Park - Nightly Entertainment | yes | Colt McLauchlin | 7:00 PM–10:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | conflict | LOCATION CONFLICT: Guide 'The Bruce RV Park' vs staging 'CKNX Centennial Pavilion (GFO Stage) Lounge | HIGH |
| Children's Parade | 2026-09-24 | 11:00 AM |  | Parade route (Guide does not specify assembly point) | Parade Week | yes | Children’s Parade | 11:00 AM | Parade route coming soon | exact | No change | HIGH |
| Evelyn Koebel | 2026-09-24 | 10:30 AM | 11:30 AM | Ontario Mutuals Main Stage in the Britespan Building | Ontario Mutuals Main Stage | yes | Ivelyn Koebel | 10:30 AM–11:30 AM | Ontario Mutuals Main Stage - In the Britespan Building | exact | No change | HIGH |
| Mudmen | 2026-09-24 | 12:00 PM | 2:00 PM | Ontario Mutuals Main Stage in the Britespan Building | Ontario Mutuals Main Stage | yes | Mudmen | 12:00 PM–2:00 PM | Ontario Mutuals Main Stage - In the Britespan Building | exact | No change | HIGH |
| Owen Sound Step Dancers Club | 2026-09-24 | 2:30 PM | 3:30 PM | Ontario Mutuals Main Stage in the Britespan Building | Ontario Mutuals Main Stage | yes | Owen Sound Step Dancers Club | 2:30 PM–3:30 PM | Ontario Mutuals Main Stage - In the Britespan Building | exact | No change | HIGH |
| Jammin' North | 2026-09-24 | 4:00 PM | 5:00 PM | Ontario Mutuals Main Stage in the Britespan Building | Ontario Mutuals Main Stage | yes | Jammin’ North | 4:00 PM–5:00 PM | Ontario Mutuals Main Stage - In the Britespan Building | exact | No change | HIGH |
| Andrew McVeety | 2026-09-24 | 10:30 AM | 12:30 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | CKNX Centennial Pavilion (GFO Stage) Lounge | yes | Andrew McVeety | 10:30 AM–12:30 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | exact | No change | HIGH |
| Naomi Bristow | 2026-09-24 | 1:00 PM | 3:30 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | CKNX Centennial Pavilion (GFO Stage) Lounge | yes | Naomi Bristow | 1:00 PM–3:30 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | exact | No change | HIGH |
| Chicken Jockey | 2026-09-24 | 4:00 PM | 5:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | CKNX Centennial Pavilion (GFO Stage) Lounge | yes | Chicken Jockey | 4:00 PM–5:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | exact | No change | HIGH |
| Tractors | 2026-09-24 | 9:30 AM |  | Plowing Fields | Plowing | yes | Tractor Plowing | 9:30 AM | Plowing Fields | exact | No change | HIGH |
| Horse Plowing | 2026-09-24 | 10:00 AM |  | Plowing Fields | Plowing | yes | Horse Plowing | 10:00 AM | Plowing Fields | exact | No change | HIGH |
| Tractors | 2026-09-24 | 11:00 AM |  | Plowing Fields | Plowing | yes | Tractor Plowing | 11:00 AM | Plowing Fields | exact | No change | HIGH |
| Queen of the Furrow Plowing Competition | 2026-09-24 | 2:30 PM |  | Plowing Fields | Plowing | yes | Queen of the Furrow Plowing Competition | 2:30 PM | Plowing Fields | exact | No change | HIGH |
| Gregglea Clydesdales | 2026-09-24 | 10:30 AM |  | RAM Truck Corral | RAM Truck Corral | yes | Gregglea Clydesdales | 10:30 AM | RAM Truck Corral | exact | No change | HIGH |
| Canadian Cowgirls Precision Drill Team | 2026-09-24 | 11:00 AM |  | RAM Truck Corral | RAM Truck Corral | yes | Canadian Cowgirls Precision Drill Team | 11:00 AM | RAM Truck Corral | exact | No change | HIGH |
| RAM Rodeo | 2026-09-24 | 12:00 PM |  | RAM Truck Corral | RAM Truck Corral | yes | RAM Rodeo | 12:00 PM | RAM Truck Corral | exact | No change | HIGH |
| Canadian Cowgirls Precision Drill Team | 2026-09-24 | 2:00 PM |  | RAM Truck Corral | RAM Truck Corral | yes | Canadian Cowgirls Precision Drill Team | 2:00 PM | RAM Truck Corral | exact | No change | HIGH |
| RAM Rodeo | 2026-09-24 | 3:00 PM |  | RAM Truck Corral | RAM Truck Corral | yes | RAM Rodeo | 3:00 PM | RAM Truck Corral | exact | No change | HIGH |
| Start of Day Movement - Definition Fitness | 2026-09-24 | 10:00 AM | 10:15 AM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Christie Thomson — Definition Fitness | 10:00 AM–10:15 AM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Pure Elegance Bridal | 2026-09-24 | 10:15 AM | 10:45 AM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Pure Elegance Bridal | 10:15 AM–10:45 AM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| His Style | 2026-09-24 | 10:45 AM | 11:15 AM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | His Style | 10:45 AM–11:15 AM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Elgin Jewelers | 2026-09-24 | 11:15 AM | 11:40 AM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Elgin Jewelers | 11:15 AM–11:40 AM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Makeover Reveal! | 2026-09-24 | 11:40 AM | 11:45 AM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Makeover Reveal! | 11:40 AM–11:45 AM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Naturally Well by Hannah | 2026-09-24 | 12:00 PM | 12:30 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Hannah Greig — Naturally Well by Hannah | 12:00 PM–12:30 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Re:mind Spa & Apothecary | 2026-09-24 | 12:30 PM | 1:00 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Re:mind Spa & Apothecary | 12:30 PM–1:00 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Soul Purpose Reiki | 2026-09-24 | 1:00 PM | 1:30 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Ashley Grant — Soul Purpose Reiki | 1:00 PM–1:30 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| The Feeling of Home | 2026-09-24 | 1:30 PM | 2:15 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | The Feeling of Home - Designing Beyond the Trend - Panel Discussion | 1:30 PM–2:15 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| The Maven Project | 2026-09-24 | 2:15 PM | 2:45 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | The Maven Project — Ruth Montgomery | 2:15 PM–2:45 PM | The Beyond Wireless Stage | partial | Title/time soft-diff; staging sub-stage location OK (more precise than Guide MNP tent). | MEDIUM |
| Southampton Olive Oil | 2026-09-24 | 2:45 PM | 3:15 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | no |  |  |  | missing | Guide Southampton Olive Oil Thu 2:45–3:15 not a discrete staging title (workbook described under Foo | MEDIUM |
| Essentially Lavender | 2026-09-24 | 3:15 PM | 3:30 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Essentially Lavender | 2:45 PM–3:30 PM | The Beyond Wireless Stage | conflict | TIME CONFLICT: Guide 3:15 PM–3:30 PM vs staging 2:45 PM–3:30 PM. Prefer Show Guide unless newer revi | HIGH |
| MNP: Planning for a Successful Transition | 2026-09-24 | 3:30 PM | 4:15 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | MNP Panel Discussion: Planning for a Successful Transition | 3:30 PM–4:15 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Greenock Collective - All things Canning | 2026-09-24 | 4:15 PM | 5:00 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Carrick Farm Market - All things Canning | 4:15 PM–5:00 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Great Canadian Lumberjack Show | 2026-09-24 | 10:30 AM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show | yes | Great Canadian Lumberjack Show | 10:30 AM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| Great Canadian Lumberjack Show | 2026-09-24 | 1:00 PM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show | yes | Great Canadian Lumberjack Show | 1:00 PM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| Great Canadian Lumberjack Show | 2026-09-24 | 3:00 PM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show | yes | Great Canadian Lumberjack Show | 3:00 PM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| Lawn Mower Races (to be confirmed) | 2026-09-24 | 9:30 AM |  | Event Centre #1 — West 2 | Event Centre #1 | no |  |  |  | missing | Guide TBC item absent from staging — confirm with organizers before adding; do not invent. | MEDIUM |
| Foxton Fuels Farmall Square Dancing Tractors | 2026-09-24 | 10:30 AM |  | Event Centre #1 — West 2 | Event Centre #1 | yes | Foxton Fuels Farmall Square Dancing Tractors | 10:30 AM | Event Centre #1 — West 2 | exact | No change | HIGH |
| Foxton Fuels Farmall Square Dancing Tractors | 2026-09-24 | 1:00 PM |  | Event Centre #1 — West 2 | Event Centre #1 | yes | Foxton Fuels Farmall Square Dancing Tractors | 1:00 PM | Event Centre #1 — West 2 | exact | No change | HIGH |
| Lawn Mower Races (to be confirmed) | 2026-09-24 | 3:30 PM |  | Event Centre #1 — West 2 | Event Centre #1 | no |  |  |  | missing | Guide TBC item absent from staging — confirm with organizers before adding; do not invent. | MEDIUM |
| The Skeleton Crew | 2026-09-24 | 7:00 PM | 10:00 PM | The Bruce RV Park | The Bruce RV Park - Nightly Entertainment | yes | The Skeleton Crew | 7:00 PM–10:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | conflict | LOCATION CONFLICT: Guide 'The Bruce RV Park' vs staging 'CKNX Centennial Pavilion (GFO Stage) Lounge | HIGH |
| Combines Parade | 2026-09-25 | 11:00 AM |  | Parade route (Guide does not specify assembly point) | Parade Week | yes | Combines Parade | 11:00 AM | Parade route coming soon | exact | No change | HIGH |
| Speeches, Ontario Queen of the Furrow Competition | 2026-09-25 | 10:00 AM | 1:00 PM | Ontario Mutuals Main Stage in the Britespan Building | Ontario Mutuals Main Stage | yes | Queen of the Furrow Speeches | 10:00 AM–1:00 PM | Ontario Mutuals Main Stage - In the Britespan Building | exact | No change | HIGH |
| Saugeen First Nations | 2026-09-25 | 1:00 PM | 3:00 PM | Ontario Mutuals Main Stage in the Britespan Building | Ontario Mutuals Main Stage | yes | Saugeen First Nations | 1:00 PM–3:00 PM | Ontario Mutuals Main Stage - In the Britespan Building | exact | No change | HIGH |
| J.C Duo | 2026-09-25 | 3:30 PM | 5:00 PM | Ontario Mutuals Main Stage in the Britespan Building | Ontario Mutuals Main Stage | yes | J.C Duo | 3:30 PM–5:00 PM | Ontario Mutuals Main Stage - In the Britespan Building | exact | No change | HIGH |
| Hard Martin & The Heros | 2026-09-25 | 10:30 AM | 12:30 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | CKNX Centennial Pavilion (GFO Stage) Lounge | yes | Hard Martin & The Heros | 10:30 AM–12:30 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | exact | No change | HIGH |
| Mandi Craddock | 2026-09-25 | 1:00 PM | 3:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | CKNX Centennial Pavilion (GFO Stage) Lounge | yes | Mandi Craddock | 1:00 PM–3:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | exact | No change | HIGH |
| No Expectations | 2026-09-25 | 3:30 PM | 5:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | CKNX Centennial Pavilion (GFO Stage) Lounge | yes | No Expectations | 3:30 PM–5:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | exact | No change | HIGH |
| Tractors | 2026-09-25 | 9:00 AM |  | Plowing Fields | Plowing | yes | Tractor Plowing | 9:00 AM | Plowing Fields | exact | No change | HIGH |
| Horse Plowing | 2026-09-25 | 9:00 AM |  | Plowing Fields | Plowing | yes | Horse Plowing | 9:00 AM | Plowing Fields | exact | No change | HIGH |
| Gregglea Clydesdales | 2026-09-25 | 10:30 AM |  | RAM Truck Corral | RAM Truck Corral | yes | Gregglea Clydesdales | 10:30 AM | RAM Truck Corral | exact | No change | HIGH |
| Canadian Cowgirls Precision Drill Team | 2026-09-25 | 11:00 AM |  | RAM Truck Corral | RAM Truck Corral | yes | Canadian Cowgirls Precision Drill Team | 11:00 AM | RAM Truck Corral | exact | No change | HIGH |
| RAM Rodeo | 2026-09-25 | 12:00 PM |  | RAM Truck Corral | RAM Truck Corral | yes | RAM Rodeo | 12:00 PM | RAM Truck Corral | exact | No change | HIGH |
| Canadian Cowgirls Precision Drill Team | 2026-09-25 | 2:00 PM |  | RAM Truck Corral | RAM Truck Corral | yes | Canadian Cowgirls Precision Drill Team | 2:00 PM | RAM Truck Corral | exact | No change | HIGH |
| RAM Rodeo | 2026-09-25 | 3:00 PM |  | RAM Truck Corral | RAM Truck Corral | yes | RAM Rodeo | 3:00 PM | RAM Truck Corral | exact | No change | HIGH |
| Start of Day Movement - Freezer Fitness | 2026-09-25 | 10:00 AM | 10:15 AM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Start of Day Movement - Freezer Fitness | 10:00 AM–10:15 AM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Fire Cider & Honey | 2026-09-25 | 10:15 AM | 10:45 AM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Fire Cider & Honey - Homesteading | 10:15 AM–10:45 AM | The Beyond Wireless Stage | partial | Title/time soft-diff; staging sub-stage location OK (more precise than Guide MNP tent). | MEDIUM |
| Harley's Pub and Perk | 2026-09-25 | 10:45 AM | 11:15 AM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Harley's Pub and Perk - Meal Prep | 10:45 AM–11:15 AM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Hormones and Food - Jennifer Dunsmoor | 2026-09-25 | 11:15 AM | 12:00 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Hormones and Food - Jennifer Dunsmoor | 11:15 AM–12:00 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Forest Maiden Facial & Beauty Room | 2026-09-25 | 12:00 PM | 12:30 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Forest Maiden Facial & Beauty Room | 12:00 PM–12:30 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Shop by Grace | 2026-09-25 | 12:30 PM | 1:00 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | by Grace Boutique | 12:30 PM–1:00 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| His Style | 2026-09-25 | 1:00 PM | 1:25 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | His Style | 1:00 PM–1:25 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Makeover Reveal! | 2026-09-25 | 1:25 PM | 1:30 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Makeover Reveal! | 1:25 PM–1:30 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Freezer Fitness | 2026-09-25 | 1:45 PM | 2:00 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Beth Fischer — Freezer Fitness | 1:45 PM–2:00 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Functional Movement - Freezer Fitness | 2026-09-25 | 2:00 PM | 2:15 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Functional Movement — Freezer Fitness | 2:00 PM–2:15 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Line Dancing - Freezer Fitness | 2026-09-25 | 2:15 PM | 2:45 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Line Dancing — Freezer Fitness | 2:15 PM–2:45 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| IncREDible Light | 2026-09-25 | 2:45 PM | 3:15 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Connor Fischer — IncREDible Light | 2:45 PM–3:15 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| MNP - Navigating the Succession Journey | 2026-09-25 | 3:30 PM | 4:15 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | MNP Panel Discussion: Navigating the Succession Journey | 3:30 PM–4:15 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Carrie Lynn Floral + Event Styling | 2026-09-25 | 4:15 PM | 4:45 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Carrie Lynn Floral + Event Styling | 4:15 PM–4:45 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Up Stage Design | 2026-09-25 | 4:45 PM | 5:30 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Angela Wainscott, Upstaged Design | 4:45 PM–5:30 PM | The Beyond Wireless Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Great Canadian Lumberjack Show | 2026-09-25 | 10:30 AM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show | yes | Great Canadian Lumberjack Show | 10:30 AM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| Great Canadian Lumberjack Show | 2026-09-25 | 1:00 PM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show | yes | Great Canadian Lumberjack Show | 1:00 PM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| Great Canadian Lumberjack Show | 2026-09-25 | 3:00 PM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show | yes | Great Canadian Lumberjack Show | 3:00 PM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| Lawn Mower Races (to be confirmed) | 2026-09-25 | 9:30 AM |  | Event Centre #1 — West 2 | Event Centre #1 | no |  |  |  | missing | Guide TBC item absent from staging — confirm with organizers before adding; do not invent. | MEDIUM |
| Foxton Fuels Farmall Square Dancing Tractors | 2026-09-25 | 11:30 AM |  | Event Centre #1 — West 2 | Event Centre #1 | yes | Foxton Fuels Farmall Square Dancing Tractors | 11:30 AM | Event Centre #1 — West 2 | exact | No change | HIGH |
| Teeswater Agro Parts Combine Demolition Derby | 2026-09-25 | 3:30 PM |  | Event Centre #1 — West 2 | Event Centre #1 | yes | Teeswater Agro Parts Combine Demolition Derby | 3:30 PM | Event Centre #1 — West 2 | exact | No change | HIGH |
| Catfish Gumbo | 2026-09-25 | 7:00 PM | 10:00 PM | The Bruce RV Park | The Bruce RV Park - Nightly Entertainment | yes | Catfish Gumbo | 7:00 PM–10:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | conflict | LOCATION CONFLICT: Guide 'The Bruce RV Park' vs staging 'CKNX Centennial Pavilion (GFO Stage) Lounge | HIGH |
| Bruce County Farming Through the Ages Parade | 2026-09-26 | 11:00 AM |  | Parade route (Guide does not specify assembly point) | Parade Week | yes | Bruce County Farming Through the Ages | 11:00 AM | Parade route coming soon | exact | No change | HIGH |
| Kerry Moore School Dance | 2026-09-26 | 10:00 AM | 11:00 AM | Ontario Mutuals Main Stage in the Britespan Building | Ontario Mutuals Main Stage | yes | Kerry Moore School of Dance | 10:00 AM–11:00 AM | Ontario Mutuals Main Stage - In the Britespan Building | exact | No change | HIGH |
| Lennon & Matthew | 2026-09-26 | 11:30 AM | 12:30 PM | Ontario Mutuals Main Stage in the Britespan Building | Ontario Mutuals Main Stage | yes | Lennon & Matthew | 11:30 AM–12:30 PM | Ontario Mutuals Main Stage - In the Britespan Building | exact | No change | HIGH |
| Grey Bruce Singers | 2026-09-26 | 1:00 PM | 2:00 PM | Ontario Mutuals Main Stage in the Britespan Building | Ontario Mutuals Main Stage | yes | Grey Bruce Singers | 1:00 PM–2:00 PM | Ontario Mutuals Main Stage - In the Britespan Building | exact | No change | HIGH |
| Shania Twang | 2026-09-26 | 2:00 PM | 4:00 PM | Ontario Mutuals Main Stage in the Britespan Building | Ontario Mutuals Main Stage | yes | Shania Twang | 2:00 PM–4:00 PM | Ontario Mutuals Main Stage - In the Britespan Building | exact | No change | HIGH |
| Whiskey Pine | 2026-09-26 | 10:30 AM | 12:30 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | CKNX Centennial Pavilion (GFO Stage) Lounge | yes | Whiskey Pine | 10:30 AM–12:30 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | exact | No change | HIGH |
| Jeremy Mighton | 2026-09-26 | 1:00 PM | 2:30 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | CKNX Centennial Pavilion (GFO Stage) Lounge | yes | Jeremy Mighton | 1:00 PM–2:30 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | exact | No change | HIGH |
| EV Outlaws | 2026-09-26 | 3:00 PM | 4:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | CKNX Centennial Pavilion (GFO Stage) Lounge | yes | EV Outlaws | 3:00 PM–4:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | exact | No change | HIGH |
| IPM 2026 Closing Ceremonies | 2026-09-26 | 4:00 PM |  | CKNX Centennial Pavilion (GFO Stage) Lounge | CKNX Centennial Pavilion (GFO Stage) Lounge | yes | Closing Ceremonies | 4:00 PM–5:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | exact | No change | HIGH |
| Junior Competition (tractors and horses) | 2026-09-26 | 8:30 AM |  | Plowing Fields | Plowing | yes | Junior Competition (tractors and horses) | 8:30 AM | Plowing Fields | exact | No change | HIGH |
| Gregglea Clydesdales | 2026-09-26 | 10:30 AM |  | RAM Truck Corral | RAM Truck Corral | yes | Gregglea Clydesdales | 10:30 AM | RAM Truck Corral | exact | No change | HIGH |
| Canadian Cowgirls Precision Drill Team | 2026-09-26 | 11:00 AM |  | RAM Truck Corral | RAM Truck Corral | yes | Canadian Cowgirls Precision Drill Team | 11:00 AM | RAM Truck Corral | exact | No change | HIGH |
| RAM Rodeo | 2026-09-26 | 12:00 PM |  | RAM Truck Corral | RAM Truck Corral | yes | RAM Rodeo | 12:00 PM | RAM Truck Corral | exact | No change | HIGH |
| Canadian Cowgirls Precision Drill Team | 2026-09-26 | 2:00 PM |  | RAM Truck Corral | RAM Truck Corral | yes | Canadian Cowgirls Precision Drill Team | 2:00 PM | RAM Truck Corral | exact | No change | HIGH |
| RAM Rodeo | 2026-09-26 | 3:00 PM |  | RAM Truck Corral | RAM Truck Corral | yes | RAM Rodeo | 3:00 PM | RAM Truck Corral | exact | No change | HIGH |
| Doors Open | 2026-09-26 | 9:00 AM | 10:00 AM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Doors Open — Gina Livy (Morning) | 9:00 AM–10:00 AM | Harley's Pub & Perk - Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Gina Livy - The Livy Method | 2026-09-26 | 10:00 AM | 11:00 AM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Gina Livy - The Livy Method | 10:00 AM–11:00 AM | Harley's Pub & Perk - Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Doors Open | 2026-09-26 | 12:00 PM | 1:00 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Doors Open — Gina Livy (Afternoon) | 12:30 PM–1:30 PM | Harley's Pub & Perk - Stage | conflict | TIME CONFLICT: Guide 12:00 PM–1:00 PM vs staging 12:30 PM–1:30 PM. Prefer Show Guide unless newer re | HIGH |
| Gina Livy - The Livy Method | 2026-09-26 | 1:30 PM | 2:30 PM | MNP Lifestyles Tent | MNP Lifestyles Tent | yes | Gina Livy - The Livy Method | 1:30 PM–2:30 PM | Harley's Pub & Perk - Stage | exact | No change (staging stage name more precise than Guide parent tent) | HIGH |
| Great Canadian Lumberjack Show | 2026-09-26 | 10:30 AM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show | yes | Great Canadian Lumberjack Show | 10:30 AM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| Great Canadian Lumberjack Show | 2026-09-26 | 1:00 PM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show | yes | Great Canadian Lumberjack Show | 1:00 PM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| Great Canadian Lumberjack Show | 2026-09-26 | 3:00 PM |  | Great Canadian Lumberjack Show area (exhibitor footprint 1A-35-38) | Great Canadian Lumberjack Show | yes | Great Canadian Lumberjack Show | 3:00 PM |  | partial | Staging location_name blank; Guide/exhibitor has 'Great Canadian Lumberjack Show area (exhibitor foo | HIGH |
| Lawn Mower Races (to be confirmed) | 2026-09-26 | 9:30 AM |  | Event Centre #1 — West 2 | Event Centre #1 | no |  |  |  | missing | Guide TBC item absent from staging — confirm with organizers before adding; do not invent. | MEDIUM |
| Foxton Fuels Farmall Square Dancing Tractors | 2026-09-26 | 11:30 AM |  | Event Centre #1 — West 2 | Event Centre #1 | yes | Foxton Fuels Farmall Square Dancing Tractors | 11:30 AM | Event Centre #1 — West 2 | exact | No change | HIGH |
| Teeswater Agro Parts Combine Demolition Derby | 2026-09-26 | 3:30 PM |  | Event Centre #1 — West 2 | Event Centre #1 | yes | Teeswater Agro Parts Combine Demolition Derby | 3:30 PM | Event Centre #1 — West 2 | exact | No change | HIGH |
| Tandem | 2026-09-26 | 7:00 PM | 10:00 PM | The Bruce RV Park | The Bruce RV Park - Nightly Entertainment | yes | Tandem | 7:00 PM–10:00 PM | CKNX Centennial Pavilion (GFO Stage) Lounge | conflict | LOCATION CONFLICT: Guide 'The Bruce RV Park' vs staging 'CKNX Centennial Pavilion (GFO Stage) Lounge | HIGH |

## Sources & method
- Schedule pages from Show Guide text (Sun Church; Mon RV; Tue–Sat Main Stage, CKNX Lounge, Plowing, RAM Truck Corral, MNP Lifestyles, Lumberjack, Event Centre #1, Bruce RV Park, daily parades).
- OCR fixes: lvelyn→Evelyn Koebel; Naturally Well “12:00 AM”→12:00 PM; RAM Rode→RAM Rodeo.
- Hydro One Education Centre / Farming For The Future all-day blurbs not treated as timed rows.
- MATCH rules as specified: exact / partial / conflict / missing / staging_only.

## Stdout JSON summary

```json
{
  "SHOW_GUIDE_EVENTS_REVIEWED": 171,
  "EXACT_MATCHES": 135,
  "PARTIAL_MATCHES": 17,
  "MISSING_FROM_STAGING": 9,
  "TIME_CONFLICTS": 4,
  "LOCATION_CONFLICTS": 6,
  "STAGING_ONLY_EVENTS": 56,
  "LUMBERJACK_SHOW_OCCURRENCES": 15,
  "LUMBERJACK_MISSING_OR_CONFLICTING": 15,
  "STAGING_TOTAL": 218
}
```
