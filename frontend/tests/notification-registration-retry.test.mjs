import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const service = await readFile(new URL('../src/services/notificationRegistration.web.ts', import.meta.url), 'utf8');
const wonderPush = await readFile(new URL('../src/services/wonderPushService.web.ts', import.meta.url), 'utf8');
const component = await readFile(new URL('../src/components/NotificationOptIn.tsx', import.meta.url), 'utf8');
const server = await readFile(new URL('../../backend/server.py', import.meta.url), 'utf8');

test('registration stages are explicit and safely bounded', () => {
  for (const stage of ['installation_retrieval', 'capability_lookup', 'backend_registration',
    'backend_status', 'provider_verification', 'success']) {
    assert.match(service, new RegExp(`['"]${stage}['"]`));
  }
  for (const classification of ['installation_unavailable', 'invalid_credentials', 'http_error',
    'timeout', 'network_failure', 'malformed_response', 'other']) {
    assert.match(service, new RegExp(`['"]${classification}['"]`));
  }
  assert.match(service, /RETRY_DELAYS_MS = \[2_500, 5_000\]/);
  assert.match(service, /attempt <= RETRY_DELAYS_MS\.length/);
  assert.match(service, /!lastError\.retryable/);
});

test('registration order preserves lookup and capability-scoped migration rebind', () => {
  const installation = service.indexOf("'installation_retrieval'");
  const lookup = service.indexOf("request('/status-by-capability'");
  const register = service.indexOf("request('/register'");
  const status = service.indexOf("request('/status'");
  const readiness = service.indexOf("request('/readiness/verify'");
  assert.ok(installation >= 0 && installation < lookup);
  assert.ok(lookup < register && register < status && status < readiness);
  assert.match(service, /error\.status !== 404/);
  assert.doesNotMatch(service, /if \(!existing\)/);
  assert.match(service, /safely rebinds a migrated browser/);
  assert.match(service, /readiness\.registered !== true/);
  assert.match(service, /readiness\.provider_deliverable !== true/);
});

test('clean installation returns before migration recovery', () => {
  const getter = wonderPush.slice(wonderPush.indexOf('export async function getSubscribedInstallationId'),
    wonderPush.indexOf('export async function getCurrentInstallationFingerprint'));
  assert.match(getter, /Notification\.permission !== 'granted'/);
  assert.match(getter, /if \(snapshot\.subscribed && snapshot\.installationId\) return snapshot\.installationId/);
  assert.ok(getter.indexOf('if (snapshot.subscribed && snapshot.installationId) return snapshot.installationId')
    < getter.indexOf('sdk.subscribeToNotifications()'));
});

test('missing legacy installation performs bounded provider recovery before targeted replacement', () => {
  const getter = wonderPush.slice(wonderPush.indexOf('export async function getSubscribedInstallationId'),
    wonderPush.indexOf('export async function getCurrentInstallationFingerprint'));
  assert.doesNotMatch(getter, /if \(!snapshot\.subscribed\) return null/);
  assert.match(getter, /sdk\.subscribeToNotifications\(\)/);
  assert.match(getter, /SUBSCRIBE_TIMEOUT_MS/);
  assert.match(getter, /attempts: INSTALLATION_RECOVERY_ATTEMPTS/);
  assert.match(getter, /retryDelayMs: INSTALLATION_RECOVERY_RETRY_MS/);
  assert.match(wonderPush, /INSTALLATION_RECOVERY_ATTEMPTS = 12/);
  assert.match(wonderPush, /INSTALLATION_RECOVERY_RETRY_MS = 750/);
  assert.equal((getter.match(/sdk\.subscribeToNotifications\(\)/g) || []).length, 2);
  assert.equal((getter.match(/readWonderPushSnapshot\(/g) || []).length, 3);
  assert.doesNotMatch(getter, /unsubscribeFromNotifications|Notification\.requestPermission/);
  assert.match(getter, /session_recovery_failed/);
  assert.match(getter, /replaceOrphanedPushSubscription/);
  assert.ok(getter.indexOf('replaceOrphanedPushSubscription')
    > getter.indexOf('attempts: INSTALLATION_RECOVERY_ATTEMPTS'));
});

test('legacy replacement is narrow, permission-safe, idempotent, and bounded', () => {
  const replacement = wonderPush.slice(wonderPush.indexOf('function legacySubscriptionWasReplaced'),
    wonderPush.indexOf('export async function readWonderPushSnapshot'));
  assert.match(replacement, /registration\.pushManager\.getSubscription\(\)/);
  assert.match(replacement, /subscription\.unsubscribe\(\)/);
  assert.match(replacement, /LEGACY_SUBSCRIPTION_REPLACED_KEY/);
  assert.match(replacement, /legacySubscriptionReplacementAttempted/);
  assert.match(replacement, /UNSUBSCRIBE_TIMEOUT_MS/);
  assert.doesNotMatch(replacement, /Notification\.requestPermission|localStorage\.clear|indexedDB\.deleteDatabase|caches\.delete|serviceWorker\.getRegistrations/);
  assert.doesNotMatch(wonderPush, /endpoint|applicationServerKey|pushToken/);
});

test('invalid credentials and takeover responses do not retry', () => {
  assert.match(service, /response\.status === 400/);
  assert.match(service, /response\.status === 401/);
  assert.match(service, /response\.status === 403/);
  assert.match(service, /response\.status === 409/);
  assert.match(service, /invalidCredentials[\s\S]*'invalid_credentials'[\s\S]*retryable/);
});

test('Home distinguishes subscribed, pending, ready and failed setup', () => {
  assert.doesNotMatch(component, /ensureNotificationRegistration\(\)\.catch\(\(\) => undefined\)/);
  assert.match(component, /Notifications are enabled\. Finishing setup…/);
  assert.match(component, /Notifications are enabled, but setup could not be completed\. Tap to try again\./);
  assert.match(component, /await ensureNotificationRegistration\(\)/);
  assert.match(component, />Try again</);
  assert.match(component, /accessibilityLabel="Try notification setup again"/);
  assert.match(component, /minHeight: 44/);
  assert.match(component, /notification-setup-\$\{setupState/);
});

test('safe UI and diagnostics do not render sensitive device material', () => {
  assert.match(component, /Setup reference: \{failureClassification \|\| 'other'\}/);
  for (const safeStage of ['sdk_unavailable', 'session_recovery_failed', 'installation_still_unavailable',
    'legacy_push_subscription_absent', 'legacy_subscription_replacement_failed',
    'wonderpush_session_initialization_failed']) {
    assert.match(service + wonderPush, new RegExp(safeStage));
  }
  assert.doesNotMatch(component, /installationId|deviceCapability|pushToken|accessToken/);
  assert.doesNotMatch(service, /console\.(?:log|warn|error)/);
  assert.doesNotMatch(service, /response\.text\(\)/);
});

test('T-30 remains hard disabled', () => {
  assert.match(server, /ITINERARY_REMINDER_DELIVERY_ENABLED = False/);
  assert.match(server, /ITINERARY_REMINDER_SCHEDULER_ENABLED = False/);
});
