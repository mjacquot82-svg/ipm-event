import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dashboard = await readFile(new URL('../src/components/admin/AnalyticsDashboard.tsx', import.meta.url), 'utf8');
const admin = await readFile(new URL('../app/admin/index.tsx', import.meta.url), 'utf8');
const service = await readFile(new URL('../src/services/adminAuthService.ts', import.meta.url), 'utf8');

test('admin shows strict deliverable-device adoption with mirror freshness disclosure', () => {
  assert.match(dashboard, /label="Notifications Enabled" value=\{notifications\.deliverable_devices\}/);
  assert.match(dashboard, /WonderPush opt-in with a push token/);
  assert.match(dashboard, /older than 24 hours/);
  assert.match(dashboard, /readiness mirror, not a real-time provider count/);
});

test('announcement stats are exact-ledger aggregates with honest historical fallback', () => {
  assert.match(service, /\/api\/admin\/announcements\/delivery-stats/);
  assert.match(admin, /Known deliverable devices at send/);
  assert.match(admin, /Audience at send: Not available/);
  assert.match(admin, /Provider accepted: Yes/);
  assert.doesNotMatch(admin, /Confirmed:/);
  assert.doesNotMatch(admin, /Opened:/);
});

test('analytics contracts expose no installation IDs, tokens, hashes, or provider references', () => {
  const statsType = service.slice(service.indexOf('export type AnnouncementDeliveryStats ='), service.indexOf('export type AnnouncementDeliveryStatsResponse'));
  assert.doesNotMatch(statsType, /installation_id|push.token|capability_hash|provider_campaign_id/i);
});
