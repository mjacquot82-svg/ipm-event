import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const home = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const data = await readFile(new URL('../src/services/spreadsheetDataService.ts', import.meta.url), 'utf8');
const worker = await readFile(new URL('../public/webpushr-sw.js', import.meta.url), 'utf8');
const schedule = await readFile(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8');
const banner = await readFile(new URL('../src/components/CachedDataBanner.tsx', import.meta.url), 'utf8');

test('Home warms the canonical vendor cache and refreshes mutable data on reconnect', () => {
  assert.match(home, /prefetchVendorsData/);
  assert.match(home, /addEventListener\('online'/);
  assert.match(home, /fetchSchedule\(true\)/);
  assert.match(home, /fetchAnnouncements\(true\)/);
});

test('announcement details retain the fetched record for closed-client offline reads', () => {
  assert.match(data, /const cacheKey = `announcement:\$\{id\}`/);
  assert.match(data, /const cached = await readCache<Announcement>\(cacheKey\)/);
  assert.match(data, /if \(cached\?\.data\) return cached\.data/);
});

test('runtime media caching does not change push ownership', () => {
  assert.match(worker, /IPM_RUNTIME_CACHE/);
  assert.doesNotMatch(worker, /addEventListener\(['"]push/);
  assert.doesNotMatch(worker, /addEventListener\(['"]notificationclick/);
});

test('attendee portraits cache across a closed offline reopen', () => {
  assert.match(worker, /theipm\.ca/);
  assert.match(worker, /IPM_RUNTIME_MEDIA_HOSTS\.has\(url\.hostname\)/);
  assert.match(worker, /path\.includes\('\/event-media\/'\)/);
  assert.match(worker, /if \(response\.ok \|\| response\.type === 'opaque'\) \{/);
  assert.match(worker, /await cache\.put\(request, response\.clone\(\)\)/);
  assert.match(worker, /IPM_RUNTIME_MAX_ENTRIES = 40/);
});

test('schedule keeps saved events calm when a refresh fails', () => {
  assert.match(schedule, /if \(!hasUsableScheduleRef\.current\) \{\s*setError\("We couldn't load the schedule\./);
  assert.match(banner, /Showing saved event information/);
});

test('schedule still shows a genuine failure when no usable saved events exist', () => {
  assert.match(schedule, /if \(error && events\.length === 0\) \{/);
  assert.match(schedule, /We couldn't load the schedule\./);
});
