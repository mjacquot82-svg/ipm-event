import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const home = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const page = await readFile(new URL('../app/volunteer-glasses.tsx', import.meta.url), 'utf8');
const service = await readFile(new URL('../src/services/volunteerGlassesService.ts', import.meta.url), 'utf8');

test('Volunteer Glasses link sits right after Souvenirs and routes internally', () => {
  const souvenirs = home.indexOf("openQuickLink('souvenirs'");
  const glasses = home.indexOf("quickAction('volunteer_glasses', 'internal'");
  assert.ok(souvenirs > 0 && glasses > souvenirs);
  assert.match(home, /router\.push\('\/volunteer-glasses'/);
});

test('page shows three styles, price, closing date, pay at pickup, closed state', () => {
  for (const s of ['Colored Logo', 'Large Etched', 'Short Etched', '$16 per set of two', 'Pre-order closes November 20', 'Pay at pickup', 'Pre-order closed', 'no mixing']) {
    assert.ok(page.includes(s), `missing ${s}`);
  }
  assert.match(page, /secureTextEntry/);
});

test('no password is hardcoded client-side; password sent as header to server', () => {
  assert.match(service, /X-Volunteer-Password/);
  assert.doesNotMatch(page + service, /VOLUNTEER_ORDER_PASSWORD/);
});
