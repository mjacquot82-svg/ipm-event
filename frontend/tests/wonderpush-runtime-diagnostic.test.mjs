import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  interpretWonderPushSessionState,
  safeWonderPushRawState,
} from '../src/services/wonderPushRuntimeDiagnosticCore.ts';

const diagnostic = await readFile(new URL('../src/services/wonderPushRuntimeDiagnostic.web.ts', import.meta.url), 'utf8');
const about = await readFile(new URL('../app/(tabs)/about.tsx', import.meta.url), 'utf8');
const notificationCard = await readFile(new URL('../src/components/NotificationOptIn.tsx', import.meta.url), 'utf8');

const states = { INIT_FAILED: -1, INIT_UNSTARTED: 0, INIT_INPROGRESS: 1, INIT_SUCCESS: 2 };

test('maps every known WonderPush session state and safely handles unknown values', () => {
  for (const [name, value] of Object.entries(states)) {
    assert.equal(interpretWonderPushSessionState(value, states), name);
  }
  assert.equal(interpretWonderPushSessionState(99, states), 'UNKNOWN');
  assert.equal(interpretWonderPushSessionState({ secret: true }, states), 'UNKNOWN');
  assert.equal(safeWonderPushRawState({ secret: true }), 'UNKNOWN');
});

test('diagnostic refresh performs only read operations', () => {
  const reader = diagnostic.slice(diagnostic.indexOf('export async function readWonderPushRuntimeDiagnostic'));
  assert.match(reader, /getSessionState/);
  assert.match(reader, /getInstallationId/);
  assert.match(reader, /isSubscribedToNotifications/);
  assert.match(reader, /getSubscription/);
  assert.doesNotMatch(reader, /initializeWonderPush|subscribeToNotifications|unsubscribeFromNotifications|requestPermission|ensureNotificationRegistration|fetch\(|request\(/);
});

test('diagnostic renders state only and never sensitive provider or device material', () => {
  for (const label of ['SDK loaded', 'SDK ready', 'Session raw state', 'Session interpreted state',
    'Current installation available', 'WonderPush subscribed', 'Browser PushSubscription present',
    'Notification permission', 'Registration workflow state', 'Home classification']) {
    assert.match(about, new RegExp(label));
  }
  assert.doesNotMatch(about, /installationId|pushToken|accessToken|webKey|capability|authorization/i);
  assert.doesNotMatch(diagnostic, /endpoint|toJSON|applicationServerKey|localStorage|indexedDB|fetch\(/);
});

test('transition history is in-memory, bounded, and observer-only', () => {
  assert.match(diagnostic, /MAX_TRANSITIONS = 10/);
  assert.match(diagnostic, /window\.addEventListener\('WonderPushEvent'/);
  assert.doesNotMatch(diagnostic, /AsyncStorage|localStorage|sessionStorage/);
});

test('Home setup behavior is unchanged apart from publishing safe workflow state', () => {
  assert.match(notificationCard, /await waitForWonderPushSessionReady\(\)/);
  assert.match(notificationCard, /await ensureNotificationRegistration\(\)/);
  assert.match(notificationCard, /recordNotificationWorkflowDiagnostic\('PENDING'\)/);
  assert.match(notificationCard, /recordNotificationWorkflowDiagnostic\('FAILED', safeClassification \|\| 'other'\)/);
});
