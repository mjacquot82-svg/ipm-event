import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const page = fs.readFileSync(new URL('../app/reminder-test-registration.tsx', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../../backend/server.py', import.meta.url), 'utf8');
const optIn = fs.readFileSync(new URL('../src/components/NotificationOptIn.tsx', import.meta.url), 'utf8');

test('phones enroll normally without displaying installation IDs or capabilities', () => {
  assert.match(page, /Register Marc’s Phone as Device A/);
  assert.match(page, /Register Jen’s Phone as Device B/);
  assert.match(page, /never displayed/);
  assert.doesNotMatch(page, /diagnostic\.installationId|diagnostic\.capabilitySecret/);
});

test('normal attendee notification card no longer links to device diagnostics', () => {
  assert.match(optIn, /display-mode: standalone/);
  assert.doesNotMatch(optIn, /router\.push\('\/reminder-test-registration'(?: as never)?\)/);
  assert.doesNotMatch(optIn, /Device test/);
});

test('safe diagnostics identify every client and API registration stage', () => {
  for (const label of ['Browser permission', 'WonderPush SDK', 'WonderPush subscription',
    'Installation ID', 'Capability', 'Registration API', 'Backend response']) {
    assert.match(page, new RegExp(label));
  }
  assert.doesNotMatch(page, /diagnostic\.installationId|diagnostic\.capabilitySecret/);
  for (const label of ['Backend registration', 'Current installation match',
    'Provider reachability', 'Reminder readiness']) assert.match(page, new RegExp(label));
});

test('iPhone Safari explains the installed Home Screen requirement', () => {
  assert.match(optIn, /Install IPM to your Home Screen/);
  assert.match(optIn, /iPhone\|iPad\|iPod/);
});

test('send guard requires distinct A and B and targets only A', () => {
  assert.match(server, /Only registered Device A may be targeted/);
  assert.match(server, /Distinct Device B registration is required/);
  assert.match(server, /installation_id not in WONDERPUSH_TEST_INSTALLATION_IDS/);
  assert.doesNotMatch(server.slice(server.indexOf('send_itinerary_targeting_test')), /send_everyone/);
  assert.match(server, /distinct_capabilities/);
  assert.match(server, /device_a_verification_code/);
});

test('reminder controls are explicit, Device A only, and promise no send', () => {
  assert.match(page, /Enable 30-Minute Event Reminders/);
  assert.match(page, /Disable Event Reminders/);
  assert.match(page, /status\?\.label === 'A'/);
  assert.match(page, /Enabling or disabling does not send a notification/);
  assert.match(page, /IS_STAGING/);
  assert.match(page, /if \(!IS_STAGING\)/);
});

test('diagnostic page scrolls through all rows on narrow mobile screens', () => {
  assert.match(page, /ScrollView/);
  assert.match(page, /contentContainerStyle=\{styles\.page\}/);
  assert.match(page, /flexGrow: 1/);
  assert.match(page, /paddingBottom: 48/);
  assert.match(page, /showsVerticalScrollIndicator/);
});
