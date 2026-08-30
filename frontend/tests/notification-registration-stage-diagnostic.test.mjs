import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const registration = await readFile(new URL('../src/services/notificationRegistration.web.ts', import.meta.url), 'utf8');
const diagnostic = await readFile(new URL('../src/services/wonderPushRuntimeDiagnostic.web.ts', import.meta.url), 'utf8');
const about = await readFile(new URL('../app/(tabs)/about.tsx', import.meta.url), 'utf8');

test('every existing registration operation publishes pending and completed stages', () => {
  for (const stage of ['capability', 'status_by_capability', 'register', 'status',
    'readiness_verify', 'final_validation', 'complete']) {
    assert.match(registration, new RegExp(`beginStage\\('${stage}', attemptNumber\\)`));
  }
  assert.match(registration, /completeNotificationRegistrationStage\(\)/);
  assert.match(registration, /attemptNumber = \(attempt \+ 1\) as 1 \| 2 \| 3/);
});

test('HTTP instrumentation distinguishes headers, parsing, completion, and safe failures', () => {
  const request = registration.slice(registration.indexOf('async function request'),
    registration.indexOf('function beginStage'));
  assert.match(request, /recordNotificationRegistrationHeaders\(response\.status\)/);
  assert.match(request, /recordNotificationRegistrationParseStarted\(\)/);
  assert.match(request, /await response\.json\(\)/);
  assert.match(request, /recordNotificationRegistrationParseCompleted\(\)/);
  assert.match(request, /failNotificationRegistrationStage\(diagnosticOutcome\(safeError\)\)/);
  for (const outcome of ['timeout', 'network_failure', 'malformed_response', 'failure']) {
    assert.match(registration, new RegExp(`'${outcome}'`));
  }
});

test('stage instrumentation does not add or reorder network requests', () => {
  assert.equal((registration.match(/await request\('/g) || []).length, 4);
  assert.equal((registration.match(/fetch\(`/g) || []).length, 1);
  const lookup = registration.indexOf("request('/status-by-capability'");
  const register = registration.indexOf("request('/register'");
  const status = registration.indexOf("request('/status'");
  const readiness = registration.indexOf("request('/readiness/verify'");
  assert.ok(lookup < register && register < status && status < readiness);
  assert.match(registration, /REQUEST_TIMEOUT_MS = 12_000/);
  assert.match(registration, /RETRY_DELAYS_MS = \[2_500, 5_000\]/);
});

test('production About renders no registration workflow engineering metadata', () => {
  for (const label of ['IPM notification registration workflow', 'Current registration stage',
    'Attempt number', 'Stage started at', 'Stage completed at', 'Last HTTP status',
    'Last operation outcome', 'Last completed stage', 'Elapsed time in current stage',
    'Headers received at', 'Response parse started at', 'Response parse completed at']) {
    assert.doesNotMatch(about, new RegExp(label));
  }
  assert.doesNotMatch(about, /wonderPushDiagnostic|readWonderPushRuntimeDiagnostic|Refresh WonderPush diagnostic/);
  assert.doesNotMatch(diagnostic, /console\.|localStorage|sessionStorage|responseBody|fetch\(/i);
});
