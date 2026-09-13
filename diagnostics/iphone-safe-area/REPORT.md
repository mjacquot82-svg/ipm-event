# iPhone Maps safe-area preview candidate

Base: `3960f073e204935c6bccd251a1931c00120c2459`
Branch: `fix/iphone-safe-area-20260913`
Worktree: `/tmp/ipm-iphone-safe-area-20260913`

## Root cause and change

The production HTML uses `viewport-fit=cover` and `apple-mobile-web-app-status-bar-style=black-translucent`. The tab layout previously forced its top padding to zero on web, despite having a SafeAreaProvider. Maps positions its common selector 8px from the scene's top. That combination accounts for the reported status-bar overlap on the physical iPhone.

The only application change removes the web-only zero override in `frontend/app/(tabs)/_layout.tsx`. The existing `useSafeAreaInsets().top` now supplies the shared content padding on every platform. Its web provider measures `env(safe-area-inset-top)` (and legacy `constant()` where supported). Selector, search, and map receive the same protected scene bounds. The existing 8px selector spacing remains. Native behavior and zero-inset browser layouts are unchanged. No fixed device-specific padding or user-agent checks were added. Common tab content inherits this top protection.

No map geometry, search, vendor/schedule/camping data, gestures, updater, notification, service-worker logic, release generation, or database code changed. Production build outputs naturally have a new bundle hash and generated shell/release identifiers; their generation logic is unchanged.

## Verification

- Focused browser matrix: iPhone widths 320, 375, 390, 393, 430 with simulated provider top insets 0, 20, 44, 59px. Chromium and WebKit check all map modes, all selector labels, selector/search hit testing, bounds, input, and map fit/reset. Android-sized zero-inset widths 320, 360, 412 and desktop 1440 are checked in Chromium.
- CSS inset inputs are simulated through the actual safe-area provider, not injected into the app container. This tests layout response, not hardware status bars or real Safari/PWA environment values. Physical Safari and installed Home Screen PWA checks remain required.
- Map browser smoke: Grounds search/highlight and Fit (after dismissing its information card), Tented City, Camping manual M27, MNP stage fallback, Ontario Government exact multibooth highlight, Valard/CAN-AM unavailable UX, updater prompt/Later, no A/B test marker.
- Existing map, geometry, search, camping, PWA and offline suites: 240 tests. Initial run had 239 passes and one missing historical Git object. Fetching exactly `cdc6ed64aef138ee8c365103904bd11b005e9048` resolved it; all eight compatibility tests passed on rerun without source changes. A subsequent complete run passed 240/240 tests.
- Existing updater integration: production-worker migration, explicit single refresh, offline reload, same-release no-op, storage and permission preservation. Push provider stubbed.
- Generated offline shell browser test: offline Maps reload and manual M27. Only remote push loader replaced with local test stub; no remote writes.
- `npx tsc --noEmit`: pass.
- Focused ESLint: no errors; existing `colors` default-import naming warning.
- `CONTEXT=production npm run build:web`: pass with read-only production public build configuration. No production environment changes.
- Offline preflight: 15 shell assets exist; HTML/entry/release manifest match; correct production backend; static vendor payload has 224 entries; generated SW logic equals source after normalizing generated asset list/version.
- Dependency setup: checked-in package lock rejects `npm ci` due to missing optional-platform dependency entries. `npm install --package-lock=false` succeeded; no manifest or lockfile changes.

Browser commands (from frontend):

```sh
IPM_BROWSER=chromium node tests/iphone-safe-area.browser.cjs
IPM_BROWSER=webkit IPM_WIDTHS=393 PLAYWRIGHT_BROWSERS_PATH=/tmp/ipm-playwright-browsers node tests/iphone-safe-area.browser.cjs
node tests/iphone-safe-area-regression.browser.cjs
node tests/iphone-safe-area-offline.browser.cjs
node tests/pwa-resume.browser.cjs
```

Browser tooling can be supplied with `IPM_PLAYWRIGHT_MODULE`. `IPM_PREVIEW_URL` chooses a draft preview; otherwise layout and map tests use localhost:8765. WebKit proxies read-only backend GET responses to avoid localhost CORS restrictions. Notification and analytics writes are blocked in browser tests.

## Release boundary

Only a Netlify draft deploy (`draft: true`, deploy-preview context) is authorized. Verify the published deployment remains `6aa5db1ba30b80000872c63f` at the supplied base. No staging changes, production publication, configuration writes, or database writes. Stop after preview verification for physical iPhone review.

Safe-area provider reference: https://appandflow.github.io/react-native-safe-area-context/usage/
