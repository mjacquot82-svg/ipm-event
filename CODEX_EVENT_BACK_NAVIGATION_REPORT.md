# Event Detail Back-Navigation Fix

## Scope

Navigation-only correction. The Landa content/media promotion remains paused; no production data or schedule records were changed.

## Baselines

- Production source baseline: `origin/main` `1b63ce2e140015fb25ef6137143217e25c856c27`
- Current staging deployment: Netlify `6aa1f83abd3e0700077f3f93`, commit `e017e25d`, `https://staging.theipm.ca`
- Current production site: `https://theipm.ca`, Netlify deploy `6aa15e88b199e77b4e5fccf7`, deploy-preview branch `fix-home-space-production-20260909`

## Reproduction and root cause

The repository's active attendee Schedule renders event details with a React Native `Modal`. Selecting an event changes only component state; it does not add a browser history entry. On web, the modal's `onRequestClose` is not a browser `popstate` handler. Consequently browser Back can pop the Schedule route while the modal state remains active during the route teardown. This is the proven unsafe state transition in the source path. The same Schedule/modal implementation is present in the production baseline and the staging path; the Landa media branch adds detail content but does not create this navigation behavior.

The available unattended environment has no browser/device automation or Chrome runtime, so a first-party console stack from the physical reproduction could not be captured here. Production and staging HTTP availability and deployed identities were verified; Marc's physical report remains the direct reproduction evidence.

## Correction

On web only, opening event detail pushes a same-URL history marker. A `popstate` handler closes the modal and clears the selected event before the Schedule route can be popped. Explicit close, Android/native `onRequestClose`, and the location link use the same guarded close function, which removes the marker without changing event data. No schedule, event, media, notification, PWA, or provider state is touched.

## Validation

- `node --test tests/schedule.test.mjs tests/schedule-date.test.mjs tests/schedule-category-deep-link.test.mjs tests/schedule-event-back-navigation.test.mjs`: **20 passed**
- `npm run lint`: **0 errors**, 46 existing warnings
- `npm run build:web`: **passed**
- Static source checks cover ordinary, filtered, itinerary/deep-link-safe route behavior, repeated open/Back cycles, and modal exits. Physical 320px/360px, desktop, browser Back, installed-PWA, and native device checks remain required on deployed staging.

## Promotion status

This branch is based on production main and is suitable for narrow promotion after staging verification. Staging deployment `6aa1fbbb4bb23c00080e1576` is ready at https://staging.theipm.ca on staging commit `8e9e3c13`; the deployed bundle contains the history marker. Production promotion is not performed because this environment cannot independently execute production browser/device Back or capture the physical exception stack. The Landa production promotion remains paused.
