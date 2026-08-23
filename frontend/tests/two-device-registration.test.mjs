import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const page = fs.readFileSync(new URL('../app/reminder-test-registration.tsx', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../../backend/server.py', import.meta.url), 'utf8');

test('phones enroll normally without displaying installation IDs or capabilities', () => {
  assert.match(page, /Register Marc’s Phone as Device A/);
  assert.match(page, /Register Jen’s Phone as Device B/);
  assert.match(page, /never displayed/);
  assert.doesNotMatch(page, /installationId|capability/);
});

test('send guard requires distinct A and B and targets only A', () => {
  assert.match(server, /Only registered Device A may be targeted/);
  assert.match(server, /Distinct Device B registration is required/);
  assert.match(server, /installation_id not in WONDERPUSH_TEST_INSTALLATION_IDS/);
  assert.doesNotMatch(server.slice(server.indexOf('send_itinerary_targeting_test')), /send_everyone/);
});
