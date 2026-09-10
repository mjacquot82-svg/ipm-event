import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8');

test('event detail owns one browser history entry and closes on popstate', () => {
  assert.match(source, /window\.history\.pushState\(\{ .*__ipmEventModal: true \}/s);
  assert.match(source, /window\.addEventListener\('popstate', handlePopState\)/);
  assert.match(source, /setShowEventModal\(false\);\s*setSelectedEvent\(null\);/);
});

test('all event-detail exits use the guarded close path', () => {
  assert.match(source, /onRequestClose=\{closeEventModal\}/);
  assert.match(source, /onPress=\{closeEventModal\}/);
  assert.doesNotMatch(source, /onPress=\{\(\) => setShowEventModal\(false\)\}/);
});

test('back-navigation fix is web-only and does not alter event data', () => {
  assert.match(source, /Platform\.OS !== 'web'/);
  assert.match(source, /window\.history\.back\(\)/);
  assert.match(source, /selectedEvent\.description/);
});

test('Itinerary passes the tapped event identity and return context to Schedule', () => {
  const itinerary = fs.readFileSync(new URL('../app/(tabs)/itinerary.tsx', import.meta.url), 'utf8');
  assert.match(itinerary, /pathname: '\/schedule', params: \{ eventId: item\.id, returnTo: 'itinerary' \}/);
});

test('Schedule resolves a valid event parameter once and fails safely for unknown IDs', () => {
  assert.match(source, /events\.find\(\(candidate\) => candidate\.id === eventId\)/);
  assert.match(source, /if \(!event\) return/);
  assert.match(source, /openedEventParamRef/);
  assert.match(source, /returnToItineraryRef/);
});

test('Itinerary-origin Back returns to Itinerary after closing the detail state', () => {
  assert.match(source, /if \(returnToItineraryRef\.current\) window\.setTimeout\(\(\) => window\.history\.back\(\), 0\)/);
  assert.match(source, /else if \(returnToItineraryRef\.current\) \{\s*router\.back\(\);/s);
});
