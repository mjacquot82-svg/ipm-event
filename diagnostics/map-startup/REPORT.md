# Map artwork preload and loading preview candidate — 2026-09-13

The preserved candidate restores production Tented City mounting and keeps artwork-only preloading plus a bounded loading/reveal state. Production and staging are not deployed. Physical iPhone approval is required before any production promotion.

Base: `75be97fb5de65e415bfc4f9ee5dc15704adfd540`, production deploy `6aa60ce046297000088e386c`, Build **367359**. Candidate branch: `feat/map-artwork-preload-20260913`. Production-style candidate Build **368147**, entry `entry-998e20f0098f0b58e1cb4c258af70609.js`.

`frontend/app/(tabs)/map.tsx` is byte-for-byte production. Tented City remains mounted, including its 284 dividers and 99 semantic hitboxes, while Grounds or Camping is selected. Its search, selection, and camera lifecycle are retained. No lazy mount or session snapshot remains. Home mounts no interactive maps.

## Artwork architecture

After Home's initial schedule, announcement and favorite operations settle, Home loading/refreshing ends, and Home has focus: wait three seconds, then request an idle opportunity (two-second idle timeout; deferred timer fallback). Preload Grounds → yield one second → Tented City → yield one second → Camping. Defer while hidden, offline, saving data, on reported 2G, before document completion, or within one second of a completed foreground resource. Navigation cancels queued work; an already-started image may finish. Shared promises prevent duplicate preload requests.

Use low-priority browser `Image` with the same Expo-exported asset URI used by RN Web, followed by a `decode()` attempt. Retain at most three image objects. No dependency, fetch/blob URL, interactive component import, service-worker cache, asset transformation, or geometry change is introduced.

**Same-resource cache reused: YES. Decode warmed: PARTIAL.** Resource timing records show exactly one transfer per map across preload and six map selections. All three decode attempts complete before first Maps navigation. Chromium also successfully opens all three maps offline in the same document after Home preload. This does not guarantee retained decoded pixels under memory pressure, a fresh offline document, or warmed WebKit compositor tiles. SVG decode completion does not prove all future rasterization work is done.

Representative measured candidate run, milliseconds from navigation: Home usable 685; Grounds preload 3678–3711; Tented City 4711–4774; Camping 5774–5809. No Home divider elements were mounted. All three resources were warm before Maps opened.

## Measurements and decisions

Exact immutable production artifacts served locally versus the production-style candidate, Chromium 390×844, DPR 3. One warm-up and three measured runs per variant; fresh browser contexts, same read-only backend responses, normal HTTP cache retained, Home dwell 11 seconds. No browser regression suites ran concurrently with timing runs. Providers and remote writes were blocked.

The measured map interval starts before the navigation/selector click and ends when the image is complete with intrinsic dimensions; the candidate must also finish its reveal gate. This measures browser/app readiness, not physical screen paint. Local transfer conditions are not production network timings. Three runs provide directional evidence, not a statistical proof; the last comparison pair was noticeably slower in both variants.

| Metric | Production median (ms) | Revised candidate median (ms) |
|---|---:|---:|
| Home usable | 722 | 685 |
| First Grounds | 549 | 456 |
| First Tented City | 87 | 78 |
| First Camping | 106 | 111 |
| Return Grounds | 130 | 129 |
| Return Tented City | 88 | 76 |
| Return Camping | 120 | 127 |

**Tented City performance gate: PASS.** The prior 408/342 ms first/return regression is eliminated. **Grounds: IMPROVED**, about 17% for first access; the prior candidate's much larger improvement is not fully retained because production's hidden Tented City mount still runs. **Camping: SAME within small measurement variation** (5/7 ms differences). **Home: no measured material regression.** Controlled loading UX and the smaller Grounds improvement justify a physical preview.

Individual preload removal used the identical candidate and suppressed only the corresponding low-priority background Image in the browser test. Actual map renderer requests were untouched. Each variant again had one warm-up and three measured runs.

| Variant | First Grounds median | First Camping median |
|---|---:|---:|
| All three preloads | 543 ms | 122 ms |
| Grounds preload disabled | 733 ms | 152 ms |
| Tented City preload disabled | 637 ms | 144 ms |
| Camping preload disabled | 485 ms | 204 ms |

- **Grounds: KEEP.** Removing it added 190 ms to first Grounds access in this comparison.
- **Tented City: KEEP.** Removing it added 94 ms to first Grounds access, where persistent Tented City also mounts. It has useful work to do before Maps opens even though its interactive component stays mounted afterward.
- **Camping: KEEP.** Removing it added 82 ms to first Camping access.

These isolated comparisons support retaining all three in this preview. Absolute values differ between measurement batches; do not subtract values across batches. Raw runs are preserved in `measurements.json` and `ablation.json`; run zero is excluded from medians.

## Loading and failure behavior

All three maps retain a stable viewport with **Loading map…** while their artwork/interactive layer has zero opacity and disabled pointer events. Selector, search, and safe surrounding controls remain available. RN Web's image lifecycle/decode callback plus two animation frames permits reveal: **ARTWORK_READY_FOR_REVEAL**, not a guarantee of complete physical WebKit paint.

Load failure or a 15-second readiness timeout shows a bounded error and **Try again**. Retry remounts only the image. Attempt/generation guards reject callbacks from previous attempts or unmounted maps; cleanup clears timers/frames. SVG decode rejection can fall back to a successfully loaded image. Offline cached artwork can reveal; unavailable artwork shows the error while local search data, including M27, remains usable. No indefinite loading state is intended or observed in the failure suite.

Ontario Government's new test incorrectly expected six DOM highlight elements. Production intentionally combines adjacent lots into one exact union. Both baseline and revised candidate have one rectangle: left 37.754%, top 52.744%, width 4.548%, height 3.947%; cyan `rgba(0,229,255,0.45)` fill, yellow `rgb(255,214,0)` outline, label **3B-19-24**, and zero full-parent fill elements. Only the new test expectation was corrected; canonical geometry and rendering are unchanged.

## Validation

Validation status is recorded in the adjacent logs. Final acceptance gates must be green before commit, push, and draft preview creation.

- Preload and map/vendor/updater/offline source regressions: **223 passing tests**.
- Additional canonical Ontario multi-booth, MNP fallback, map search precision, Camping parity, and Home checks: **49 passing tests**.
- Chromium and WebKit loading suites: delayed load/reveal for all three, failure/retry, persistent Tented City selection/camera, Ontario union, MNP, map switch during load, real 15-second timeout, stale callback rejection, SVG decode rejection, unavailable offline artwork. Chromium additionally verifies all three browser-cached maps offline.
- Core browser checks: Home, Schedule, **224 vendors**, Valard/CAN-AM unavailable messaging, Ontario, MNP, M27, Grounds search, double-tap zoom, drag, Fit, updater Later/no reload, no runtime errors.
- Loading text bounds, selector, usable search, and safe inset at **320/375/390/393/430/360/412** in Chromium and WebKit.
- Chromium full safe-area matrix: those widths plus 1440, iPhone simulated top insets 0/20/44/59; all modes, hit tests, search, Fit, no clipping.
- WebKit browser/standalone safe-area matrix: PASS, 45 cases across all listed widths and applicable 0/20/44/59 top insets.
- Real generated offline shell install/reload and offline M27: PASS (remote provider replaced only in the local test response).
- Real worker/updater integration: legacy→A, explicit Refresh A→B once, under/at ten-minute threshold, same-release no-op, offline B, cold online C, storage/permission retained. Production source unchanged.
- TypeScript: PASS. Production `build:web`: PASS. Final offline preflight: PASS. Generated worker differs from the protected template only in build fingerprints/asset inventory; no map added to precache. All three exported artwork files match source bytes exactly.

No map asset, geometry/data, service-worker logic, updater semantics, WonderPush code, database, production deployment, or staging deployment changed. Build output/cache artifacts remain local and are not included in the feature commit. The old WonderPush workspace is untouched.

## Required physical iPhone check

1. Cold-open the immutable preview.
2. Stay on Home at least six seconds to allow preloading.
3. Open Maps → Grounds; compare speed and loading presentation.
4. Switch to Tented City and confirm fast first selection.
5. Switch to Camping and search M27.
6. Switch repeatedly among all three maps.
7. Check that blank → partial → more painting is not exposed.
8. Cold-open again and open Maps immediately, before preload completes; check the loading fallback.
9. Confirm selector, search, gestures, Fit, and the approved safe area.
10. Compare with production Build 367359. Marc must approve the physical preview before production deployment.
