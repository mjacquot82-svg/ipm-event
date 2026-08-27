import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const home = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const destinations = await readFile(new URL('../src/analytics/trackedLinks.ts', import.meta.url), 'utf8');

const quickActionsStart = home.indexOf('<Text style={styles.sectionTitle}>Quick Actions</Text>');
const linksStart = home.indexOf('<Text style={[styles.sectionTitle, styles.linksTitle]}>Links</Text>', quickActionsStart);
const groupsEnd = home.indexOf('{happeningNow.length > 0', linksStart);
const quickActions = home.slice(quickActionsStart, linksStart);
const links = home.slice(linksStart, groupsEnd);
const groupedActions = home.slice(quickActionsStart, groupsEnd);

const allActions = [
  'Map', 'Schedule', 'Vendors', 'Sponsors', 'Volunteer', 'Exhibitors', 'Tickets',
  'Camping', 'Souvenirs', 'Personal Itinerary', 'Queen of the Furrow', 'SOS', 'Announcements', 'Plowing Results',
  'Plowing',
];
const internalActions = ['Map', 'Schedule', 'Vendors', 'Camping', 'Personal Itinerary', 'Queen of the Furrow', 'SOS', 'Announcements', 'Plowing Results'];
const externalActions = ['Sponsors', 'Volunteer', 'Exhibitors', 'Tickets', 'Souvenirs'];

function labelOccurrences(source, label) {
  return [...source.matchAll(new RegExp(`>${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<\\/Text>`, 'g'))].length;
}

test('Home has distinct Quick Actions and Links headings in that order', () => {
  assert.ok(quickActionsStart >= 0);
  assert.ok(linksStart > quickActionsStart);
  assert.ok(groupsEnd > linksStart);
});

test('every existing Home action and the Plowing link appear exactly once', () => {
  assert.equal(allActions.length, 15);
  for (const action of allActions) {
    assert.equal(labelOccurrences(groupedActions, action), 1, `${action} should appear exactly once`);
  }
  assert.equal(internalActions.length + externalActions.length + 1, allActions.length);
});

test('Plowing appears once under Links and routes internally', () => {
  assert.equal(labelOccurrences(links, 'Plowing'), 1);
  assert.equal(labelOccurrences(quickActions, 'Plowing'), 0);
  assert.match(links, /quickAction\('plowing', 'internal', \(\) => router\.push\('\/plowing' as never\)\)/);
  assert.match(links, /accessibilityLabel="Plowing information"/);
});

test('internal actions are under Quick Actions and absent from Links', () => {
  for (const action of internalActions) {
    assert.equal(labelOccurrences(quickActions, action), 1, `${action} missing from Quick Actions`);
    assert.equal(labelOccurrences(links, action), 0, `${action} must not appear in Links`);
  }
  assert.match(quickActions, /quickAction\('camping', 'internal', \(\) => router\.push\('\/camping' as never\)\)/);
  assert.match(quickActions, /SHOW_PLOWING_RESULTS_DEMO/);
});

test('URL-only actions are under Links and preserve tracked destinations', () => {
  const handlers = {
    Sponsors: ["openQuickLink('sponsors', 'partners')", 'partners', 'https://www.plowingmatch.org/ipm2026/partners-and-sponsors/'],
    Volunteer: ["openQuickLink('volunteer', 'volunteer')", 'volunteer', 'https://www.plowingmatch.org/ipm2026/get-involved/become-a-volunteer/'],
    Exhibitors: ["openQuickLink('exhibitors', 'exhibitor')", 'exhibitor', 'https://www.plowingmatch.org/ipm2026/get-involved/become-an-exhibitor/'],
    Tickets: ["openQuickLink('tickets', 'tickets')", 'tickets', 'https://www.tix123.com/tickets/?code=IPMRE26'],
    Souvenirs: ["openQuickLink('souvenirs', 'merchandise')", 'merchandise', 'https://ipm26.itemorder.com/shop/home/'],
  };

  for (const [label, [handler, destinationId, url]] of Object.entries(handlers)) {
    assert.equal(labelOccurrences(links, label), 1, `${label} missing from Links`);
    assert.equal(labelOccurrences(quickActions, label), 0, `${label} must not appear in Quick Actions`);
    assert.ok(links.includes(handler), `${label} handler changed`);
    assert.ok(destinations.includes(`${destinationId}: {`));
    assert.ok(destinations.includes(`url: '${url}'`), `${label} URL changed`);
  }
});

test('unrelated Home sections and behavior remain present', () => {
  assert.match(home, /<ResponsiveBanner \/>/);
  assert.match(home, /<NotificationOptIn \/>/);
  assert.match(home, /Happening Now/);
  assert.match(home, /Coming Up Next/);
  assert.match(home, /<AttendeeAttribution source="home_attribution" \/>/);
});
