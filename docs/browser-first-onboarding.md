# Browser-first attendee setup — staging release

## Audit and design

Production was inspected at theipm.ca (served bundle entry-37853976efcd06d37462427866a35bea.js; Netlify deploy 6a9f556915d51b067133a7b2). Staging was inspected at staging.theipm.ca (entry-e8a4c411363b533729e8d9e6296c3a0e.js; deploy 6a9f1763d038dc1a2860b7ef, labelled permanent staging reconciliation 2d1350ad). The isolated release starts from remote staging 2d1350ad15fa4f2a180e836ca742472785471aa2, not the divergent workspace branch.

Both experiences prioritize an automatically shown full-screen installation guide. Its root placement covers first-time deep links. Dismissal expires after five days and a new browser install event can override it. Browser use is described as optional continuation below installation instructions. There is no persistent route back to installation help. iPhone non-Safari copy incorrectly implies other iPhone browsers cannot install. Generic desktop instructions speculate about menu items. The notification card uses a four-hour/twice-daily invitation policy, hides success, and can hide a failed/slow status check with no visible recovery. Small copy and horizontal card controls leave little room on narrow devices. Staging exposes technical diagnostics in attendee setup. Home update activation also lacks an interaction hold.

Design: render normal content immediately; no welcome/install modal, forced redirect, or automatic permission request. On Home, say "Use IPM now" and "You’re already in IPM. Explore below — no download needed." Keep notification status/options separate from an optional Home Screen help control. Both disclosures start closed on every mount, so old dismissals and time elapsed can never cause nagging. Help remains discoverable on Home. Installation dismissal/completion keys are retained for compatibility; no content is gated on storage availability.

## Attendee copy and walkthrough

- Home: **Use IPM now** — **You’re already in IPM. Explore below — no download needed.** The normal navigation and content are immediately usable, including deep-linked pages.
- Notifications: **Get important IPM updates**. **Notification options** opens the explanation: **Notifications are optional. Get important IPM announcements on this device. You can keep using IPM without them.** Only **Enable notifications** invokes existing enrollment. Permission granted alone does not imply provider setup succeeded. Existing setup/read-back states remain authoritative. Success: **Notifications are enabled on this device.** Turning off notifications remains an explicit optional action.
- Blocked permission: no Enable action or repeated permission attempts. Chrome/Edge guidance points to address-bar site controls → Site settings/Permissions. Installed iPhone/iPad guidance points to Settings → Notifications → IPM. Safari Mac guidance points to Settings → Websites → Notifications and system notification settings. **Check notification status again** performs a bounded read, not an automatic subscription request.
- Slow checks: **Notifications are temporarily unavailable. The IPM app will continue to work.** Options expose an explicit status retry. Pending/failed setup retains clear delivery-check/retry messaging. Technical diagnostic services remain intact but their details are not displayed in attendee help.
- Installation help: **Do I need to install IPM?** — **No. You can use IPM directly in your browser. Adding it to your Home Screen makes it quicker to open.** Close: **Close help — keep using IPM**.
- Android Chrome: native browser confirmation when a captured install event exists; otherwise Chrome menu → Add to Home screen/Install app → confirm, only on request. Rejected/dismissed prompts do not reopen help. Installed launches show status instead of an install action.
- iPhone Safari: Share (or More → Share) → Add to Home Screen → Add. Leave Open as Web App enabled when offered. Other iPhone browsers get an optional Safari route for these instructions, not a claim that Safari is the only browser capable of adding a Home Screen app.
- iPhone notifications: where APIs are unavailable in a browser tab, explain that notification support needs iOS/iPadOS 16.4+ and opening IPM from its Home Screen icon. This requirement is for notifications only. Feature availability is determined by the existing SDK service's runtime API checks; an unsupported installed device does not receive an Enable button.
- Desktop: no automatic installation messaging. Optional help uses native confirmation or Chrome/Edge instructions. Other desktop browsers receive bookmark/browser-supported-install guidance instead of a fabricated menu path.
- Returning users, users who denied permission, and users who never install: normal app access, closed help, persistent status/options, no recurring invitations.
- Offline: cached app shell still opens after a successful online visit. Notification status explicitly waits for connectivity; reconnect triggers the existing bounded status lifecycle. A first-ever visit without any network/cache cannot download the app.

Apple reference: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
Apple current guidance: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
Chrome reference: https://developer.chrome.com/blog/mini-infobar-update/

## Safety and architecture

Existing WonderPush SDK, enrollment/registration APIs, subscription reconciliation, capability ownership, database gates, cohort, targeting, notification analytics, and send behavior are unchanged. Opening/closing a disclosure performs no enrollment/provider mutation. Existing normal app initialization and capability-owned lifecycle checks remain active; this release does not substitute an onboarding repair path.

Root captures browser installation events passively, including on deep links; the existing install component supplies the on-demand Home help. No new dependency or parallel wizard. Inline disclosures avoid modal focus traps and small-screen overlays. Help takes keyboard focus and restores it on close. Buttons have >=44px touch targets. No animation is introduced. Update holds are reference-counted/idempotent, protect both pre-activation and post-activation/controller-change races, and release after interaction; offline worker/cache policy remains unchanged.

## Validation

AUTOMATED VERIFIED:
- 136 focused frontend tests: onboarding runtime, platform guidance, notification enrollment/regression, privacy canaries, reconciliation regression, offline worker, icons, and update lifecycle.
- Runtime component matrix uses inert SDK/platform adapters and counts enrollment/install calls. Covers Android/iPhone/desktop/unsupported, installed/denied/enabled, explicit opt-in, dismissal, offline/reconnect, bounded error recovery, and no side effects when expanding help.
- Chromium at 320px (iPhone UA), 360px (Android UA), and 1280px: content access, optional instructions, no horizontal overflow, focus transfer/restoration, reload without nagging, and deep-link preservation.
- Actual generated service-worker shell cached/reloaded offline and opened a deep link offline, then reconnected. Test isolates the provider SDK; no notification is sent or subscription created.
- TypeScript and web build with staging-only environment pass. Full lint: no errors; existing warnings documented in audit artifacts.

Full baseline suite has two pre-existing map failures (tented-city-map.test.mjs and map verify1A expectation); both reproduce on untouched remote staging. No map/test fixes are included. All other frontend tests pass. These do not affect onboarding acceptance.

CODE-PATH VERIFIED: existing SDK permission/subscribe sequence, capability registration, provider setup, disabled/error recovery, install event handling, and notification success state. Backend/provider enrollment behavior is not replaced or exercised against real devices by test automation.

PHYSICAL DEVICE TEST STILL RECOMMENDED: Android Chrome native installation/permission dialog; Safari Add to Home Screen and installed iPhone opt-in; denied-permission settings recovery; returning installed device; VoiceOver/TalkBack. Emulated iPhone UA is not an actual Safari/iPhone test. Do not send a notification as part of this release validation.

## Staging deployment contract

Overlay only rebuilt frontend files onto the current staging deploy manifest. Preserve every unrelated prior asset and the three standalone diagnostic pages. Before upload, assert staging deploy is unchanged since capture, production deploy is unchanged, required public environment points to staging, and no unexpected existing asset differs. Only index.html and generated webpushr-sw.js replace existing bytes; the new hashed JavaScript/assets are additive. No application code deployment to production, database writes, schedule/vendor/map edits, or notification sends.
