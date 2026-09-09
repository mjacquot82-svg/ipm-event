# PWA startup timing correction — production remains blocked

Resumed `b4df82f0`; did not restart the feature or change the acceptance threshold. Source correction is committed and pushed on `fix/launch-update-staging-20260909`: `1fadda71`, followed by the necessary activation-race correction `9ef1968f0650dd5b3235f066a5c7efddf43cb652`. Production candidate `9ea6c7da` was not changed or promoted.

## Correction and timing boundary

The original 12.104-second B → C result combined approximately 6.5 seconds of upgrade installation network precaching with the subsequent five-second navigation timeout. The timer in `currentLaunch()` could not bound the preceding installation work.

The final correction changes only the worker, its generator and focused tests:

- Upgrade installation reuses a complete last-known-good shell instead of waiting for network precaching. First installation, where no known-good cache exists, retains its existing precache behavior.
- Worker versions share `ipm-offline-shell-current-v1`. This prevents activation from deleting the result of a navigation that completed concurrently in the previous worker. Legacy versioned caches migrate only when their HTML and referenced entry bundle are present.
- The generator includes the worker template in its identity digest, so lifecycle-source changes receive distinct worker identities.
- Fresh navigation retains the existing validate-JS-before-HTML-commit behavior and five-second network decision. No update UI, reload trigger, registration calls, provider calls or session interruption logic was added.

An initial attempt copied the old shell into a new version-specific cache. Real testing exposed loss of a concurrent navigation's cached result during activation. That attempt was superseded by the shared cache and is retained under `initial-copy/`.

All attendee-visible measurements start immediately before fresh document navigation (`page.goto`) and end when the saved itinerary removal control is visible. They include browser worker update/install time and application rendering, rather than starting at the worker's internal fetch phase. The original **12000 ms** acceptance limit was retained; slow cases additionally required **less than 8000 ms**. These are measured end-to-end bounds, not a claim that worker JavaScript can impose a timer before the browser dispatches its events. Physical OS launch time remains outside these Chromium measurements.

## Results

| Case | Result |
| --- | --- |
| Independent real A → B → C slow lifecycle | Passed both transitions using the same retained context. B → C cached B usable in **7049 ms**. First clean online relaunch reached C; subsequent offline/reconnect checks passed. See `repeat/slow-real/`. |
| Worker check HTTP 503 | Passed through a localhost proxy serving the exact staged bytes. Real browser worker-script requests reached the server and received 503; application remained usable. No manual `registration.update()` was used. |
| Worker check delayed 20 seconds | App became usable in **996 ms** while the failed worker check remained pending. Recovery and cached launches passed in this proxy run. |
| Deliberate activation/update overlap | Passed: navigation started at 1788993045.777 while the actual worker script request was held from 1788993045.633 to 1788993047.634. App usable in **482 ms**, subsequent offline launch **360 ms**. |
| Registration/cache loops | Four repeated current-version proxy launches retained exactly one registration and one shared cache, with unchanged cache request lists, at most one application `register()` and two `update()` calls per observed launch. No spontaneous navigation during the final seven-second observation. Wrappers observed normal application calls; they did not initiate updates. |
| Slow document and unavailable server | Proxy slow fallback **5341 ms**; server-503 fallback **399 ms**. |
| Complete real staging matrix | **Not passed.** First shared-cache run passed all eight A → B cases, then C's first browser320 online launch reached C in **819 ms**, but its immediately following offline navigation exceeded **30000 ms**. No navigation response was recorded after its worker request. See `shared-cache/transitions.log`, `C-browser320-fresh.json`, and trace. |
| Repeated real staging matrix | Five A → B cases passed. Slow fallback succeeded, but its next uninjected online request received no network response before the five-second abort and safely retained A in **5305 ms**, failing the harness's expected-B assertion. Diagnostics show the active corrected worker and retained shared cache. This is consistent with safe fallback on an unresponsive network; it is not proof that a successfully received B response was ignored. The full matrix stopped and did not clear the gate. |

**Exact remaining blocker:** the real-browser immediate offline navigation timeout after the successful C online launch is unresolved. The shared cache and controlled proxy tests do not explain that failure. Browser/worker dispatch, in-flight registration and worker-network fault-injection behavior need to be distinguished before attributing it to application code or certifying it as safe. Do not promote based only on the successful independent slow client or proxy results.

## State and notification safety

Completed cases preserved the rendered fixture itinerary, favorite IDs, saved dismissal preference, `/itinerary` deep link, denied/granted browser notification permission and unsubscribed state. Contexts were retained; no reinstall, storage clearing, hard refresh or extra clean launch was used to satisfy first-launch assertions. Already-open clients retained their original document before deliberate closure, without deployment-triggered reloads.

The fixture prohibited subscribe/unsubscribe and blocked non-GET traffic. No real enrolled subscription was manufactured or intentionally changed. Existing WonderPush import/init and provider behavior were not changed by this correction. Existing enrolled-device preservation remains a physical-test limitation. No notification was sent.

## Tests and deployments

40 focused worker, activation-race, notification-lifecycle, deep-link and WonderPush tests passed. Targeted ESLint passed with the appropriate worker/Node globals, with one warning for the retained generated worker identity constant. Initial generic lint lacked `importScripts`/`__dirname` environment declarations; both logs are retained. No TypeScript/application UI source changed. The worker artifacts were generated against retained real build assets; Netlify file-manifest comparison verified **only `/webpushr-sw.js` differs** from each original A/B/C deployment.

| Corrected staging build | Deployment |
| --- | --- |
| A = 362330 | 6aa1dc6170fa174c8b3382fd |
| B = 362335 | 6aa1dc634254d82f13c66c94 |
| C = 362339, currently published | 6aa1dc6505ffe0c83c6ec61d |

Production promotion: **NO**. Production remains build **362242**, deployment **6aa15e88b199e77b4e5fccf7**, with its unchanged published source title identifying `1999c69e89b9fdcb77f0cc6ad81f26aa43eb54ae`. No production deployment was created.

Final read-only verification confirms **218 schedule events**, unchanged contents; **127 vendors**, unchanged contents; reconciliation enabled at **100% eligibility**, unchanged backend commit `70e068ab2930bdeddee3c5817477cc97e9ca0b01`. Production deployment and application assets are unchanged, including Home, notification prompt, maps, interactive Tented City map, what3words and Notification Health. No reconciliation, provider-record, announcement, Landa, configuration or production data writes were made. No new production what3words lookup or physical phone/offline test is claimed.

## Remaining physical phone test

After all automated gates pass and the correction is promoted, Marc/Jen should use their existing installed iPhone and Android apps on the next normal production release. Confirm an open app remains uninterrupted; fully terminate and reopen once online; verify the new build, saved itinerary/favorites/preferences, deep link, permission and real enrollment. Verify offline launch and reconnect too. No reinstall, storage clearing, hard refresh, second launch or artificial production release should be used for that test.

PWA UPDATE RELIABILITY BLOCKED
