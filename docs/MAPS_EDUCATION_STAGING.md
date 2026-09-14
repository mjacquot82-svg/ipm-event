# Maps education — staging review

Based on canonical staging `17cfd9624be0df05feef5ca22bb1e30da22f9098`, Netlify deploy `6aa751eda5e68500085ae6ae`, build `368747`.

Five sequential callouts explain Parking, Tented City, Camping Map, search and Find on Map. A 44px Help button sits in the active map's existing search row. Displaying or replaying education never selects a map or layer. If Maps is first opened via a Tented City/Camping deep link, the Parking step explains “On Grounds…” and anchors to Grounds without changing the requested destination.

Schedule and Vendor tips wrap the existing action. Schedule uses the same plowing normalization and existing trusted map resolvers; Vendors require both a mapped crosswalk and trusted geometry. No location data or routing handlers changed. A shared display lease allows only one education callout at a time; the Schedule tip also waits for the existing introduction. Vendor cards must be visible before they can claim the tip.

Independent AsyncStorage keys:

- `@ipm_maps_tour_seen_v1`
- `@ipm_schedule_find_on_map_tip_seen_v1`
- `@ipm_vendor_find_on_map_tip_seen_v1`

Skip, Got it and Escape persist dismissal. Help changes none of the other flags. No animation is used. Keyboard focus is contained in the callout and restored on dismissal. Escape is consumed on keyup before React Native Web's parent event-detail modal sees it.

## Verification

Run `node --test frontend/tests/map-education.test.mjs` and the existing `frontend/tests/*.test.mjs` suite. Run TypeScript with `frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json`, then the normal staging-configured `npm run build:web` in `frontend`.

For built-shell browser tests, install Playwright and set `IPM_PLAYWRIGHT_MODULE` to its module path. Start `node frontend/tests/map-education-server.cjs`. Its default URL is `http://127.0.0.1:8870`; `IPM_PREVIEW_URL` can override the browser target. Run:

- `map-education.browser.cjs`: first visit, all steps/anchors, all 15 widths, unchanged active map/layer, completion/Skip/replay, independent keys, close/reopen, Escape/Tab/focus and reduced motion.
- `map-education-context.browser.cjs`: mapped/unmapped eligibility, once-only flags, actual destination highlights, and Schedule-introduction sequencing. The Schedule fixture contains two real staging events used only in tests; `IPM_SCHEDULE_SNAPSHOT` can select a larger read-only snapshot.
- `map-education-safe-area.browser.cjs`: Chromium and WebKit at all 15 requested widths, all steps, simulated 59px top/34px bottom phone insets, short phone, Help/Fit/selector hit areas.
- `map-education-offline.browser.cjs`: local server only; generated offline shell, offline reload, persisted state, offline replay and Camping/M27.
- `map-education-itinerary.browser.cjs`: add/remove favourite and Personal Itinerary after dismissing a contextual tip.

Browser tests block all external writes and notification providers. The local server substitutes a no-op provider only in the served service worker response; it does not modify the generated worker file. Physical iPhone review remains Marc's staging acceptance step.

The broad staging-base suite has three pre-existing failures: two admin/vendor proxy expectations in `admin-auth-network.test.mjs` and one obsolete build-comment expectation in `subscription-reconciliation.test.mjs`. All three reproduce on an archive of the exact base SHA. No tests or unrelated runtime configuration were weakened to address them.

Production/main, databases, notification code, service-worker source/generator, map geometry, POIs, traffic definitions and runtime Schedule/Vendor data remain unchanged.
