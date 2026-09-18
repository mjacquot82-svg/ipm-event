import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/services/itineraryReminderSync.web.ts'), 'utf8');

test('enabled attendee reconciliation refreshes exact provider readiness before stars', () => {
  assert.match(source, /verifyReadinessIfStale\(\)/);
  const enabledBranch = source.slice(source.indexOf("if (await AsyncStorage.getItem(ENABLED_KEY) !== 'true')"));
  assert.match(enabledBranch, /await verifyReadinessIfStale\(\);/);
  assert.match(enabledBranch, /await request\('\/stars', 'PUT'/);
});

test('readiness freshness is recorded only after the provider verification request succeeds', () => {
  const helper = source.slice(source.indexOf('async function verifyReadinessIfStale'));
  assert.match(helper, /await request\('\/readiness\/verify', 'POST'\)/);
  assert.match(helper, /await AsyncStorage\.setItem\(READINESS_VERIFIED_AT_KEY/);
  assert.ok(helper.indexOf("await request('/readiness/verify', 'POST')") < helper.indexOf('AsyncStorage.setItem'));
  assert.match(source, /READINESS_FRESHNESS_MS = 5 \* 60 \* 1000/);
});

test('disabled attendees are not prompted by the refresh helper', () => {
  const helper = source.slice(source.indexOf('export async function refreshEnabledItineraryReminderReadiness'));
  assert.match(helper, /ENABLED_KEY/);
  assert.match(helper, /return getItineraryReminderReadiness\(\)/);
});
