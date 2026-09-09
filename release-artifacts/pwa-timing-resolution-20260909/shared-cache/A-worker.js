try {
  const webKey = new URL(self.location.href).searchParams.get('webKey');
  if (!webKey) throw new Error('Missing WonderPush Web Key');

  importScripts('https://cdn.by.wonderpush.com/sdk/1.1/wonderpush-loader.min.js');
  self.WonderPush = self.WonderPush || [];
  self.WonderPush.push(['init', { webKey }]);
} catch (error) {
  console.error('WonderPush service worker initialization failed:', error);
}

// Generated after the Expo export. WonderPush remains the sole root-scope
// service worker; these handlers only add application-shell offline behavior.
const IPM_OFFLINE_VERSION = '9a23ff5575d0a8d8';
const IPM_SHELL_ASSETS = [
  "/",
  "/_expo/static/js/web/entry-40efbaa8399049d7a310627fee215c2e.js",
  "/assets/___frontend/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ca4b48e04dc1ce10bfbddb262c8b835f.ttf",
  "/assets/___frontend/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.6e435534bd35da5fef04168860a9b8fa.ttf",
  "/assets/assets/images/event-map.94b882b9f1d40ea20cf0ebe5c54e825a.png",
  "/assets/assets/images/field.154a1ca0924b6977588741956792d1cb.png",
  "/assets/assets/images/gemini4.ef396f07f7d3372a80f044580e02ba94.png",
  "/assets/assets/images/ipm-logo.b1a4d05af46b7d0f64d746577b425f0c.png",
  "/index.html",
  "/ipm-icon-any-192.png",
  "/ipm-icon-any-512.png",
  "/ipm-icon-maskable-192.png",
  "/ipm-icon-maskable-512.png",
  "/manifest.json",
  "/v2-icon.png"
];
const IPM_CACHE_PREFIX = 'ipm-offline-shell-';
// Navigation and installation share a last-known-good shell across worker
// versions. Activation must not delete a concurrent navigation's cached result.
const IPM_SHELL_CACHE = `${IPM_CACHE_PREFIX}current-v1`;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(IPM_SHELL_CACHE);
    const current = await cache.match('/index.html');
    if (current) {
      const entry = (await current.text()).match(/src=["'](\/_expo\/static\/js\/web\/entry-[^"']+\.js)["']/)?.[1];
      if (entry && await cache.match(entry)) return;
    }
    // An upgrade must not hold the next navigation behind a network precache.
    // Carry forward a complete usable shell; fresh navigation already validates
    // and caches the current deployment before returning its HTML.
    const keys = (await caches.keys()).filter((key) =>
      key.startsWith(IPM_CACHE_PREFIX) && key !== IPM_SHELL_CACHE).reverse();
    for (const key of keys) {
      const previous = await caches.open(key);
      const document = await previous.match('/index.html');
      if (!document) continue;
      const html = await document.clone().text();
      const entry = html.match(/src=["'](\/_expo\/static\/js\/web\/entry-[^"']+\.js)["']/)?.[1];
      if (!entry || !await previous.match(entry)) continue;
      for (const request of await previous.keys()) {
        const path = new URL(request.url).pathname;
        // Do not accumulate obsolete entry bundles across repeated upgrades.
        if (/^\/_expo\/static\/js\/web\/entry-/.test(path) && path !== entry) continue;
        await cache.put(request, await previous.match(request));
      }
      return;
    }
    // First installation has no last-known-good shell to inherit.
    await cache.addAll(IPM_SHELL_ASSETS);
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(IPM_CACHE_PREFIX) && key !== IPM_SHELL_CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

// Only real document navigations enter this path. An open app is never reloaded.
// Validate and cache the startup assets before replacing the usable offline HTML.
const IPM_LAUNCH_TIMEOUT_MS = 5000;

async function currentLaunch(request) {
  const cache = await caches.open(IPM_SHELL_CACHE);
  const controller = new AbortController();
  let timer;
  const network = (async () => {
    const response = await fetch(request, { cache: 'no-store', signal: controller.signal });
    if (!response.ok || response.redirected || !response.headers.get('content-type')?.includes('text/html')) {
      throw new Error('Application document unavailable');
    }
    const html = await response.clone().text();
    const startup = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi)]
      .map((match) => new URL(match[1], self.location.origin))
      .filter((url) => url.origin === self.location.origin
        && url.pathname.startsWith('/_expo/static/') && /\.(js|css)$/.test(url.pathname));
    if (!startup.some((url) => /\/entry-[^/]+\.js$/.test(url.pathname))) {
      throw new Error('Application startup script missing');
    }
    await Promise.all(startup.map(async (url) => {
      if (await cache.match(url.href)) return;
      const asset = await fetch(url.href, { cache: 'no-store', signal: controller.signal });
      const type = asset.headers.get('content-type') || '';
      if (!asset.ok || asset.redirected || !/(?:javascript|text\/css)/i.test(type)) {
        throw new Error('Application startup asset unavailable');
      }
      await cache.put(url.href, asset);
    }));
    if (controller.signal.aborted) throw new Error('Application launch timed out');
    await cache.put('/index.html', response.clone());
    return response;
  })();
  try {
    return await Promise.race([network, new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('Application launch timed out'));
      }, IPM_LAUNCH_TIMEOUT_MS);
    })]);
  } catch (error) {
    controller.abort();
    const cached = await cache.match('/index.html');
    if (cached) return cached;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(currentLaunch(request));
    return;
  }

  if (IPM_SHELL_ASSETS.includes(url.pathname) || url.pathname.startsWith('/_expo/static/')) {
    event.respondWith(caches.match(request, { ignoreSearch: true })
      .then((cached) => cached || fetch(request)));
  }
});
