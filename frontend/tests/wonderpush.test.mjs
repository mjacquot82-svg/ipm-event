import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

function installBrowserMocks() {
  let appendedScripts = 0;
  const scripts = new Map();
  const notification = { permission: 'default' };
  globalThis.Notification = notification;
  globalThis.window = {
    Notification: notification,
    PushManager: function PushManager() {},
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
        script.onload();
      },
    },
    createElement() { return { dataset: {} }; },
    getElementById(id) { return scripts.get(id) || null; },
  };
  return { notification, appendedScripts: () => appendedScripts };
}

test('WonderPush web SDK initializes once with the existing root worker', async () => {
  const browser = installBrowserMocks();
  process.env.EXPO_PUBLIC_WONDERPUSH_WEB_KEY = 'staging-public-key';
  const service = await import('../src/services/wonderPushService.web.ts?init-once');

  await Promise.all([service.initializeWonderPush(), service.initializeWonderPush()]);

  assert.equal(browser.appendedScripts(), 1);
  assert.deepEqual(window.WonderPush[0], ['init', {
    webKey: 'staging-public-key',
    serviceWorkerUrl: '/webpushr-sw.js?webKey=staging-public-key',
  }]);
});

test('subscription states cover default, granted, denied, subscribe and unsubscribe', async () => {
  const browser = installBrowserMocks();
  process.env.EXPO_PUBLIC_WONDERPUSH_WEB_KEY = 'staging-public-key';
  const service = await import('../src/services/wonderPushService.web.ts?states');
  await service.initializeWonderPush();

  let subscribed = false;
  Object.assign(window.WonderPush, {
    push(callback) { if (typeof callback === 'function') callback(); },
    isSubscribedToNotifications: async () => subscribed,
    subscribeToNotifications: async () => { browser.notification.permission = 'granted'; subscribed = true; },
    unsubscribeFromNotifications: async () => { subscribed = false; },
    getInstallationId: async () => 'installation-1',
  });

  assert.equal(await service.getNotificationState(), 'default');
  browser.notification.permission = 'granted';
  assert.equal(await service.getNotificationState(), 'unsubscribed');
  assert.equal(await service.subscribeToNotifications(), 'subscribed');
  assert.equal(await service.getWonderPushInstallationId(), 'installation-1');
  assert.equal(await service.unsubscribeFromNotifications(), 'unsubscribed');
  browser.notification.permission = 'denied';
  assert.equal(await service.getNotificationState(), 'denied');
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
  assert.match(layout, /Platform\.OS === 'web'/);
  assert.match(layout, /Platform\.OS !== 'web'/);
  assert.match(nativeNotifications, /expo-notifications/);
  assert.match(installPrompt, /beforeinstallprompt/);
  assert.doesNotMatch(publicHtml, /webpushr|wonderpush/i);
});
