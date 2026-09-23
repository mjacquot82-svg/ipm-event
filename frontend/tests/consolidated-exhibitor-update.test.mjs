import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);

const root = new URL('..', import.meta.url);
const catalog = JSON.parse(fs.readFileSync(new URL('public/api/vendors.json', root))).vendors;
const mapUpdates = fs.readFileSync(new URL('src/data/tentedCityVendorsConsolidated.ts', root), 'utf8');
const mapSource = [1, 2, 3].map((part) => fs.readFileSync(new URL(`src/data/tentedCityVendorsPart${part}.ts`, root), 'utf8')).join('\n');

const yellow = new Map([
  ['Your Ultimate Structures Inc., Beachville', '2A-09'],
  ['National Energy Equipment Inc.', '2B-15'],
  ['Weldesign Hardware Inc., Burgessville', '2B-22'],
  ['Huron-Bruce Provincial Liberal Association', '3A-06'],
  ['CSN Auto Reset Group', '4B-02'],
  ['Eastern Silk Road, Kitchener', '4B-04'],
  ['Maple Court Retirement', '4B-08'],
  ['JW Custom Fab, Cargill', '5A-21'],
]);
const artisan = [
  ['Amabel Books, Allenford', 'Artisan Tent'], ['Equestrian Elite, Durham', 'Artisan Tent'],
  ['Flora and Fae, Tara', 'Artisan Tent'], ["Mike's Wood, Elmwood", 'Artisan Tent'],
  ["Nana's Sewing Basket, Walkerton", 'Artisan Tent'], ['Natural Stitch Designs, Amaranth', 'Artisan Tent'],
  ['Northern Flyer Design (Ken Thornburn), Tara', 'Artisan Tent'], ['Paisley Drive Designs, Chesley', 'Artisan Tent'],
  ['Rachel Joy Jewellery, Kincardine', 'Artisan Tent'], ['Susan Seitz, Walkerton', 'Artisan Tent'],
  ['Wildflower Designs, Shallow Lake', 'Artisan Tent'],
];
const orange = ['Norfolk Drone Services', 'Doc MacCheesey', 'Little Bowl'];
const cancellations = [
  { directory: 'RONA Doidge Kincardine, Kincardine', id: '2c76a419-cfec-4413-9d8c-e1944dda6add', type: 'Outdoor', location: '2A-36-38', map: 'RONA Doidge Kincardine' },
  { directory: 'WASTE MANAGEMNT', id: 'e32ebc10-ce2b-5bac-8bb4-c21650a2effb', type: 'Outdoor', location: '4B-29', map: 'WASTE MANAGEMNT' },
  { directory: 'Real Time Fun and Rentals', id: '6e77cda5-7713-5ed5-83f5-e2a8b85d69a7', type: 'Food', location: '4B-10', map: 'Real Time Fun and Rentals' },
  { directory: 'AmSpec Group', id: 'a0d0ef38-08bd-47ed-a65f-4e89c44c44e1', type: 'Indoor', location: '1B-16-22', map: 'AmSpec Group, Hamilton' },
];

const moduleCache = new Map();
function loadTypeScript(relative, parent = root) {
  const filename = new URL(relative, parent);
  if (moduleCache.has(filename.href)) return moduleCache.get(filename.href).exports;
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  moduleCache.set(filename.href, mod);
  const localRequire = (name) => {
    if (name.endsWith('.json')) return JSON.parse(fs.readFileSync(new URL(name, filename), 'utf8'));
    if (name.startsWith('.')) return loadTypeScript(`${name}.ts`, new URL('.', filename));
    return require(name);
  };
  new Function('require', 'module', 'exports', code)(localRequire, mod, mod.exports);
  return mod.exports;
}

test('candidate preserves consolidated data after four confirmed cancellations', () => {
  assert.equal(catalog.length, 315);
  for (const [name, location] of yellow) {
    const hits = catalog.filter((vendor) => vendor.name === name);
    assert.equal(hits.length, 1, name);
    assert.equal(hits[0].location, location, name);
  }
  assert.deepEqual(catalog.filter((v) => v.name.includes('Beef Farmers')).map((v) => [v.name, v.type, v.location]), [
    ['Beef Farmers of Ontario & Bruce County Beef Farmers', 'Outdoor', '2B-08–09'],
    ['Beef Farmers of Ontario & Bruce County Beef Farmers', 'Indoor', 'SOUTH-4'],
  ]);
  assert.equal(catalog.find((v) => v.name === 'Hometown Street Eats, Drayton')?.location, 'Lounge');
  for (const [name, location] of artisan) {
    const hits = catalog.filter((vendor) => vendor.name === name);
    assert.equal(hits.length, 1, name);
    assert.equal(hits[0].type, 'Indoor');
    assert.equal(hits[0].location, 'Indoors at the Artisan Tent');
  }
});

test('Sharon-confirmed cancellations are absent from directory and runtime map catalogs', () => {
  for (const cancelled of cancellations) {
    assert.equal(catalog.some((vendor) => vendor.id === cancelled.id), false, cancelled.id);
    assert.equal(catalog.some((vendor) => vendor.name === cancelled.directory), false, cancelled.directory);
    assert.equal(mapSource.includes(`"name":"${cancelled.map}"`), false, cancelled.map);
  }
  assert.equal(mapSource.includes('Route 66'), false);
  assert.equal(mapSource.includes('RONA Doidge Kincardine'), false);
  assert.equal(mapSource.includes('WASTE MANAGEMNT'), false);
  assert.equal(mapSource.includes('Real Time Fun and Rentals'), false);
  assert.equal(mapSource.includes('AmSpec Group, Hamilton'), false);
});

test('map updater preserves destinations and Artisan Tent representation', () => {
  for (const [name, location] of yellow) {
    assert.match(mapUpdates, new RegExp(name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')));
    assert.match(mapUpdates, new RegExp(`locationLabel: '${location}'`));
  }
  assert.match(mapUpdates, /booths: \['2B-08', '2B-09'\]/);
  assert.match(mapUpdates, /booths: \['Lounge'\]/);
  for (const [name] of artisan) {
    const mapName = name.replaceAll("'", '’');
    assert.ok(mapSource.includes(name) || mapSource.includes(mapName), name);
  }
  assert.match(mapSource, /"name":"Artisan Vendors Tent"/);
});

test('already-correct, holds, and orange exclusions remain protected', () => {
  assert.equal(catalog.find((v) => v.name === 'Wild Willies Food Truck, Bayfield')?.location, '2B-26');
  assert.equal(catalog.find((v) => v.name === 'Florence Leather')?.location, '4B-15');
  for (const name of orange) {
    assert.equal(catalog.some((v) => v.name === name), false, name);
    assert.equal(mapSource.includes(`"name":"${name}"`), false, name);
  }
});

test('Beef Farmers is one attendee group with two preserved, friendly locations', () => {
  const { groupVendorsForAttendees } = loadTypeScript('src/config/vendorPresentation.ts');
  const beef = catalog.filter((vendor) => vendor.name.includes('Beef Farmers'));
  const groups = groupVendorsForAttendees(beef);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].locations.length, 2);
  assert.deepEqual(groups[0].locations.map((location) => [location.record.type, location.displayLocation, location.mapLocation]), [
    ['Outdoor', '2B-08–09', '2B-08–09'],
    ['Indoor', 'Hydro One Education Area', 'SOUTH-4'],
  ]);
  assert.notEqual(groups[0].locations[0].record.id, groups[0].locations[1].record.id);
});

test('multi-location navigation is structured while ambiguous free-text remains guarded', () => {
  const vendorsSource = fs.readFileSync(new URL('../app/(tabs)/vendors.tsx', import.meta.url), 'utf8');
  const mapSourceFile = fs.readFileSync(new URL('../app/(tabs)/map.tsx', import.meta.url), 'utf8');
  const mapComponent = fs.readFileSync(new URL('../src/components/TentedCityMap.tsx', import.meta.url), 'utf8');
  const searchSource = fs.readFileSync(new URL('../src/config/tentedCitySearch.ts', import.meta.url), 'utf8');
  const resolverSource = fs.readFileSync(new URL('../src/config/vendorMapCrosswalk.ts', import.meta.url), 'utf8');
  assert.match(vendorsSource, /vendorName: vendor\.name/);
  assert.match(vendorsSource, /vendorLocation: vendor\.location/);
  assert.match(vendorsSource, /item\.locations\.length > 1/);
  assert.match(mapSourceFile, /initialVendorName={vendorName}/);
  assert.match(mapComponent, /findTentedCityPlaceByIdentity/);
  assert.match(searchSource, /matches\.length === 1/);
  assert.match(resolverSource, /if \(exact\.length > 1\) return \{ status: 'unmapped' \}/);
});

test('Hometown canonical identity resolves WEST-3 to the existing CKNX Lounge map record', () => {
  const { findTentedCityPlaceByIdentity } = loadTypeScript('src/config/tentedCitySearch.ts');
  const tentedCityVendors = [{
    name: 'Hometown Street Eats, Drayton', category: 'food',
    locationLabel: 'CKNX Centennial Pavilion (Lounge), West 3', booths: ['WEST-3'],
  }];
  const place = findTentedCityPlaceByIdentity(
    'Hometown Street Eats, Drayton',
    'WEST-3',
    tentedCityVendors,
    'food',
  );
  assert.equal(place?.kind, 'vendor');
  assert.equal(place?.vendor.locationLabel, 'CKNX Centennial Pavilion (Lounge), West 3');
  assert.deepEqual(place?.vendor.booths, ['WEST-3']);
});

test('resolved September 19 assignments retain IDs and resolve exactly the confirmed booth lots', () => {
  const { tentedCityVendors } = loadTypeScript('src/data/tentedCityVendors.ts');
  const { matchVendor } = loadTypeScript('src/config/tentedCityVendorMatch.ts');
  const cases = [
    ['15691f8e-2ecb-4904-8b4f-3ab4ec8f10c5', 'Fellowship of Christian Farmers', '2A-16–17', ['2A-16', '2A-17']],
    ['b1280c80-ed82-5b61-a875-4ae2b558a0e0', 'Mitchell Cycle Inc., Mitchell', '2A-18–19', ['2A-18', '2A-19']],
    ['e0a5d033-8f65-404e-bea0-3d29c912046b', 'Bailey Repair Services Ltd., Palmerston', '2A-20', ['2A-20']],
    ['f2c294e5-6c52-55ae-920f-784caea9c320', 'B Town Farm Supply', '1B-07', ['1B-07']],
    ['319f7c2d-22e3-4945-8c4d-caa3d9ad7ff4', 'JW Custom Fab, Cargill', '5A-21', ['5A-21']],
  ];
  for (const [id, name, location, booths] of cases) {
    const rows = catalog.filter(v => v.id === id); assert.equal(rows.length, 1); assert.equal(rows[0].name, name); assert.equal(rows[0].location, location);
    const mapped = tentedCityVendors.filter(v => v.name === name); assert.equal(mapped.length, 1); assert.deepEqual(mapped[0].booths, booths);
    const result = matchVendor(mapped[0]); assert(result.rect); assert.equal(result.class, 'confident_lot');
    assert.equal(result.lotIds.length, booths.length);
    for (const booth of booths) assert(result.lotIds.some(id => id.endsWith(booth)), `${name}: ${booth}`);
    for (const v of tentedCityVendors.filter(v => v.name !== name)) assert(!v.booths.some(b => booths.includes(b)), `Collision: ${name} / ${v.name}`);
  }
  const town = catalog.find(v => v.name === 'B Town Farm Supply');
  assert.deepEqual(town, {id:'f2c294e5-6c52-55ae-920f-784caea9c320',name:'B Town Farm Supply',type:'',location:'1B-07',hours_of_operation:'',days_of_operation:'',priority:99});
  assert.equal(tentedCityVendors.find(v => v.name === town.name).category, '');
});
