import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const itinerary = readFileSync(join(root, 'app/(tabs)/itinerary.tsx'), 'utf8');
const sync = readFileSync(join(root, 'src/services/itineraryReminderSync.web.ts'), 'utf8');

test('controlled arm UI is staging-only and uses the existing authenticated endpoint', () => {
  assert.match(itinerary, /window\.location\.hostname === 'staging\.theipm\.ca'/);
  assert.match(itinerary, /getActiveControlledReminder/);
  assert.match(itinerary, /armControlledReminderTest\(\)/);
  assert.doesNotMatch(itinerary, /STAGING_ARM_(EVENT|FIXTURE|STARTS_AT)_ID/);
  assert.doesNotMatch(itinerary, /X-Itinerary-Device-Capability/);
  assert.match(sync, /request\('\/controlled-test\/arm', 'POST'/);
});

test('controlled arm UI is held until the fixture due window and reports no early send', () => {
  assert.match(itinerary, /armWindowOpensAt/);
  assert.match(itinerary, /No notification has been sent/);
  assert.match(sync, /armControlledReminderTest/);
  assert.match(sync, /controlled-test\/active/);
});
