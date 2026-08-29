import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildRawNotificationObservations,
  classifyDiagnosticFailure,
  formatNotificationContextReport,
  interpretInstalledContext,
  summarizeUserAgent,
} from '../src/services/notificationContextDiagnosticCore.ts';

const rawInput = {
  userAgent: 'Mozilla/5.0 (iPhone) AppleWebKit/605.1 Safari/604.1',
  platform: 'iPhone', maxTouchPoints: 5, displayModeStandalone: false,
  navigatorStandalone: true, notificationAvailable: true, notificationPermission: 'granted',
  serviceWorkerAvailable: true, pushManagerAvailable: true,
  serviceWorkerRegistrationAvailable: true, controllingServiceWorker: true,
  wonderPushSdkLoaded: true,
};

test('standalone signals remain raw and derive installation independently', () => {
  assert.equal(interpretInstalledContext(true, false), 'INSTALLED');
  assert.equal(interpretInstalledContext(false, true), 'INSTALLED');
  assert.equal(interpretInstalledContext(true, true), 'INSTALLED');
  assert.equal(interpretInstalledContext(false, false), 'NOT INSTALLED');
  assert.equal(interpretInstalledContext(null, false), 'UNKNOWN');
  assert.equal(interpretInstalledContext(false, null), 'UNKNOWN');
});

test('user agent reporting is family-only for iPhone and Android', () => {
  assert.equal(summarizeUserAgent('Mozilla/5.0 (iPhone) AppleWebKit/605.1 Safari/604.1'),
    'iOS / Safari-family');
  assert.equal(summarizeUserAgent('Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/128.0'),
    'Android / Chrome-family');
});

test('raw capability reporting distinguishes granted and unavailable browser APIs', () => {
  const granted = buildRawNotificationObservations(rawInput);
  assert.equal(granted.notificationPermission, 'granted');
  assert.equal(granted.serviceWorkerAvailable, 'YES');
  assert.equal(granted.pushManagerAvailable, 'YES');
  assert.equal(granted.displayModeStandalone, 'FALSE');
  assert.equal(granted.navigatorStandalone, 'TRUE');

  const unavailable = buildRawNotificationObservations({ ...rawInput,
    notificationAvailable: false, notificationPermission: undefined,
    serviceWorkerAvailable: false, pushManagerAvailable: false,
    serviceWorkerRegistrationAvailable: null, controllingServiceWorker: false,
    wonderPushSdkLoaded: false });
  assert.equal(unavailable.notificationPermission, 'unavailable');
  assert.equal(unavailable.serviceWorkerAvailable, 'NO');
  assert.equal(unavailable.pushManagerAvailable, 'NO');
  assert.equal(unavailable.serviceWorkerRegistrationAvailable, 'UNKNOWN');
  assert.equal(unavailable.wonderPushSdkLoaded, 'NO');
});

test('backend failures expose safe status, server, timeout, network and malformed classes', () => {
  assert.equal(classifyDiagnosticFailure({ status: 403 }), 'HTTP 403');
  assert.equal(classifyDiagnosticFailure({ status: 503 }), 'HTTP 503');
  assert.equal(classifyDiagnosticFailure(new Error('request timed out')), 'TIMEOUT');
  assert.equal(classifyDiagnosticFailure(new TypeError('fetch failed')), 'NETWORK FAILURE');
  assert.equal(classifyDiagnosticFailure(new SyntaxError('JSON')), 'MALFORMED RESPONSE');
});

const diagnostic = {
  raw: {
    iosDetected: 'YES', userAgentFamily: 'iOS / Safari-family', displayModeStandalone: 'FALSE',
    navigatorStandalone: 'TRUE', notificationAvailable: 'YES', notificationPermission: 'granted',
    serviceWorkerAvailable: 'YES', pushManagerAvailable: 'YES',
    serviceWorkerRegistrationAvailable: 'YES', controllingServiceWorker: 'YES', wonderPushSdkLoaded: 'YES',
  },
  derived: {
    installedContext: 'INSTALLED', wonderPushSdkReady: 'YES', wonderPushSubscribed: 'YES',
    currentInstallationAvailable: 'YES', backendRegistrationExists: 'UNKNOWN',
    installationMatchesRegistration: 'UNKNOWN', providerReadiness: 'UNAVAILABLE',
    failureStage: 'backend_authoritative_verification', backendFailure: 'HTTP 403',
  },
};

test('backend failure does not erase locally known facts from the report', () => {
  const report = formatNotificationContextReport(diagnostic, '2026-08-29T00:00:00.000Z');
  assert.match(report, /display-mode standalone: FALSE/);
  assert.match(report, /navigator\.standalone: TRUE/);
  assert.match(report, /Notification\.permission: granted/);
  assert.match(report, /WonderPush SDK ready: YES/);
  assert.match(report, /WonderPush subscribed: YES/);
  assert.match(report, /Current WonderPush installation available: YES/);
  assert.match(report, /Backend authoritative verification: HTTP 403/);
});

test('rendered diagnostics contain no sensitive identifiers', () => {
  const report = formatNotificationContextReport(diagnostic, '2026-08-29T00:00:00.000Z');
  assert.doesNotMatch(report, /installation[_ -]?id|push[_ -]?token|api[_ -]?key|access[_ -]?token|authorization|cookie|supabase|render secret/i);
});

test('web collector reports every required raw capability without changing notification flow', async () => {
  const [collector, component, wonderPush, reminder] = await Promise.all([
    readFile(new URL('../src/services/notificationContextDiagnostics.web.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/StagingOfflineStatus.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/wonderPushService.web.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/reminderUxService.web.ts', import.meta.url), 'utf8'),
  ]);
  for (const required of ['matchMedia', 'navigatorStandalone', "'Notification' in window",
    'Notification.permission', 'navigator.serviceWorker', "'PushManager' in window",
    "getRegistration('/')", 'serviceWorker?.controller', 'window.WonderPush']) {
    assert.match(collector, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(component, /isStagingWeb/);
  assert.match(component, /RAW browser\/runtime observations/);
  assert.match(component, /DERIVED IPM interpretations/);
  assert.match(component, /UNKNOWN — initializing/);
  assert.doesNotMatch(collector, /subscribeToNotifications|registerControlledTestDevice|configureItineraryReminderSync/);
  assert.match(collector, /getAttendeeReminderStatus\(\{ verifyProvider: false \}\)/);
  assert.match(wonderPush, /subscribeToNotifications/);
  assert.match(reminder, /subscribeToNotifications/);
});

test('itinerary preserves client diagnostics and classifies backend stages', async () => {
  const [ux, sync, itinerary] = await Promise.all([
    readFile(new URL('../src/services/reminderUxService.web.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/itineraryReminderSync.web.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/(tabs)/itinerary.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(ux, /redactedDiagnostics\(error\.client, error\.registration/);
  assert.match(ux, /registrationLookupCompleted/);
  assert.match(sync, /backend_authoritative_verification/);
  assert.match(sync, /backend_registration/);
  assert.match(sync, /provider_verification/);
  assert.match(sync, /classifyDiagnosticFailure/);
  assert.match(itinerary, /Backend authoritative verification/);
});
