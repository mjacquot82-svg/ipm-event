> Follow-up: Marc reported a physical failure on Build 376897. See [the suppression investigation](physical-install-guidance-fix-20260919.md); the original storage-failure suppression policy below is superseded.

# Device-aware install guidance recovery — 19 September 2026

## Historical evidence

- `b6b586c9` (21 August): device-aware `PWAInstallPrompt.tsx` and `installEnvironment.ts`. Broad browser/platform detection, iPad desktop-style user agent plus touch support, captured `beforeinstallprompt`, browser-menu instructions, iOS Share/Home Screen instructions, installed display mode and `navigator.standalone`. Not exact phone model/version detection.
- The former root-level automatic guide used a five-day dismissal cooldown; a newer browser install event could override dismissal. A separate historical context-aware variant (`90571b73`) used an ordinary-root-entry gateway and persisted `pwa_install_entry_completed`, preserving deep links. That variant is historical evidence, not code restored wholesale.
- `f166fb3d0e1e05abb4674884218d02ba1c2bd784` (8 September, staging) intentionally removed automatic installation presentation under the browser-first policy. Its production promotion is `ed42fa1186c0acfbfacd47474bcd33c13addcc4c`. Detection and native event capture remained, but instructions opened only on an explicit action.
- `51cf73ab` (9 September) removed Home's installation disclosure and put it inside collapsed **About → App help**.

**Proven cause:** launch-policy and navigation changes. The guidance was not deleted; automatic entry was removed and replay became harder to discover. No evidence requires a caching explanation.

## Restored behavior

Reuses the existing component, detection, instructions and root event capture. A focused Home screen offers one optional modal to a browser visitor without an existing install/dismissal/completion preference. It does not interrupt direct Schedule, Vendors, Maps or announcement links. Those contextual tutorials keep their own content, state and progression. Leaving Home unmounts automatic installation guidance.

Dismissal is remembered indefinitely; no timed reminder is restored. Any valid historical dismissal, historical entry completion, or installed preference suppresses automatic presentation. Storage-read failure fails open to website use. About exposes **Install App** directly, outside the collapsed App help section. Manual help uses the same instructions after dismissal.

Installed `standalone`, `minimal-ui`, iOS standalone, and a current-session `appinstalled` event suppress presentation. An arbitrary `android-app://` referrer is no longer treated as proof of installation. A normal browser cannot reliably prove a separately installed copy exists; stored install evidence is respected where available.

Native install confirmation runs only from **Install App** when the browser supplies `beforeinstallprompt`. Otherwise Android Chrome uses its menu/Home Screen instructions; iPhone/iPad Safari uses Share → Add to Home Screen → Add. Other iOS browsers are offered a Safari route without claiming they cannot install. Embedded Android browsers get generic instructions. No exact device model claim is made.

The modal has a visible Close action, optional website continuation, Escape/back dismissal, safe-area padding, constrained scrolling, focus containment through the existing React Native Modal, and no animation. It holds existing PWA update activation during interaction. No favorites, itinerary, notification registration/permission, service worker, backend or T-30 code changes.

## Reference checks

- [Apple: open a website as an app](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/27/ios/27)
- [Chrome: install web apps](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en-CO)
- [MDN: beforeinstallprompt availability and user interaction](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event)

## Validation

Focused install/PWA/offline/update/tutorial tests: 89 passed. Production-style frontend build passed. TypeScript reports the unchanged pre-existing `app/(tabs)/itinerary.tsx:225` TS2367; no new diagnostic. Browser installation matrix passed at 320×568, 390px, 393px, 768px and 1440px, including native-event accepted/dismissed paths, existing choices, storage failure, installed modes, Home-to-section navigation and direct deep links. The existing complete first-visit/replay walkthrough suite passed at 320/768/1440px; all 10 Home/notification-permission scenarios passed. Staging deployment evidence is recorded with the final verification artifacts.

Browser tests block API writes and external/provider requests, and preserve sentinel favorites/notification preferences. They emulate OS/browser capabilities; they do not prove an actual Safari/Android operating-system installation. Marc's physical staging review remains required.

## Physical review

1. Open staging Home in a fresh private browser session: review the optional installation guide, then continue to the website. Reload: it should not repeat in that session.
2. About → Install App reopens instructions without clearing existing attendee data.
3. Launch the installed staging app: no automatic installation guide. Visit Schedule/Vendors/Maps: their tutorials remain separate.
4. On actual Android Chrome, use Install App if offered; on iPhone Safari, follow Share/Home Screen instructions. No notification test is required.
