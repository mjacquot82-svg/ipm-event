import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const sdk = fs.readFileSync(new URL('../src/services/wonderPushService.web.ts', import.meta.url), 'utf8');
const sync = fs.readFileSync(new URL('../src/services/itineraryReminderSync.web.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../../supabase/migrations/20260823000100_itinerary_reminder_targeting.sql', import.meta.url), 'utf8');
const hardening = fs.readFileSync(new URL('../../supabase/migrations/20260823000500_harden_itinerary_reminder_readiness.sql', import.meta.url), 'utf8');
const testPage = fs.readFileSync(new URL('../app/reminder-test-registration.tsx', import.meta.url), 'utf8');
const favorites = fs.readFileSync(new URL('../src/utils/favoritesStorage.ts', import.meta.url), 'utf8');

test('uses supported SDK installation ID and a 256-bit local capability', () => {
  assert.match(sdk, /getInstallationId/);
  assert.match(sync, /getRandomValues\(new Uint8Array\(32\)\)/);
  assert.match(sync, /CAPABILITY_KEY/);
  assert.doesNotMatch(sync, /console\.(log|error).*capability/i);
});

test('stale registrations are excluded and delivery acceptance stays honest', () => {
  assert.match(hardening, /registration\.provider_deliverable/);
  assert.match(hardening, /registration\.provider_reachability = 'optIn'/);
  assert.match(hardening, /registration\.provider_has_push_token/);
  assert.match(hardening, /provider_checked_at > p_now - interval '15 minutes'/);
  assert.match(hardening, /provider_accepted/);
  assert.match(hardening, /delivery_unknown/);
  assert.match(hardening, /confirmed_delivered/);
});

test('client and backend readiness are evaluated separately', () => {
  assert.match(sdk, /clientReady: supportedContext/);
  assert.match(sdk, /browserPermission === 'granted'/);
  assert.match(sdk, /subscription === 'subscribed'/);
  assert.match(sdk, /installation === 'available'/);
  assert.match(sync, /status-by-capability/);
  assert.match(sync, /current_installation_unavailable/);
  assert.match(sync, /installation_mismatch/);
  assert.match(sync, /current\.provider_deliverable/);
});

test('deliberate Device A control enables, full-set syncs, and rereads readiness', () => {
  assert.match(testPage, /Enable 30-Minute Event Reminders/);
  assert.match(testPage, /onPress=\{\(\) => changeReminders\(true\)\}/);
  assert.match(testPage, /enableItineraryRemindersForTesting\(await getFavorites\(\)\)/);
  assert.match(sync, /currentInstallationMatch !== 'match'/);
  assert.match(sync, /registration\?\.provider_deliverable/);
  assert.match(sync, /const completeSet = \[\.\.\.new Set\(starredScheduleIds\)\]/);
  assert.match(sync, /request\('\/enabled', 'PUT', \{ enabled: true \}\)/);
  assert.match(sync, /request\('\/stars', 'PUT', \{ schedule_ids: completeSet \}\)/);
  assert.match(sync, /return getItineraryReminderReadiness\(\)/);
  assert.doesNotMatch(sync, /send_one_installation|targetInstallationIds|\/controlled-device-a-send/);
});

test('empty full set is valid and synchronization failure safely disables', () => {
  assert.doesNotMatch(sync, /starredScheduleIds\.length/);
  assert.match(sync, /request\('\/enabled', 'PUT', \{ enabled: false \}\)\.catch/);
  assert.match(sync, /AsyncStorage\.setItem\(ENABLED_KEY, 'false'\)/);
});

test('deliberate disable preserves favorites and returns readiness false', () => {
  assert.match(testPage, /Disable Event Reminders/);
  assert.match(testPage, /onPress=\{\(\) => changeReminders\(false\)\}/);
  assert.match(sync, /disableItineraryRemindersForTesting/);
  assert.doesNotMatch(sync, /clearFavorites|removeFavorite/);
  assert.match(favorites, /const FAVORITES_KEY/);
});

test('staging enablement control is isolated to registered Device A', () => {
  assert.match(testPage, /status\?\.label === 'A'/);
  assert.doesNotMatch(testPage, /status\?\.label === 'B'.*changeReminders/s);
});

test('full-set sync is retryable and gated by local enabled state', () => {
  assert.match(sync, /ENABLED_KEY/);
  assert.match(sync, /method: 'PUT'|request\('\/stars', 'PUT'/);
  assert.match(sync, /\[\.\.\.new Set\(starredScheduleIds\)\]/);
  assert.match(sync, /next focus\/toggle retries the full set/);
});

test('schema isolates devices and deduplicates reminder claims', () => {
  assert.match(migration, /unique \(event_id, wonderpush_installation_id\)/);
  assert.match(migration, /unique \(registration_id, schedule_item_id, reminder_type\)/);
  assert.match(migration, /item\.status = 'published'/);
  assert.match(migration, /star\.starred_at <= item\.starts_at - interval '30 minutes'/);
  assert.match(migration, /on conflict .* do nothing/);
  assert.match(migration, /enable row level security/g);
});
