import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const service = await readFile(new URL('../src/services/wonderPushService.web.ts', import.meta.url), 'utf8');
const registration = await readFile(new URL('../src/services/notificationRegistration.web.ts', import.meta.url), 'utf8');
const backend = await readFile(new URL('../../backend/server.py', import.meta.url), 'utf8');
const provider = await readFile(new URL('../../backend/platform_services.py', import.meta.url), 'utf8');
const admin = await readFile(new URL('../app/admin/index.tsx', import.meta.url), 'utf8');

test('production frontend reads WonderPush configuration from deployment environment', () => {
  assert.match(service, /process\.env\.EXPO_PUBLIC_WONDERPUSH_WEB_KEY/);
  assert.doesNotMatch(service, /staging\.theipm\.ca|ipm-staging/);
});

test('normal announcement delivery has TTL and idempotency but no campaignId', () => {
  const block = backend.slice(backend.indexOf('async def notify_announcement('), backend.indexOf('@api_router.post(\n    "/admin/announcements/{announcement_id}/notify/test"'));
  assert.match(block, /announcement_expiration_time/);
  assert.match(block, /idempotency_key=/);
  assert.doesNotMatch(block, /campaign_id=/);
  assert.match(provider, /X-WonderPush-Idempotency-Key/);
});

test('production announcement links are same-origin and never staging', () => {
  assert.match(backend, /PUBLIC_APP_URL.*https:\/\/theipm\.ca/);
  assert.match(backend, /PUBLIC_APP_URL.*announcements/);
  assert.doesNotMatch(backend, /staging\.theipm\.ca/);
});

test('exact-device tests cannot degrade to broadcast and remain Owner-only in UI', () => {
  assert.match(provider, /targetInstallationIds/);
  assert.match(provider, /target == "@ALL"/);
  assert.match(admin, /showTestAction=\{currentUser\?\.role === 'Owner'\}/);
  assert.match(admin, /Notify Everyone/);
  assert.match(admin, /confirmEveryone/);
});

test('ordinary registration preserves register-before-status lifecycle', () => {
  const absent = registration.indexOf("request('/register', 'POST'");
  const status = registration.indexOf("await request('/status', 'GET'");
  const verify = registration.indexOf("request('/readiness/verify', 'POST'");
  assert.ok(absent > 0 && absent < status && status < verify);
  assert.match(registration, /error\.status !== 404/);
  assert.doesNotMatch(registration, /if \(!existing\)/);
  assert.match(registration, /capability-scoped and idempotent/);
});

test('T-30 delivery and scheduling are hard-disabled by the cutover', () => {
  assert.match(backend, /ITINERARY_REMINDER_DELIVERY_ENABLED = False/);
  assert.match(backend, /ITINERARY_REMINDER_SCHEDULER_ENABLED = False/);
  assert.doesNotMatch(backend, /WONDERPUSH_REMINDER_CAMPAIGN_ID/);
});
