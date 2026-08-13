import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { AdminRequestError, adminRequest } from '../src/services/adminAuthService.ts';

const dashboardSource = await readFile(new URL('../src/components/admin/AnalyticsDashboard.tsx', import.meta.url), 'utf8');
const adminSource = await readFile(new URL('../app/admin/index.tsx', import.meta.url), 'utf8');
const serviceSource = await readFile(new URL('../src/services/adminAnalyticsService.ts', import.meta.url), 'utf8');

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, statusText: '', json: async () => body };
}

test('Analytics is enabled inside authenticated organizer navigation, not a public route', () => {
  assert.match(adminSource, /key: 'analytics', label: 'Analytics'/);
  assert.match(adminSource, /activeSection === 'analytics'/);
  assert.match(adminSource, /<AnalyticsDashboard onAuthenticationExpired=/);
  assert.doesNotMatch(dashboardSource, /export default function.*public|\/analytics\/stats/);
});

test('reporting service sends authenticated range requests to all actual IPM endpoints', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/live')) return response({ timezone: 'America/Toronto', live: {} });
    return response({ range: '30d', timezone: 'America/Toronto' });
  };
  await Promise.all([
    adminRequest('/api/admin/analytics/summary?range=30d'), adminRequest('/api/admin/analytics/traffic?range=30d'),
    adminRequest('/api/admin/analytics/content?range=30d'), adminRequest('/api/admin/analytics/live'),
  ]);
  assert.deepEqual(calls.map((call) => call.url.replace(/^.*\/api/, '/api')), [
    '/api/admin/analytics/summary?range=30d', '/api/admin/analytics/traffic?range=30d',
    '/api/admin/analytics/content?range=30d', '/api/admin/analytics/live',
  ]);
  assert.ok(calls.every((call) => call.init.credentials === 'include'));
  for (const path of ['summary', 'traffic', 'content', 'live']) assert.ok(serviceSource.includes(`/api/admin/analytics/${path}`));
});

test('expired organizer sessions remain detectable by the portal', async () => {
  globalThis.fetch = async () => response({ detail: 'Invalid or expired session' }, 401);
  await assert.rejects(() => adminRequest('/api/admin/analytics/summary?range=today'), (error) => {
    assert.ok(error instanceof AdminRequestError);
    assert.equal(error.status, 401);
    return true;
  });
  assert.match(dashboardSource, /error instanceof AdminRequestError && error\.status === 401/);
});

test('range switching, loading, retry, error and empty states are implemented', () => {
  for (const label of ['Today', '7 Days', '30 Days', 'All Time']) assert.ok(dashboardSource.includes(label));
  assert.match(dashboardSource, /useEffect\(\(\) => \{ void loadAggregates\(range\); \}, \[range, loadAggregates\]\)/);
  assert.match(dashboardSource, /Loading attendee analytics/);
  assert.match(dashboardSource, /Some analytics could not be loaded/);
  assert.match(dashboardSource, /No attendee analytics have been recorded yet/);
  assert.match(dashboardSource, /onRetry=\{manualRefresh\}/);
  assert.match(dashboardSource, /Promise\.allSettled/);
});

test('collection start is server-owned and All Time is explained without a misleading preview date', () => {
  assert.match(serviceSource, /collectionStartedAt: string \| null/);
  assert.match(dashboardSource, /Analytics collecting since:/);
  assert.match(dashboardSource, /Not started in production/);
  assert.match(dashboardSource, /All Time.*all analytics collected since this date/);
  assert.doesNotMatch(dashboardSource, /2026-08-13/);
});

test('only live activity polls every 30 seconds while aggregate loads are range-driven', () => {
  assert.match(dashboardSource, /const LIVE_REFRESH_MS = 30_000/);
  assert.match(dashboardSource, /setInterval\(\(\) => void loadLive\(\), LIVE_REFRESH_MS\)/);
  const intervalLine = dashboardSource.split('\n').find((line) => line.includes('setInterval')) || '';
  assert.doesNotMatch(intervalLine, /loadAggregates/);
  assert.match(dashboardSource, /aggregateRequest/);
  assert.match(dashboardSource, /liveInFlight/);
});

test('overview, traffic, and every requested engagement section render', () => {
  const requiredCopy = [
    'Unique Visitors', 'New Visitors', 'Returning Visitors', 'Sessions', 'App Launches', 'Page Views',
    'Installed PWA Visitors', 'Browser Visitors', 'Average Session', 'Live Activity', 'Today by Hour',
    'Traffic by Day', 'Page Popularity', 'Schedule', 'Vendors', 'Map', 'Queen of the Furrow',
    'Announcements', 'Quick Actions', 'Outbound Links', 'Feature Adoption', 'Event Day Comparison',
    'Zero-result Searches', 'Schedule to Map', 'Bottom Navigation', 'Home Quick Action',
  ];
  for (const label of requiredCopy) assert.ok(dashboardSource.includes(label), label);
});

test('privacy-sensitive identifiers and unsupported claims are absent from dashboard presentation', () => {
  assert.doesNotMatch(dashboardSource, /visitorId|sessionId|destinationUrl|notification conversion rate|Most Viewed Vendor|Queen Entry/);
  assert.match(dashboardSource, /arbitrary URLs are never displayed/);
  assert.match(dashboardSource, /individual entries are not tracked/);
  assert.match(dashboardSource, /not notification conversion/);
});

test('responsive-safe layouts use wrapping, compact stacking, collapsible sections and horizontal tables', () => {
  assert.match(dashboardSource, /const compact = width < 720/);
  assert.match(dashboardSource, /flexWrap: 'wrap'/);
  assert.match(dashboardSource, /splitCompact: \{ flexDirection: 'column' \}/);
  assert.match(dashboardSource, /accessibilityState=\{\{ expanded: open \}\}/);
  assert.match(dashboardSource, /<ScrollView horizontal[^>]*><View style=\{styles\.comparisonTable\}/);
});
