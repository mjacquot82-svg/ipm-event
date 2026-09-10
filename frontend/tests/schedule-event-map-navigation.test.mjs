import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const schedulePath = new URL('../app/(tabs)/schedule.tsx', import.meta.url);
const scheduleSource = fs.readFileSync(schedulePath, 'utf8');

test('Find on the Map dismisses the modal without replaying modal history', () => {
  const locationStart = scheduleSource.indexOf('{/* Location */}');
  const categoryStart = scheduleSource.indexOf('{/* Category */}', locationStart);
  assert.ok(locationStart >= 0 && categoryStart > locationStart);
  const locationSection = scheduleSource.slice(locationStart, categoryStart);

  assert.match(locationSection, /dismissEventModalForMap\(\)/);
  assert.match(locationSection, /router\.replace\(/);
  assert.match(locationSection, /pathname:\s*['"]\/\(tabs\)\/map['"]/);
  assert.match(locationSection, /showOnly:\s*['"]true['"]/);
  assert.match(locationSection, /source:\s*['"]schedule['"]/);
  assert.doesNotMatch(locationSection, /closeEventModal\(\)/);
  assert.doesNotMatch(locationSection, /window\.history\.(back|go|forward)/);
});

test('normal event-detail browser Back history remains present separately', () => {
  assert.match(scheduleSource, /const eventModalHistoryRef = useRef\(false\)/);
  assert.match(scheduleSource, /const closeEventModal = useCallback/);
  assert.match(scheduleSource, /window\.history\.go\(returnToItineraryRef\.current \? -2 : -1\)/);
});
