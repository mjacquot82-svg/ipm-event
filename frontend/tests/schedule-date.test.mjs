import assert from 'node:assert/strict';
import test from 'node:test';

import { formatScheduleDate, getScheduleWeekday, IPM_TIMEZONE } from '../src/utils/scheduleDate.ts';

const expected = [
  ['2026-09-22', 'Tuesday', 'Tuesday, September 22'],
  ['2026-09-23', 'Wednesday', 'Wednesday, September 23'],
  ['2026-09-24', 'Thursday', 'Thursday, September 24'],
  ['2026-09-25', 'Friday', 'Friday, September 25'],
  ['2026-09-26', 'Saturday', 'Saturday, September 26'],
];

test('IPM date-only schedule values stay on their Ontario calendar dates', () => {
  assert.equal(IPM_TIMEZONE, 'America/Toronto');
  for (const [date, weekday, display] of expected) {
    assert.equal(getScheduleWeekday(date), weekday);
    assert.equal(formatScheduleDate(date, { weekday: 'long', month: 'long', day: 'numeric' }), display);
  }
});

test('invalid date-only values fail safely and non-date timestamps retain normal behavior', () => {
  assert.equal(getScheduleWeekday('2026-09-31'), null);
  assert.equal(formatScheduleDate('not-a-date', { weekday: 'long' }), null);
  assert.ok(formatScheduleDate('2026-09-22T14:00:00-04:00', { hour: 'numeric' }));
});
