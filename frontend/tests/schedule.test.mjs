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

test('desktop retains category pills while mobile uses the compact category selector', () => {
  assert.match(scheduleSource, /viewportWidth >= ATTENDEE_DESKTOP_BREAKPOINT/);
  assert.match(scheduleSource, /categoryOptions\.length > 0 && isDesktop/);
  assert.match(scheduleSource, /categoryOptions\.length > 0 && !isDesktop/);
  assert.match(scheduleSource, />\s*Categories\s*</);
  assert.match(scheduleSource, /selectedCategory \? '1 category selected' : 'All categories'/);
});

test('mobile category selector exposes every full category option and supports clear and dismissal', () => {
  assert.match(scheduleSource, /\[null, \.\.\.categoryOptions\]\.map/);
  assert.match(scheduleSource, /const label = category \|\| 'All categories'/);
  assert.match(scheduleSource, /onPress=\{\(\) => selectCategory\(category\)\}/);
  assert.match(scheduleSource, /onRequestClose=\{\(\) => setShowCategorySelector\(false\)\}/);
  assert.match(scheduleSource, /accessibilityLabel="Close category selector"/);
  assert.match(scheduleSource, /accessibilityState=\{\{ selected: isActive \}\}/);
});

test('mobile keeps day controls and category composes with day, search, and Starred', () => {
  assert.match(scheduleSource, /dayOptions\.map\(\(day\)/);
  assert.match(scheduleSource, /setSelectedDay\(isActive \? null : day\)/);
  assert.match(scheduleSource, /selectedCategory && event\.category !== selectedCategory/);
  assert.match(scheduleSource, /selectedDay && !getEventDayLabels\(event\)\.includes\(selectedDay\)/);
  assert.match(scheduleSource, /normalizedSearch/);
  assert.match(scheduleSource, /showFavoritesOnly && !favorites\.includes\(event\.id\)/);
});

test('blank schedule descriptions remain optional in cards, details, and itinerary', () => {
  assert.match(scheduleSource, /event\.description \? \(/);
  assert.match(scheduleSource, /selectedEvent\.description && \(/);
  assert.match(itinerarySource, /item\.description \? \(/);
});

test('start-time-only events render without a trailing separator', () => {
  assert.match(scheduleSource, /\[event\.start_time, event\.end_time\]\.filter\(Boolean\)\.join\(' - '\)/);
  assert.match(scheduleSource, /\[selectedEvent\.start_time, selectedEvent\.end_time\]\.filter\(Boolean\)\.join\(' - '\)/);
  assert.doesNotMatch(scheduleSource, /\{event\.start_time\} - \{event\.end_time\}/);
  assert.doesNotMatch(scheduleSource, /\{selectedEvent\.start_time\} - \{selectedEvent\.end_time\}/);
});

test('mobile category selector derives options and therefore includes Parade Week', () => {
  assert.match(scheduleSource, /new Set\(events\.map\(\(event\) => event\.category\)\.filter\(Boolean\)\)/);
  assert.match(scheduleSource, /\[null, \.\.\.categoryOptions\]\.map/);
});

test('attendee schedule and itinerary use Ontario-safe date-only formatting', () => {
  assert.match(scheduleSource, /formatScheduleDate\(dateStr/);
  assert.match(scheduleSource, /getScheduleWeekday\(dateStr\)/);
  assert.doesNotMatch(scheduleSource, /new Date\(dateStr\)/);
  assert.match(itinerarySource, /formatScheduleDate\(dateStr/);
});
