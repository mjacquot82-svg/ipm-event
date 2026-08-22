import assert from 'node:assert/strict';
import test from 'node:test';

import {
  exportScheduleEvent,
  exportScheduleItinerary,
} from '../src/services/calendarService.ts';
import { formatScheduleTimeRange } from '../src/utils/scheduleTime.ts';

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const originalFetch = globalThis.fetch;
const originalDocument = globalThis.document;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

function calendarResponse() {
  return new Response('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n', {
    status: 200,
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'attachment; filename="test.ics"',
    },
  });
}

function setNavigator(value) {
  Object.defineProperty(globalThis, 'navigator', { value, configurable: true });
}

function restoreGlobals() {
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
  else delete globalThis.navigator;
  globalThis.fetch = originalFetch;
  globalThis.document = originalDocument;
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
}

test.afterEach(restoreGlobals);

test('supported Web Share sends the generated calendar file', async () => {
  let shared;
  setNavigator({
    canShare: ({ files }) => files.length === 1 && files[0].type.startsWith('text/calendar'),
    share: async (data) => { shared = data; },
  });
  globalThis.fetch = async () => calendarResponse();
  assert.equal(await exportScheduleEvent('schedule-1'), 'shared');
  assert.equal(shared.files[0].name, 'test.ics');
});

test('cancelled share sheet is not reported as success and does not download', async () => {
  let downloaded = false;
  setNavigator({
    canShare: () => true,
    share: async () => { throw new DOMException('cancelled', 'AbortError'); },
  });
  globalThis.fetch = async () => calendarResponse();
  URL.createObjectURL = () => { downloaded = true; return 'blob:test'; };
  assert.equal(await exportScheduleEvent('schedule-1'), 'cancelled');
  assert.equal(downloaded, false);
});

test('unsupported file sharing uses the safe download fallback', async () => {
  let clicked = false;
  setNavigator({ canShare: () => false });
  globalThis.fetch = async () => calendarResponse();
  URL.createObjectURL = () => 'blob:test';
  URL.revokeObjectURL = () => {};
  globalThis.document = {
    body: { appendChild: () => {} },
    createElement: () => ({ click: () => { clicked = true; }, remove: () => {} }),
  };
  assert.equal(await exportScheduleEvent('schedule-1'), 'downloaded');
  assert.equal(clicked, true);
});

test('bulk export submits exactly the starred UUIDs', async () => {
  let request;
  setNavigator({ canShare: () => true, share: async () => {} });
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return calendarResponse();
  };
  assert.equal(await exportScheduleItinerary(['one', 'two']), 'shared');
  assert.deepEqual(JSON.parse(request.options.body), { schedule_ids: ['one', 'two'] });
  assert.match(request.url, /\/api\/schedule\/calendar$/);
});

test('export errors are surfaced and an empty itinerary is rejected', async () => {
  globalThis.fetch = async () => new Response('failed', { status: 500 });
  await assert.rejects(exportScheduleEvent('schedule-1'), /could not be created/);
  await assert.rejects(exportScheduleItinerary([]), /Star at least one event/);
});

test('shared time formatting preserves ranges and omits a trailing separator', () => {
  assert.equal(formatScheduleTimeRange('10:00 AM', '11:00 AM'), '10:00 AM - 11:00 AM');
  assert.equal(formatScheduleTimeRange('11:00 AM', ''), '11:00 AM');
  assert.equal(formatScheduleTimeRange('11:00 AM', null), '11:00 AM');
});
