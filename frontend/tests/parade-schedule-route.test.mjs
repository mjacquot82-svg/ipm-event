import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const schedule = fs.readFileSync(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8');
const map = fs.readFileSync(new URL('../app/(tabs)/map.tsx', import.meta.url), 'utf8');
const tented = fs.readFileSync(new URL('../src/components/TentedCityMap.tsx', import.meta.url), 'utf8');
const routeConfig = fs.readFileSync(new URL('../src/config/paradeSchedule.ts', import.meta.url), 'utf8');
const manifest = fs.readFileSync(new URL('../../backend/import_manifests/ipm_parade_week_2026.json', import.meta.url), 'utf8');
const importer = fs.readFileSync(new URL('../../backend/import_ipm_parade_week_schedule.py', import.meta.url), 'utf8');

const titles = [
  'Bruce Power Opening Day Parade',
  'Trucks and Tractors Parade',
  'Children’s Parade',
  'Combines Parade',
  'Bruce County Farming Through the Ages',
];

test('canonical parade source contains no obsolete attendee wording', () => {
  assert.doesNotMatch(manifest, /Parade route coming soon/);
  assert.doesNotMatch(importer, /Parade route coming soon/);
  assert.match(manifest, /Tuesday Parade Route/);
  assert.match(manifest, /Wednesday–Saturday Parade Route/);
});

test('all five parade events have stable route mapping and direct map navigation', () => {
  for (const title of titles) assert.match(routeConfig, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(routeConfig, /'Bruce Power Opening Day Parade': 'tuesday'/);
  for (const title of titles.slice(1)) assert.match(routeConfig, new RegExp(`'${title}': 'wed-sat'`));
  assert.match(schedule, /paradeRoute/);
  assert.match(schedule, /View Parade Route/);
  assert.match(schedule, /eventTitle: selectedEvent\.title/);
  assert.match(schedule, /paradeRoute \}/);
  assert.match(map, /initialParadeRoute/);
  assert.match(map, /paradeRoute === 'tuesday' \|\| paradeRoute === 'wed-sat'/);
  assert.match(tented, /initialParadeRoute/);
  assert.match(tented, /setParadeRoute\(initialParadeRoute\)/);
});

test('route geometry remains owned by the existing route configuration', () => {
  assert.match(tented, /ParadeRouteOverlay/);
  assert.match(tented, /ParadeRouteControls/);
  assert.doesNotMatch(routeConfig, /coming soon/i);
});
