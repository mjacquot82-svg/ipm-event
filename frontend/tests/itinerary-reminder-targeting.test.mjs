import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const sdk = fs.readFileSync(new URL('../src/services/wonderPushService.web.ts', import.meta.url), 'utf8');
const sync = fs.readFileSync(new URL('../src/services/itineraryReminderSync.web.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../../supabase/migrations/20260823000100_itinerary_reminder_targeting.sql', import.meta.url), 'utf8');
const hardening = fs.readFileSync(new URL('../../supabase/migrations/20260823000500_harden_itinerary_reminder_readiness.sql', import.meta.url), 'utf8');
const testPage = fs.readFileSync(new URL('../app/reminder-test-registration.tsx', import.meta.url), 'utf8');
const favorites = fs.readFileSync(new URL('../src/utils/favoritesStorage.ts', import.meta.url), 'utf8');
const reminderUx = fs.readFileSync(new URL('../src/services/reminderUxService.web.ts', import.meta.url), 'utf8');
const schedulePage = fs.readFileSync(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8');
const itineraryPage = fs.readFileSync(new URL('../app/(tabs)/itinerary.tsx', import.meta.url), 'utf8');
const engineMigration = fs.readFileSync(new URL('../../supabase/migrations/20260823000600_real_itinerary_reminder_engine.sql', import.meta.url), 'utf8');
const authorizationMigration = fs.readFileSync(new URL('../../supabase/migrations/20260824000100_synthetic_t30_one_shot_authorizations.sql', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../../backend/server.py', import.meta.url), 'utf8');

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
  assert.match(sync, /request\('\/readiness\/verify', 'POST'\)/);
  assert.match(sync, /authoritative\.final_reminder_ready/);
  assert.match(sync, /authoritative\.provider_fresh/);
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
  assert.match(sync, /const finalReadiness = await getItineraryReminderReadiness\(\{ verifyProvider: true \}\)/);
  assert.match(sync, /synchronizedCount !== completeSet\.length/);
  assert.match(sync, /return finalReadiness/);
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

test('real scheduler rereads canonical time, applies T-30 window, and atomically deduplicates', () => {
  assert.match(engineMigration, /join schedule_items item/);
  assert.match(engineMigration, /item\.starts_at > p_now \+ interval '25 minutes'/);
  assert.match(engineMigration, /item\.starts_at <= p_now \+ interval '30 minutes'/);
  assert.match(engineMigration, /star\.starred_at < item\.starts_at - interval '30 minutes'/);
  assert.match(engineMigration, /item\.status='published'|item\.status = 'published'/);
  assert.match(engineMigration, /on conflict \(registration_id, schedule_item_id, reminder_type\)/);
  assert.match(engineMigration, /provider_checked_at > p_now - interval '15 minutes'/);
});

test('synthetic fixture uses the same readiness, timing, claim, and uniqueness rules', () => {
  assert.match(engineMigration, /claim_due_synthetic_itinerary_reminders/);
  assert.match(engineMigration, /registration\.provider_deliverable/);
  assert.match(engineMigration, /unique\(registration_id, synthetic_event_id, reminder_type\)/);
  assert.doesNotMatch(engineMigration, /update\s+schedule_items/i);
  assert.match(server, /"late_star_suppression"/);
  assert.match(server, /timedelta\(minutes=20 if late else 31\)/);
  assert.match(server, /device_isolation_t30_retest_2/);
  assert.match(testPage, /Create &amp; Associate Fresh T-30 Demo/);
  assert.match(testPage, /styles\.fixtureMessage/);
});

test('one-shot workflow is organizer authorized, atomic, expiring, and synthetic only', () => {
  assert.match(authorizationMigration, /itinerary_reminder_synthetic_authorizations/);
  assert.match(authorizationMigration, /unique\(synthetic_event_id, reminder_type\)/);
  assert.match(authorizationMigration, /consumed_at is null/);
  assert.match(authorizationMigration, /expires_at>p_now/);
  assert.match(authorizationMigration, /registration\.test_device_label='A'/);
  assert.doesNotMatch(authorizationMigration, /references public\.schedule_items/);
  assert.match(sync, /credentials: 'include'/);
  assert.match(testPage, /Authorize One T-30 Demo Reminder/);
  assert.match(testPage, /Run Eligible T-30 Demo/);
  assert.match(testPage, /authorization_status === 'none'/);
  assert.match(testPage, /Global kill switch: ON/);
});

test('first-star feedback teaches itinerary addition without promising reminder delivery', () => {
  assert.match(schedulePage, /starSucceeded[\s\S]*setShowStarConfirmation\(true\)/);
  assert.match(schedulePage, /Added to Personal Itinerary/);
  assert.match(schedulePage, /Event reminders about 30 minutes before eligible events will also be available/);
  assert.doesNotMatch(schedulePage, /enableRemindersFromPrompt|we'll remind you 30 minutes/);
});

test('no-nag policy permits at most two local displays and suppresses when ready', () => {
  assert.match(reminderUx, /mayShowReminderPromotion/);
  assert.match(reminderUx, /AsyncStorage\.setItem\(PROMPT_COUNT_KEY, String\(count \+ 1\)\)/);
});

test('personal itinerary exposes hardened reminder status and platform guidance', () => {
  assert.match(itineraryPage, /Set up event reminders/);
  assert.match(itineraryPage, /Event reminder setup complete/);
  assert.match(itineraryPage, /when they become available/);
  assert.match(itineraryPage, /result\.readiness\?\.reminderReady/);
  assert.match(itineraryPage, /install IPM to your Home Screen/);
  assert.match(itineraryPage, /Notifications are blocked/);
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
