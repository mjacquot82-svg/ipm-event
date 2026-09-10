import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const scheduleSource = await readFile(
  new URL('../app/(tabs)/schedule.tsx', import.meta.url),
  'utf8',
);
const mapSource = await readFile(
  new URL('../app/(tabs)/map.tsx', import.meta.url),
  'utf8',
);

function locationActionSource() {
  const start = scheduleSource.indexOf('{/* Location */}');
  const end = scheduleSource.indexOf('{/* Category */}', start);
  assert.notEqual(start, -1, 'event location section must exist');
  assert.notEqual(end, -1, 'event category section must follow the location section');
  return scheduleSource.slice(start, end);
}

test('Find on the Map dismisses the event modal and performs one map navigation', () => {
  const source = locationActionSource();

  assert.match(source, /setShowEventModal\(false\);\s*router\.push\(/);
  assert.match(source, /pathname:\s*['"]\/\(tabs\)\/map['"]/);
  assert.match(source, /location:\s*selectedEvent\.location_name/);
  assert.match(source, /showOnly:\s*['"]true['"]/);
  assert.match(source, /source:\s*['"]schedule['"]/);

  // Regression guard for build 363016: closing the modal must not consume the
  // map transition through a competing browser-history operation.
  assert.doesNotMatch(source, /window\.history\.(?:back|go|forward)\s*\(/);
  assert.doesNotMatch(source, /closeEventModal\s*\(/);
  assert.doesNotMatch(scheduleSource, /eventModalHistoryRef|__ipmEventModal|openedEventParamRef/);
});

test('map route has no automatic navigation back to Schedule', () => {
  assert.doesNotMatch(mapSource, /router\.(?:back|push|replace)\s*\(/);
  assert.doesNotMatch(mapSource, /window\.history\.(?:back|go|forward)\s*\(/);
});
