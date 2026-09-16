# Nicole / Landa and DirtWorks — staging content review, September 16, 2026

Status: COMPLETE ON STAGING; STOPPED FOR OWNER PHYSICAL REVIEW. No production promotion authorized or performed.

## Sources and exact scope

Nicole: PR #21, commit `8b0920346c1d305ae8b77fefdfe0c1f51f116b06`, `backend/import_manifests/nicole_schneider_20260915.json`. The prepared biography/description was recovered verbatim from that manifest, not reconstructed. The original portrait remains in `.worktrees/grounds-no-entry/data/nicole.jpg`; its SHA-256 matches the PR asset: `21a20f01ecdd752679c448d0093a6e148aaa526502b37d7fb4eaa3e5090295e6`, 18,916 bytes, 452×640. Existing September 9 Landa ZIP packages and preserved reports were inspected; those older packages do not contain this later Nicole biography. No separate original Nicole biography document was found beyond the prepared PR manifest.

DirtWorks: PR #22, commit `28c0b0bfd4be67b9a9722ae7af0fb03390ae26be`, `backend/import_manifests/ipm_dirtworks_2026.json`, its review document and offline planner. Both original graphics remain in `.worktrees/grounds-no-entry/data/` and were visually inspected and hash-matched:

- `IMG_20260915_133702.png`: authoritative Daily Event Schedule; SHA-256 `f2e6330bb8190394f0c9068740cd813b56789b643d82209a3da00158374df455`.
- `IMG_20260915_133655.png`: approved promotional poster; SHA-256 `3e899f6a3ab305c183b4d3026e235b85ae6e406cb5d22f5f1a505636f4199be8`, 1,857,298 bytes, 1320×2868.

The authoritative daily schedule agrees with all five requested dates, times, titles and venue. The promotional poster uses descriptive variants such as “Mini Excavator Rodeo” and “Ride & Drive Compact Tractors”; the prepared titles follow the daily schedule. No conflicting dates, times or sessions were found.

PR #21 preview injection, preview build script and debug/scaffolding were excluded. Included runtime support is limited to Nicole's optional top-square portrait display and API preservation of that crop. Existing uncropped image responses retain their prior shape. Original image bytes are unchanged. No maps, notifications, unrelated content, environment configuration or schema changes.

## Final records (America/Toronto, 2026)

| Date | Time | Title | Location / category |
|---|---|---|---|
| September 25 | 12:15–1:15 PM | Nicole Schneider - The Perfect Christmas Tree | Quality Homes - Stage / MNP Lifestyles Tent Events |
| September 22 | 2–3 PM | Mini Ex Rodeo | DirtWorks Demo Field |
| September 23 | 2–3 PM | Track Loader Rodeo | DirtWorks Demo Field |
| September 24 | 2–3 PM | Mini Ex Rodeo | DirtWorks Demo Field |
| September 25 | Noon–1 PM | Track Loader Rodeo | DirtWorks Demo Field |
| September 26 | Noon–1 PM | Compact Ride & Drive | DirtWorks Demo Field |

Nicole's presenter/business is **Nicole Schneider, Porterhouse – Flowers By Usss**. The full approved biography and demonstration description are in the existing description field. Only `title`, `description`, and `event_image` changed; the normal database trigger also advances `updated_at`. Date, time, venue, category, UUID, source identity and existing external links remain unchanged. The image relationship is attached to the existing event, not a duplicate presenter/event record.

All five DirtWorks records retain PR #22 descriptions, the approved promotional image, and its labeled full-poster link. No location/map entity was created.

Nicole existing UUID: `39891220-5824-4536-aac8-be0290ecdc19`; external ID: `2026-09-25-quality-homes-m15`.

| DirtWorks stable external ID | Created UUID |
|---|---|
| 2026-09-22-dirtworks-mini-ex-rodeo | 353900f8-1a41-5876-ba78-b27a2d8dd756 |
| 2026-09-23-dirtworks-track-loader-rodeo | a68c97e1-ff71-5052-8883-ea201cce2a46 |
| 2026-09-24-dirtworks-mini-ex-rodeo | a7afdb06-1677-56ec-b1f0-1ef646da86d0 |
| 2026-09-25-dirtworks-track-loader-rodeo | 6601a02f-9b04-5e4c-b56f-d3b59c2b7a0e |
| 2026-09-26-dirtworks-compact-ride-and-drive | a5e16106-3d32-5915-b64d-6baba2728908 |

## Target verification and preservation

Staging project `hooiqjcbcbwzjjvnwyxf` (IPM Staging), event `51000000-0000-4000-8000-000000000001`, slug `ipm-staging`. Production was separately verified as project `hppboivlpqkfhhzfftuu`, event `5119d9d0-ea63-4677-9bea-36e32dbcfa46`, slug `ipm-2026`. Both use America/Toronto. Parent staging event metadata contains its longstanding 2027 test window; identity is confirmed by project, event UUID, name and slug. This task leaves parent metadata unchanged and explicitly uses the approved 2026 session dates.

Before the write: saved all 229 staging records, separately fetched both public APIs, found exactly one Nicole/Flowers by Uss record and no DirtWorks matches including archived records, and prepared exact rollback content. The transaction locks schedule_items, checks staging identity, requires baseline count 229, requires Nicole's full row to match the saved baseline, and rejects DirtWorks near-matches. It updates one record and inserts exactly five. It does not invoke a bulk importer.

Expected and observed counts: **219 → 224 public events; 229 → 234 total records**. All 228 unrelated existing database records, including archived records, remain identical. All 218 unrelated public staging events remain identical. No duplicate Nicole or DirtWorks records.

## Deployment and review

Frontend: staging Netlify site `0932cc5d-9cb8-4cd3-8418-7e486df75bf1`, deployment `6aaa8c9d0f39990008821b71`, commit `c95df94d7af2bf6395ac978889f6d3a3da88ae77`.
Backend crop support: live deployment `dep-dal8rjks728c739aerd0` (September 16, 12:40:22 UTC), staging Render service `srv-da4adt7qj5pc73bl63j0`, commit `10a408ccd473cf8fe8b91028a14d0e13996a7331`.
Content branch: `content/nicole-dirtworks-staging-20260916`; both runtime commits are preserved on remote staging. Isolated Git indexes were used; no extra worktree, dependency installation or workspace maintenance was needed. The primary checkout's pre-existing changes were preserved.

Review the actual shared staging app: https://staging.theipm.ca/schedule . Search **Nicole** or **DirtWorks**. Nicole direct detail: https://staging.theipm.ca/schedule?eventId=39891220-5824-4536-aac8-be0290ecdc19 . No fixture or preview override supplies these records.

Evidence files: `nicole-schedule-card.png`, `nicole-detail-portrait.png`, `dirtworks-all-five.png`, `dirtworks-detail.png`, `nicole-phone-390.png`, `dirtworks-phone-390.png`. Browser evidence includes each session's search, correct day, time, detail, image loading, adding/removing favourites, itinerary persistence and opening details from itinerary. Browser requests other than GET and push-provider requests were blocked; favourites use browser-local storage. No notification opt-in or send was performed.

Validation completed after the final backend deployment: 6 frontend media tests, 4 DirtWorks content tests, and 7 backend media tests passed; staging Netlify build/export succeeded; all six browser scenarios passed with zero page errors, including exact displayed time ranges and Nicole square-crop geometry. Public API values equal both prepared manifests. Staging health endpoint returned 200 and no staging backend error logs appeared between 12:40:23 and 12:42 UTC.

Final review evidence and checksums are preserved in `release-artifacts/nicole-dirtworks-staging-20260916/`. No temporary preview page was added.

## Rollback, prepared but not executed

`rollback-records.json` contains Nicole's full before record and all five created records. `rollback-staging.sql` is staging-event guarded, locks the table, and refuses to proceed if any of the six post-apply records has subsequently changed. It restores Nicole's prior title, description and null image, then deletes only the five explicitly identified DirtWorks rows. Normal updated_at auditing remains active. Expected rollback counts: 219 public / 229 total. Execute only against staging project `hooiqjcbcbwzjjvnwyxf` if a rollback is requested; do not replay after later content edits without review.

For code rollback, revert only these content/media commits using new commits against the then-current staging head; never reset shared history. Restore data first if assets are to be removed. Prior frontend deployment is `6aa85bcdb2999d0009ae753c` at `4e16d853cb506000c65f3dd038c0508fc114afba`; prior backend is `dep-daksgibncjis73ds6hug` at `1f199c10cdc1dd01acfa1770bacaf80609305c2b`. Do not restore an old entire deployment over newer unrelated work.

## Production protection

No production writes, deployment, configuration changes, schema changes, main push/merge, or notification sends. Production public schedule remains 218 unchanged event records. Production Netlify remains `6aaa72c1669bca0007576d39` at `41192789995b052b39e60687ec8080bb84ad5797`. Production Render remains `dep-dakvl6ek1f9s73d6b1u0` at `2a113e09a00294ae531e990f3510d7d9937003ac`. Remote main remains `41192789995b052b39e60687ec8080bb84ad5797`.

STOP for owner physical review. No production promotion.
