# Production resume updater reconciliation — preparation only

## Verified baseline

Live production/main: e93ead504d8734a0b35abce97bce59a36988d572.
Published deploy: 6aa5b1c9cc9a8300082e8643.
Entry: entry-807513d53ca80701e29eaef2fe6e2f0c.js.
The candidate is a direct child of this live tree; no staging history is merged.
Physically approved updater: cdc6ed64aef138ee8c365103904bd11b005e9048. Marker-only 9056d628 is excluded.

## Extraction and compatibility

The updater web/native services and prompt are byte-identical to the physically approved source. Root layout ports only initialization, Home safety gating and prompt rendering. PWAInstallPrompt and NotificationOptIn gain only the tested updater holds; removing those lines yields the exact production source. The production generator receives only the five-line entry-manifest output block. No staging template-hash change, AppStatus, A/B marker, diagnostic, backend, schedule, map, vendor, package or environment change is included.

Runtime files:
- frontend/app/_layout.tsx
- frontend/src/services/pwaUpdateService.ts
- frontend/src/services/pwaUpdateService.web.ts
- frontend/src/components/PWAUpdatePrompt.tsx
- frontend/src/components/PWAInstallPrompt.tsx
- frontend/src/components/NotificationOptIn.tsx
- frontend/scripts/generate-offline-worker.js
- frontend/public/webpushr-sw.js

Tests: pwa-auto-update.test.mjs, pwa-resume.browser.cjs, pwa-production-compatibility.test.mjs, offline-service-worker.test.mjs and online-launch.test.mjs. The production compatibility suite checks exact WonderPush code, hold-only UI changes, immutable currentLaunch and cache migration/activation overlap.

## Worker source changes

1. Shared current-v1 last-known-good shell and complete-shell migration during install. This is the exact cache policy present during the accepted staging A/B test. It replaces production's per-version cache installation so activation does not delete a concurrent navigation's shell. Trigger: normal installation of the candidate worker. It does not invoke skipWaiting or force activation; ordinary browser activation when old clients close remains possible. WonderPush impact: none. currentLaunch body is unchanged; its cache remains stable through activation. Migration skips incomplete prior shells and leaves non-IPM caches untouched.
2. Conditional IPM_ACTIVATE_UPDATE message handler invoking skipWaiting via waitUntil. Trigger: the existing updater sends this only after explicit Refresh, revalidation and safe-state checks. No other message invokes activation. No global skipWaiting, new worker registration, push or notificationclick handler. Normal browser lifecycle activation remains unchanged.

The unchanged activate listener still calls clients.claim and removes obsolete IPM shell caches. The changed cache identifier keeps the shared shell through that operation. No additional clients.claim call is introduced.

## Exact WonderPush before/after proof

The worker bootstrap prefix (including import URL, query webKey extraction and WonderPush init) is byte-identical to live. wonderPushService native/web, notificationRegistration.web, subscriptionReconciliation.web and notificationDeepLink.web are byte-identical. No push or notificationclick listener is introduced. Permission and subscription APIs and installation storage code are unchanged. NotificationOptIn diff consists solely of updater holds around existing operations. Provider configuration was not read for modification or changed; production public build variables were reused without alteration.

## Tests and interpretation

247 focused tests passed, including updater/offline/cold launch, production migration, vendor/catalog/unmapped state, MNP, multi-booth, all three maps and gestures, and schedule-to-map navigation. TypeScript passed. The real Chromium worker fixture starts with the exact production worker (provider loader stubbed locally), bootstraps into the candidate and performs an explicit A/B update once, retains storage/permission, resumes offline, and cold-loads a newer shell online with no runtime errors. Provider-side delivery or installation continuity is not retested by contacting WonderPush. The user has separately accepted the physical Android flow on staging.

## Rollback readiness — do not execute during preparation

The exact current production deploy above was verified ready and still published in Netlify. Emergency republish method, if a future authorized release needs rollback:
POST /api/v1/sites/c64b53c9-5b39-441c-910a-dc00db77b4a5/deploys/6aa5b1c9cc9a8300082e8643/restore
Then verify the published deploy and original entry on https://theipm.ca. This is the current map/vendor plus unmapped UX baseline, not the older pre-map release. The endpoint has been used successfully for exact-deploy restoration in this project; no production restore is executed here.

## Future production verification — not executed

Bootstrap: old already-running pages have no updater JS. After a separately approved production deployment, one genuine close/reopen/navigation obtains the updater generation. Do not interpret this cold launch as a resume-update test. No announcement is published now.
Long-term: retain that updater-capable generation, save itinerary/favourites, background without closing for >=10 minutes, then deploy a separately approved next generation. Foreground the retained page, choose Refresh, verify one reload, saved state and the new entry/build. A tiny changed entry manifest detects the release without any visible A/B marker. Do not add test-only production text or deploy an unapproved B to manufacture the test.

## Exact worker diff against live

```diff
diff --git a/frontend/public/webpushr-sw.js b/frontend/public/webpushr-sw.js
index 72c36e81..4762f42e 100644
--- a/frontend/public/webpushr-sw.js
+++ b/frontend/public/webpushr-sw.js
@@ -14,10 +14,41 @@ try {
 const IPM_OFFLINE_VERSION = 'development';
 const IPM_SHELL_ASSETS = ['/', '/index.html', '/manifest.json'];
 const IPM_CACHE_PREFIX = 'ipm-offline-shell-';
-const IPM_SHELL_CACHE = `${IPM_CACHE_PREFIX}${IPM_OFFLINE_VERSION}`;
+// Navigation and installation share a last-known-good shell across worker
+// versions. Activation must not delete a concurrent navigation's cached result.
+const IPM_SHELL_CACHE = `${IPM_CACHE_PREFIX}current-v1`;
 
 self.addEventListener('install', (event) => {
-  event.waitUntil(caches.open(IPM_SHELL_CACHE).then((cache) => cache.addAll(IPM_SHELL_ASSETS)));
+  event.waitUntil((async () => {
+    const cache = await caches.open(IPM_SHELL_CACHE);
+    const current = await cache.match('/index.html');
+    if (current) {
+      const entry = (await current.text()).match(/src=["'](\/_expo\/static\/js\/web\/entry-[^"']+\.js)["']/)?.[1];
+      if (entry && await cache.match(entry)) return;
+    }
+    // An upgrade must not hold the next navigation behind a network precache.
+    // Carry forward a complete usable shell; fresh navigation already validates
+    // and caches the current deployment before returning its HTML.
+    const keys = (await caches.keys()).filter((key) =>
+      key.startsWith(IPM_CACHE_PREFIX) && key !== IPM_SHELL_CACHE).reverse();
+    for (const key of keys) {
+      const previous = await caches.open(key);
+      const document = await previous.match('/index.html');
+      if (!document) continue;
+      const html = await document.clone().text();
+      const entry = html.match(/src=["'](\/_expo\/static\/js\/web\/entry-[^"']+\.js)["']/)?.[1];
+      if (!entry || !await previous.match(entry)) continue;
+      for (const request of await previous.keys()) {
+        const path = new URL(request.url).pathname;
+        // Do not accumulate obsolete entry bundles across repeated upgrades.
+        if (/^\/_expo\/static\/js\/web\/entry-/.test(path) && path !== entry) continue;
+        await cache.put(request, await previous.match(request));
+      }
+      return;
+    }
+    // First installation has no last-known-good shell to inherit.
+    await cache.addAll(IPM_SHELL_ASSETS);
+  })());
 });
 
 self.addEventListener('activate', (event) => {
@@ -97,3 +128,8 @@ self.addEventListener('fetch', (event) => {
       .then((cached) => cached || fetch(request)));
   }
 });
+
+// Activation is requested only after an attendee explicitly chooses Refresh.
+self.addEventListener('message', (event) => {
+  if (event.data?.type === 'IPM_ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
+});
```
