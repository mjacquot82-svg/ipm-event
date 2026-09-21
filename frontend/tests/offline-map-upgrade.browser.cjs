const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.IPM_PLAYWRIGHT_MODULE || '/tmp/ipm-browser-tools/node_modules/playwright');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'webpushr-sw.js'), 'utf8');
const maps = [
  '/assets/grounds-site-map.verified.jpg',
  '/assets/tented-city-map-app-ready.verified.svg',
  '/assets/rv-park-detail-map.verified.png',
];
const shell = version => ['/', '/index.html', `/_expo/static/js/web/entry-${version}.js`];
const worker = version => source
  .replace('https://cdn.by.wonderpush.com/sdk/1.1/wonderpush-loader.min.js', '/provider-stub.js')
  .replace("'development'", `'${version}'`)
  .replace("['/', '/index.html', '/manifest.json']", JSON.stringify(shell(version)))
  .replace('const IPM_MAP_ARTWORK_ASSETS = [];', `const IPM_MAP_ARTWORK_ASSETS = ${JSON.stringify(version === 'B' ? maps : [])};`);

const onePixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

async function startServer() {
  let workerVersion = 'A';
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    res.setHeader('Cache-Control', 'no-store');
    if (pathname === '/webpushr-sw.js') {
      res.setHeader('Content-Type', 'application/javascript');
      return res.end(worker(workerVersion));
    }
    if (pathname === '/provider-stub.js') {
      res.setHeader('Content-Type', 'application/javascript');
      return res.end('self.WonderPush = [];');
    }
    if (pathname.startsWith('/_expo/static/js/web/entry-')) {
      res.setHeader('Content-Type', 'application/javascript');
      return res.end('');
    }
    if (maps.includes(pathname)) {
      if (workerVersion === 'A') return res.writeHead(503).end();
      res.setHeader('Content-Type', pathname.endsWith('.svg') ? 'image/svg+xml' : pathname.endsWith('.jpg') ? 'image/jpeg' : 'image/png');
      return res.end(pathname.endsWith('.svg')
        ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>'
        : onePixelPng);
    }
    res.setHeader('Content-Type', 'text/html');
    return res.end(`<!doctype html><body>
      <script>navigator.serviceWorker.register('/webpushr-sw.js?webKey=fixture', { scope: '/' });</script>
      <img data-map="grounds" src="${maps[0]}"><img data-map="tented" src="${maps[1]}"><img data-map="rv" src="${maps[2]}">
      <script src="/_expo/static/js/web/entry-${workerVersion}.js"></script>
    </body>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, get workerVersion() { return workerVersion; }, set workerVersion(value) { workerVersion = value; }, origin: `http://127.0.0.1:${server.address().port}` };
}

async function cachedMaps(page) {
  return page.evaluate(async paths => {
    const cache = await caches.open('ipm-offline-shell-current-v1');
    return Promise.all(paths.map(async pathName => Boolean(await cache.match(new URL(pathName, location.origin).href))));
  }, maps);
}

async function waitForCachedMaps(page) {
  await page.waitForFunction(async paths => {
    const cache = await caches.open('ipm-offline-shell-current-v1');
    return (await Promise.all(paths.map(async pathName => Boolean(await cache.match(new URL(pathName, location.origin).href))))).every(Boolean);
  }, maps);
}

(async () => {
  const fixture = await startServer();
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const fresh = await browser.newContext();
    const freshPage = await fresh.newPage();
    fixture.workerVersion = 'B';
    await freshPage.goto(fixture.origin, { waitUntil: 'domcontentloaded' });
    await freshPage.waitForFunction(() => navigator.serviceWorker.controller);
    await freshPage.waitForTimeout(250);
    await waitForCachedMaps(freshPage);
    assert.deepEqual(await cachedMaps(freshPage), [true, true, true]);
    await fresh.close();

    fixture.workerVersion = 'A';
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(fixture.origin, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    assert.deepEqual(await cachedMaps(page), [false, false, false]);

    fixture.workerVersion = 'B';
    await page.evaluate(() => navigator.serviceWorker.ready.then(registration => registration.update()));
    await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.ready).waiting));
    await waitForCachedMaps(page);
    assert.deepEqual(await cachedMaps(page), [true, true, true]);

    await page.evaluate(() => new Promise((resolve, reject) => {
      const deadline = Date.now() + 5000;
      const activate = () => navigator.serviceWorker.getRegistration().then(registration => {
        if (registration?.waiting) {
          navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
          registration.waiting.postMessage({ type: 'IPM_ACTIVATE_UPDATE' });
          return;
        }
        if (Date.now() >= deadline) throw new Error('Expected an installed waiting worker');
        setTimeout(activate, 50);
      }).catch(reject);
      activate();
    }));
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => [...document.querySelectorAll('img[data-map]')].every(image => image.complete && image.naturalWidth > 0));
    assert.equal(await page.locator('img[data-map]').count(), 3);
    console.log('PASS fresh install, existing-install upgrade, and offline cold reopen preserve all three map artworks');
    await context.close();
  } finally {
    await browser.close();
    fixture.server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
