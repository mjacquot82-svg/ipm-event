import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/components/NotificationOptIn.tsx', import.meta.url), 'utf8');

test('notification options are explicit and IPM-branded', () => {
  assert.match(source, /Get important IPM updates/);
  assert.match(source, /Notification options/);
  assert.match(source, /accessibilityLabel=\{state === 'subscribed' \? 'Disable IPM notifications' : persistent \? 'Turn on event reminders' : 'Enable IPM notifications'\}/);
});

test('onboarding reuses the existing enrollment action and local dismissal policy', () => {
  assert.match(source, /onPress={updateSubscription}/);
  assert.match(source, /ensureNotificationRegistration\(\{allowEnrollment\}\)/);
  assert.match(source, /homeDismissed/);
});

test('already-ready and offline states do not render a modal', () => {
  assert.match(source, /verificationDeferred/);
  assert.match(source, /if \(navigator\.onLine === false\)/);
  assert.match(source, /stateMessage/);
});

test('persistent options are independent of promotional dismissal', () => {
  assert.match(source, /persistent = false/);
  assert.match(source, /initiallyExpanded \|\| persistent/);
  assert.match(source, /onPress=\{updateSubscription\}/);
  assert.match(source, /persistent \? \(state === 'subscribed' \? 'Event reminders ✓' : 'Event reminders'\) : 'Get important IPM updates'/);
  assert.match(source, /Notification options/);
});
