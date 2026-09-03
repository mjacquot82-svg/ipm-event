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
const IPM_ADMIN_LOGIN_PATH = '/admin/login';

self.addEventListener('message', (event) => {
  if (event.data?.type === 'IPM_ACTIVATE_UPDATE') self.skipWaiting();
});

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const existingCacheKeys = await caches.keys();
    const isApplicationUpdate = existingCacheKeys.some((key) => key.startsWith(IPM_CACHE_PREFIX));
    const cache = await caches.open(IPM_SHELL_CACHE);
    await cache.addAll(IPM_SHELL_ASSETS);

    // Older clients treated every non-Home route as unsafe, which could leave
    // an Organizer login tab on its cached bundle forever. Take over only when
    // every open IPM window is the signed-out login screen.
    const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const onlyAdminLoginClients = windowClients.length > 0 && windowClients.every((client) => {
      try {
        return new URL(client.url).pathname === IPM_ADMIN_LOGIN_PATH;
      } catch {
        return false;
      }
    });
    if (isApplicationUpdate && onlyAdminLoginClients) {
      await self.skipWaiting();
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const isApplicationUpdate = keys.some((key) => (
      key.startsWith(IPM_CACHE_PREFIX) && key !== IPM_SHELL_CACHE
    ));
    await Promise.all(keys
      .filter((key) => key.startsWith(IPM_CACHE_PREFIX) && key !== IPM_SHELL_CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
    if (isApplicationUpdate) {
      const windowClients = await self.clients.matchAll({ type: 'window' });
      await Promise.all(windowClients.map((client) => {
        try {
          return new URL(client.url).pathname === IPM_ADMIN_LOGIN_PATH
            ? client.navigate(client.url)
            : undefined;
        } catch {
          return undefined;
        }
      }));
    }
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
      if (url.pathname === IPM_ADMIN_LOGIN_PATH) {
        try {
          return await fetch(request);
        } catch {
          if (cached) return cached;
          throw new Error('Organizer login is unavailable offline');
        }
      }
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
