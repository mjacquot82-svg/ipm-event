import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const schedule = await readFile(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8');
const itinerary = await readFile(new URL('../app/(tabs)/itinerary.tsx', import.meta.url), 'utf8');

test('Schedule details expose an accessible explicit calendar action', () => {
  assert.match(schedule, /'Add to Calendar'/);
  assert.match(schedule, /accessibilityLabel=\{`Add \$\{selectedEvent\.title\} to calendar`\}/);
  assert.match(schedule, /exportScheduleEvent\(eventId\)/);
  assert.match(schedule, /'Remove from Itinerary' : 'Add to Itinerary'/);
});

test('starring remains independent and never calls calendar export', () => {
  const favoriteHandler = schedule.match(/const handleToggleFavorite[\s\S]*?^  \};/m)?.[0] || '';
  assert.match(favoriteHandler, /toggleFavorite\(eventId\)/);
  assert.doesNotMatch(favoriteHandler, /exportSchedule/);
});

test('itinerary bulk action is conditional and submits current starred event UUIDs', () => {
  assert.match(itinerary, /starredEvents\.length > 0 \? \(/);
  assert.match(itinerary, /Add My Itinerary to Calendar/);
  assert.match(itinerary, /starredEvents\.map\(\(event\) => event\.id\)/);
});

test('bulk confirmation clearly discloses snapshot behavior and supports dismissal', () => {
  assert.match(itinerary, /Export \{starredEvents\.length\} starred event/);
  assert.match(itinerary, /This creates a snapshot\. Changes to your IPM itinerary won&apos;t automatically update your calendar\./);
  assert.match(itinerary, /onRequestClose=\{\(\) => setShowCalendarConfirmation\(false\)\}/);
  assert.match(itinerary, /accessibilityLabel="Cancel calendar export"/);
});

test('completion wording does not claim that calendar import succeeded', () => {
  const message = 'Calendar file created. Complete the import in your calendar app.';
  assert.match(schedule, new RegExp(message.replaceAll('.', '\\.')));
  assert.match(itinerary, new RegExp(message.replaceAll('.', '\\.')));
  assert.doesNotMatch(schedule, /Added to your calendar/);
  assert.doesNotMatch(itinerary, /Added to your calendar/);
});

test('Schedule and Itinerary share null-safe time-range formatting', () => {
  assert.match(schedule, /formatScheduleTimeRange\(event\.start_time, event\.end_time\)/);
  assert.match(schedule, /formatScheduleTimeRange\(selectedEvent\.start_time, selectedEvent\.end_time\)/);
  assert.match(itinerary, /formatScheduleTimeRange\(item\.start_time, item\.end_time\)/);
  assert.doesNotMatch(itinerary, /\{item\.start_time\} - \{item\.end_time\}/);
});
