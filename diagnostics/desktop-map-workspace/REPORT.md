# Desktop Maps — Option 2 preview candidate

Result: responsive/regression gates passed; production-style draft preview authorized. Physical desktop review remains required. No production or staging deployment.

## Live base

- SHA: 220edd0b1e6a9032e4d75172d116d4c6d028ffa8
- Deploy: 6aa6d09275582e0008d2b15d
- Entry: /_expo/static/js/web/entry-937bb24b7c6bc507e39455c996ef2e25.js
- Build: 368195. Reverified before preview preparation.
- Branch: feat/desktop-map-workspace-20260913; one isolated commit directly above live production. Sunday-first Schedule candidate 893fa612 is excluded.

## Root cause and final layout

There was no phone max-width cap. The existing fit calculation contains the portrait Grounds image using viewport height, while search independently spans the screen and the selector is content-sized. Navigation/search overlay parts of the fitted artwork.

The chosen Option 2 preserves entire-artwork visibility. Web widths from 768px use a centered white card with subtle shadow against the existing page background. Width follows each map's fitted aspect ratio plus 16px internal padding per side, with a 380px minimum for controls, 1360px maximum and at least 24px outer horizontal margins. Wider gutters are intentional for portrait maps.

Height reserves the existing 60px navigation bar, 16px outer top/bottom margins, 120px selector/search header and 64px Fit/hint footer. Tented City additionally reserves 44px for its category controls. Safe-area top insets are subtracted without changing provider/layout semantics. No page or map scrolling is introduced to enlarge Grounds. Normal zoom/pan may move artwork as before.

Selector, search card and map viewport align. Each map retains its own workspace dimensions when hidden, so switching modes does not resize the persistent Tented City host. Desktop Maps navigation icons are centered within 960px; other routes/mobile retain existing navigation.

At 1440×900, old/new fitted artwork:

| Map | Production | Candidate |
|---|---:|---:|
| Grounds | 603×900, partly beneath chrome | 418×624, completely visible |
| Tented City | 1155×900, partly beneath chrome | 744×580, completely visible |
| Camping | 695×900, partly beneath chrome | 482×624, completely visible |

This intentionally reduces fitted artwork height to make room for controls; it does not claim wider Grounds artwork or a performance optimization. Existing Fit controls remain accessible; no new fullscreen mode is introduced.

## Validation

- 275 focused unit tests passed: existing 272 map/preload/geometry/vendor/updater/offline regressions plus 3 desktop sizing tests.
- 120 browser layout combinations passed: widths 768/1024/1280/1366/1440/1600/1920/2560 × heights 720/768/900/1080/1440 × all three maps. Full aspect ratio, aligned controls, no clipping/overflow, Fit hit tests, persistent 284-divider host.
- 57 candidate screenshots captured against preserved immutable-production baselines. Comparison gallery and images remain in this worktree's diagnostics directory.
- Mobile widths 320/360/375/390/393/412/430: all image/selector/search bounds identical. Nineteen screenshots pixel-identical; two have two shadow-edge pixels differing by at most 3/255 per channel. No material mobile visual change.
- iPhone/Android safe-area suite: 23 Chromium and 45 WebKit browser/standalone cases passed. A local server process terminated during the first WebKit run; interrupted widths were rerun successfully. Simulated insets are not physical-device approval.
- Loading UX: 14 Chromium and 13 WebKit checks passed, including delayed artwork, failure/retry, timeout, stale callbacks, persistent TC selection/camera, switching while loading, offline unavailable assets, and Chromium browser-cached offline artwork. Loading label/control positioning passed all 7 mobile widths in both engines and all 8 desktop widths in Chromium.
- Desktop pan/double-click zoom/Fit passed all three maps. M27, MNP EAST-2 fallback and Ontario Government's exact 3B-19-24 cyan/yellow union passed. Canonical geometry/search/single/multibooth and 690-site regressions passed.
- Home, Schedule, Vendors=224, Maps, CAN-AM/Valard unavailable messaging passed. Core mobile gestures/Fit and updater Later/no unexpected reload passed; no browser runtime errors.
- Real generated offline shell and updater legacy→A→B Refresh/10-minute/one-shot/offline regressions passed with push provider stubbed and remote writes blocked.
- TypeScript passed; production build:web passed (candidate Build 368241); final offline preflight passed.

## Switching and preload check

One warm-up pair plus three measured pairs, Chromium 1440×900, both exact-base and candidate artifacts served locally. Other browser suites were stopped for the final timing run; earlier concurrent/interrupted measurements were retained separately. These are lab observations, not physical iPhone or desktop performance guarantees.

| Median (ms) | Production code | Candidate |
|---|---:|---:|
| Home usable | 540 | 633 |
| First Grounds | 369 | 360 |
| First Tented City | 83 | 94 |
| First Camping | 139 | 117 |
| Return Grounds | 114 | 96 |
| Return Tented City | 81 | 65 |
| Return Camping | 92 | 94 |

No material map-switching regression observed. Home's median was 93ms higher in this run; preload still starts only after the unchanged grace/idle schedule. No Home-startup improvement is claimed. Every measured run retained exactly three artwork network requests in Grounds→Tented City→Camping order, zero interactive TC dividers on Home, and 284 persistent dividers after Maps opened. No duplicate artwork requests or TC remounts were observed.

## Scope and protected behavior

Runtime files: app/(tabs)/_layout.tsx; app/(tabs)/map.tsx; src/components/GroundsMap.tsx, TentedCityMap.tsx, RvParkDetailMap.tsx, MapModeSelector.tsx; src/theme/desktopMapWorkspace.ts (all under frontend).

Tests: desktop-map-workspace.test.mjs, desktop-map-workspace.browser.cjs, desktop-map-mobile-comparison.cjs; map-loading-layout.browser.cjs adds an optional viewport list for desktop coverage.

No changes to source artwork, geometry/data, search/gesture/Fit handlers, preload service, loading/readiness component, persistent TC mounting conditions, safe-area implementation, Home/Schedule/vendor data, updater, SW logic, WonderPush, backend or databases. Generated release/worker fingerprints changed normally. Exported map bytes match their original source assets.

Production touched: NO (read-only identity checks only). Staging touched: NO. Databases/notifications/announcements: NO.

## Marc's physical review

Open the draft preview on the same PC/browser, maximize it and check Grounds' complete artwork and aligned workspace. Check Tented City and Camping/M27, resize narrower/wider, and try gestures/search/Fit. Confirm the phone layout remains unchanged. Production deployment requires separate approval.
