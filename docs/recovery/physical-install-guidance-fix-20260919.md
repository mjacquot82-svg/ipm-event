# Physical first-visit installation investigation — 19 September 2026

## Published baseline and evidence limits

Before source changes, Netlify's actual published staging deployment was verified as `6aaec82935928e0008208a7c`, SHA `b11bc0c58ed4faa00c9f2389866aea3bddceee04`, Build **376897**. The public HTML loaded `entry-6bf62da3ffde1fb14a01d04e1367191d.js`; it contains Home's automatic component mount and installation-preference decision logic.

Marc reported a fresh private phone visit with no guide. The exact phone/browser/URL was requested; no device-level suppression evidence was available when this report was written. **Do not equate the reproduced storage failure with a proven diagnosis of Marc's particular phone.**

Read-only browser reproduction against that published bundle, with a fresh mobile/touch context and no overridden installed/native-install detection:

| Entry / condition | Home loaded | Native event | Guide |
|---|---|---|---|
| `/`, empty installation preferences | Yes | Absent | Visible |
| `/(tabs)` (normalizes to `/`) | Yes | Absent | Visible |
| `/(tabs)/` (normalizes to `/`) | Yes | Absent | Visible |
| `/`, installation-preference reads throw `SecurityError` | Yes | Absent | **Absent** |

API writes and provider requests were blocked. The reads allowed for this reproduction were staging Schedule/Announcements and public frontend assets.

## Complete suppression trace

| Condition | Build 376897 behavior | Correction / retained behavior |
|---|---|---|
| Platform.OS is not web | No component | Retained; browser builds use web, independent of Android/iOS UA |
| Home route pathname is not `/` | Automatic component not mounted | Retained to preserve deep links and tutorial precedence; normal Home aliases were reproduced |
| Router not yet rendering Home | No automatic component yet | Mounted when Home route renders; no API response or native-install event is required |
| `display-mode: standalone` or `minimal-ui` | Suppressed | Retained |
| `navigator.standalone === true` | Suppressed | Retained |
| `appinstalled` event in current document | Suppressed through `ipmInstalledThisSession` | Retained |
| `pwa_install_installed === 'true'` | Suppressed based on historical stored installation evidence | Retained where readable |
| `pwa_install_entry_completed === 'true'` | Suppressed | Retained where readable |
| Valid positive numeric `pwa_install_dismissed_at` | Suppressed indefinitely | Retained; no timed reminder |
| Any one of those preference reads rejects | Entire Promise.all rejects; empty catch leaves visibility false | **Fixed:** independently read each key; an unreadable preference is unknown, not proof of dismissal. Other readable choices remain authoritative |
| Dismissal in current component instance | Suppressed | Retained, plus page-lifetime and session-storage fallback for unavailable persistent storage |
| Accepted native installation choice | Closes guide and saves completion | Retained, plus session fallback |
| Native `beforeinstallprompt` absent | Selects manual instructions; not a visibility veto | Retained and explicitly regression-tested |
| Browser/platform unrecognized | Selects generic instructions; not a visibility veto | Retained; mobile ambiguous-UA case tested |
| Cookies | Not consulted | Not consulted; no cookies added |
| sessionStorage | Not consulted | New `pwa_install_session_dismissed` fallback, set only following dismissal/accepted install; absence or access error does not suppress fresh guidance |
| Service worker, notification permission, installability criteria | Not consulted by automatic eligibility | Unchanged |
| Schedule/Vendor/Map tutorial completion | Not consulted | Unchanged; automatic guide only on Home |
| Staging flags / preview query parameters | No install eligibility gate | Unchanged; no forced-preview bypass added |
| Re-evaluation race/unmount | Generation check discards stale async reads | Retained; re-check current installed and dismissal state before opening |

A private context is not inherently incapable of storage. [MDN documents private Web Storage lifetime and access errors](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage); browser policy may restrict access, but this is not proof that Marc's browser did so. [Native install events have limited availability](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event); educational instructions do not depend on them.

## Why the earlier checks passed

The normal fresh browser cases already had no native install event and did show guidance. Critically, the earlier blocked-storage regression **expected no guide** and thus blessed the suppression defect. It also overrode display-mode detection for every normal case and did not enable mobile/touch context flags. The revised tests use actual display-mode detection in ordinary cases, enable mobile/touch contexts, and require manual guidance when preference access fails.

The component test harness's AsyncStorage adapter also lacked its ES-module marker, masking preference reads. Corrected the adapter and added an actual partial-read regression: failure reading the installed key must not erase a readable completion flag.

## Fix and persistence limits

No audience, registration, notification, tutorial, route, backend, worker or attendee data change. Each existing preference is read independently. Education appears if there is no positive installed/dismissed/completed evidence, even when preference storage is unavailable. Dismissal remains persistent under normal storage. Session storage provides reload persistence if persistent storage is blocked; a module-local flag prevents repeat prompts across app navigation if both storage types are blocked. A full reload with **all** storage inaccessible cannot reliably remember a prior choice; no cookies or attendee-data resets are used to work around browser policy.

## Validation and physical gate

92 focused install/PWA/offline/update/tutorial tests pass. Production-style build passes. TypeScript retains the pre-existing `itinerary.tsx:225` TS2367 only. Browser results and exact published deployment are preserved under `.artifacts/install-physical-fix/` after verification.

Marc's physical result remains authoritative. The next test is one fresh private/incognito session opening staging Home; guidance should appear without clearing app data or uninstalling anything. No physical pass is claimed from browser automation.
