import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('../app/(tabs)/plowing.tsx', import.meta.url), 'utf8');
const layout = await readFile(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
const destinations = await readFile(new URL('../src/analytics/trackedLinks.ts', import.meta.url), 'utf8');
const demo = await readFile(new URL('../app/(tabs)/plowing-results.tsx', import.meta.url), 'utf8');

test('/plowing is an internal hidden route with normal Back navigation', () => {
  assert.match(layout, /<Tabs\.Screen name="plowing" options=\{\{ title: 'Plowing', href: null \}\} \/>/);
  assert.match(page, /if \(router\.canGoBack\(\)\) router\.back\(\)/);
  assert.match(page, /else router\.replace\('\/'\)/);
});

test('Plowing page exposes both official OPA resources through distinct tracked destinations', () => {
  assert.match(page, /Plowing Rules & Regulations/);
  assert.match(page, /destination="plowing_rules"/);
  assert.match(destinations, /plowing_rules: \{ id: 'plowing_rules', type: 'information', url: 'https:\/\/www\.plowingmatch\.org\/plowing\/ipm-plowing\/plowing-rules-regulations-2\/' \}/);
  assert.match(page, /Daily Plowing Results/);
  assert.match(page, /destination="plowing_daily_results"/);
  assert.match(destinations, /plowing_daily_results: \{ id: 'plowing_daily_results', type: 'results', url: 'https:\/\/www\.plowingmatch\.org\/plowing\/ipm-plowing\/daily-plowing-results\/' \}/);
  assert.match(page, /openTrackedLink\(destination, 'plowing_information'\)/);
});

test('new resource page does not alter or embed the staging results demo', () => {
  assert.match(demo, /DEMO RESULTS/);
  assert.match(demo, /getPlowingResults/);
  assert.doesNotMatch(page, /getPlowingResults|leaderboard|standings|scrap|rule book.*download/i);
});
