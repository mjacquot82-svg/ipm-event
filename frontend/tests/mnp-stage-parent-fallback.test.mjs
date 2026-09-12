import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const cache = new Map();
function load(url) {
  if (cache.has(url.href)) return cache.get(url.href).exports;
  const mod = { exports: {} };
  cache.set(url.href, mod);
  const source = ts.transpileModule(fs.readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const require = (name) => (name.endsWith('.json')
    ? JSON.parse(fs.readFileSync(new URL(name, url), 'utf8'))
    : name.startsWith('.') ? load(new URL(name.endsWith('.ts') || name.endsWith('.tsx') ? name : name + '.ts', url)) : createRequire(url)(name));
  new Function('require', 'module', 'exports', source)(require, mod, mod.exports);
  return mod.exports;
}

function loadExhibitors() {
  const dir = new URL('../src/data/', import.meta.url);
  const rows = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.startsWith('tentedCityVendorsPart') && f.endsWith('.ts')).sort()) {
    const text = fs.readFileSync(new URL(file, dir), 'utf8');
    const start = text.indexOf('= [') + 2;
    const end = text.lastIndexOf(']') + 1;
    rows.push(...JSON.parse(text.slice(start, end)));
  }
  return rows;
}

const { findTentedCityPlace, placeRect, venueRect } = load(new URL('../src/config/tentedCitySearch.ts', import.meta.url));
const { tentedCityVenues, findTentedCityVenue } = load(new URL('../src/config/tentedCityVenues.ts', import.meta.url));
const vendors = loadExhibitors();

const MNP_PARENT = { x: 65.2, y: 28.8, w: 12.0, h: 7.2 };
const QH_BOOTH = { x: 30.146, y: 37.495, w: 4.973, h: 3.854 };

const SCHEDULE_LOCATION_NAMES = [
  'The Beyond Wireless Stage',
  "Harley's Pub & Perk - Stage",
  'Quality Homes - Stage',
];

const STAGE_IDS = ['beyond-wireless-stage', 'harleys-stage', 'quality-homes-stage'];

test('MNP parent landmark has the audited EAST-2 geometry', () => {
  const parent = tentedCityVenues.find((v) => v.id === 'mnp-lifestyles');
  assert.ok(parent);
  assert.deepEqual(parent.rect, MNP_PARENT);
});

test('three MNP stages keep rect:null and link parentVenueId mnp-lifestyles', () => {
  for (const id of STAGE_IDS) {
    const venue = tentedCityVenues.find((v) => v.id === id);
    assert.ok(venue, id);
    assert.equal(venue.rect, null);
    assert.equal(venue.parentVenueId, 'mnp-lifestyles');
    assert.deepEqual(venueRect(venue), MNP_PARENT);
  }
});

test('schedule location_name strings resolve to non-null MNP parent rect', () => {
  for (const location of SCHEDULE_LOCATION_NAMES) {
    const place = findTentedCityPlace(location, vendors);
    assert.ok(place, `place for ${location}`);
    assert.equal(place.kind, 'stage');
    assert.equal(place.venue.parentVenueId, 'mnp-lifestyles');
    const rect = placeRect(place);
    assert.ok(rect, `rect for ${location}`);
    assert.deepEqual(rect, MNP_PARENT);
  }
});

test('Quality Homes Stage does not resolve to booth 3A-09-12 vendor rect', () => {
  const place = findTentedCityPlace('Quality Homes - Stage', vendors);
  assert.equal(place.kind, 'stage');
  assert.equal(place.venue.id, 'quality-homes-stage');
  const rect = placeRect(place);
  assert.deepEqual(rect, MNP_PARENT);
  assert.notDeepEqual(rect, QH_BOOTH);

  const qhVendor = vendors.find((v) => v.locationLabel === '3A-09-12' || (v.booths || []).includes('3A-09'));
  assert.ok(qhVendor, 'Quality Homes exhibitor booth exists for contrast');
  assert.equal(qhVendor.locationLabel, '3A-09-12');
  assert.notDeepEqual(rect, qhVendor.rect);

  // Venue note must forbid booth reuse.
  assert.match(place.venue.note || '', /3A-09-12|booth/i);
});

test('findTentedCityVenue prefers stage names over Quality Homes exhibitor', () => {
  const venue = findTentedCityVenue('Quality Homes - Stage');
  assert.equal(venue.id, 'quality-homes-stage');
  assert.equal(venue.kind, 'stage');
});

test('TentedCityMap uses placeRect for stage unmapped gate; filter dots omit parent-fallback stages', () => {
  const map = fs.readFileSync(new URL('../src/components/TentedCityMap.tsx', import.meta.url), 'utf8');
  assert.match(map, /place\.kind === 'stage' && !placeRect\(place\)/);
  assert.match(map, /filter\(\(v\) => v\.kind === 'stage' && v\.rect\)/);
  assert.match(map, /Parent-fallback stages/);
});
