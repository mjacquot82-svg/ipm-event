import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ANALYTICS_MAX_BUFFERED_REQUESTS,
  ANALYTICS_SESSION_TIMEOUT_MS,
  AnalyticsRequestBuffer,
  PageFocusDeduplicator,
  buildOutboundAnalyticsProperties,
  buildSearchAnalyticsProperties,
  generateAnalyticsUuid,
  getOrCreateSession,
  getOrCreateVisitorId,
  isAttendeeAnalyticsPath,
  takeAnalyticsBatch,
} from '../src/analytics/analyticsCore.ts';

class MemoryStorage {
  values = new Map();
  async getItem(key) { return this.values.get(key) ?? null; }
  async setItem(key, value) { this.values.set(key, value); }
  async removeItem(key) { this.values.delete(key); }
}

const uuids = Array.from({ length: 300 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
const uuidSource = () => uuids.shift();

test('visitor ID is generated once and persists', async () => {
  const storage = new MemoryStorage();
  const first = await getOrCreateVisitorId(storage, uuidSource);
  const second = await getOrCreateVisitorId(storage, () => { throw new Error('must not regenerate'); });
  assert.equal(first, second);
});

test('session is reused within 30 minutes and rolls over after inactivity', async () => {
  const storage = new MemoryStorage();
  const first = await getOrCreateSession(storage, 1_000, uuidSource);
  const active = await getOrCreateSession(storage, 1_000 + ANALYTICS_SESSION_TIMEOUT_MS - 1, uuidSource);
  const expired = await getOrCreateSession(storage, 1_000 + (2 * ANALYTICS_SESSION_TIMEOUT_MS), uuidSource);
  assert.equal(first.created, true);
  assert.equal(active.created, false);
  assert.equal(active.session.id, first.session.id);
  assert.equal(expired.created, true);
  assert.notEqual(expired.session.id, first.session.id);
});

test('client event UUIDs are unique', () => {
  const ids = new Set(Array.from({ length: 100 }, () => generateAnalyticsUuid()));
  assert.equal(ids.size, 100);
});

test('event batching preserves order and bounds each batch', () => {
  const events = Array.from({ length: 61 }, (_, index) => index);
  assert.deepEqual(takeAnalyticsBatch(events, 50), Array.from({ length: 50 }, (_, index) => index));
  assert.deepEqual(events, Array.from({ length: 11 }, (_, index) => index + 50));
});

test('failed requests are buffered and retry uses the identical idempotency body', async () => {
  const storage = new MemoryStorage();
  const calls = [];
  let online = false;
  const fetcher = async (url, init) => {
    calls.push({ url, body: init.body });
    if (!online) throw new Error('offline');
    return { ok: true };
  };
  const buffer = new AnalyticsRequestBuffer(storage, fetcher, 'https://example.test');
  const request = { endpoint: '/api/analytics/events', body: { events: [{ clientEventId: 'fixed-id' }] } };
  assert.equal(await buffer.sendOrBuffer(request), false);
  assert.equal(await buffer.size(), 1);
  online = true;
  await buffer.flush();
  assert.equal(await buffer.size(), 0);
  assert.equal(calls[0].body, calls[1].body);
});

test('buffer drops oldest requests when its bounded capacity is exceeded', async () => {
  const storage = new MemoryStorage();
  const buffer = new AnalyticsRequestBuffer(storage, async () => { throw new Error('offline'); }, '');
  for (let index = 0; index < ANALYTICS_MAX_BUFFERED_REQUESTS + 5; index += 1) {
    await buffer.enqueue({ endpoint: '/events', body: { index } });
  }
  assert.equal(await buffer.size(), ANALYTICS_MAX_BUFFERED_REQUESTS);
  const persisted = JSON.parse([...storage.values.values()].find((value) => value.includes('/events')));
  assert.equal(persisted[0].body.index, 5);
});

test('analytics endpoint failure resolves without throwing so attendee actions continue', async () => {
  const storage = new MemoryStorage();
  const buffer = new AnalyticsRequestBuffer(storage, async () => ({ ok: false }), '');
  let actionCompleted = false;
  await buffer.sendOrBuffer({ endpoint: '/events', body: { safe: true } });
  actionCompleted = true;
  assert.equal(actionCompleted, true);
  assert.equal(await buffer.size(), 1);
});

test('permanently rejected payloads are not retried forever', async () => {
  const storage = new MemoryStorage();
  const buffer = new AnalyticsRequestBuffer(storage, async () => ({ ok: false, status: 422 }), '');
  await buffer.sendOrBuffer({ endpoint: '/events', body: { malformed: true } });
  assert.equal(await buffer.size(), 0);
});

test('page focus deduplicates rerenders but counts a later refocus', () => {
  const focus = new PageFocusDeduplicator();
  assert.equal(focus.begin('home'), true);
  assert.equal(focus.begin('home'), false);
  focus.end('home');
  assert.equal(focus.begin('home'), true);
});

test('admin, preview, and development-only routes are excluded', () => {
  for (const path of ['/admin', '/admin/login', '/preview', '/preview-2026', '/coming-soon']) {
    assert.equal(isAttendeeAnalyticsPath(path), false, path);
  }
  for (const path of ['/', '/schedule', '/vendors', '/announcements/abc']) {
    assert.equal(isAttendeeAnalyticsPath(path), true, path);
  }
});

test('search analytics contains derived counts and never raw text', () => {
  const properties = buildSearchAnalyticsProperties('  private words  ', 0);
  assert.deepEqual(properties, { query_length: 13, result_count: 0, zero_results: true });
  assert.equal(JSON.stringify(properties).includes('private'), false);
});

test('outbound analytics contains controlled identifiers and no URL', () => {
  const properties = buildOutboundAnalyticsProperties('tickets', 'ticketing', 'home_quick_action');
  assert.deepEqual(properties, { destination_id: 'tickets', destination_type: 'ticketing', source: 'home_quick_action' });
  assert.equal(Object.keys(properties).some((key) => key.includes('url')), false);
});
