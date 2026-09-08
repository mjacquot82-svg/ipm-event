import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dashboard = await readFile(new URL('../src/components/admin/AnalyticsDashboard.tsx', import.meta.url), 'utf8');
const admin = await readFile(new URL('../app/admin/index.tsx', import.meta.url), 'utf8');
const service = await readFile(new URL('../src/services/adminAuthService.ts', import.meta.url), 'utf8');

test('admin explains notification health without promising receipt', () => {
  assert.match(dashboard, /title="Notification Health"/);
  assert.match(dashboard, /label="Notification registrations"/);
  assert.match(dashboard, /does not necessarily represent a unique attendee or guarantee delivery/);
  assert.match(dashboard, /older than 24 hours/);
  assert.match(dashboard, /True device delivery and provider click totals are not available/);
  assert.match(dashboard, /Repairs verified.*Not recorded/);
  assert.match(dashboard, /intentionally not automatically repaired/);
});

test('announcement stats are exact-ledger aggregates with honest historical fallback', () => {
  assert.match(service, /\/api\/admin\/announcements\/delivery-stats/);
  assert.match(admin, /Provider-ready registrations at send/);
  assert.match(admin, /Audience at send: Not available/);
  assert.match(admin, /Provider accepted: Yes/);
  assert.doesNotMatch(admin, /Confirmed:/);
  assert.doesNotMatch(admin, /Opened:/);
});

test('analytics contracts expose no installation IDs, tokens, hashes, or provider references', () => {
  const statsType = service.slice(service.indexOf('export type AnnouncementDeliveryStats ='), service.indexOf('export type AnnouncementDeliveryStatsResponse'));
  assert.doesNotMatch(statsType, /installation_id|push.token|capability_hash|provider_campaign_id/i);
});

test('notification analytics remains additive when production backend is older', () => {
  assert.match(admin, /Delivery analytics is additive; an older backend must not block Announcements/);
  assert.match(dashboard, /Notification health:.*handleError/);
});
