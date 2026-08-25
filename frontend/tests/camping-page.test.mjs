import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const home = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const page = await readFile(new URL('../app/(tabs)/camping.tsx', import.meta.url), 'utf8');
const layout = await readFile(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
const trackedLinks = await readFile(new URL('../src/analytics/trackedLinks.ts', import.meta.url), 'utf8');

test('Camping Quick Action navigates internally without opening its external destination', () => {
  const campingHandlerStart = home.indexOf("onPress={() => quickAction('camping'");
  const campingCard = home.slice(campingHandlerStart, home.indexOf('</TouchableOpacity>', campingHandlerStart));
  assert.ok(campingHandlerStart >= 0);
  assert.match(campingCard, /quickAction\('camping', 'internal'/);
  assert.doesNotMatch(campingCard, /openQuickLink|openTrackedLink|Linking\.openURL/);
  assert.match(layout, /name="camping"/);
});

test('all supplied camping sections and emergency details render', () => {
  for (const heading of ['RV Park &amp; Camping Information', 'Important &amp; Emergency Information', 'RV Park Office', 'RV Pump-Out Service', 'Water', 'Garbage Pickup', 'Empties', 'Trailer Service', 'Quiet Time']) {
    assert.ok(page.includes(heading), `missing ${heading}`);
  }
  assert.match(page, /95 Durham Road/);
  assert.match(page, /Entrances 9 &amp; 10/);
  assert.match(page, /EMERGENCY_PHONE = '226-972-6785'/);
  assert.match(page, /tel:\$\{number\}/);
});

test('office and pump-out dates, hours, and payment notice are exact', () => {
  assert.match(page, /Saturday September 19 through Friday September 25/);
  assert.match(page, /9:00 AM - 6:00 PM/);
  assert.match(page, /Tuesday September 22 through Saturday September 26/);
  assert.match(page, /Monday, September 21 through Friday September 25/);
  assert.match(page, /7:30 AM - 9:30 AM/);
  assert.match(page, /3:30 PM - 5:30 PM/);
  assert.match(page, /Pump-out service must be paid for at the time of booking\./);
});

test('water, garbage, empties, trailer service, and quiet time details are present', () => {
  assert.match(page, /Water service hours coming soon\./);
  assert.match(page, /Garbage must be out by 9:00 AM/);
  assert.match(page, /Please DO NOT put garbage out the night before/);
  assert.match(page, /blue collection barrels/);
  assert.match(page, /partnered with the Shriners/);
  assert.match(page, /Hardcore Camper Inc\. are on site to help\./);
  assert.match(page, /Site S1/);
  assert.match(page, /TRAILER_SERVICE_PHONE = '519-889-2016'/);
  assert.match(page, /11:00 PM - 7:00 AM/);
});

test('existing camping URL remains centralized and accessible from the page', () => {
  assert.match(trackedLinks, /camping: \{[^\n]*url: 'https:\/\/letscamp\.ca\/camps\/ipm-2026'/);
  assert.match(page, /openTrackedLink\('camping', 'camping_information'\)/);
  assert.match(page, />Book or Manage Camping<\/Text>/);
  assert.match(page, /external Let's Camp website/);
  assert.equal((page.match(/>Book or Manage Camping<\/Text>/g) || []).length, 1);
  assert.ok(page.indexOf('>Book or Manage Camping</Text>') < page.indexOf('Important &amp; Emergency Information'));
});

test('Back handles stack navigation and direct deep links', () => {
  assert.match(page, /if \(router\.canGoBack\(\)\) router\.back\(\)/);
  assert.match(page, /else router\.replace\('\/'\)/);
});

test('unrelated Quick Actions retain their existing handlers', () => {
  for (const action of ['sponsors', 'volunteer', 'exhibitors', 'tickets', 'souvenirs']) {
    assert.match(home, new RegExp(`openQuickLink\\('${action}'`));
  }
  assert.match(home, /pathname: '\/map', params: \{ source: 'home_quick_action' \}/);
  assert.match(home, /pathname: '\/schedule', params: \{ source: 'home_quick_action' \}/);
});
