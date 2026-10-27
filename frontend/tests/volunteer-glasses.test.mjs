import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const home = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const page = await readFile(new URL('../app/volunteer-glasses.tsx', import.meta.url), 'utf8');
const orders = await readFile(new URL('../app/volunteer-glasses-orders.tsx', import.meta.url), 'utf8');
const service = await readFile(new URL('../src/services/volunteerGlassesService.ts', import.meta.url), 'utf8');

const souvenirs = await readFile(new URL('../app/souvenirs.tsx', import.meta.url), 'utf8');

test('Volunteer Glasses button lives on the Souvenirs page, not the home page', () => {
  assert.doesNotMatch(home, /volunteer_glasses|>Volunteer Glasses</);
  assert.match(souvenirs, />Volunteer Glasses</);
  assert.match(souvenirs, /name="lock"/);
  assert.match(souvenirs, /router\.push\('\/volunteer-glasses'/);
});

test('page shows three styles, price, closing date, pay at pickup, closed state', () => {
  for (const s of ['Colored Logo', 'Large Etched', 'Short Etched',
    'Glassware is available as a set of two.', 'No mix and matching.', '3 styles to choose from',
    'Cash payment at pickup $16 per set of 2 glasses',
    'Pickup December 17th at the Chepstow Lions Park from 5-8pm. If you cannot be there send someone on your behalf with payment',
    'Deadline to order nov 15', 'Pre-order closed']) {
    assert.ok(page.includes(s), `missing ${s}`);
  }
  assert.match(page, /secureTextEntry/);
});

test('no password is hardcoded client-side; password sent as header to server', () => {
  assert.match(service, /X-Volunteer-Password/);
  assert.doesNotMatch(page + service, /VOLUNTEER_ORDER_PASSWORD/);
});

test('owner list has a confirmed Delete per order that calls the admin DELETE and reloads', () => {
  assert.match(service, /method: 'DELETE', headers: \{ 'X-Admin-Password'/);
  assert.match(service, /\/admin\/orders\/\$\{encodeURIComponent\(orderId\)\}/);
  assert.match(orders, /window\.confirm\(/);
  assert.match(orders, /Alert\.alert\('Delete order'/);
  assert.match(orders, /deleteVolunteerGlassesOrder\(password, o\.id\);\s*await load\(\);/);
  assert.match(orders, />Delete<\/Text>/);
});
