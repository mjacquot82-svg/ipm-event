import assert from 'node:assert/strict';
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
  t.mock.method(globalThis, 'setTimeout', (callback) => {
    const timer = { callback, active: true };
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
    getInstallationId: async () => 'installation-1',
  };
  const initialization = service.initializeWonderPush();
  browser.makeSdkReady(methods);
  await initialization;

  assert.equal(await service.getNotificationState(), 'default');
  browser.notification.permission = 'granted';
  assert.equal(await service.getNotificationState(), 'unsubscribed');
  assert.equal(await service.subscribeToNotifications(), 'subscribed');
  assert.equal(await service.getWonderPushInstallationId(), 'installation-1');
  assert.equal(await service.unsubscribeFromNotifications(), 'unsubscribed');
  browser.notification.permission = 'denied';
  assert.equal(await service.getNotificationState(), 'denied');
});

test('readiness timeout returns an error state, resets initialization and permits retry', async (t) => {
  const browser = installBrowserMocks();
  process.env.EXPO_PUBLIC_WONDERPUSH_WEB_KEY = 'staging-public-key';
  const service = await import('../src/services/wonderPushService.web.ts?readiness-timeout');

  const timers = installTimerMocks(t);

  const firstState = service.getNotificationState();
  await new Promise((resolve) => setImmediate(resolve));
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
  timers.runNext();
  assert.equal(await subscribe, 'error');

  const unsubscribe = service.unsubscribeFromNotifications();
  await new Promise((resolve) => setImmediate(resolve));
  timers.runNext();
  assert.equal(await unsubscribe, 'error');
});

test('missing public key fails clearly without blocking unsupported/native environments', async () => {
  installBrowserMocks();
  delete process.env.EXPO_PUBLIC_WONDERPUSH_WEB_KEY;
  const webService = await import('../src/services/wonderPushService.web.ts?missing-key');
  await assert.rejects(webService.initializeWonderPush(), /EXPO_PUBLIC_WONDERPUSH_WEB_KEY/);

  const nativeService = await import('../src/services/wonderPushService.ts');
  assert.equal(await nativeService.getNotificationState(), 'unsupported');
  assert.equal(await nativeService.getWonderPushInstallationId(), null);
});

test('staging diagnostics expose subscription identity and worker paths without push secrets', async () => {
  const browser = installBrowserMocks();
  process.env.EXPO_PUBLIC_WONDERPUSH_WEB_KEY = 'staging-public-key';
  const workerUrl = 'https://staging.theipm.ca/webpushr-sw.js?webKey=must-not-leak';
  const registration = {
    scope: 'https://staging.theipm.ca/brevo/',
    active: { scriptURL: workerUrl },
    waiting: null,
    installing: null,
    pushManager: {
      getSubscription: async () => ({
        endpoint: 'https://push.example/private-endpoint',
        getKey: () => 'must-not-leak',
      }),
    },
  };
  Object.assign(navigator.serviceWorker, {
    controller: { scriptURL: workerUrl },
    getRegistrations: async () => [registration],
  });
  const originalPerformance = globalThis.performance;
  Object.defineProperty(globalThis, 'performance', {
    configurable: true,
    value: {
      getEntriesByType: () => [{
        name: 'https://api.wonderpush.com/v1/authentication/accessToken',
        duration: 1234.4,
        responseStatus: 503,
      }],
    },
  });
  const service = await import('../src/services/wonderPushService.web.ts?diagnostics');
  const initialization = service.initializeWonderPush();
  browser.makeSdkReady({
    isSubscribedToNotifications: async () => true,
    getInstallationId: async () => 'installation-for-staging-test',
  });
  await initialization;

  const diagnostics = await service.getWonderPushDiagnostics();
  assert.deepEqual(diagnostics, {
    permission: 'default',
    sdkSubscribed: true,
    installationId: 'installation-for-staging-test',
    workerScopePath: '/brevo/',
    workerScriptPath: '/webpushr-sw.js',
    controllerPath: '/webpushr-sw.js',
    hasPushSubscription: true,
    installationRequestObserved: true,
    installationRequestStatusClass: '5xx',
    installationRequestDurationMs: 1234,
    errors: [],
  });
  assert.doesNotMatch(JSON.stringify(diagnostics), /webKey|private-endpoint|must-not-leak/);
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: originalPerformance });
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
  assert.match(component, /EXPO_PUBLIC_EVENT_ID === 'ipm-staging'/);
  assert.match(component, /getWonderPushDiagnostics/);
  assert.match(layout, /Platform\.OS === 'web'/);
  assert.match(layout, /Platform\.OS !== 'web'/);
  assert.match(nativeNotifications, /expo-notifications/);
  assert.match(installPrompt, /beforeinstallprompt/);
  assert.doesNotMatch(publicHtml, /webpushr|wonderpush/i);
});
