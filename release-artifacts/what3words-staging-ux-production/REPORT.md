# WHAT3WORDS STAGING UX LIVE

Authoritative recovery report. Verified 2026-09-09T03:11:52.506894+00:00. This report and verification artifacts are committed on `fix/what3words-staging-ux-production`. No further task is running.

## Objective and outcome

Restore the staging-approved Emergency/what3words attendee experience exactly over current production, preserving the private POST backend and all excluded features. Completed and independently verified. No blocker. No notification sent. No production data writes, backend deployment, environment/key change, staging merge, or map promotion.

## Exact authority and production identities

| Component | Source SHA | Deployment |
| --- | --- | --- |
| Approved staging authority | `317ccd4faf72d5adcae086e84ee51bea5321892a` | `6aa091b2b8f161cc3b981158` |
| Production frontend before | `1b63ce2e140015fb25ef6137143217e25c856c27` | `6aa0bd481c247632e1a18d16` |
| Production frontend after | `1db1e1db373c114b242bd792af3a809a85573001` | `6aa0ccd4556bd25f58ba346d` |
| Production backend before AND after | `70e068ab2930bdeddee3c5817477cc97e9ca0b01` | `dep-dagbgj740ujc73c4eqi0` |

Frontend published 2026-09-09T03:06:28.325Z to https://theipm.ca. It is the exact tested Netlify draft artifact, manually published. Netlify `commit_ref` is null for manual uploads; deployment title, release-manifest.json, package hashes and Git commit identify the source. Backend is still live at its original deployment.

Authority was reconstructed from consolidated-staging/deployment.json and REPORT.md, historical source, Netlify deployment metadata and the immutable historical deployment URL. Staging page screenshots and the candidate's screenshots are **byte-identical** at 320, 390 and 1440 pixels. Rendered text, labels, font styles and dimensions also compare equal.

The production release is sourced from the task branch. **GitHub main was not changed** and remains `1b63ce2e140015fb25ef6137143217e25c856c27`; do not mistake main for the now-live frontend source. Final evidence is a documentation-only descendant of the deployed source commit. No extra deployment is needed for that evidence commit.

## Differences found BEFORE implementation

Machine-readable `staging-vs-production-ux.json` was written before code changes. Production lacked the staging Home Emergency card. Production's Emergency page JSX, every displayed string, styles, accessibility labels and location-request flow already matched staging. Shared colors and responsive layout helpers also matched. About already provided secondary access.

Intentional production privacy differences were preserved: POST body instead of staging GET query coordinates; no-store/omit credentials/no-referrer; no Emergency page analytics hook; no coordinates in response type; safe added 429 rate-limit message. The staging GET defect was not copied.

## Exact changes

Only application file: `frontend/app/(tabs)/index.tsx`, 13 inserted lines. The exact staging card is now first in Quick Actions, immediately before Map. Label and screen-reader label: **Emergency Services**. Icon: **Feather alert-triangle**, size 22, white, existing `colors.error` background. Route: `/emergency-services`. Existing `actionCard`, `actionIcon`, `actionTitle` and wrapping grid styles are used unchanged. Existing Quick Actions retain their relative order; Share IPM remains last. No Home redesign, hero/countdown/style change, or Emergency page edit.

The card restores the staging call to the existing `quickAction('emergency_services', 'internal', ...)` helper. This is the existing generic selection event with fixed action metadata, not a new analytics implementation. No analytics schema, backend, page telemetry, Share analytics or payload change. About secondary access remains.

Two directly related source/browser tests were added; all other committed files are release evidence. `source.patch`, `whitelist.json` and `files-changed.txt` identify the scope.

## Exact attendee wording retained from staging

The card wording restored is “Emergency Services”. The page wording was already correct and remains unchanged. Exact JSX and all styles are in `staging-emergency.tsx.txt`; the machine-readable inventory includes:

- Location permission was denied. Allow location access, then try again.
- Location request timed out. Move to a clearer GPS signal and try again.
- Your device could not provide a location. Turn on location services and try again.
- Could not copy the 3-word location. You can still read it to the dispatcher.
- Unable to get a 3-word location. Try again.
- The location coordinates were invalid. Try again.
- Location lookup is not available right now.
- Location lookup failed. Try again.
- Back
- Emergency Services
- Call 911 first
- If this is an emergency, call 911 now. Then use your 3-word location below so the dispatcher can find you on site.
- Site 911 address
- 95 Durham Road
- Entrances 9 &amp; 10
- Need help finding your location?
- Tap “Get my 3-word location” below. If prompted, allow location access so we can determine your 3-word location to share with the 911 dispatcher.
- Your browser may ask for location permission.
- Read this to 911
- Back to attendee Home
- Get my 3-word location
- Uses your device GPS. Does not send an SOS report.
- Copy 3-word location
- Getting your location…
- Getting your 3-word location…
- Near {nearestPlace}
- ///{words}
- Copy
- Copied

Additional preserved production protection: “Please wait a minute before trying again.” for HTTP 429. Success shows selectable `///{words}`, optional `Near {nearestPlace}`, and Copy/Copied. No new copy was invented.

## Privacy verification

Location begins only after the attendee activates the location button; no automatic GPS/provider lookup. Browser-to-IPM request is POST `/api/what3words`, JSON body only, no browser query, credentials omitted, no referrer and no-store. Real lookup using fixed public test coordinates returned HTTP 200 before and after release. Invalid coordinates returned 400; local backend privacy tests cover malformed bodies, ranges, origin, response filtering, rate/body limits and exception/secret canaries.

Browser tests found no coordinate/address canaries in URLs, other request bodies/analytics, console, localStorage or sessionStorage; reload clears the result. Existing worker ignores POST/API data. The generated bundle contains no provider key variable, provider endpoint, synthetic secret or coordinate canaries; private-key/token patterns were absent. The actual production key was never read, requested, changed or copied.

Render log searches after live lookup found zero coordinate/address/secret canary matches and no `X-Api-Key`/`coordinates=` matches. Sanitized access evidence records only `POST /api/what3words HTTP/1.1` with 200, no query or body. Backend source and deployment are unchanged.

## Tests and independent production verification

- 259 frontend tests passed, including exact staging card/source preservation and privacy assertions.
- TypeScript passed; lint 0 errors / 46 pre-existing warnings; production build passed.
- 42 combined backend privacy and Notification Health tests passed.
- 84 required analytics/reporting/Notification Health regressions passed.
- All nine production browser suites exited 0: exact Emergency UX, Emergency privacy/error matrix, Share IPM, Home presentation, itinerary, actual service-worker offline checks, real provider lookup, public smoke/map/About, and Notification Health layout.
- Exact UX at 320/390/1440; native/cancelled/failing Share and clipboard/manual fallback; exact Share selection analytics intercepted locally; keyboard and screen-reader assertions; no notification/install side effects.
- GPS denied, unavailable, provider failure, network failure and rate-limit cases passed with controlled fixtures. Real production provider success passed. No recipient was selected and no OS share delivery is claimed.
- Offline cached Home, Share copy, Emergency navigation/deep link, exact offline network fallback and Schedule deep link passed using the actual production worker.
- Public production bundle/HTML/worker/map hashes match. All canonical uploaded files match the Netlify manifest; public assets were independently downloaded and hashed. Netlify control files and existing backend-proxied paths were verified through the upload manifest.

`test-matrix.json` maps all 30 requested checks to evidence. Test logs are normalized only for trailing whitespace when committed.

## Known baseline test limits (not introduced by this release)

Expanded testing also ran the unrelated legacy `tests/test_notification_analytics.py`: three failures reproduce on untouched production source (missing adoption_summary, create_requested audience fields, and list_announcement_delivery_stats). No unrelated fixes were made. Initial browser harness failures involved a selector assuming all legacy cards had button roles, a hidden duplicate heading, and incorrect Organizer login copy; test selectors were corrected, application code unchanged, and final runs all pass. Initial asset read-back required excluding non-public Netlify control paths and percent-encoding filenames; final manifest/public verification passes.

Notification Health uses unchanged source/backend. Its backend regression tests and controlled authenticated UI fixtures pass; live production returns the expected 401 without credentials. No organizer session was available/requested, so **a fresh authenticated production aggregate response is not claimed**. This does not block the isolated Home card release and does not modify notification behavior.

## Exclusion and preservation evidence

- All 228 schedule records have identical before/after database digest `fd2f818eb6b2013cf535a985840c0f17`; **218 published / 10 archived**. Public schedule records are identical.
- Church Service remains **Sunday September 20, 2026, 2:30 p.m. America/Toronto**, stored `2026-09-20T18:30:00+00:00`, no end time; ID `72b96b59-c480-5fb2-a1ed-25acb63ae379`. Record unchanged.
- All **127 vendors** match before/after; no booth or vendor-map writes.
- All existing package assets retained byte-for-byte. Package changes are only new entry bundle, generated HTML entry reference and generated worker cache manifest. Existing map source/assets and rendered image remain unchanged; no iframe or interactive Tented City integration was introduced.
- Notification Health, WonderPush, subscriptions, permissions, announcements and Notify Everyone were not changed or invoked. Tests block unrelated writes and provider requests. **No notification sent.**
- Reconciliation remains `repair_cohort_percent=100`, `repair_enabled=true`, `observation_enabled=true`, `pilot_only=false`, `operating_mode=POPULATION_REPAIR_STAGED`. Existing background reconciliation may naturally change aggregate counts; its mode/eligibility/configuration are identical.
- Hero, countdown, browser-first onboarding, compact notification invitation, itinerary/favorites and Share IPM source/behavior preserved. Device state fixtures confirm no setup wall or automatic permission request.

## Recovery and exact stop point

Implementation, preview testing, frontend publication and independent production verification are complete. Final verification/report artifacts are committed and pushed to `fix/what3words-staging-ux-production`. The authoritative files are this report, verification.json, whitelist.json, files-changed.txt, deployment/read-back JSON, database/API snapshots and browser/test evidence in this directory.

No next implementation step is required. Do not redeploy because the terminal disappeared. If an independently authorized rollback ever becomes necessary, the previous frontend artifact is `6aa0bd481c247632e1a18d16`; no backend or data rollback is involved. Local frontend-release is an ignored upload package; its complete hashes and remote Netlify file manifest are committed for recovery.

Final status: **WHAT3WORDS STAGING UX LIVE**
