import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  safeAnnouncementDestination,
  wonderPushAnnouncementDestination,
} from '../src/services/notificationDeepLinkCore.ts';

const origin = 'https://ipm-staging.netlify.app';
const announcementId = '123e4567-e89b-42d3-a456-426614174000';
const destination = `${origin}/announcements/${announcementId}`;
const message = (targetUrl = destination) => ({
  sdk: 'wonderpush-jssdk',
  type: 'nativeNotificationOpen',
  data: { _wp: { targetUrl } },
});

test('trusted WonderPush open message yields the intended announcement detail route', () => {
  assert.equal(wonderPushAnnouncementDestination(message(), origin), `/announcements/${announcementId}`);
});

for (const currentPage of ['/', '/schedule', '/about']) {
  test(`existing client on ${currentPage} routes instead of remaining focused in place`, () => {
    let currentRoute = currentPage;
    const next = wonderPushAnnouncementDestination(message(), origin);
    if (next) currentRoute = next;
    assert.equal(currentRoute, `/announcements/${announcementId}`);
  });
}

test('focus-only cannot silently discard a valid WonderPush destination', async () => {
  const listener = await readFile(new URL('../src/services/notificationDeepLink.web.ts', import.meta.url), 'utf8');
  const layout = await readFile(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  assert.match(listener, /navigator\.serviceWorker\.addEventListener\('message'/);
  assert.match(listener, /if \(destination\) navigate\(destination\)/);
  assert.match(layout, /router\.replace\(destination as never\)/);
});

test('production, external, malformed and non-announcement URLs are rejected', () => {
  for (const unsafe of [
    `https://ipm.example/announcements/${announcementId}`,
    `https://evil.example/announcements/${announcementId}`,
    `${origin}/schedule`,
    `${origin}/announcements/not-a-uuid`,
    'javascript:alert(1)',
  ]) assert.equal(safeAnnouncementDestination(unsafe, origin), null);
});

test('untrusted page messages cannot request navigation', () => {
  assert.equal(wonderPushAnnouncementDestination({ type: 'nativeNotificationOpen', data: {
    _wp: { targetUrl: destination },
  } }, origin), null);
  assert.equal(wonderPushAnnouncementDestination({ sdk: 'wonderpush-jssdk', type: 'other', data: {
    _wp: { targetUrl: destination },
  } }, origin), null);
});

test('no-client click remains owned by WonderPush openWindow and offline handling is unchanged', async () => {
  const [worker, provider] = await Promise.all([
    readFile(new URL('../public/webpushr-sw.js', import.meta.url), 'utf8'),
    readFile(new URL('../../backend/platform_services.py', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(worker, /addEventListener\(['"]notificationclick/);
  assert.match(provider, /"targetUrl": content\["target_url"\]/);
  assert.match(provider, /"target_url": content\["target_url"\]/);
  assert.match(worker, /strategy: cached \? 'versioned-cache-first'/);
});
