import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const service = await readFile(new URL('../src/services/notificationRegistration.web.ts', import.meta.url), 'utf8');
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

test('registration order preserves conclusive lookup and idempotent create', () => {
  const installation = service.indexOf("'installation_retrieval'");
  const lookup = service.indexOf("request('/status-by-capability'");
  const register = service.indexOf("request('/register'");
  const status = service.indexOf("request('/status'");
  const readiness = service.indexOf("request('/readiness/verify'");
  assert.ok(installation >= 0 && installation < lookup);
  assert.ok(lookup < register && register < status && status < readiness);
  assert.match(service, /error\.status !== 404/);
  assert.match(service, /if \(!existing\)/);
  assert.match(service, /readiness\.registered !== true/);
  assert.match(service, /readiness\.provider_deliverable !== true/);
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
  assert.doesNotMatch(component, /installationId|deviceCapability|pushToken|accessToken/);
  assert.doesNotMatch(service, /console\.(?:log|warn|error)/);
  assert.doesNotMatch(service, /response\.text\(\)/);
});

test('T-30 remains hard disabled', () => {
  assert.match(server, /ITINERARY_REMINDER_DELIVERY_ENABLED = False/);
  assert.match(server, /ITINERARY_REMINDER_SCHEDULER_ENABLED = False/);
});
