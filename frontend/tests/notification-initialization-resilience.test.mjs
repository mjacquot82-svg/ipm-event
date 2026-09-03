import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const service = await readFile(new URL('../src/services/wonderPushService.web.ts', import.meta.url), 'utf8');
const component = await readFile(new URL('../src/components/NotificationOptIn.tsx', import.meta.url), 'utf8');
const stateGetter = service.slice(
  service.indexOf('export async function getNotificationState'),
  service.indexOf('export async function subscribeToNotifications'),
);

test('slow SDK startup and loader/readiness failures receive one bounded retry', () => {
  assert.match(service, /LOADER_TIMEOUT_MS = 10_000/);
  assert.match(service, /READINESS_TIMEOUT_MS = 15_000/);
  assert.match(service, /initialization = null/);
  assert.match(service, /NOTIFICATION_STATE_ATTEMPTS = 2/);
  assert.match(stateGetter, /attempt < NOTIFICATION_STATE_ATTEMPTS/);
  assert.equal((stateGetter.match(/withSdk\(/g) || []).length, 1);
  assert.doesNotMatch(stateGetter, /setTimeout|setInterval|wait\(/);
});

test('subscription-status timeout is transient and a successful retry preserves state', () => {
  assert.match(stateGetter, /STATUS_TIMEOUT_MS, 'WonderPush notification status timed out\.'/);
  assert.match(stateGetter, /if \(subscribed && Notification\.permission === 'granted'\) return 'subscribed'/);
  assert.match(stateGetter, /return Notification\.permission === 'granted' \? 'unsubscribed' : 'default'/);
  assert.match(stateGetter, /return 'loading'/);
  assert.doesNotMatch(stateGetter, /return 'error'/);
});

test('denied permission and unsupported browsers remain distinct and do not initialize SDK', () => {
  const unsupported = stateGetter.indexOf("if (!isSupported()) return 'unsupported'");
  const denied = stateGetter.indexOf("if (Notification.permission === 'denied') return 'denied'");
  const retry = stateGetter.indexOf('for (let attempt');
  assert.ok(unsupported >= 0 && unsupported < denied && denied < retry);
});

test('status checks never prompt permission and retry cannot loop infinitely', () => {
  assert.doesNotMatch(stateGetter, /requestPermission|subscribeToNotifications|setTimeout|setInterval/);
  assert.match(service, /NOTIFICATION_STATE_ATTEMPTS = 2/);
});

test('focus and online recovery are event-driven, deduplicated, and keep transient UI hidden', () => {
  assert.match(component, /statusCheckInFlightRef\.current/);
  assert.match(component, /if \(statusCheckInFlightRef\.current \|\| navigator\.onLine === false\) return/);
  assert.match(component, /useFocusEffect[\s\S]*notificationStateRef\.current === 'loading' \|\| notificationStateRef\.current === 'recovering'[\s\S]*void refresh\(\)/);
  assert.match(component, /window\.addEventListener\('online', resume\)/);
  assert.match(component, /window\.removeEventListener\('online', resume\)/);
  assert.match(component, /if \(state === 'loading'/);
  assert.doesNotMatch(component.slice(component.indexOf('const refresh ='), component.indexOf('const updateSubscription =')),
    /subscribeToNotifications|requestPermission/);
});

test('a retained transient failure cannot render before focus recovery runs', () => {
  const renderStart = component.indexOf("if (Platform.OS !== 'web') return null");
  const render = component.slice(renderStart, component.indexOf('return (', renderStart));
  assert.match(render, /if \(state === 'recovering'\) return null/);
  assert.doesNotMatch(render, /state === 'error'[\s\S]*return null/);
  assert.match(component, /notificationStateRef\.current === 'recovering'[\s\S]*void refresh\(\)/);
  assert.doesNotMatch(component, /recovering[\s\S]{0,200}setTimeout|recovering[\s\S]{0,200}requestPermission/);
});

test('recoverable mutations use internal state while confirmed error remains user-visible', () => {
  const subscribe = service.slice(service.indexOf('export async function subscribeToNotifications'),
    service.indexOf('export async function getSubscribedInstallationId'));
  assert.equal((subscribe.match(/return 'recovering'/g) || []).length, 1);
  assert.match(subscribe, /\? 'denied' : 'recovering'/);
  assert.doesNotMatch(subscribe, /: 'error'|return 'error'/);
  assert.match(component, /error: 'Notifications are temporarily unavailable/);
});

test('confirmed setup and registration failures retain their explicit recovery UI', () => {
  assert.match(component, /setSetupState\('failed'\)/);
  assert.match(component, /Notifications are enabled, but setup could not be completed\. Tap to try again\./);
  assert.match(component, /accessibilityLabel="Try notification setup again"/);
});
