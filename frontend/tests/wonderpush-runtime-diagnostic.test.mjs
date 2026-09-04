import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  interpretWonderPushSessionState,
  safeWonderPushRawState,
  isStagingNotificationDiagnosticEnabled,
  classifyWonderPushAuthenticationResult,
  classifyWonderPushAuthNetworkFailure,
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

test('classifies WonderPush authentication failures without retaining response values', () => {
  assert.equal(classifyWonderPushAuthenticationResult({ status: 0 }), 'AUTH_NETWORK_FAILURE');
  assert.equal(classifyWonderPushAuthenticationResult({ status: 401 }), 'DOMAIN_PROJECT_REJECTION');
  assert.equal(classifyWonderPushAuthenticationResult({ status: 404 }), 'AUTH_HTTP_4XX');
  assert.equal(classifyWonderPushAuthenticationResult({ status: 503 }), 'AUTH_HTTP_5XX');
  assert.equal(classifyWonderPushAuthenticationResult({ status: 200 }), 'AUTH_RESPONSE_INVALID');
  assert.equal(classifyWonderPushAuthenticationResult({ status: 200, validJson: true }),
    'AUTH_RESPONSE_MISSING_TOKEN');
  assert.equal(classifyWonderPushAuthenticationResult({
    status: 200, validJson: true, tokenPresent: true,
  }), 'AUTH_RESPONSE_MISSING_INSTALLATION_ID');
  assert.equal(classifyWonderPushAuthenticationResult({
    status: 200, validJson: true, tokenPresent: true, installationIdPresent: true,
  }), 'NONE');
});

test('classifies passive XHR terminal events distinctly', () => {
  const base = {
    status: 0, onlineAtStart: true, onlineAtTerminal: true,
    offlineDuringRequest: false, cspConnectBlocked: false, resourceTimingPresent: false,
  };
  assert.equal(classifyWonderPushAuthNetworkFailure({ ...base, terminalEvent: 'ABORT' }), 'XHR_ABORT');
  assert.equal(classifyWonderPushAuthNetworkFailure({ ...base, terminalEvent: 'TIMEOUT' }), 'XHR_TIMEOUT');
  assert.equal(classifyWonderPushAuthNetworkFailure({ ...base, terminalEvent: 'ERROR' }),
    'XHR_NETWORK_ERROR_NO_RESOURCE_TIMING');
  assert.equal(classifyWonderPushAuthNetworkFailure({
    ...base, terminalEvent: 'ERROR', resourceTimingPresent: true,
  }), 'XHR_NETWORK_ERROR_WITH_RESOURCE_TIMING');
  assert.equal(classifyWonderPushAuthNetworkFailure({ ...base, terminalEvent: 'LOAD' }),
    'XHR_LOAD_STATUS_ZERO');
});

test('offline and matching CSP observations override generic network errors', () => {
  const base = {
    status: 0, terminalEvent: 'ERROR', onlineAtStart: true, onlineAtTerminal: true,
    offlineDuringRequest: false, cspConnectBlocked: false, resourceTimingPresent: false,
  };
  assert.equal(classifyWonderPushAuthNetworkFailure({ ...base, offlineDuringRequest: true }),
    'OFFLINE_DURING_AUTH');
  assert.equal(classifyWonderPushAuthNetworkFailure({ ...base, onlineAtTerminal: false }),
    'OFFLINE_DURING_AUTH');
  assert.equal(classifyWonderPushAuthNetworkFailure({ ...base, cspConnectBlocked: true }),
    'CSP_CONNECT_BLOCK');
});

test('temporary initialization diagnostic is enabled only for the staging backend', () => {
  assert.equal(isStagingNotificationDiagnosticEnabled('https://ipm-staging-backend.onrender.com'), true);
  assert.equal(isStagingNotificationDiagnosticEnabled('https://ipm-staging-backend.onrender.com/'), true);
  assert.equal(isStagingNotificationDiagnosticEnabled('https://ipm-backend-eoiw.onrender.com'), false);
  assert.equal(isStagingNotificationDiagnosticEnabled(undefined), false);
  assert.equal(isStagingNotificationDiagnosticEnabled('not a url'), false);
});

test('diagnostic refresh performs only read operations', () => {
  const reader = diagnostic.slice(diagnostic.indexOf('export async function readWonderPushRuntimeDiagnostic'));
  assert.match(reader, /getSessionState/);
  assert.match(reader, /getInstallationId/);
  assert.match(reader, /isSubscribedToNotifications/);
  assert.match(reader, /getSubscription/);
  assert.doesNotMatch(reader, /initializeWonderPush|subscribeToNotifications|unsubscribeFromNotifications|requestPermission|ensureNotificationRegistration|fetch\(|request\(/);
});

test('init failure observer is staging-gated, pass-through, and retains no sensitive material', () => {
  const observer = diagnostic.slice(diagnostic.indexOf('export function startWonderPushInitFailureObservation'),
    diagnostic.indexOf('export function startWonderPushRuntimeObservation'));
  assert.match(observer, /if \(!enabled/);
  assert.match(observer, /originalOpen\.call/);
  assert.match(diagnostic, /authentication\/accessToken/);
  assert.doesNotMatch(observer, /\.send\(|subscribeToNotifications|unsubscribeFromNotifications|fetch\(|indexedDB\.open|localStorage|sessionStorage/);
  assert.match(observer, /addEventListener\('error'/);
  assert.match(observer, /addEventListener\('abort'/);
  assert.match(observer, /addEventListener\('timeout'/);
  assert.match(observer, /addEventListener\('load'/);
  assert.match(observer, /securitypolicyviolation/);
  assert.match(diagnostic, /getEntriesByType\('resource'\)/);
  assert.doesNotMatch(notificationCard, /responseText|accessToken|webKey|endpoint|pushToken|installationId\b/);
});

test('failure UI renders classifications only and never sensitive provider values', () => {
  assert.match(notificationCard, /SHOW_STAGING_NOTIFICATION_DIAGNOSTIC/);
  assert.match(notificationCard, /Staging initialization diagnostic/);
  for (const forbidden of ['installationId}', 'endpoint}', 'pushToken', 'capability}',
    'fingerprint', 'credentials', 'apiKey', 'cookie', 'blockedURI', 'domainLookupStart',
    'domainLookupEnd', 'connectStart', 'connectEnd', 'secureConnectionStart']) {
    assert.doesNotMatch(notificationCard, new RegExp(forbidden, 'i'));
  }
  assert.match(notificationCard, /authentication_network_classification=/);
  assert.match(notificationCard, /authentication_resource_timing_present=/);
});

test('production About does not render temporary WonderPush engineering state', () => {
  for (const label of ['SDK loaded', 'SDK ready', 'Session raw state', 'Session interpreted state',
    'Current installation available', 'WonderPush subscribed', 'Browser PushSubscription present',
    'Notification permission', 'Registration workflow state', 'Home classification']) {
    assert.doesNotMatch(about, new RegExp(label));
  }
  assert.doesNotMatch(about, /wonderPushDiagnostic|readWonderPushRuntimeDiagnostic|Refresh WonderPush diagnostic/);
  assert.doesNotMatch(diagnostic, /endpoint|toJSON|applicationServerKey|localStorage|indexedDB\.open|fetch\(/);
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
