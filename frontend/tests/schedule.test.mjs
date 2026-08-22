import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const scheduleSource = await readFile(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8');
const itinerarySource = await readFile(new URL('../app/(tabs)/itinerary.tsx', import.meta.url), 'utf8');

test('attendee schedule derives real category filters and combines them with day, search, and Starred', () => {
  assert.match(scheduleSource, /new Set\(events\.map\(\(event\) => event\.category\)\.filter\(Boolean\)\)/);
  assert.match(scheduleSource, /event\.category !== selectedCategory/);
  assert.match(scheduleSource, /!getEventDayLabels\(event\)\.includes\(selectedDay\)/);
  assert.match(scheduleSource, /showFavoritesOnly && !favorites\.includes\(event\.id\)/);
  assert.match(scheduleSource, /normalizedSearch/);
});

test('blank schedule descriptions remain optional in cards, details, and itinerary', () => {
  assert.match(scheduleSource, /event\.description \? \(/);
  assert.match(scheduleSource, /selectedEvent\.description && \(/);
  assert.match(itinerarySource, /item\.description \? \(/);
});

test('attendee schedule and itinerary use Ontario-safe date-only formatting', () => {
  assert.match(scheduleSource, /formatScheduleDate\(dateStr/);
  assert.match(scheduleSource, /getScheduleWeekday\(dateStr\)/);
  assert.doesNotMatch(scheduleSource, /new Date\(dateStr\)/);
  assert.match(itinerarySource, /formatScheduleDate\(dateStr/);
});
