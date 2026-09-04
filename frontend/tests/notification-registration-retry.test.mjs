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
  assert.equal((getter.match(/sdk\.subscribeToNotifications\(\)/g) || []).length, 3);
  assert.equal((getter.match(/readWonderPushSnapshot\(/g) || []).length, 4);
  assert.doesNotMatch(getter, /Notification\.requestPermission/);
  assert.match(getter, /wonderpush_recovery_subscribe_timed_out/);
  assert.match(getter, /wonderpush_recovery_snapshot_failed/);
  assert.match(wonderPush, /safeSubscribeRejectionStage/);
  for (const classification of ['registration_in_progress', 'permission_rejected',
    'push_not_supported', 'subscription_state_rejected', 'wrong_context', 'storage_failed',
    'dom_invalid_state', 'dom_abort', 'dom_network', 'provider_rejected', 'unknown_rejection']) {
    assert.match(wonderPush, new RegExp(`wonderpush_recovery_subscribe_${classification}`));
  }
  assert.match(getter, /replaceOrphanedPushSubscription/);
  assert.ok(getter.indexOf('replaceOrphanedPushSubscription')
    > getter.indexOf('attempts: INSTALLATION_RECOVERY_ATTEMPTS'));
});

test('registration already in progress is observed without another provider mutation', () => {
  const getter = wonderPush.slice(wonderPush.indexOf('export async function getSubscribedInstallationId'),
    wonderPush.indexOf('export async function getCurrentInstallationFingerprint'));
  const recovery = getter.slice(getter.indexOf('let registrationAlreadyInProgress'),
    getter.indexOf('// A completed replacement marker'));
  assert.match(recovery, /wonderpush_recovery_subscribe_registration_in_progress/);
  assert.match(recovery, /registrationAlreadyInProgress = true/);
  assert.match(recovery, /attempts: INSTALLATION_RECOVERY_ATTEMPTS/);
  assert.match(recovery, /if \(snapshot\.subscribed && snapshot\.installationId\) return snapshot\.installationId/);
  assert.match(recovery, /registrationInProgressUnavailableStage/);
  assert.equal((recovery.match(/sdk\.subscribeToNotifications\(\)/g) || []).length, 1);
  assert.doesNotMatch(recovery, /unsubscribeFromNotifications|Notification\.requestPermission/);
  assert.ok(recovery.indexOf('registrationInProgressUnavailableStage')
    < getter.indexOf('if (legacySubscriptionWasReplaced())'));
});

test('stuck provider registration reports only bounded boolean lifecycle state', () => {
  const classifier = wonderPush.slice(wonderPush.indexOf('function registrationInProgressUnavailableStage'),
    wonderPush.indexOf('export async function readWonderPushSnapshot'));
  for (const state of ['installation_lookup_rejected', 'service_worker_or_push_state_unavailable',
    'push_subscription_absent', 'subscribed_state_unavailable', 'wonderpush_not_subscribed',
    'session_state_unavailable', 'session_not_ready',
    'session_ready_push_present_subscribed_installation_null']) {
    assert.match(classifier, new RegExp(`wonderpush_registration_in_progress_${state}`));
  }
  assert.match(classifier, /snapshot\.installationFailed/);
  assert.match(classifier, /snapshot\.subscriptionFailed/);
  assert.doesNotMatch(classifier, /endpoint|applicationServerKey|installationId|pushToken|\.message|\.stack/);
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

test('completed legacy replacement reports only safe browser and provider lifecycle state', () => {
  assert.match(wonderPush, /currentPushSubscriptionState/);
  assert.match(wonderPush, /legacy_replacement_completed_subscription_present_installation_unavailable/);
  assert.match(wonderPush, /legacy_replacement_completed_subscription_absent_installation_unavailable/);
  assert.match(wonderPush, /legacy_unsubscribe_succeeded_wonderpush_resubscribe_rejected/);
  assert.match(wonderPush, /legacy_unsubscribe_succeeded_wonderpush_resubscribe_timed_out/);
  assert.match(wonderPush, /legacy_unsubscribe_succeeded_wonderpush_resubscribe_resolved_recovery_check_failed/);
  const getter = wonderPush.slice(wonderPush.indexOf('export async function getSubscribedInstallationId'),
    wonderPush.indexOf('export type WonderPushInstallationFailureStage'));
  assert.ok(getter.indexOf('if (legacySubscriptionWasReplaced())')
    > getter.indexOf('WonderPush installation recovery timed out.'));
  assert.doesNotMatch(wonderPush, /subscription\.endpoint|subscription\.options|subscription\.toJSON/);
});

test('completed replacement resynchronizes through documented WonderPush lifecycle', () => {
  const getter = wonderPush.slice(wonderPush.indexOf('export async function getSubscribedInstallationId'),
    wonderPush.indexOf('export type WonderPushInstallationFailureStage'));
  const markerBranch = getter.slice(getter.indexOf('if (legacySubscriptionWasReplaced())'),
    getter.indexOf('// Push subscriptions are scoped'));
  assert.match(markerBranch, /subscriptionState === 'present' && snapshot\.subscribed === true/);
  assert.match(markerBranch, /sdk\.unsubscribeFromNotifications\(\)/);
  assert.match(markerBranch, /sdk\.subscribeToNotifications\(\)/);
  assert.ok(markerBranch.indexOf('sdk.unsubscribeFromNotifications()')
    < markerBranch.indexOf('sdk.subscribeToNotifications()'));
  assert.match(markerBranch, /sdk\.isSubscribedToNotifications\(\)/);
  assert.match(markerBranch, /wonderpush_association_unsubscribe_rejected/);
  assert.match(markerBranch, /wonderpush_association_unsubscribe_timed_out/);
  assert.match(markerBranch, /wonderpush_association_unsubscribe_state_still_subscribed/);
  assert.match(markerBranch, /wonderpush_association_subscribe_rejected/);
  assert.match(markerBranch, /wonderpush_association_subscribe_timed_out/);
  assert.match(markerBranch, /wonderpush_association_snapshot_failed/);
  assert.match(markerBranch, /if \(snapshot\.subscribed && snapshot\.installationId\) return snapshot\.installationId/);
  assert.match(wonderPush, /sessionInitSuccess/);
  assert.doesNotMatch(markerBranch, /Notification\.requestPermission|localStorage\.clear|indexedDB|caches|serviceWorker\.unregister/);
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

test('session initialization remains pending and automatically resumes setup', () => {
  assert.match(wonderPush, /SESSION_RECOVERY_TIMEOUT_MS = 45_000/);
  assert.match(wonderPush, /export async function waitForWonderPushSessionReady/);
  assert.match(wonderPush, /window\.addEventListener\('WonderPushEvent', listener\)/);
  assert.match(wonderPush, /detail\?\.name === 'session' && detail\.state === readyState/);
  assert.match(wonderPush, /sdk\.getSessionState\?\.\(\) === readyState/);
  assert.match(wonderPush, /window\.removeEventListener\('WonderPushEvent', listener\)/);

  const setup = component.slice(component.indexOf('const completeSetup'),
    component.indexOf('const refresh'));
  assert.match(setup, /wonderpush_registration_in_progress_session_not_ready/);
  assert.match(setup, /await waitForWonderPushSessionReady\(\)/);
  assert.equal((setup.match(/await ensureNotificationRegistration\(\)/g) || []).length, 2);
  assert.ok(setup.indexOf('await waitForWonderPushSessionReady()')
    < setup.lastIndexOf('await ensureNotificationRegistration()'));
  assert.match(setup, /setSetupState\('ready'\)/);
  assert.match(setup, /setSetupState\('failed'\)/);
  assert.doesNotMatch(setup, /subscribeToNotifications|unsubscribeFromNotifications|requestPermission|send/);
});

test('pending startup remains visible until provider readiness while genuine failures retain recovery UI', () => {
  assert.match(component, /if \(state === 'loading'\) return null/);
  assert.match(component, /state === 'subscribed' && setupState === 'ready'/);
  assert.match(component, /setupState === 'failed'[\s\S]*Try again/);
  assert.match(component, /state === 'subscribed'[\s\S]*unsubscribeFromNotifications\(\)/);
  assert.match(component, /state === 'denied'/);
  assert.match(component, /Notifications are enabled\. Finishing setup…/);
  assert.match(component, /Notifications are enabled, but setup could not be completed/);
});

test('only provider-ready subscribers hide the Home card', () => {
  const hidden = component.indexOf("if (state === 'subscribed' && setupState === 'ready') return null");
  const card = component.indexOf('accessibilityLabel="IPM notification settings"');
  assert.ok(hidden > 0 && hidden < card);
  assert.match(component, /style=\{\[styles\.card, containerStyle\]\}/);
  assert.match(component, /state === 'default' \|\| state === 'unsubscribed'/);
  assert.match(component, /state === 'denied'/);
  assert.match(component, /state === 'unsupported' && isIphoneSafari/);
});

test('safe UI and diagnostics do not render sensitive device material', () => {
  assert.match(component, /Setup reference: \{failureClassification \|\| 'other'\}/);
  for (const safeStage of ['sdk_unavailable', 'installation_still_unavailable',
    'wonderpush_recovery_subscribe_timed_out',
    'wonderpush_recovery_snapshot_failed',
    'wonderpush_registration_in_progress_installation_lookup_rejected',
    'wonderpush_registration_in_progress_service_worker_or_push_state_unavailable',
    'wonderpush_registration_in_progress_push_subscription_absent',
    'wonderpush_registration_in_progress_subscribed_state_unavailable',
    'wonderpush_registration_in_progress_wonderpush_not_subscribed',
    'wonderpush_registration_in_progress_session_state_unavailable',
    'wonderpush_registration_in_progress_session_not_ready',
    'wonderpush_registration_in_progress_session_ready_push_present_subscribed_installation_null',
    'legacy_push_subscription_absent', 'legacy_subscription_replacement_failed',
    'wonderpush_session_initialization_failed',
    'legacy_unsubscribe_succeeded_wonderpush_resubscribe_rejected',
    'legacy_unsubscribe_succeeded_wonderpush_resubscribe_timed_out',
    'legacy_unsubscribe_succeeded_wonderpush_resubscribe_resolved_recovery_check_failed',
    'legacy_replacement_completed_subscription_present_installation_unavailable',
    'legacy_replacement_completed_subscription_absent_installation_unavailable',
    'wonderpush_association_unsubscribe_rejected',
    'wonderpush_association_unsubscribe_timed_out',
    'wonderpush_association_unsubscribe_state_unavailable',
    'wonderpush_association_unsubscribe_state_still_subscribed',
    'wonderpush_association_subscribe_rejected',
    'wonderpush_association_subscribe_timed_out',
    'wonderpush_association_snapshot_failed',
    'legacy_association_recovery_subscribed_session_ready_installation_unavailable',
    'legacy_association_recovery_subscribed_session_not_ready_installation_unavailable',
    'legacy_association_recovery_not_subscribed_installation_unavailable']) {
    assert.match(service + wonderPush, new RegExp(safeStage));
  }
  assert.doesNotMatch(component, /installationId|deviceCapability|pushToken|accessToken/);
  assert.doesNotMatch(service + wonderPush,
    /session_recovery_failed|legacy_association_recovery_failed|wonderpush_recovery_subscribe_rejected|wonderpush_registration_in_progress_installation_unavailable/);
  const classifier = wonderPush.slice(wonderPush.indexOf('function safeSubscribeRejectionStage'),
    wonderPush.indexOf('function isSupported'));
  assert.doesNotMatch(classifier, /\.message|\.stack|JSON\.stringify|endpoint|installationId|pushToken/);
  assert.doesNotMatch(service, /console\.(?:log|warn|error)/);
  assert.doesNotMatch(service, /response\.text\(\)/);
});

test('T-30 remains hard disabled', () => {
  assert.match(server, /ITINERARY_REMINDER_DELIVERY_ENABLED = False/);
  assert.match(server, /ITINERARY_REMINDER_SCHEDULER_ENABLED = False/);
});
