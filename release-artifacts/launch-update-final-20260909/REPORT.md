# PWA update reliability — final controlled validation blocked

Production was not promoted. No application source was changed in this validation.

## Preserved work

The missing `/tmp/ipm-disk-recovery-20260909/recovery/RESUME-PWA.md` was read directly from recovery commit `4d049da8de24b10af3003155fba5837487d285a1`. GitHub refs were fetched and verified. Production candidate remains `9ea6c7daa54f319a623ec1e0f9de1c88d4241364`. Staging application candidate remains `73e523040e4c755b3aa7f1d99da839e59b0edef0`; its branch contained subsequent evidence-only commit `f8667a893e60bc13a91ccc74d25bca8fe82708ad`.

The correction remains the existing five-second bounded network-first document navigation in `frontend/public/webpushr-sw.js`, which validates and caches startup JS/CSS before replacing cached HTML. It adds no forced reload, update UI, or activation trigger. The production candidate commit changes only this runtime file and two test files. The candidate's exported application JS was compared with live production: only build metadata differs (362242 → 362336). Candidate branches include earlier release history and must never be promoted wholesale over main.

## Real staging lifecycle

Existing deployed artifacts were verified at immutable deployment URLs. A/B/C application JS bytes are identical after normalizing build metadata. The corrected preserved harness uses `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1`, permits the read-only WonderPush SDK/config requests, prohibits subscription writes, and makes no manual `registration.update()` calls. Request/response/failure timestamps were added; application bytes were not instrumented.

| Version | Build | Netlify deployment |
| --- | --- | --- |
| A | 362330 | 6aa172e36307a145eaab4ba8 |
| B | 362335 | 6aa174216307a15981ab4bcb |
| C | 362339 | 6aa174ee87a47f2cf274b3b6 |

A was restored, fresh A clients established, then B and C published with the same browser contexts retained. Staging now serves C. No production deployment was created.

- **A → B: passed all eight scenarios**: browser320, standalone-emulated360, desktop, previously closed, offline/reconnect, slow network, failed startup asset, waiting worker. First clean online launches reached B in 734–2392 ms. Slow fallback retained A in 5415 ms; failed-asset fallback retained A in 429 ms.
- **B → C: incomplete / failed gate.** Browser320, standalone-emulated360, desktop, previously closed and offline/reconnect passed their first online launches, reaching C in 2404–2830 ms. The next slow-network case exceeded the preserved harness's 12000 ms usable-app limit, at **12104 ms**, while correctly retaining cached B. The sequence stopped at that assertion; C's later failed-asset and waiting scenarios were not completed.
- Open clients retained their incumbent entry before deliberate page closure. Completed cases preserved itinerary rendering, favorite IDs, the saved dismissal preference, `/itinerary` deep link, denied/granted browser notification permission, and unsubscribed status. No hard refresh, reinstall, storage clearing or second clean online launch was used for the first-launch assertions.
- Offline launch and reconnect passed in every completed transition case. Reconnect did not replace the running document.

## Exact blocking evidence

`C-slow-fallback.json` records usable B after 12104 ms. The sanitized network trace shows new-worker install requests for `/` and `/index.html` delayed by the injected slow network and then failing. Only after roughly 6.5 seconds did Chromium dispatch the incumbent worker's `/itinerary` fetch; its five-second timeout then returned cached B, which rendered successfully. Thus the application's five-second navigation timer does not bound the preceding browser worker-install/update delay. This is an observed breach of the harness limit, not proof of an infinite hang. The successful cached fallback does not satisfy the complete timing gate.

The earlier preserved report also recorded an unexplained first-online-launch A response after B publication. That did not recur in this run, but its original cause remains unproven. Do not discard that evidence or characterize this run as full reliability proof.

## Independent failure and safety checks

After the transition assertion failed, independent current-C checks passed: injected server 503 retained usable cached C in 374 ms; aborted worker networking retained C in 946 ms; already-current fresh launch took 528 ms. Each remained stable through offline/online recovery and 6.5 seconds of observation, with zero spontaneous navigations and unchanged cache names and saved state.

Failed installation was observed in the C slow case, with incumbent B retained. Waiting-worker behavior passed A → B. A separately controlled worker-script update-check failure and a complete successful activation-race matrix remain unproven. Browser-owned script update checks must not be claimed as intercepted merely because worker fetch interception is enabled. No complete no-registration-storm/no-cache-thrashing certification is claimed for the interrupted sequence; completed samples show no reload loop and the supplemental samples show stable caches.

There was no real enrolled subscription available. The browser fixture explicitly prohibited subscribe/unsubscribe and blocked all non-GET requests, preserving unsubscribed state. Existing enrolled-device/provider preservation remains a physical validation limitation; no production enrollment was manufactured and no provider records were mutated by this work. Standalone mode was emulated in Chromium; page closure and new-page creation within retained contexts represent fresh documents, not a physical OS process termination test.

## Tests and exclusions

33 focused worker, notification lifecycle, deep-link and WonderPush tests passed in this run. The preserved export artifacts were verified instead of rebuilt. Earlier 70-test/type-check/lint evidence remains supporting historical evidence, not a replacement for the failed staging gate.

Final read-only checks: public production HTML and its entry load; production remains build **362242**, deployment **6aa15e88b199e77b4e5fccf7**, published from source identified in its title as **1999c69e89b9fdcb77f0cc6ad81f26aa43eb54ae** (Netlify `commit_ref` is null). Schedule remains **218 events**, contents unchanged. Vendors remain **127**, contents unchanged. Reconciliation remains enabled with **100% eligibility**, backend commit `70e068ab2930bdeddee3c5817477cc97e9ca0b01`.

Production deployment unchanged means its map, interactive map, Home UX, compact notification prompt, Notification Health, what3words and other deployed application assets were not replaced. No fresh production what3words lookup or physical offline test is claimed in this blocked run. No schedule/vendor/database/configuration changes, announcement work, image work or Landa work were performed. **No notification was sent.**

## Remaining physical test

After a correction passes all gates and is promoted, Marc and Jen must test installed iPhone and Android devices on the **next normal production release**, keeping existing installation, itinerary/favorites/preferences and real notification enrollment. Leave the old app open across deployment to confirm it is uninterrupted. Fully terminate it, reopen once online, and verify the new About build and saved/deep-linked state without reinstall, hard refresh, clearing storage or a second launch. Also launch offline and reconnect, verifying usable cached content and unchanged enrollment. Do not create an artificial production release for that test.

PWA UPDATE RELIABILITY BLOCKED
