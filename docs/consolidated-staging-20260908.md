# Consolidated staging candidate — September 8, 2026

## Baseline and integration

The published Netlify deployment `6aa0624f7fccca9f801be20d` is the browser-first
onboarding release, source `f166fb3d0e1e05abb4674884218d02ba1c2bd784`, branch
`release/browser-first-onboarding`. Verified against the live site metadata,
release-artifacts/browser-first-onboarding/deployment.json and RELEASE.md, and the
served `entry-49627d554cef2cad8a9504556ab8aa8b.js` bundle. It is newer than the former
staging branch frontend. This candidate starts from that exact source.

Analytics frontend changes from `fb80d44a` were integrated as `92bc3803`. The merge
`12d6b859` records the already-deployed backend history, making the candidate's
backend identical to live staging without redeploying it. No provider/reconciliation
or deployment configuration was altered. The feature branch is
`codex/consolidated-staging-20260908`; it is the new integration candidate, not main.

## Itinerary audit (repository history and actual production bundle)

| Requirement | Production before this task | Live staging baseline | Consolidated candidate |
| --- | --- | --- | --- |
| Star saves to My Itinerary | Implemented; local favorites independent of notification permission | Implemented | Preserved |
| Addition confirmation | Partial: modal button says “Added to Itinerary”; no transient confirmation | Implemented: “Added to Personal Itinerary”, 2.8 seconds | Preserved |
| Removal confirmation | Not implemented | Not implemented | Added in Schedule and My Itinerary |
| Contextual notification suggestion | Not implemented | Not implemented | Added after successful additions |
| Not every action / cooldown | No offer | No offer | Second addition at earliest; one offer/session; seven-day cooldown; max two offers per browser storage |
| Suppress enabled users | No offer | No offer | Browser permission must be default; granted is always suppressed |
| Dismissal does not affect saved event | Saving independent | Saving independent | Saved before offer; dismissal only closes offer |
| Save never depends on notification permission | Implemented | Implemented | Preserved |

The actual production bundle `entry-37853976efcd06d37462427866a35bea.js` contained
“Added to Itinerary” but not the staging confirmation or contextual reminder offer.
`origin/main` agrees. Package 1 commit `d99f5aa9` exists on the unmerged promotion
branch and in staging; it is not an ancestor of main. No replacement implementation
of the existing successful-addition toast was needed.

An older implementation exists in `56b55634` on `origin/feat/tented-city-map-app`.
It is NOT integrated: its offer depends on itinerary-reminder readiness, can offer
to notification-enabled users whose reminder readiness is false, has a lifetime
show limit but no time cooldown, and invokes reminder enrollment/synchronization.
Those behaviors exceed this task and conflict with the requested safeguards.

The new suggestion is local presentation only. It reads browser permission without
starting the SDK. Granted, denied, unsupported and unknown states suppress it.
Granted-but-provider-unsubscribed records are conservatively suppressed too. There
is no claim that opting in enables itinerary reminders. The offer concerns important
IPM announcements and opens the existing NotificationOptIn component only after an
explicit “Notification options” action. Its default Home presentation remains closed.
The existing enable/disable functions and reconciliation guards are unchanged.

The offer reserves its cooldown before display, so dismissal, navigation or reload
cannot immediately repeat it. Broken/unavailable local storage suppresses the offer.
A backwards clock suppresses repeat offers. The cap is local browser storage, not a
person-level identity; clearing storage resets it. No IDs or fingerprinting added.

## what3words

Implementation intent is recorded in `c84b519d` (Restore staging Emergency Services)
and `740ac37f` (permission-sequence copy). Both are already in the live baseline.
The UI obtains location only on explicit action, converts through the backend,
displays the three words and nearest place, supports copying, and explains that
this action does not send an SOS report. Location denial, unavailable GPS, conversion
failure and copy failure have user-facing handling. Existing Emergency / Need Help
navigation is present. No additional implementation was needed or integrated.

The backend uses the server-only WHAT3WORDS_API_KEY in an X-Api-Key header. Client
code calls IPM's /api/what3words endpoint and contains no what3words key. Unit tests
exercise invalid coordinates, missing key, conversion and key non-disclosure.
A read-only staging request for fixed test coordinates 44.1,-81.2 returned 200 with
palaces.itches.windsurf, near Hanover, Ontario. These were not device coordinates.

The production endpoint returned 404 and the actual production frontend bundle
contains no /api/what3words integration. Production environment key readiness is
UNKNOWN: no authorized evidence of a configured production key was available;
absence of the route does not prove absence of the key. No production environment
was changed or secrets exposed. Before production: review/promote the narrow
Emergency/what3words source changes, verify a production server-side key and quota,
review request throttling (the current public route has no route-specific rate
limit), and verify real location/copy behavior on target devices. No automatic SOS,
background tracking or dispatch integration is implemented or claimed.

## Map exclusion and future promotion

The interactive Tented City map remains byte-for-byte unchanged in source for
staging testing. Exact file paths and reachable map commits are listed in
`consolidated-staging-map-exclusions.txt`. Shared Map/Vendors files must not be
promoted wholesale. This candidate is NOT a production promotion branch.

Proposed future promotion set, each reviewed on top of current production:
1. Browser-first onboarding as a narrow reviewed change, preserving production guards.
2. Notification-health reporting and admin UI from fb80d44a / 92bc3803, plus its tests.
3. The itinerary confirmation/suggestion delta from this candidate; production also
   needs the approved Package 1 addition confirmation, adapted without map hunks.
4. Emergency/what3words only after its production prerequisites are resolved.

Never merge all of staging into main. Exclude interactive map data, components,
geometry, crosswalks, vendor Find on Map navigation, diagnostics and reminder-engine
experiments from this proposed set. No production action is authorized by this report.

## Authentication and verification limits

The organizer portal requires a real server-side session and an event-scoped user.
Local tests use FastAPI dependency overrides, not staging credentials. Legacy PIN
routes do not grant access to organizer analytics. No existing authenticated browser
session or configured staging test credentials were available. No user was created,
password reset, cookie forged or auth bypass installed. Actual live aggregate values
remain unverified until an organizer signs in normally at staging.theipm.ca/admin/.
This verification limitation does not block frontend integration/deployment.

## Validation and deployment

Full frontend: 335 passed; two pre-existing map failures reproduced on the untouched
baseline (outdated map import assertion and missing frontend/data fixture path).
TypeScript passed. Full frontend lint: zero errors, 60 pre-existing warnings.
Focused what3words, notification-health and organizer-auth backend tests: 22 passed.
No backend code differs from the deployed fb80d44a; no backend deploy or migration.
Staging-configured Expo build passed. Additional browser/read-back evidence and the
final deployment ID are recorded with release artifacts after verification.

Production unchanged. No notification sent. No WonderPush PATCH, enrollment,
permission change, reconciliation/cohort/config change, schedule-data edit, vendor
edit, map edit or production deployment occurred. Browser tests isolate providers
and use local synthetic favorite records; no attendee records are modified.

## Final staging read-back

Published Netlify deployment: `6aa091b2b8f161cc3b981158`, ready at
2026-09-08T22:54:59Z, https://staging.theipm.ca. Application source SHA:
`317ccd4faf72d5adcae086e84ee51bea5321892a`. Served bundle:
`entry-acd64df49b64990b340a1a3c26db9561.js`; offline cache version `190cff821a290811`.
Manual deployment source is proven by bundle/index/worker byte comparison and the
release manifest; Netlify leaves commit_ref null for this file-manifest deployment.

Preserved 163 previous paths unchanged, including old bundle aliases and diagnostics.
Only index.html and the generated worker replace existing paths; new hashed assets
are additive. The submitted manifest contains 185 paths. Preview read-back verified
78 critical paths by SHA-1; live index and worker match the built bytes exactly.
Worker body matches the previous worker after excluding generated cache constants.

Local, preview and live browser fixture flows passed at 390px and 1440px: addition,
Schedule removal, My Itinerary removal, saved-state persistence, dismissal, reload
cooldown and granted-permission suppression. Live read-only smoke passed at 320px
and 1440px: optional browser-first help, Emergency location UI, Tented City tab,
and organizer login. No document overflow. All provider access and outbound writes
were blocked in automated browser flows. Test favorites are synthetic browser-local
records, not attendee/provider state. The actual local offline worker cached Home,
reloaded offline and served an offline Schedule deep link successfully.

Integrated analytics desktop/mobile UI fixture tests passed. Live /api/admin/auth/me
returns 401 without a session; actual authenticated aggregate counts remain pending.
The simplest remaining human step is normal organizer sign-in at
https://staging.theipm.ca/admin/ and opening Analytics. No cookie export is requested.

Staging Render remains on fb80d44a, deployment dep-dag8ls3l550s739r539g (live).
No new backend deploy or configuration mutation occurred during consolidation.

The final documentation-only commit aligns origin/staging with this consolidated
candidate, so the next staging task no longer starts from the older frontend.
It uses [skip render] and [skip netlify], leaving the validated deployments intact.
These are supported by [Render's deploy documentation](https://render.com/docs/deploys)
and [Netlify's deploy documentation](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/).
The documentation-only commit does not change the deployed application bytes.
