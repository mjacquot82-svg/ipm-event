# Temporary staging Pixel snapshot

Open `https://staging.theipm.ca/api/pixel-diagnostic.html` directly in the Pixel's existing Chrome profile and tap **Read current state once**. Do not open Home to reach it: normal app startup can perform registration/readiness writes. The `/api/` prefix intentionally uses the existing offline worker's network pass-through so navigation does not boot the cached IPM shell. No worker changes are required.

The page and collector are gated to the exact HTTPS staging origin. They do not load the app, WonderPush SDK, analytics, or third-party scripts. The button runs once and then stays disabled. Only existing worker/subscription reads and one credential-scoped GET of stored staging registration status are permitted. No capability is created. Only existing capability storage is read; it is sent solely in the staging status header, never displayed. Cookies are omitted and redirects rejected.

Safe output: observation timestamp; notification permission; worker-controlled boolean; active scope enum; expected active WonderPush wrapper present; browser subscription present; SDK local subscription, initialization enum and installation-presence boolean when already available; current OS/token availability enums; historical provider timestamp, token-presence/deliverability booleans and reachability enum; stored-read outcome; sanitized diagnostic error class; worker-error availability enum. Errors never include messages, URLs or stacks.

Important limits:

- No SDK is initialized in the isolated document. Local SDK fields will normally be UNKNOWN / SDK_NOT_LOADED_IN_DIAGNOSTIC. This does not describe the initialization state of another tab or the worker.
- The expected worker's presence does not prove its SDK handlers initialized. Existing worker errors cannot be read from the page without worker instrumentation; they stay UNKNOWN_NOT_OBSERVABLE.
- OS visibility and live provider token state are not exposed by the existing read-only backend endpoint. They remain UNKNOWN_NO_LIVE_READ. Stored values are explicitly historical.
- Provider-check time is returned only when this Chrome profile already holds a valid capability and the staging GET succeeds. No registration or readiness endpoint is invoked.
- Merely existing/being present does not establish physical delivery or token validity.

Validation:

```
node --test diagnostics/staging-pixel/diagnostic.test.mjs
node --test diagnostics/staging-pixel/browser.test.mjs
node diagnostics/staging-pixel/build.mjs /tmp/ipm-pixel-artifact
```

The browser test uses Playwright (`PLAYWRIGHT_MODULE` can identify an existing installation). It intercepts all traffic in an isolated test context and asserts no app/SDK requests, no non-GET requests, no secret output, and no retry button.

Deployment is an additive Netlify file-digest deployment to the existing **ipm-web-staging** site ONLY. Preserve every file digest from the currently published staging deployment, then add the three built `/api/pixel-diagnostic*` assets. Do not rebuild Expo or the offline worker for this temporary diagnostic. Verify the staging published deployment has not advanced before publication, and that all pre-existing file digests remain identical afterward. Do not push main, change Render, or deploy the production Netlify site. Keep the diagnostic source on its dedicated staging feature branch to avoid triggering unrelated backend deployments.

Removal: a later authorized staging deploy can omit the three diagnostic assets. Do not clear or unregister any browser data/worker.
