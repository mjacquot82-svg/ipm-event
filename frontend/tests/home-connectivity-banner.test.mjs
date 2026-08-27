import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ApiDataError, classifyApiFailure } from '../src/services/apiFailureClassification.ts';
import {
  refreshStateAfterFailure,
  shouldShowHomeConnectivityBanner,
} from '../src/services/homeConnectivityState.ts';

const cachedPending = {
  dataSource: 'cache',
  hasCachedContent: true,
  refreshState: 'pending',
  knownOffline: false,
};

test('online cache-first Home stays quiet while refresh is pending and after success', () => {
  assert.equal(shouldShowHomeConnectivityBanner(cachedPending), false);
  assert.equal(shouldShowHomeConnectivityBanner({
    ...cachedPending,
    dataSource: 'network',
    refreshState: 'succeeded',
  }), false);
});

test('offline cached Home shows the banner with its saved timestamp copy', async () => {
  assert.equal(shouldShowHomeConnectivityBanner({ ...cachedPending, knownOffline: true }), true);
  assert.equal(shouldShowHomeConnectivityBanner({
    ...cachedPending,
    refreshState: refreshStateAfterFailure(classifyApiFailure(new ApiDataError('connectivity', 'offline'))),
  }), true);
  const banner = await readFile(new URL('../src/components/CachedDataBanner.tsx', import.meta.url), 'utf8');
  assert.match(banner, /Limited internet connection/);
  assert.match(banner, /Last updated: \$\{date\.toLocaleString\(\)\}/);
});

test('successful refresh after connectivity returns removes the banner', () => {
  const failed = { ...cachedPending, refreshState: 'connectivity-failed' };
  assert.equal(shouldShowHomeConnectivityBanner(failed), true);
  assert.equal(shouldShowHomeConnectivityBanner({
    ...failed,
    dataSource: 'network',
    refreshState: 'succeeded',
    knownOffline: false,
  }), false);
});

test('server, malformed response and application failures do not claim limited internet', () => {
  for (const kind of ['server', 'malformed-response', 'application']) {
    const error = new ApiDataError(kind, kind);
    assert.equal(classifyApiFailure(error), kind);
    assert.equal(shouldShowHomeConnectivityBanner({
      ...cachedPending,
      refreshState: refreshStateAfterFailure(classifyApiFailure(error)),
    }), false);
  }
  assert.equal(classifyApiFailure(new TypeError('fetch failed')), 'connectivity');
});

test('Home keeps cache-first hydration non-blocking and scopes the new banner policy to Home', async () => {
  const [home, service, schedule, vendors] = await Promise.all([
    readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/spreadsheetDataService.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/(tabs)/vendors.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(service, /if \(cachedData\)[\s\S]*void refresh\(\)[\s\S]*return cachedData/);
  assert.match(home, /shouldShowHomeConnectivityBanner/);
  assert.doesNotMatch(schedule, /shouldShowHomeConnectivityBanner/);
  assert.doesNotMatch(vendors, /shouldShowHomeConnectivityBanner/);
  assert.match(schedule, /dataSource === 'cache'[\s\S]*CachedDataBanner/);
  assert.match(vendors, /dataSource === 'cache'[\s\S]*CachedDataBanner/);
});

test('WonderPush and offline worker files are outside this focused state change', async () => {
  const home = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(home, /wonderPushService|webpushr-sw|offline-worker/);
});
