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
  'Camping', 'Souvenirs', 'Celebration of Excellence', 'Interdenominational Worship Service',
  'Personal Itinerary', 'Queen of the Furrow', 'Announcements',
];
const actionButtons = ['Map', 'Schedule', 'Vendors', 'Camping', 'Personal Itinerary', 'Queen of the Furrow', 'Announcements'];
const linkButtons = ['Sponsors', 'Volunteer', 'Exhibitors', 'Tickets', 'Souvenirs', 'Celebration of Excellence', 'Interdenominational Worship Service'];

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

test('SOS is absent from the production Home entry point', () => {
  assert.equal(occurrences(actions, 'SOS'), 0);
  assert.doesNotMatch(actions, /quickAction\('sos'/);
  assert.doesNotMatch(home, /styles\.sosCard|sosCard:/);
});

test('Quick Actions reflow naturally without width-specific gaps', () => {
  assert.match(home, /quickActionsGrid: \{[\s\S]*?flexDirection: 'row',[\s\S]*?flexWrap: 'wrap',[\s\S]*?justifyContent: 'flex-start',[\s\S]*?gap: 8,/);
  assert.match(home, /actionCard: \{[\s\S]*?width: '31%',/);
  assert.doesNotMatch(home, /(?:mobile|desktop).*SOS|SOS.*(?:mobile|desktop)/i);
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
    'Celebration of Excellence': ['celebration_of_excellence', 'https://www.zeffy.com/en-CA/ticketing/2026-ipm-celebration-of-excellence'],
  };
  for (const [label, [destination, url]] of Object.entries(expected)) {
    assert.equal(occurrences(links, label), 1, `${label} missing from links`);
    assert.equal(occurrences(actions, label), 0, `${label} leaked into actions`);
    assert.ok(destinations.includes(`${destination}: {`));
    assert.ok(destinations.includes(`url: '${url}'`), `${label} URL changed`);
  }
});

test('Camping uses a tent icon and retains its internal route', () => {
  const start = actions.indexOf("quickAction('camping'");
  const card = actions.slice(start, actions.indexOf('</TouchableOpacity>', start));
  assert.match(card, /router\.push\('\/camping' as never\)/);
  assert.match(card, /MaterialCommunityIcons name="tent"/);
  assert.doesNotMatch(card, /name="sun"/);
});

test('Worship Service appears once under Links and routes internally', () => {
  assert.equal(occurrences(links, 'Interdenominational Worship Service'), 1);
  assert.equal(occurrences(actions, 'Interdenominational Worship Service'), 0);
  assert.match(links, /quickAction\('worship_service', 'internal', \(\) => router\.push\('\/worship-service' as never\)\)/);
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
