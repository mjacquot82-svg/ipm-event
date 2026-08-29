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

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(IPM_SHELL_CACHE);
      const cached = await cache.match('/index.html');
      if (cached) return cached;
      return fetch(request);
    })());
    return;
  }

  if (IPM_SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(request, { ignoreSearch: true })
      .then((cached) => cached || fetch(request)));
  }
});
