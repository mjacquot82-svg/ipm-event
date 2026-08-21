importScripts('https://cdn.webpushr.com/sw-server.min.js');

// The production build prepends this configuration to the same worker file.
// The app and Webpushr share this single /webpushr-sw.js registration at root scope.
const ipmOfflineConfig = self.__IPM_OFFLINE_CONFIG__;

if (ipmOfflineConfig) {
  const shellCacheName = `ipm-app-shell-${ipmOfflineConfig.version}`;
  const runtimeCacheName = `ipm-public-runtime-${ipmOfflineConfig.version}`;
  const ownedCachePrefixes = ['ipm-app-shell-', 'ipm-public-runtime-'];
  const precachePaths = new Set(ipmOfflineConfig.precacheAssets);
  const optionalQueenPath = '/assets/assets/images/queen-of-the-furrow/';

  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open(shellCacheName).then((cache) => cache.addAll(ipmOfflineConfig.precacheAssets))
    );
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys()
        .then((cacheNames) => Promise.all(
          cacheNames
            .filter((cacheName) => (
              ownedCachePrefixes.some((prefix) => cacheName.startsWith(prefix))
              && cacheName !== shellCacheName
              && cacheName !== runtimeCacheName
            ))
            .map((cacheName) => caches.delete(cacheName))
        ))
        .then(() => self.clients.claim())
    );
  });

  self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

    if (request.mode === 'navigate') {
      event.respondWith(
        fetch(request).catch(() => caches.match('/index.html', { cacheName: shellCacheName }))
      );
      return;
    }

    if (precachePaths.has(url.pathname)) {
      event.respondWith(
        caches.match(request, { cacheName: shellCacheName, ignoreSearch: true })
          .then((cached) => cached || fetch(request))
      );
      return;
    }

    if (url.pathname.startsWith(optionalQueenPath)) {
      event.respondWith(
        caches.open(runtimeCacheName).then(async (cache) => {
          const cached = await cache.match(request, { ignoreSearch: true });
          if (cached) return cached;
          const response = await fetch(request);
          if (response.ok) await cache.put(request, response.clone());
          return response;
        })
      );
    }
  });
}
