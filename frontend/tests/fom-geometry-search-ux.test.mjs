import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
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
    : name.startsWith('.')
      ? load(new URL(name.endsWith('.ts') || name.endsWith('.tsx') ? name : name + '.ts', url))
      : createRequire(url)(name));
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

const { tentedCityVenues, findTentedCityVenue } = load(new URL('../src/config/tentedCityVenues.ts', import.meta.url));
const {
  BRITESPAN_BUILDING_RECT, CKNX_WEST3_RECT, HYDRO_ONE_EAST5_RECT, MNP_LIFESTYLES_EAST2_RECT, AREA_BY_ID,
} = load(new URL('../src/config/tentedCityGeometry.ts', import.meta.url));
const { footprintForVendor, matchVendor } = load(new URL('../src/config/tentedCityVendorMatch.ts', import.meta.url));
const { findTentedCityPlace, placeRect, resolveMapTypeForLocation } = load(new URL('../src/config/tentedCitySearch.ts', import.meta.url));
const { searchEventMap, isBlockedMapQuery } = load(new URL('../src/config/mapSearch.ts', import.meta.url));
const { resolveGroundsZone, GROUNDS_ZONES } = load(new URL('../src/config/groundsZones.ts', import.meta.url));
const { GROUNDS_INITIAL_SCALE, GROUNDS_MAX_SCALE } = load(new URL('../src/config/groundsCamera.ts', import.meta.url));
const vendors = loadExhibitors();

const OLD_MAIN_STAGE_ROAD = { x: 53.243, y: 41.875, w: 5.344, h: 3.854 };
const OLD_LABEL_STRIP = { x: 28.737, y: 89.499, w: 15.783, h: 4.48 };
const OLD_CKNX = { x: 7.8, y: 39.0, w: 11.8, h: 9.2 };
const MUTUAL_SQUARE = { x: 45.376, y: 47.253, w: 9.693, h: 9.272 };
const NEW_BRITESPAN = { x: 28.786, y: 82.958, w: 15.659, h: 10.875 };

const venuesSrc = fs.readFileSync(new URL('../src/config/tentedCityVenues.ts', import.meta.url), 'utf8');
const groundsMapSrc = fs.readFileSync(new URL('../src/components/GroundsMap.tsx', import.meta.url), 'utf8');
const tentedMapSrc = fs.readFileSync(new URL('../src/components/TentedCityMap.tsx', import.meta.url), 'utf8');
const mapSrc = fs.readFileSync(new URL('../app/(tabs)/map.tsx', import.meta.url), 'utf8');

test('P0 Main Stage venue leaves Hydro One Avenue road strip', () => {
  const venue = tentedCityVenues.find((v) => v.id === 'ontario-mutuals-main-stage');
  assert.ok(venue);
  assert.deepEqual(venue.rect, NEW_BRITESPAN);
  assert.notDeepEqual(venue.rect, OLD_MAIN_STAGE_ROAD);
  assert.notDeepEqual(venue.rect, OLD_LABEL_STRIP);
  assert.notDeepEqual(venue.rect, MUTUAL_SQUARE);
  assert.deepEqual(BRITESPAN_BUILDING_RECT, NEW_BRITESPAN);
  const named = AREA_BY_ID.get('named-ontario-mutuals-main-stage-welcome-centre');
  assert.deepEqual(named.rect, NEW_BRITESPAN);
});

test('schedule Main Stage names resolve to Britespan campus', () => {
  for (const name of [
    'Ontario Mutuals Main Stage - In the Britespan Building',
    'Ontario Mutuals Main Stage',
    'Britespan Building',
    'Main Stage',
    'Welcome Centre',
  ]) {
    const place = findTentedCityPlace(name, vendors);
    assert.equal(place?.kind, 'stage', name);
    assert.deepEqual(placeRect(place), NEW_BRITESPAN, name);
    assert.equal(resolveMapTypeForLocation(name, vendors), 'tented', name);
  }
});

test('Welcome / Britespan vendor FoM uses building, not Mutual Square; VIP/First Aid stay Mutual Square', () => {
  for (const name of ['Welcome Centre', 'Britespan Building', 'Britespan Main Stage Building']) {
    const vendor = vendors.find((v) => v.name === name);
    assert.ok(vendor, name);
    const fp = footprintForVendor(vendor);
    assert.ok(fp, name);
    assert.deepEqual(fp.rect, NEW_BRITESPAN, name);
    assert.equal(fp.areaId, 'named-ontario-mutuals-main-stage-welcome-centre', name);
    assert.notDeepEqual(fp.rect, MUTUAL_SQUARE, name);
    assert.notDeepEqual(fp.rect, OLD_MAIN_STAGE_ROAD, name);
  }
  const vip = vendors.find((v) => v.name === 'Grain Farmers of Ontario VIP Tent');
  assert.equal(matchVendor(vip).areaId, 'named-mutual-square');
  const aid = vendors.find((v) => v.name === 'First Aid and Lost Persons');
  assert.equal(matchVendor(aid).areaId, 'named-mutual-square');
  assert.deepEqual(footprintForVendor(aid).rect, MUTUAL_SQUARE);
});

test('CKNX venue uses PDF WEST-3 named area', () => {
  const venue = tentedCityVenues.find((v) => v.id === 'cknx-gfo-lounge');
  assert.deepEqual(venue.rect, CKNX_WEST3_RECT);
  assert.notDeepEqual(venue.rect, OLD_CKNX);
  assert.deepEqual(CKNX_WEST3_RECT, { x: 8.361, y: 41.157, w: 8.778, h: 7.967 });
});

test('Hydro One static rect tightened to named EAST-5', () => {
  const hydro = vendors.find((v) => v.name === 'Hydro One');
  assert.deepEqual(hydro.rect, HYDRO_ONE_EAST5_RECT);
  assert.deepEqual(hydro.booths, ['EAST-05']);
  assert.deepEqual(AREA_BY_ID.get('named-east-5').rect, HYDRO_ONE_EAST5_RECT);
  assert.equal(hydro.locationLabel, 'EAST-05');
});

test('MNP EAST-2 parent is unchanged', () => {
  const parent = tentedCityVenues.find((v) => v.id === 'mnp-lifestyles');
  assert.deepEqual(parent.rect, MNP_LIFESTYLES_EAST2_RECT);
  assert.deepEqual(MNP_LIFESTYLES_EAST2_RECT, { x: 57.864, y: 38.189, w: 6.176, h: 6.882 });
});

test('unified search returns owning mapType and switches destinations', () => {
  const rv = searchEventMap('RV Park', vendors);
  assert.ok(rv.some((h) => h.mapType === 'grounds' && h.zoneId === 'rv-park'));
  const camp = searchEventMap('camping', vendors);
  assert.ok(camp.some((h) => h.mapType === 'grounds' && h.zoneId === 'rv-park'));
  const west = searchEventMap('West Parking', vendors);
  assert.ok(west.some((h) => h.mapType === 'grounds' && h.zoneId === 'west-parking'));
  assert.ok(!west.some((h) => h.zoneId === 'north-parking'));
  const shuttle = searchEventMap('shuttle', vendors);
  assert.ok(shuttle.some((h) => h.mapType === 'grounds' && h.zoneId === 'bus-stop'));
  const plow = searchEventMap('plowing', vendors);
  assert.ok(plow.some((h) => h.zoneId === 'horse-plowing'));
  assert.ok(plow.some((h) => h.zoneId === 'tractor-plowing'));
  const horse = searchEventMap('Horse Plowing', vendors);
  assert.ok(horse.some((h) => h.zoneId === 'horse-plowing'));
  assert.ok(!horse.some((h) => h.zoneId === 'tractor-plowing'));
  const stage = searchEventMap('Ontario Mutuals Main Stage', vendors);
  assert.ok(stage.some((h) => h.mapType === 'tented' && h.kind === 'stage'));
  const eventCentre = searchEventMap('Event Centre', vendors);
  assert.ok(eventCentre.some((h) => h.mapType === 'tented' && h.kind === 'semantic'));
  const aid = searchEventMap('First Aid', vendors);
  assert.ok(aid.some((h) => h.mapType === 'tented'));
  const emergency = searchEventMap('Emergency', vendors);
  assert.ok(emergency.some((h) => h.mapType === 'tented' && /first aid/i.test(h.title)));
  const welcome = searchEventMap('Welcome Centre', vendors);
  assert.ok(welcome.some((h) => h.mapType === 'tented'));
});

test('unresolved destinations stay unmapped', () => {
  assert.equal(isBlockedMapQuery('Bus Parking #1194'), true);
  assert.equal(isBlockedMapQuery('parade route'), true);
  assert.deepEqual(searchEventMap('Bus Parking #1194', vendors), []);
  assert.deepEqual(searchEventMap('Bus Parking', vendors), []);
  assert.deepEqual(searchEventMap('Parade Route', vendors), []);
  assert.equal(resolveGroundsZone('Bus Parking #1194'), null);
  assert.equal(resolveGroundsZone('Parade Route'), null);
  assert.ok(!GROUNDS_ZONES.some((z) => z.id === 'bus-parking' || /1194/.test(z.label)));
});

test('Valard EAST-06 and CAN-AM stay untouched', () => {
  const valard = vendors.find((v) => v.name === 'Valard Construction, Vaughan');
  assert.equal(valard.locationLabel, 'EAST-06');
  assert.equal(valard.rect, null);
  const canam = vendors.find((v) => v.name.startsWith('Can-Am Demo Area'));
  assert.equal(canam.locationLabel, 'WEST-02');
});

test('Grounds UX: initial zoom, raised max, one-shot FoM, search, fit, box-none card', () => {
  assert.equal(GROUNDS_INITIAL_SCALE, 1.22);
  assert.ok(GROUNDS_MAX_SCALE >= 6);
  assert.match(groundsMapSrc, /GROUNDS_INITIAL_SCALE/);
  assert.match(groundsMapSrc, /GROUNDS_MAX_SCALE/);
  assert.match(groundsMapSrc, /focusedKey/);
  assert.match(groundsMapSrc, /grounds-map-search/);
  assert.match(groundsMapSrc, /searchEventMap/);
  assert.match(groundsMapSrc, /grounds-fit-reset/);
  assert.match(groundsMapSrc, /pointerEvents="box-none"/);
  assert.match(groundsMapSrc, /minPointers\(1\)\.maxPointers\(1\)/);
  assert.match(tentedMapSrc, /searchEventMap/);
  assert.match(tentedMapSrc, /onSwitchToGrounds\?\.\(hit.query\)/);
  assert.match(mapSrc, /overrideLocation/);
  assert.match(mapSrc, /onSwitchToTented=\{\(loc\) =>/);
});

test('visual language remains cyan fill + yellow outer border', () => {
  assert.match(groundsMapSrc, /#FFD600/);
  assert.match(groundsMapSrc, /rgba\(0, 229, 255/);
  assert.match(tentedMapSrc, /SELECTED_STAGE_OUTER_BORDER = '#FFD600'/);
  assert.match(tentedMapSrc, /SELECTED_STAGE_FILL = 'rgba\(0, 229, 255, 0.45\)'/);
  assert.match(venuesSrc, /BRITESPAN_BUILDING_RECT/);
});
