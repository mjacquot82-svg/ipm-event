# Resumed PWA launch validation — production blocked

Preserved production candidate 9ea6c7daa54f319a623ec1e0f9de1c88d4241364 and staging application candidate 73e523040e4c755b3aa7f1d99da839e59b0edef0 were verified against their pushed branches. Application source was not changed during this resumed validation. Recovery branch 4d049da8de24b10af3003155fba5837487d285a1 remains intact.

## Result

DO NOT PROMOTE. In the last repeated transition, the first fresh online browser320 launch after publishing B returned entry-40efbaa8399049d7a310627fee215c2e.js (A, build 362330) instead of entry-03184dc2e7f3b50c7a7ec3982a87a58c.js (B, build 362335). No network fault was injected into this context. Root cause is NOT PROVEN: the trace does not distinguish Netlify publication propagation, transient timeout/network fallback, or candidate behavior. A fresh HTTP response/body timeline must be captured before making a causal claim. No application correction was attempted after this gate failed.

An earlier complete A-to-B run passed all eight cases: browser320, standalone-emulated360, desktop, previously closed, offline/reconnect, slow network, failed startup asset, and waiting worker. First successful launches took 643–2394ms. Slow fallback took 5479ms; missing-asset fallback 422ms. B-to-C passed the first five cases, then the slow case rendered C where the harness expected B. That was usable current content and not proof of a fallback defect; the subsequent repeat established faults before publication to eliminate pre-caching ambiguity, and encountered the blocking browser320 result above. Overall repeated transition gates have NOT passed.

## Test limits and preservation

Real Netlify deployments and worker/HTML/JS bytes were used, with the same eight Chromium contexts across transitions. Page closure/new-page creation represented fresh documents; standalone/iOS detection was emulated, not physical installation. Worker-network interception was enabled using PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1. The waiting-worker check was changed to wait for an actual waiting state rather than merely absence of installing. The harness made no explicit registration.update() calls; registration checks came from normal application launch/reconnect behavior.

Schedule data was a browser-local fixture for itinerary rendering. Actual schedule/vendor API contents were separately compared read-only. In completed cases, itinerary/favorite IDs, dismissal preference, notification permission, unsubscribed status, offline itinerary deep link, and reconnect were preserved. Granted and denied permission were exercised. A real enrolled subscription was not available and no subscribe/unsubscribe action was permitted; real enrolled-device preservation is unproven. No reload loops or blank UI were observed in completed cases, but the overall repeated sequence is incomplete. Prior preserved 70 production unit tests, 10 staging launch tests, type checks and lint results remain supporting evidence; they do not override the real transition failure.

## Deployments

- A: build 362330, 6aa172e36307a145eaab4ba8.
- B: build 362335, 6aa174216307a15981ab4bcb; current staging after last repeat.
- C: build 362339, 6aa174ee87a47f2cf274b3b6; used in the earlier B-to-C attempt, no longer current staging.
- Production unchanged: build 362242, 6aa15e88b199e77b4e5fccf7.
- Preserved production candidate build 362336 remains local and unpromoted.

## Exclusions and next physical test

Read-only final verification confirms schedule 218 and vendors 127 with unchanged contents, reconciliation enabled at 100%, same backend commit 70e068ab2930bdeddee3c5817477cc97e9ca0b01, and unchanged production deployment/assets (including maps/Home). No changes to Home, compact notification prompt, schedule, vendors, either map, what3words, Notification Health, reconciliation, eligibility, provider records or announcements. No notification was sent.

Physical iPhone behavior remains unverified. No new production physical update test should be claimed for this candidate. If a later validated correction is promoted, Marc/Jen should keep their installation, note current About build, saved itinerary and notification setting, then after the next normal production release fully close the app, reopen once online, and check the expected build and preserved state without hard refresh, reinstall or storage clearing.

Stopped after failure verification, as requested. Preserve this evidence and diagnose the first-navigation response timeline before any future production promotion.
