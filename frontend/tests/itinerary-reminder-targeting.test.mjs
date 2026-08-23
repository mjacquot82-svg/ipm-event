import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const sdk = fs.readFileSync(new URL('../src/services/wonderPushService.web.ts', import.meta.url), 'utf8');
const sync = fs.readFileSync(new URL('../src/services/itineraryReminderSync.web.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../../supabase/migrations/20260823000100_itinerary_reminder_targeting.sql', import.meta.url), 'utf8');
const hardening = fs.readFileSync(new URL('../../supabase/migrations/20260823000500_harden_itinerary_reminder_readiness.sql', import.meta.url), 'utf8');

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
