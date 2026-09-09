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
