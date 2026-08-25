import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const home = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const destinations = await readFile(new URL('../src/analytics/trackedLinks.ts', import.meta.url), 'utf8');

const actionsStart = home.indexOf('<Text style={styles.sectionTitle}>Quick Actions</Text>');
const linksStart = home.indexOf('<Text style={[styles.sectionTitle, styles.linksTitle]}>Links</Text>', actionsStart);
const groupsEnd = home.indexOf('{happeningNow.length > 0', linksStart);
const actions = home.slice(actionsStart, linksStart);
const links = home.slice(linksStart, groupsEnd);
const groupedButtons = home.slice(actionsStart, groupsEnd);

const allButtons = [
  'Map', 'Schedule', 'Vendors', 'Sponsors', 'Volunteer', 'Exhibitors', 'Tickets',
  'Camping', 'Souvenirs', 'Personal Itinerary', 'Queen of the Furrow', 'SOS', 'Announcements',
];
const actionButtons = ['Map', 'Schedule', 'Vendors', 'Camping', 'Personal Itinerary', 'Queen of the Furrow', 'SOS', 'Announcements'];
const linkButtons = ['Sponsors', 'Volunteer', 'Exhibitors', 'Tickets', 'Souvenirs'];

function occurrences(source, label) {
  return [...source.matchAll(new RegExp(`>${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<\\/Text>`, 'g'))].length;
}

test('Home renders Action Buttons before Link Buttons', () => {
  assert.ok(actionsStart >= 0);
  assert.ok(linksStart > actionsStart);
  assert.ok(groupsEnd > linksStart);
});

test('all production Home buttons remain present exactly once', () => {
  assert.equal(actionButtons.length + linkButtons.length, allButtons.length);
  for (const label of allButtons) assert.equal(occurrences(groupedButtons, label), 1, label);
});

test('internal controls are isolated under Action Buttons', () => {
  for (const label of actionButtons) {
    assert.equal(occurrences(actions, label), 1, `${label} missing from actions`);
    assert.equal(occurrences(links, label), 0, `${label} leaked into links`);
  }
});

test('external controls are isolated under Link Buttons without URL changes', () => {
  const expected = {
    Sponsors: ['partners', 'https://www.plowingmatch.org/ipm2026/partners-and-sponsors/'],
    Volunteer: ['volunteer', 'https://www.plowingmatch.org/ipm2026/get-involved/become-a-volunteer/'],
    Exhibitors: ['exhibitor', 'https://www.plowingmatch.org/ipm2026/get-involved/become-an-exhibitor/'],
    Tickets: ['tickets', 'https://www.tix123.com/tickets/?code=IPMRE26'],
    Souvenirs: ['merchandise', 'https://ipm26.itemorder.com/shop/home/'],
  };
  for (const [label, [destination, url]] of Object.entries(expected)) {
    assert.equal(occurrences(links, label), 1, `${label} missing from links`);
    assert.equal(occurrences(actions, label), 0, `${label} leaked into actions`);
    assert.ok(destinations.includes(`${destination}: {`));
    assert.ok(destinations.includes(`url: '${url}'`), `${label} URL changed`);
  }
});

test('Camping is an internal Quick Action and its external URL is retained by the Camping page', () => {
  assert.match(actions, /quickAction\('camping', 'internal', \(\) => router\.push\('\/camping' as never\)\)/);
  assert.equal(occurrences(actions, 'Camping'), 1);
  assert.equal(occurrences(links, 'Camping'), 0);
  assert.ok(destinations.includes("camping: {"));
  assert.ok(destinations.includes("url: 'https://letscamp.ca/camps/ipm-2026'"));
});

test('unrelated Home content remains present', () => {
  assert.match(home, /<ResponsiveBanner \/>/);
  assert.match(home, /Happening Now/);
  assert.match(home, /Coming Up Next/);
  assert.match(home, /<AttendeeAttribution source="home_attribution" \/>/);
});
