# Landa content and event media — staging review

**STOPPED ON STAGING. Production promotion requires Marc's visual approval.**

Review at https://staging.theipm.ca/schedule. Search the event title, then open the event detail. Presenter images are intentionally absent from schedule-list rows.

## Implemented

- Exactly 22 approved description changes: 14 ADD and 8 UPDATE. Both MNP panel descriptions included. No changes to the 40 unresolved descriptions.
- Three structured associations for Cheryl's exact Mary Kay URL, labeled “Visit Cheryl's Mary Kay page,” opening a new tab with noopener/noreferrer and an accessible new-tab announcement. The destination returned HTTP 200 and opened in browser testing.
- Three source-identical assets stored once each under frontend/public/event-media with content-hashed filenames, served at durable staging IPM HTTPS URLs. No temporary/Gmail/third-party image hosts, no description image URLs, no duplicated image files or image generation. Originals remain in the recovered source package. Total delivered asset size is 352,308 bytes; loading is lazy and shared URLs allow normal browser caching.
- Optional event_image JSON object (url, required alt, intrinsic width/height) and external_links JSON array on schedule_items. No new presenter subsystem. SQL validation constraints require labeled HTTPS content; image dimensions preserve aspect ratio and prevent enlargement.
- API read/payload models expose typed optional media. Missing legacy fields default safely. Omitted fields in legacy PATCH requests preserve existing media. A wholesale import refuses to erase an enriched schedule; individual edits remain available. No import or schedule replacement was performed.
- Event-detail renderer shows only valid optional content. Images cap at 240px width / 260px height and intrinsic dimensions. Gina caps at 156×221. Failed images are removed rather than leaving a broken placeholder; biographies and links remain usable. Native image/link paths are supported; this pass's device validation used browser viewport emulation, not physical phones.

Migration applied ONLY to IPM Staging project hooiqjcbcbwzjjvnwyxf: version 20260909234943, schedule_event_media. Added two columns, two validation constraints and one pure validation function; no RLS/policy changes. Existing table access policy configuration was left unchanged. Security advisor findings were reviewed; no new elevated-privilege function was introduced.

## Exact image associations

### Cheryl McNair, Mary Kay Sales Director

Asset: https://staging.theipm.ca/event-media/cheryl-mcnair-b939c515fcc1.jpg (167,936 bytes), source SHA256 `b939c515fcc1dbebb3526e16dc0e733063324cec269e11d7ece7145365a11057`.

| Event | External ID | Staging UUID | Start (UTC) |
|---|---|---|---|
| Mary Kay (Cheryl McNair) | `2026-09-23-harleys-f10` | `137f262c-bebd-4c45-b5fe-160ecd442298` | 2026-09-23T15:00:00+00:00 |
| Mary Kay (Cheryl McNair) | `2026-09-23-foodland-e32` | `05f5ef8a-6920-46b1-aec4-dfc318b10c1b` | 2026-09-23T20:30:00+00:00 |
| Mary Kay (Cheryl McNair) | `2026-09-24-harleys-i24` | `1db08838-6bfe-4c10-8e78-9d89274a3f2b` | 2026-09-24T18:30:00+00:00 |
### Nikk Wise outside Harley’s Pub & Perk

Asset: https://staging.theipm.ca/event-media/nikk-wise-572a68bc731a.jpg (138,735 bytes), source SHA256 `572a68bc731a1a117c54ec255663969fd315b8c571037ae6371ec36e9337c4ff`.

| Event | External ID | Staging UUID | Start (UTC) |
|---|---|---|---|
| Harley's Pub and Perk - Charcuterie | `2026-09-22-foodland-b16` | `ac00c49a-766c-4e21-8c4f-f55074f98435` | 2026-09-22T16:30:00+00:00 |
| Harley's Pub and Perk - Charcuterie Sampling | `2026-09-22-harleys-c19` | `2b5d8f92-d054-4378-b4b4-20d016f83ec7` | 2026-09-22T17:15:00+00:00 |
| Harley's Pub and Perk - Meal Prep | `2026-09-25-foodland-k9` | `be9064e0-62d6-43cd-8ba7-e29031f91957` | 2026-09-25T14:45:00+00:00 |
| Harley's Pub and Perk - Sampling | `2026-09-25-quality-homes-m12` | `00e22f05-fc84-4611-81f8-800f05eb9541` | 2026-09-25T15:30:00+00:00 |
### Gina Livy, The Livy Method

Asset: https://staging.theipm.ca/event-media/gina-livy-a94c541cec05.png (45,637 bytes), source SHA256 `a94c541cec053a0329cf8797584103e970b535689437a2994b20ce5b74b74c84`.

| Event | External ID | Staging UUID | Start (UTC) |
|---|---|---|---|
| Gina Livy - The Livy Method | `2026-09-26-foodland-o8` | `286edf8c-ff29-4feb-b848-51d61bf760b4` | 2026-09-26T14:00:00+00:00 |
| Gina Livy - The Livy Method | `2026-09-26-foodland-o18` | `61acf2f6-9415-47cf-a886-66a080f50ee3` | 2026-09-26T17:30:00+00:00 |

The production UUIDs in the approved audit were never copied over staging identities. Matching used unique stable external IDs, expected old description values and the complete staging snapshot; staging UUIDs and all protected fields remain unchanged. identity-crosswalk.json and verified-asset-associations.json contain the exact mappings.

## Representative visual outcomes

- Brenda: full approved biography; no image.
- Cheryl: newer full biography, headshot and labeled Mary Kay link; all three appearances associated.
- Nikk/Harleys: owner/business biography and environmental portrait; four explicitly named business appearances associated, not all events on the sponsored Harley's stage.
- Bread Barn/Katie Hohnstein: approved transcribed biography; no flyer or cropped family photo attached.
- Gina: extracted portrait at native-size maximum on both September 26 sessions; neither doors-open record received media.
- Existing description-only event and an unchanged blank-description event: normal rendering without any image placeholder.

Screenshots: detail-{brenda,cheryl,nikk,bread,gina,existing-bio,existing-blank}-{320,360,1440}.png. The body remains scrollable for long biographies; portrait screenshots may be scrolled to the image position rather than the top of the detail.

## Validation

- Focused backend model/service tests: 8 passed, with 6 additional parameterized subtests. Legacy field omission, explicit clearing, shared references, invalid alt/dimensions/URLs, backward-compatible reads and safe bulk-import refusal covered.
- Frontend media/schedule/date tests: 18 passed. TypeScript noEmit and Python compilation passed. Git whitespace checks passed.
- Live staging schema rollback test: valid links accepted; unsafe/missing-label links and empty image alt rejected; all test changes rolled back.
- Full approved data transaction rehearsed with ROLLBACK, then committed with whole-snapshot preconditions and exact postconditions. SQL guards reject changed baselines or an unintended target event. Independent API/DB read-back passed.
- 21 real staging browser cases: seven representative events × 320px, 360px, 1440px. No main-page runtime errors, no page overflow, no image distortion/upscaling, no presenter images in list rows. Valid image decode and source dimensions confirmed.
- Axe checks on the newly rendered images and links: zero violations. Required alt text and accessible safe-link behavior verified. This is scoped media accessibility certification, not a whole-application accessibility claim.
- Simulated 404 portrait at 320px: image removed, biography readable, Cheryl link retained.
- All three live asset URLs returned 200 and matched the authoritative original SHA256 byte-for-byte. Nine API image associations and three link associations matched the database.
- Mary Kay destination returned 200; the actual link opened the expected URL in a new tab.

**Existing test limitation:** the older MNP import suite has five failures and two passes on both the unchanged deployed baseline and this feature checkout. Its hard-coded initial descriptions disagree with already-approved manifest descriptions. The first attempt also lacked the preserved untracked workbook; supplying that exact workbook exposed the same baseline failures. No importer, old manifest or historical expectation was altered to make those unrelated tests pass. Baseline output is preserved.

**Existing staging content limitation:** the two Ashley biographies and Michelle biography already contain the older “with catch you” / “preforming” staging wording. These three rows are outside the approved 22-description delta and were not modified. Production retains “will catch you” / “performing” byte-for-byte. No source typo was newly introduced or promoted.

## Data safety and excluded systems

218 active records on staging; 218 active records on production. Staging remains 228 total including 10 archives. Exactly 24 staging rows received approved content/media fields (22 descriptions plus two Gina image-only rows), along with their existing update-audit timestamp trigger. Schedule delta ZERO: UUIDs, external IDs, title, dates/times, timezone, stages, categories, location coordinates/IDs, event ownership, source, sort order, created timestamps and published/archive state match the before snapshot. No archived identity received content.

The 40 unresolved descriptions compare exactly unchanged. Staging vendor/location/event/settings hashes match before/after. Production schedule and vendor API objects compare exactly unchanged. No production schema/data/application deployment or provider operation was performed. No notification was sent. Maps, what3words, Home UX, notification reconciliation/eligibility, WonderPush, Notification Health, announcements and announcement-image implementation files were not changed. Those unrelated runtime systems were not separately recertified.

The actual staging deployment was a manually published PWA candidate ahead of origin/staging. Netlify metadata identified 9ef1968f as the published source; the new feature commit is based on it. Its existing layout, worker and worker-generation files are byte-identical in the feature diff. This preserves already-deployed PWA work without modifying or resuming it. Only the narrow feature commit should ever be considered for later production promotion; never merge staging wholesale.

## Deployment and review gate

- Code commit: abddf8d634f3dca50f17f838d85f0dbae28db898.
- Branch: feature/landa-event-media-20260909, also fast-forwarded to staging. No main push.
- Frontend build: 362868.
- Netlify staging site: ipm-web-staging / 0932cc5d-9cb8-4cd3-8418-7e486df75bf1.
- Published frontend deployment: 6aa1f1424b5bfc1923f931c2, 2026-09-09T23:54:01Z.
- Render staging service: ipm-staging-backend / srv-da4adt7qj5pc73bl63j0.
- Backend deployment: dep-dagv363l550s73ctb3dg, live 2026-09-09T23:55:35Z.

The first Render trigger was rejected by automatic approval review as an insufficiently verified target. Read-only service metadata and live UUID comparison proved the service was the isolated staging backend, with no production UUID overlap. The same deployment action then succeeded after verification; no alternative path bypassed the rejection.

Marc's next step is visual review of staging, especially Cheryl's link/photo, Nikk's full environmental portrait and Gina's intentionally small portrait. Physical phone review is still appropriate; the automated checks used Chromium viewport emulation. **No production promotion is authorized until Marc approves.**
