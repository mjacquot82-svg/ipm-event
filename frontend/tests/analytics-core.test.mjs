import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ANALYTICS_MAX_BUFFERED_REQUESTS,
  ANALYTICS_SESSION_TIMEOUT_MS,
  AnalyticsRequestBuffer,
  AnalyticsSessionRecovery,
  ResilientAnalyticsStorage,
  PageFocusDeduplicator,
  buildOutboundAnalyticsProperties,
  buildSearchAnalyticsProperties,
  clearSession,
  generateAnalyticsUuid,
  getOrCreateSession,
  getOrCreateVisitorId,
  isAttendeeAnalyticsPath,
  shouldInitializeAttendeeAnalytics,
  takeAnalyticsBatch,
} from '../src/analytics/analyticsCore.ts';
import {
  getAnalyticsDiagnostics,
  recordAnalyticsDiagnostic,
} from '../src/analytics/analyticsDiagnostics.ts';

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

test('production attendee root initializes and attempts session start', async () => {
  assert.equal(shouldInitializeAttendeeAnalytics('/', 'https://ipm-backend-eoiw.onrender.com'), true);
  const storage = new MemoryStorage();
  const visitorId = await getOrCreateVisitorId(storage, uuidSource);
  const session = await getOrCreateSession(storage, 1_000, uuidSource);
  const calls = [];
  const transport = new AnalyticsRequestBuffer(storage, async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, status: 202 };
  }, 'https://ipm-backend-eoiw.onrender.com');
  if (session.created) {
    await transport.sendOrBuffer({
      endpoint: '/api/analytics/session/start',
      body: { visitorId, sessionId: session.session.id, clientEventId: generateAnalyticsUuid(uuidSource) },
    });
  }
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://ipm-backend-eoiw.onrender.com/api/analytics/session/start');
});

test('excluded and unconfigured routes do not initialize analytics', () => {
  const backend = 'https://ipm-backend-eoiw.onrender.com';
  for (const path of ['/admin', '/admin/login', '/preview', '/preview-2026', '/coming-soon']) {
    assert.equal(shouldInitializeAttendeeAnalytics(path, backend), false, path);
  }
  assert.equal(shouldInitializeAttendeeAnalytics('/', ''), false);
});

test('storage unavailable falls back to memory and still supports a session start', async () => {
  const diagnostics = [];
  const unavailable = {
    async getItem() { throw new Error('storage unavailable'); },
    async setItem() { throw new Error('storage unavailable'); },
    async removeItem() { throw new Error('storage unavailable'); },
  };
  const storage = new ResilientAnalyticsStorage(unavailable, (code) => diagnostics.push(code));
  const visitorId = await getOrCreateVisitorId(storage, uuidSource);
  const session = await getOrCreateSession(storage, 1_000, uuidSource);
  const calls = [];
  const transport = new AnalyticsRequestBuffer(storage, async (url) => {
    calls.push(url);
    return { ok: true, status: 202 };
  }, 'https://example.test');
  await transport.sendOrBuffer({
    endpoint: '/api/analytics/session/start',
    body: { visitorId, sessionId: session.session.id, clientEventId: generateAnalyticsUuid(uuidSource) },
  });
  assert.equal(storage.isUsingFallback(), true);
  assert.deepEqual(diagnostics, ['storage_fallback']);
  assert.deepEqual(calls, ['https://example.test/api/analytics/session/start']);
});

test('storage that throws during a write switches once to a stable memory fallback', async () => {
  let writes = 0;
  const throwing = {
    async getItem() { return null; },
    async setItem() { writes += 1; throw new Error('quota denied'); },
    async removeItem() { throw new Error('quota denied'); },
  };
  const storage = new ResilientAnalyticsStorage(throwing);
  const visitor = await getOrCreateVisitorId(storage, uuidSource);
  assert.equal(await getOrCreateVisitorId(storage, () => { throw new Error('must reuse fallback visitor'); }), visitor);
  assert.equal(writes, 1);
});

test('resilient storage preserves persistent visitor and 30-minute session behavior when available', async () => {
  const persistent = new MemoryStorage();
  const storage = new ResilientAnalyticsStorage(persistent);
  const visitor = await getOrCreateVisitorId(storage, uuidSource);
  assert.equal(await getOrCreateVisitorId(storage, () => { throw new Error('must persist'); }), visitor);
  const first = await getOrCreateSession(storage, 1_000, uuidSource);
  const resumed = await getOrCreateSession(storage, 1_000 + ANALYTICS_SESSION_TIMEOUT_MS - 1, uuidSource);
  assert.equal(resumed.created, false);
  assert.equal(resumed.session.id, first.session.id);
  assert.equal(storage.isUsingFallback(), false);
});

test('production diagnostics are bounded and contain only technical codes', () => {
  for (let index = 0; index < 20; index += 1) recordAnalyticsDiagnostic('transport_rejected', '422');
  const entries = getAnalyticsDiagnostics();
  assert.equal(entries.length, 12);
  assert.deepEqual(Object.keys(entries[0]).sort(), ['at', 'code', 'detail']);
  assert.equal(entries.every((entry) => entry.code === 'transport_rejected' && entry.detail === '422'), true);
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

const invalidSessionResponse = () => ({
  ok: false,
  status: 422,
  json: async () => ({ detail: 'session is missing, ended, or inactive' }),
});

test('long offline activity retires the expired session, discards its events, and starts a fresh session', async () => {
  const storage = new MemoryStorage();
  const recovery = new AnalyticsSessionRecovery();
  const first = await getOrCreateSession(storage, 0, uuidSource);
  const oldSessionId = first.session.id;
  // Local activity at 20 and 40 minutes keeps the client session locally fresh,
  // while the server has received nothing for longer than its 30-minute limit.
  await getOrCreateSession(storage, 20 * 60_000, uuidSource);
  const locallyActive = await getOrCreateSession(storage, 40 * 60_000, uuidSource);
  assert.equal(locallyActive.session.id, oldSessionId);

  let online = false;
  let currentSessionId = oldSessionId;
  let recoveryCount = 0;
  const calls = [];
  let buffer;
  const fetcher = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body });
    if (!online) throw new Error('offline');
    if (body.sessionId === oldSessionId) return invalidSessionResponse();
    return { ok: true, status: 202 };
  };
  buffer = new AnalyticsRequestBuffer(storage, fetcher, 'https://example.test', false, async (rejectedSessionId) => {
    assert.equal(rejectedSessionId, oldSessionId);
    await recovery.run(async () => {
      recoveryCount += 1;
      await clearSession(storage);
      const fresh = await getOrCreateSession(storage, 40 * 60_000 + 1, uuidSource);
      currentSessionId = fresh.session.id;
      await buffer.sendOrBuffer({
        endpoint: '/api/analytics/session/start',
        body: { visitorId: 'visitor', sessionId: currentSessionId, clientEventId: 'fresh-start' },
      });
    });
  });

  const oldRequest = {
    endpoint: '/api/analytics/events',
    body: { visitorId: 'visitor', sessionId: oldSessionId, events: [{ clientEventId: 'old-event' }] },
  };
  await buffer.sendOrBuffer(oldRequest);
  assert.equal(await buffer.size(), 1);
  online = true;
  await buffer.flush();

  assert.equal(recoveryCount, 1);
  assert.notEqual(currentSessionId, oldSessionId);
  assert.equal(await buffer.size(), 0);
  assert.equal(calls.filter((call) => call.body.events?.[0]?.clientEventId === 'old-event').length, 2);
  assert.equal(calls.filter((call) => call.body.clientEventId === 'fresh-start').length, 1);

  const newEventAccepted = await buffer.sendOrBuffer({
    endpoint: '/api/analytics/events',
    body: { visitorId: 'visitor', sessionId: currentSessionId, events: [{ clientEventId: 'new-event' }] },
  });
  assert.equal(newEventAccepted, true);
});

test('concurrent invalid-session signals use one recovery and cannot loop', async () => {
  const recovery = new AnalyticsSessionRecovery();
  let releases;
  const gate = new Promise((resolve) => { releases = resolve; });
  let recoveries = 0;
  const task = async () => { recoveries += 1; await gate; };
  const first = recovery.run(task);
  const second = recovery.run(task);
  assert.equal(first, second);
  releases();
  await Promise.all([first, second]);
  assert.equal(recoveries, 1);
});

test('short offline periods replay the existing session without recovery', async () => {
  const storage = new MemoryStorage();
  const first = await getOrCreateSession(storage, 0, uuidSource);
  const resumed = await getOrCreateSession(storage, ANALYTICS_SESSION_TIMEOUT_MS - 1, uuidSource);
  assert.equal(resumed.session.id, first.session.id);
  let recoveries = 0;
  let online = false;
  const buffer = new AnalyticsRequestBuffer(storage, async () => {
    if (!online) throw new Error('offline');
    return { ok: true, status: 202 };
  }, '', false, () => { recoveries += 1; });
  await buffer.sendOrBuffer({ endpoint: '/api/analytics/events', body: { sessionId: first.session.id } });
  online = true;
  await buffer.flush();
  assert.equal(recoveries, 0);
  assert.equal(await buffer.size(), 0);
});

test('an explicitly ended session is retired and attendee work remains non-blocking', async () => {
  const storage = new MemoryStorage();
  const oldSessionId = (await getOrCreateSession(storage, 0, uuidSource)).session.id;
  let recovered = false;
  const buffer = new AnalyticsRequestBuffer(storage, async () => invalidSessionResponse(), '', false, async () => {
    await clearSession(storage);
    await getOrCreateSession(storage, 1, uuidSource);
    recovered = true;
  });
  const analyticsWork = buffer.sendOrBuffer({
    endpoint: '/api/analytics/session/heartbeat', body: { sessionId: oldSessionId },
  });
  let attendeeActionCompleted = false;
  attendeeActionCompleted = true;
  await analyticsWork;
  assert.equal(attendeeActionCompleted, true);
  assert.equal(recovered, true);
  const replacement = JSON.parse(await storage.getItem('@ipm_analytics_session_v1'));
  assert.notEqual(replacement.id, oldSessionId);
});

test('unrelated 422 validation failures do not rotate a valid session', async () => {
  const storage = new MemoryStorage();
  const session = await getOrCreateSession(storage, 0, uuidSource);
  let recoveries = 0;
  const buffer = new AnalyticsRequestBuffer(storage, async () => ({
    ok: false, status: 422, json: async () => ({ detail: 'unknown analytics event' }),
  }), '', false, () => { recoveries += 1; });
  await buffer.sendOrBuffer({ endpoint: '/api/analytics/events', body: { sessionId: session.session.id } });
  assert.equal(recoveries, 0);
  assert.equal((await getOrCreateSession(storage, 1, uuidSource)).session.id, session.session.id);
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
