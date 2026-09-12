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

const { resolveGroundsZone, resolvePlowingMapLocation } = load(new URL('../src/config/groundsZones.ts', import.meta.url));
const { resolveMapTypeForLocation, findTentedCityPlace } = load(new URL('../src/config/tentedCitySearch.ts', import.meta.url));
const { findSemanticAreaForLocation } = load(new URL('../src/config/tentedCitySemanticMap.ts', import.meta.url));
const { resolveVendorMapQuery } = load(new URL('../src/config/vendorMapCrosswalk.ts', import.meta.url));
const vendors = loadExhibitors();
const camping = fs.readFileSync(new URL('../app/(tabs)/camping.tsx', import.meta.url), 'utf8');
const emergency = fs.readFileSync(new URL('../app/(tabs)/emergency-services.tsx', import.meta.url), 'utf8');
const schedule = fs.readFileSync(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8');
const mapSource = fs.readFileSync(new URL('../app/(tabs)/map.tsx', import.meta.url), 'utf8');
const zonesSource = fs.readFileSync(new URL('../src/config/groundsZones.ts', import.meta.url), 'utf8');

test('1. Plowing Fields aliases + Horse/Tractor distinction', () => {
  assert.equal(resolveGroundsZone('Plowing Fields')?.id, 'tractor-plowing');
  assert.equal(resolveGroundsZone('Horse Plowing')?.id, 'horse-plowing');
  assert.equal(resolveGroundsZone('Tractor Plowing')?.id, 'tractor-plowing');
  assert.equal(resolvePlowingMapLocation('Plowing Fields', 'Horse Plowing'), 'Horse Plowing');
  assert.equal(resolvePlowingMapLocation('Plowing Fields', 'Tractor Plowing'), 'Tractor Plowing');
  assert.equal(resolvePlowingMapLocation('Plowing Fields', 'Junior Competition (tractors and horses)'), 'Plowing Fields');
  assert.equal(resolvePlowingMapLocation('Plowing Fields', 'Queen of the Furrow Plowing Competition'), 'Plowing Fields');
  assert.equal(resolveMapTypeForLocation('Plowing Fields', vendors), 'grounds');
  assert.match(schedule, /resolvePlowingMapLocation/);
});

test('2. Event Centre #1 — West 2 opens Tented City (semantic)', () => {
  assert.ok(findSemanticAreaForLocation('Event Centre #1 — West 2'));
  assert.equal(resolveMapTypeForLocation('Event Centre #1 — West 2', vendors), 'tented');
  assert.equal(findTentedCityPlace('Event Centre #1 — West 2', vendors), undefined);
});

test('3. Accessible Parking schedule path stays Tented City; grounds icon is extra discovery', () => {
  assert.ok(findSemanticAreaForLocation('Accessible Parking'));
  assert.equal(resolveMapTypeForLocation('Accessible Parking', vendors), 'tented');
  assert.equal(resolveGroundsZone('Accessible Parking')?.id, 'accessible-parking');
  assert.match(zonesSource, /id: 'accessible-parking'/);
});

test('4. Welcome Centre rename preserves geometry + Centre alias', () => {
  const welcome = vendors.find((v) => v.name === 'Welcome Centre');
  assert.ok(welcome);
  assert.equal(welcome.locationLabel, '3B-25-27');
  assert.deepEqual(welcome.rect, { x: 50.037, y: 41.875, w: 3.206, h: 3.854 });
  assert.equal(vendors.some((v) => v.name === 'Centre'), false);
  assert.equal(resolveVendorMapQuery('Centre').status, 'mapped');
  assert.equal(resolveVendorMapQuery('Centre').query, 'Welcome Centre');
  assert.equal(resolveVendorMapQuery('Welcome Centre').status, 'mapped');
  assert.equal(findTentedCityPlace('Welcome Centre', vendors)?.kind, 'stage');
});

test('5. Emergency / First Aid clean name + aliases + page Find-on-Map', () => {
  const aid = vendors.find((v) => v.name === 'First Aid and Lost Persons');
  assert.ok(aid);
  assert.equal(aid.locationLabel, '3A-25-28');
  assert.equal(vendors.some((v) => v.name === 'First Aid and Lost Persons)'), false);
  assert.equal(resolveVendorMapQuery('First Aid').query, 'First Aid and Lost Persons');
  assert.equal(resolveVendorMapQuery('Emergency Services').query, 'First Aid and Lost Persons');
  assert.equal(resolveMapTypeForLocation('First Aid and Lost Persons', vendors), 'tented');
  assert.match(emergency, /location: 'First Aid and Lost Persons'/);
  assert.match(emergency, /mapType: 'tented'/);
  assert.match(emergency, /Find First Aid on Map/);
});

test('6. Shuttle aliases → bus-stop only; Bus Parking #1194 stays separate', () => {
  for (const q of ['Bus Stop', 'shuttle', 'shuttle stop', 'shuttle stops', 'shuttle pickup', 'dropoff', 'pickup']) {
    assert.equal(resolveGroundsZone(q)?.id, 'bus-stop', q);
  }
  assert.equal(resolveGroundsZone('Bus Parking #1194'), null);
  assert.equal(resolveGroundsZone('Bus Parking'), null);
  assert.equal(resolveGroundsZone('bus parking 1194'), null);
  assert.doesNotMatch(zonesSource, /bus parking/);
});

test('7. Camping / RV refs → rv-park grounds + camping page Find-on-Map', () => {
  assert.equal(resolveGroundsZone('RV Park')?.id, 'rv-park');
  assert.equal(resolveGroundsZone('camping')?.id, 'rv-park');
  assert.equal(resolveMapTypeForLocation('RV Park', vendors), 'grounds');
  assert.match(camping, /location: 'RV Park'/);
  assert.match(camping, /mapType: 'grounds'/);
  assert.match(camping, /Find RV Park on Map/);
  assert.doesNotMatch(camping, /rv-detail|RV detail/i);
});

test('8. Hydro One EAST-5 → EAST-05 label normalize; geometry preserved', () => {
  const hydro = vendors.find((v) => v.name === 'Hydro One');
  assert.ok(hydro);
  assert.equal(hydro.locationLabel, 'EAST-05');
  assert.deepEqual(hydro.booths, ['EAST-05']);
  assert.deepEqual(hydro.rect, { x: 57.864, y: 58.625, w: 6.176, h: 6.444 });
  assert.equal(findTentedCityPlace('Hydro One', vendors)?.kind, 'vendor');
  assert.equal(resolveMapTypeForLocation('Hydro One', vendors), 'tented');
});

test('explicit mapType tented/grounds preserved; unrelated grounds routing intact', () => {
  assert.match(mapSource, /if \(mapType === 'tented' \|\| mapType === 'grounds'(?: \|\| mapType === 'rv')?\) return mapType/);
  assert.equal(resolveMapTypeForLocation('West Parking Lot', vendors), 'grounds');
  assert.equal(resolveMapTypeForLocation('North Parking', vendors), 'grounds');
  assert.equal(resolveMapTypeForLocation('Bus Stop', vendors), 'grounds');
  assert.equal(resolveMapTypeForLocation('RAM Truck Corral', vendors), 'tented');
});
