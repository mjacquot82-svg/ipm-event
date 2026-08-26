const IPM_WORKER_BOOT_STARTED = Date.now();
const IPM_WONDERPUSH_IMPORT_STARTED = Date.now();
let IPM_WONDERPUSH_IMPORT_FINISHED = null;
let IPM_LAST_NAVIGATION_DIAGNOSTIC = null;

try {
  const webKey = new URL(self.location.href).searchParams.get('webKey');
  if (!webKey) throw new Error('Missing WonderPush Web Key');

  importScripts('https://cdn.by.wonderpush.com/sdk/1.1/wonderpush-loader.min.js');
  self.WonderPush = self.WonderPush || [];
  self.WonderPush.push(['init', { webKey }]);
} catch (error) {
  console.error('WonderPush service worker initialization failed:', error);
} finally {
  IPM_WONDERPUSH_IMPORT_FINISHED = Date.now();
}

// Generated after the Expo export. WonderPush remains the sole root-scope
// service worker; these handlers only add application-shell offline behavior.
const IPM_OFFLINE_VERSION = 'development';
const IPM_SHELL_ASSETS = ['/', '/index.html', '/manifest.json'];
const IPM_CACHE_PREFIX = 'ipm-offline-shell-';
const IPM_SHELL_CACHE = `${IPM_CACHE_PREFIX}${IPM_OFFLINE_VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(IPM_SHELL_CACHE).then((cache) => cache.addAll(IPM_SHELL_ASSETS)));
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

self.addEventListener('message', (event) => {
  if (event.data?.type === 'IPM_GET_OFFLINE_STATUS') {
    event.ports?.[0]?.postMessage({
      shellVersion: IPM_OFFLINE_VERSION,
      workerBootStarted: IPM_WORKER_BOOT_STARTED,
      wonderPushImportStarted: IPM_WONDERPUSH_IMPORT_STARTED,
      wonderPushImportFinished: IPM_WONDERPUSH_IMPORT_FINISHED,
      lastNavigation: IPM_LAST_NAVIGATION_DIAGNOSTIC,
    });
  } else if (event.data?.type === 'IPM_ACTIVATE_WAITING_UPDATE') {
    // Only an explicit attendee action may advance a fully installed waiting worker.
    void self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    const receivedAt = Date.now();
    const navigationResponse = (async () => {
      const cache = await caches.open(IPM_SHELL_CACHE);
      const cached = await cache.match('/index.html');
      const selectedAt = Date.now();
      IPM_LAST_NAVIGATION_DIAGNOSTIC = {
        receivedAt,
        selectedAt,
        respondedAt: Date.now(),
        strategy: cached ? 'versioned-cache-first' : 'network-cache-miss',
        cacheHit: Boolean(cached),
      };
      if (cached) return cached;
      return fetch(request);
    })();
    event.respondWith(navigationResponse);
    event.waitUntil((async () => {
      await navigationResponse.catch(() => undefined);
      const clientId = event.resultingClientId;
      if (!clientId || !IPM_LAST_NAVIGATION_DIAGNOSTIC) return;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const client = await self.clients.get(clientId);
        if (client) {
          client.postMessage({
            type: 'IPM_STARTUP_NAVIGATION_TIMING',
            workerBootStarted: IPM_WORKER_BOOT_STARTED,
            wonderPushImportStarted: IPM_WONDERPUSH_IMPORT_STARTED,
            wonderPushImportFinished: IPM_WONDERPUSH_IMPORT_FINISHED,
            navigation: IPM_LAST_NAVIGATION_DIAGNOSTIC,
          });
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    })());
    return;
  }

  if (IPM_SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(request, { ignoreSearch: true })
      .then((cached) => cached || fetch(request)));
  }
});
