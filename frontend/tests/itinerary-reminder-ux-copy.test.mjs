import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const schedule = fs.readFileSync(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8');
const itinerary = fs.readFileSync(new URL('../app/(tabs)/itinerary.tsx', import.meta.url), 'utf8');
const notificationOptIn = fs.readFileSync(new URL('../src/components/NotificationOptIn.tsx', import.meta.url), 'utf8');
const reminderUx = fs.readFileSync(new URL('../src/services/reminderUxService.web.ts', import.meta.url), 'utf8');

test('Schedule explains starring, My Itinerary, and approximate reminder timing', () => {
  assert.match(schedule, /Star events to add them to your itinerary/);
  assert.match(schedule, /approximately 30 minutes before each event starts/);
  assert.match(schedule, /when notifications are enabled/);
});

test('star confirmation is a lightweight existing banner and uses approximate wording', () => {
  assert.match(schedule, /Added to your itinerary/);
  assert.match(schedule, /Reminder approximately 30 minutes before the event when notifications are enabled/);
  assert.doesNotMatch(schedule, /Modal visible=.*showStarConfirmation/);
});

test('itinerary keeps persistent Event reminders and Notification options discoverable', () => {
  assert.match(itinerary, /Event reminders/);
  assert.match(itinerary, /<NotificationOptIn persistent/);
  assert.doesNotMatch(itinerary, /Enable notifications on Home/);
  assert.doesNotMatch(itinerary, /requestPermission|subscribeToNotifications|ensureNotificationRegistration/);
  assert.match(notificationOptIn, /approximately 30 minutes before your starred events/);
  assert.match(notificationOptIn, /Notification options/);
  assert.match(schedule, /const result = await toggleFavorite\(eventId\)/);
  assert.match(reminderUx, /MAX_PROMPT_SHOWS = 2/);
});

test('persistent reminder panel makes the available opt-in benefit and action prominent', () => {
  const component = fs.readFileSync(new URL('../src/components/NotificationOptIn.tsx', import.meta.url), 'utf8');
  assert.match(component, /Get a reminder approximately 30 minutes before your starred events/);
  assert.match(component, /Turn on event reminders/);
  assert.match(component, /accessibilityLabel=\{state === 'subscribed' \? 'Disable IPM notifications' : persistent \? 'Turn on event reminders'/);
  assert.match(component, /Event reminders ✓/);
  assert.match(component, /You’ll receive reminders for your starred events/);
  assert.match(component, /Notifications are blocked on this device/);
  assert.match(component, /persistent && state === 'denied'/);
});

test('the prominent opt-in remains behind the existing explicit action', () => {
  const component = fs.readFileSync(new URL('../src/components/NotificationOptIn.tsx', import.meta.url), 'utf8');
  assert.match(component, /onPress=\{updateSubscription\}/);
  assert.match(component, /expanded && !verificationDeferred && canAct && !working/);
  assert.doesNotMatch(component, /requestPermission\(\)/);
});
