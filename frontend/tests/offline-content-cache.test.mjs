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

test('Schedule and Vendor cached states explain limited connectivity and retain timestamps', async () => {
  const [banner, schedule, vendors] = await Promise.all([
    readFile(new URL('../src/components/CachedDataBanner.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/(tabs)/vendors.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(banner, /Limited internet connection/);
  assert.match(banner, /You're seeing saved \$\{informationLabel\} so you can keep using IPM/);
  assert.match(banner, /We'll update it automatically when your connection improves/);
  assert.match(banner, /Last updated: \$\{date\.toLocaleString\(\)\}/);
  assert.match(banner, /informationType = 'event'/);
  assert.doesNotMatch(banner, /Showing saved event information/);
  assert.match(schedule, /dataSource === 'cache'[\s\S]*CachedDataBanner/);
  assert.match(schedule, /informationType="event"/);
  assert.match(vendors, /dataSource === 'cache'[\s\S]*CachedDataBanner/);
  assert.match(vendors, /informationType="vendor"/);
  assert.match(schedule, /setDataSource\(result\.source\)/);
  assert.match(vendors, /setDataSource\(result\.source\)/);
});

test('first offline open has explicit unsaved-data states', async () => {
  const schedule = await readFile(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8');
  const vendors = await readFile(new URL('../app/(tabs)/vendors.tsx', import.meta.url), 'utf8');
  assert.match(schedule, /Schedule information isn't saved yet/);
  assert.match(vendors, /Vendor information isn't saved yet/);
});

test('Home cached Schedule uses the same limited-connection explanation', async () => {
  const [home, banner] = await Promise.all([
    readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/CachedDataBanner.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(home, /isShowingCachedData[\s\S]*informationType="event"/);
  assert.match(home, /const isShowingCachedData = dataSource === 'cache' && !loading && events\.length > 0/);
  assert.match(home, /setDataSource\(result\.source\)/);
  assert.match(banner, /Limited internet connection/);
  assert.match(banner, /You're seeing saved \$\{informationLabel\} so you can keep using IPM/);
  assert.match(banner, /We'll update it automatically when your connection improves/);
  assert.match(banner, /Last updated: \$\{date\.toLocaleString\(\)\}/);
  assert.doesNotMatch(banner, /Showing saved event information/);
  assert.match(home, /<ResponsiveBanner \/>/);
  const homeBanners = home.match(/<CachedDataBanner[^>]+>/g) || [];
  assert.ok(homeBanners.length >= 2);
  assert.equal(homeBanners.every((banner) => banner.includes('informationType="event"')), true);
});
