import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const schedule = await readFile(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8');
const itinerary = await readFile(new URL('../app/(tabs)/itinerary.tsx', import.meta.url), 'utf8');

test('Schedule details expose an accessible explicit calendar action', () => {
  assert.match(schedule, />\s*Add to Calendar\s*</);
  assert.match(schedule, /accessibilityLabel=\{`Add \$\{selectedEvent\.title\} to calendar`\}/);
  assert.match(schedule, /exportScheduleEvent\(eventId\)/);
  assert.match(schedule, /'Remove from Itinerary' : 'Add to Itinerary'/);
});

test('single-event Add to Calendar opens a dismissible provider chooser', () => {
  assert.match(schedule, /setShowCalendarChooser\(true\)/);
  assert.match(schedule, /visible=\{showCalendarChooser && Boolean\(selectedEvent\)\}/);
  assert.match(schedule, />Google Calendar</);
  assert.match(schedule, /Fastest for Google Calendar users/);
  assert.match(schedule, />Other Calendar</);
  assert.match(schedule, /Apple Calendar, Outlook, and other calendar apps/);
  assert.match(schedule, /accessibilityLabel="Dismiss calendar choices"/);
});

test('Google choice uses the canonical backend link without exporting or changing favorites', () => {
  const googleHandler = schedule.match(/const handleGoogleCalendar[\s\S]*?^  \};/m)?.[0] || '';
  assert.match(googleHandler, /Linking\.openURL\(getGoogleCalendarUrl\(eventId\)\)/);
  assert.doesNotMatch(googleHandler, /exportScheduleEvent|toggleFavorite/);
});

test('start-only events omit Google choice and retain Other Calendar', () => {
  assert.match(schedule, /selectedEvent\?\.end_time \? \(/);
  assert.match(schedule, /This event has no confirmed end time/);
  assert.match(schedule, /handleCalendarExport\(selectedEvent\.id\)/);
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
