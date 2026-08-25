import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import cachePolicy from '../src/services/contentCachePolicy.js';

const validId = '123e4567-e89b-42d3-a456-426614174000';

test('Schedule and Vendor validators reject malformed records', () => {
  assert.equal(cachePolicy.isScheduleRecord({ id: validId, title: 'Parade', start_date: '2026-09-22', start_time: '10:00 AM', category: 'Parade Week' }), true);
  assert.equal(cachePolicy.isScheduleRecord({ id: validId, title: 'Missing fields' }), false);
  assert.equal(cachePolicy.isVendorRecord({ id: validId, name: 'Vendor', type: 'Food' }), true);
  assert.equal(cachePolicy.isVendorRecord({ id: 'not-a-uuid', name: 'Vendor', type: 'Food' }), false);
});

test('last-known-good policy rejects accidental empty replacement', () => {
  assert.equal(cachePolicy.shouldAcceptReplacement(151, 0, { events: [], total_count: 0 }), false);
  assert.equal(cachePolicy.shouldAcceptReplacement(127, 0, { vendors: [], total_count: 0 }), false);
  assert.equal(cachePolicy.shouldAcceptReplacement(151, 0, { events: [], total_count: 0, authoritative_empty: true }), true);
  assert.equal(cachePolicy.shouldAcceptReplacement(151, 152, { total_count: 152 }), true);
  assert.equal(cachePolicy.shouldAcceptReplacement(0, 0, { total_count: 0 }), true);
});

test('data service preserves a versioned last-known-good snapshot and refreshes in background', async () => {
  const source = await readFile(new URL('../src/services/spreadsheetDataService.ts', import.meta.url), 'utf8');
  assert.match(source, /CONTENT_CACHE_SCHEMA_VERSION = 2/);
  assert.match(source, /schemaVersion: CONTENT_CACHE_SCHEMA_VERSION/);
  assert.match(source, /if \(cachedData\)[\s\S]*void refresh\(\)[\s\S]*return cachedData/);
  assert.match(source, /Refusing to replace saved/);
  assert.match(source, /Background API refresh failed/);
  assert.match(source, /window\.addEventListener\('online', refresh\)/);
});

test('Schedule and Vendor screens immediately expose cached source and retain local filters', async () => {
  const schedule = await readFile(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8');
  const vendors = await readFile(new URL('../app/(tabs)/vendors.tsx', import.meta.url), 'utf8');
  for (const source of [schedule, vendors]) {
    assert.match(source, /setDataSource\(result\.source\)/);
    assert.match(source, /addConnectivityRefreshListener/);
    assert.match(source, /CachedDataBanner/);
  }
  assert.match(schedule, /events\.filter/);
  assert.match(schedule, /selectedCategory/);
  assert.match(schedule, /selectedDay/);
  assert.match(vendors, /vendors\.filter/);
  assert.match(vendors, /selectedType/);
});

test('first offline open has explicit unsaved-data states', async () => {
  const schedule = await readFile(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8');
  const vendors = await readFile(new URL('../app/(tabs)/vendors.tsx', import.meta.url), 'utf8');
  assert.match(schedule, /Schedule information isn't saved yet/);
  assert.match(vendors, /Vendor information isn't saved yet/);
});
