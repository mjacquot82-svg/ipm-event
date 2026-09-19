import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const schedule = fs.readFileSync(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8');
const itinerary = fs.readFileSync(new URL('../app/(tabs)/itinerary.tsx', import.meta.url), 'utf8');
const reminderUx = fs.readFileSync(new URL('../src/services/reminderUxService.web.ts', import.meta.url), 'utf8');

test('Schedule explains starring, My Itinerary, and approximate reminder timing', () => {
  assert.match(schedule, /Star events to add them to your itinerary/);
  assert.match(schedule, /approximately 30 minutes before each event starts/);
  assert.match(schedule, /when notifications are enabled/);
});

test('star confirmation is a lightweight existing banner and uses approximate wording', () => {
  assert.match(schedule, /Added to Personal Itinerary/);
  assert.match(schedule, /Reminder approximately 30 minutes before the event when notifications are enabled/);
  assert.doesNotMatch(schedule, /Modal visible=.*showStarConfirmation/);
});

test('itinerary keeps persistent Event reminders and Notification options discoverable', () => {
  assert.match(itinerary, /Event reminders/);
  assert.match(itinerary, /approximately 30 minutes before starred events/);
  assert.match(itinerary, /Notification options/);
  assert.match(itinerary, /<NotificationOptIn persistent/);
  assert.doesNotMatch(itinerary, /Enable notifications on Home/);
  assert.doesNotMatch(itinerary, /requestPermission|subscribeToNotifications|ensureNotificationRegistration/);
  assert.match(schedule, /const result = await toggleFavorite\(eventId\)/);
  assert.match(reminderUx, /MAX_PROMPT_SHOWS = 2/);
});
