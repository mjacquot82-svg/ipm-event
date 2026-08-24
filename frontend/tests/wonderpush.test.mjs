import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

function installBrowserMocks({ loadLoader = true } = {}) {
  let appendedScripts = 0;
  const scripts = new Map();
  const notification = { permission: 'default' };
  globalThis.Notification = notification;
  globalThis.window = {
    Notification: notification,
    PushManager: function PushManager() {},
    location: { origin: 'https://staging.theipm.ca' },
  };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { serviceWorker: {} },
  });
  globalThis.document = {
    head: {
      appendChild(script) {
        appendedScripts += 1;
        scripts.set(script.id, script);
        if (loadLoader) script.onload();
      },
    },
    createElement() { return { dataset: {} }; },
    getElementById(id) { return scripts.get(id) || null; },
  };
  return {
    notification,
    appendedScripts: () => appendedScripts,
    loaderScript: () => scripts.get('wonderpush-jssdk-loader'),
    makeSdkReady(methods = {}) {
      const queued = [...window.WonderPush];
      Object.assign(window.WonderPush, methods, {
        push(command) { if (typeof command === 'function') command(); },
      });
      for (const command of queued) {
        if (typeof command === 'function') command();
      }
    },
  };
}

function installTimerMocks(t) {
  const timers = [];
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    const timer = { callback, delay, active: true };
    timers.push(timer);
    return timer;
  });
  t.mock.method(globalThis, 'clearTimeout', (timer) => {
    if (timer) timer.active = false;
  });
  return {
    runNext() {
      const timer = timers.find((candidate) => candidate.active);
      assert.ok(timer, 'expected an active timeout');
      timer.active = false;
      timer.callback();
    },
    activeDelays() {
      return timers.filter((timer) => timer.active).map((timer) => timer.delay);
    },
  };
}

test('WonderPush web SDK initializes once with the existing root worker', async () => {
  const browser = installBrowserMocks();
  process.env.EXPO_PUBLIC_WONDERPUSH_WEB_KEY = 'staging-public-key';
  const service = await import('../src/services/wonderPushService.web.ts?init-once');

  let initialized = false;
  const first = service.initializeWonderPush().then(() => { initialized = true; });
  const second = service.initializeWonderPush();

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(browser.appendedScripts(), 1);
  assert.equal(browser.loaderScript().id, 'wonderpush-jssdk-loader');
  assert.notEqual(browser.loaderScript().id, 'wonderpush-jssdk');
  assert.equal(browser.loaderScript().dataset.loaded, 'true');
  assert.equal(initialized, false, 'loader onload must not mark the full SDK ready');
  assert.deepEqual(window.WonderPush[0], ['init', {
    webKey: 'staging-public-key',
    serviceWorkerUrl: '/webpushr-sw.js?webKey=staging-public-key',
  }]);

  browser.makeSdkReady();
  await Promise.all([first, second]);
  assert.equal(initialized, true);
});

test('subscription states cover default, granted, denied, subscribe and unsubscribe', async () => {
  const browser = installBrowserMocks();
  process.env.EXPO_PUBLIC_WONDERPUSH_WEB_KEY = 'staging-public-key';
  const service = await import('../src/services/wonderPushService.web.ts?states');

  let subscribed = false;
  const methods = {
    isSubscribedToNotifications: async () => subscribed,
    subscribeToNotifications: async () => { browser.notification.permission = 'granted'; subscribed = true; },
    unsubscribeFromNotifications: async () => { subscribed = false; },
  };
  const initialization = service.initializeWonderPush();
  browser.makeSdkReady(methods);
  await initialization;

  assert.equal(await service.getNotificationState(), 'default');
  subscribed = true;
  assert.equal(await service.getNotificationState(), 'default', 'SDK state cannot override browser permission');
  subscribed = false;
  browser.notification.permission = 'granted';
  assert.equal(await service.getNotificationState(), 'unsubscribed');
  assert.equal(await service.subscribeToNotifications(), 'subscribed');
  assert.equal(await service.unsubscribeFromNotifications(), 'unsubscribed');
  browser.notification.permission = 'denied';
  assert.equal(await service.getNotificationState(), 'denied');
});

test('bounded read-only settling recovers a refresh-time subscription and installation race', async () => {
  const browser = installBrowserMocks();
  process.env.EXPO_PUBLIC_WONDERPUSH_WEB_KEY = 'staging-public-key';
  const service = await import('../src/services/wonderPushService.web.ts?settling-race');
  browser.notification.permission = 'granted';
  let reads = 0;
  let subscribeCalls = 0;
  const initialization = service.initializeWonderPush();
  browser.makeSdkReady({
    isSubscribedToNotifications: async () => { reads += 1; return reads >= 2; },
    getInstallationId: async () => reads >= 2 ? 'redacted-installation' : null,
    subscribeToNotifications: async () => { subscribeCalls += 1; },
  });
  await initialization;

  const snapshot = await service.readWonderPushSnapshot({ attempts: 3, retryDelayMs: 0 });
  assert.equal(snapshot.subscribed, true);
  assert.equal(snapshot.installationId, 'redacted-installation');
  assert.equal(reads, 2);
  assert.equal(subscribeCalls, 0, 'status verification must never resubscribe');
});

test('bounded read-only settling preserves a genuine missing installation', async () => {
  const browser = installBrowserMocks();
  process.env.EXPO_PUBLIC_WONDERPUSH_WEB_KEY = 'staging-public-key';
  const service = await import('../src/services/wonderPushService.web.ts?genuinely-unavailable');
  browser.notification.permission = 'granted';
  let reads = 0;
  const initialization = service.initializeWonderPush();
  browser.makeSdkReady({
    isSubscribedToNotifications: async () => { reads += 1; return false; },
    getInstallationId: async () => null,
  });
  await initialization;

  const snapshot = await service.readWonderPushSnapshot({ attempts: 3, retryDelayMs: 0 });
  assert.equal(snapshot.subscribed, false);
  assert.equal(snapshot.installationId, null);
  assert.equal(reads, 3);
});

test('current installation comparison exposes only the same safe fingerprint format as backend', async () => {
  const browser = installBrowserMocks();
  process.env.EXPO_PUBLIC_WONDERPUSH_WEB_KEY = 'staging-public-key';
  const service = await import('../src/services/wonderPushService.web.ts?safe-fingerprint');
  browser.notification.permission = 'granted';
  const rawInstallation = 'never-render-this-installation-id';
  const initialization = service.initializeWonderPush();
  browser.makeSdkReady({
    isSubscribedToNotifications: async () => false,
    getInstallationId: async () => rawInstallation,
  });
  await initialization;
  const fingerprint = await service.getCurrentInstallationFingerprint();
  assert.equal(fingerprint, createHash('sha256').update(rawInstallation).digest('hex').slice(0, 10).toUpperCase());
  assert.notEqual(fingerprint, rawInstallation);
});

test('readiness timeout returns an error state, resets initialization and permits retry', async (t) => {
  const browser = installBrowserMocks();
  process.env.EXPO_PUBLIC_WONDERPUSH_WEB_KEY = 'staging-public-key';
  const service = await import('../src/services/wonderPushService.web.ts?readiness-timeout');

  const timers = installTimerMocks(t);

  const firstState = service.getNotificationState();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(timers.activeDelays(), [15_000]);
  timers.runNext();
  assert.equal(await firstState, 'error');

  const retry = service.initializeWonderPush();
  browser.makeSdkReady({ isSubscribedToNotifications: async () => false });
  await retry;
  assert.equal(await service.getNotificationState(), 'default');
});

test('loader download, subscribe and unsubscribe operations are bounded', async (t) => {
  const browser = installBrowserMocks({ loadLoader: false });
  process.env.EXPO_PUBLIC_WONDERPUSH_WEB_KEY = 'staging-public-key';
  const service = await import('../src/services/wonderPushService.web.ts?bounded-operations');

  const timers = installTimerMocks(t);

  const loaderFailure = service.initializeWonderPush();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(timers.activeDelays(), [10_000]);
  timers.runNext();
  await assert.rejects(loaderFailure, /loader timed out/);

  browser.loaderScript().onload();
  const retry = service.initializeWonderPush();
  browser.makeSdkReady({
    isSubscribedToNotifications: async () => false,
    subscribeToNotifications: () => new Promise(() => {}),
    unsubscribeFromNotifications: () => new Promise(() => {}),
  });
  await retry;

  const subscribe = service.subscribeToNotifications();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(timers.activeDelays(), [45_000]);
  timers.runNext();
  assert.equal(await subscribe, 'error');

  const unsubscribe = service.unsubscribeFromNotifications();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(timers.activeDelays(), [20_000]);
  timers.runNext();
  assert.equal(await unsubscribe, 'error');
});

test('routine subscription status checks use a short bounded deadline', async (t) => {
  const browser = installBrowserMocks();
  process.env.EXPO_PUBLIC_WONDERPUSH_WEB_KEY = 'staging-public-key';
  const service = await import('../src/services/wonderPushService.web.ts?status-timeout');
  const timers = installTimerMocks(t);

  const initialization = service.initializeWonderPush();
  browser.makeSdkReady({ isSubscribedToNotifications: () => new Promise(() => {}) });
  await initialization;

  const status = service.getNotificationState();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(timers.activeDelays(), [10_000]);
  timers.runNext();
  assert.equal(await status, 'error');
});

test('missing public key fails clearly without blocking unsupported/native environments', async () => {
  installBrowserMocks();
  delete process.env.EXPO_PUBLIC_WONDERPUSH_WEB_KEY;
  const webService = await import('../src/services/wonderPushService.web.ts?missing-key');
  await assert.rejects(webService.initializeWonderPush(), /EXPO_PUBLIC_WONDERPUSH_WEB_KEY/);

  const nativeService = await import('../src/services/wonderPushService.ts');
  assert.equal(await nativeService.getNotificationState(), 'unsupported');
});

test('worker uses WonderPush existing-worker integration and contains no Webpushr dependency', async () => {
  const worker = await readFile(new URL('../public/webpushr-sw.js', import.meta.url), 'utf8');
  assert.match(worker, /cdn\.by\.wonderpush\.com\/sdk\/1\.1\/wonderpush-loader\.min\.js/);
  assert.match(worker, /self\.WonderPush\.push\(\['init', \{ webKey \}\]\)/);
  assert.match(worker, /new URL\(self\.location\.href\)\.searchParams\.get\('webKey'\)/);
  assert.doesNotMatch(worker, /cdn\.webpushr\.com|sw-server\.min\.js/);

  const imported = [];
  const workerSelf = { location: { href: 'https://staging.theipm.ca/webpushr-sw.js?webKey=public-key' } };
  vm.runInNewContext(worker, {
    self: workerSelf,
    URL,
    console,
    importScripts(url) { imported.push(url); },
  });
  assert.deepEqual(imported, ['https://cdn.by.wonderpush.com/sdk/1.1/wonderpush-loader.min.js']);
  assert.equal(workerSelf.WonderPush[0][0], 'init');
  assert.equal(workerSelf.WonderPush[0][1].webKey, 'public-key');
});

test('IPM owns the opt-in action and existing native/install paths remain isolated', async () => {
  const [component, layout, nativeNotifications, installPrompt, publicHtml] = await Promise.all([
    readFile(new URL('../src/components/NotificationOptIn.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/_layout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/utils/notificationService.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/PWAInstallPrompt.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  ]);
  assert.match(component, /onPress=\{updateSubscription\}/);
  assert.match(component, /subscribeToNotifications/);
  assert.match(component, /unsubscribeFromNotifications/);
  assert.doesNotMatch(component, /diagnostic|getWonderPushInstallationId/i);
  assert.match(layout, /Platform\.OS === 'web'/);
  assert.match(layout, /Platform\.OS !== 'web'/);
  assert.match(nativeNotifications, /expo-notifications/);
  assert.match(installPrompt, /beforeinstallprompt/);
  assert.doesNotMatch(publicHtml, /webpushr|wonderpush/i);
});
