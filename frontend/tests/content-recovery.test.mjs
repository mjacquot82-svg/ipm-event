import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import {
  ContentHttpError,
  ContentRequestCoalescer,
  CONTENT_REQUEST_MAX_ATTEMPTS,
  CONTENT_REQUEST_TIMEOUT_MS,
  MAX_IN_FLIGHT_CONTENT_REQUESTS,
  getContentRetryDelayMs,
  resolveCacheFirst,
  retryContentRequest,
} from '../src/services/contentRecoveryCore.ts';

const serviceSource = await readFile(new URL('../src/services/spreadsheetDataService.ts', import.meta.url), 'utf8');
const detailSource = await readFile(new URL('../app/announcements/[announcement_id].tsx', import.meta.url), 'utf8');
const scheduleSource = await readFile(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8');
const vendorsSource = await readFile(new URL('../app/(tabs)/vendors.tsx', import.meta.url), 'utf8');

test('retry timing is bounded and jitter is deterministic', () => {
  assert.equal(CONTENT_REQUEST_TIMEOUT_MS, 5_000);
  assert.equal(CONTENT_REQUEST_MAX_ATTEMPTS, 3);
  assert.equal(getContentRetryDelayMs(1, () => 0), 300);
  assert.equal(getContentRetryDelayMs(1, () => 0.5), 450);
  assert.equal(getContentRetryDelayMs(2, () => 1), 1_200);
  assert.ok(CONTENT_REQUEST_TIMEOUT_MS * CONTENT_REQUEST_MAX_ATTEMPTS + 1_800 <= 17_000);
});

test('transient failures retry once with jitter while permanent 4xx does not retry', async () => {
  const delays = [];
  let transientAttempts = 0;
  const value = await retryContentRequest(async () => {
    transientAttempts += 1;
    if (transientAttempts === 1) throw new ContentHttpError(503);
    return 'recovered';
  }, { random: () => 0.25, sleep: async (milliseconds) => { delays.push(milliseconds); } });
  assert.equal(value, 'recovered');
  assert.equal(transientAttempts, 2);
  assert.deepEqual(delays, [375]);

  let permanentAttempts = 0;
  await assert.rejects(() => retryContentRequest(async () => {
    permanentAttempts += 1;
    throw new ContentHttpError(404);
  }, { sleep: async () => { throw new Error('must not sleep'); } }), /status 404/);
  assert.equal(permanentAttempts, 1);
});

test('network errors exhaust the finite retry budget and pass the configured timeout', async () => {
  const timeouts = [];
  await assert.rejects(() => retryContentRequest(async (timeoutMs) => {
    timeouts.push(timeoutMs);
    throw new TypeError('network unavailable');
  }, { timeoutMs: 25, maxAttempts: 2, random: () => 0, sleep: async () => undefined }), /network unavailable/);
  assert.deepEqual(timeouts, [25, 25]);

  let invalidResponseAttempts = 0;
  await assert.rejects(() => retryContentRequest(async () => {
    invalidResponseAttempts += 1;
    throw new Error('invalid response schema');
  }, { sleep: async () => { throw new Error('must not retry invalid data'); } }), /invalid response schema/);
  assert.equal(invalidResponseAttempts, 1);
});

test('cache-first returns stale content immediately and refreshes non-destructively', async () => {
  let finishRefresh;
  const refreshed = new Promise((resolve) => { finishRefresh = resolve; });
  const callbacks = [];
  const result = await resolveCacheFirst('cached schedule', () => refreshed, {
    onRefresh: (value) => callbacks.push(value),
  });
  assert.equal(result, 'cached schedule');
  assert.deepEqual(callbacks, []);
  finishRefresh('fresh schedule');
  await refreshed;
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(callbacks, ['fresh schedule']);

  let refreshError;
  assert.equal(await resolveCacheFirst('cached vendors', async () => { throw new Error('offline'); }, {
    onRefreshError: (error) => { refreshError = error; },
  }), 'cached vendors');
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(refreshError.message, /offline/);
});

test('identical logical requests coalesce and failed work is released for a later retry', async () => {
  const coalescer = new ContentRequestCoalescer();
  let calls = 0;
  let release;
  const operation = () => {
    calls += 1;
    return new Promise((resolve) => { release = resolve; });
  };
  const first = coalescer.run('schedule', operation);
  const second = coalescer.run('schedule', operation);
  assert.equal(first, second);
  assert.equal(calls, 1);
  release('events');
  assert.equal(await second, 'events');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(coalescer.size, 0);

  await assert.rejects(() => coalescer.run('announcements', async () => { throw new Error('failed'); }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(await coalescer.run('announcements', async () => 'retry works'), 'retry works');
});

test('different resources do not share results and retained in-flight state is bounded', async () => {
  const coalescer = new ContentRequestCoalescer();
  const releases = [];
  const pending = Array.from({ length: MAX_IN_FLIGHT_CONTENT_REQUESTS + 4 }, (_, index) =>
    coalescer.run(`detail:${index}`, () => new Promise((resolve) => releases.push(resolve)))
  );
  assert.equal(coalescer.size, MAX_IN_FLIGHT_CONTENT_REQUESTS);
  releases.forEach((resolve, index) => resolve(index));
  await Promise.all(pending);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(coalescer.size, 0);

  assert.notEqual(
    coalescer.run('schedule', async () => 'schedule'),
    coalescer.run('vendors', async () => 'vendors'),
  );
});

test('schedule, vendors and announcement list use cache-first coalesced refreshes', () => {
  assert.match(serviceSource, /contentRequests\.run\(`content:\$\{cacheKey\}`/);
  for (const key of ['schedule', 'vendors', 'announcements']) {
    assert.match(serviceSource, new RegExp(`cacheKey: '${key}'`));
  }
  assert.match(serviceSource, /return resolveCacheFirst\(cachedData, refresh/);
});

test('announcement detail only falls back to cached published, unexpired public-list data', () => {
  assert.match(serviceSource, /readCache<AnnouncementsResponse>\('announcements'\)/);
  assert.match(serviceSource, /announcement\.status === 'published'/);
  assert.match(serviceSource, /announcement\.expires_at.*Date\.now\(\)/s);
  assert.match(serviceSource, /announcement\.id === id && isPublicAnnouncement/);
  assert.match(serviceSource, /announcement-detail:\$\{id\}/);
  assert.match(detailSource, /onBackgroundRefresh: \(freshAnnouncement\)/);
  assert.match(detailSource, /setAnnouncement\(freshAnnouncement\)/);
});

test('manual refresh keeps rendered schedule/vendor data on transient failure', () => {
  assert.match(scheduleSource, /if \(!hasScheduleDataRef\.current\) \{\s*setError/s);
  assert.match(vendorsSource, /preferCache: !isRefresh/);
  assert.match(vendorsSource, /if \(!hasVendorDataRef\.current\) \{\s*setError/s);
});
