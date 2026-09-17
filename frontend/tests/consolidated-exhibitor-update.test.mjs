import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

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
const orange = ['Norfolk Drone Services', 'Iron-Haven Structures', 'Doc MacCheesey', 'Turquesa Mexican Food', 'Chepstow & District Lions Club', "Tilly's Fresh Fair Style Lemonade", 'Little Bowl', 'The Back 40 Smoke Box'];

test('live baseline reconciles to the approved 231-record candidate', () => {
  assert.equal(catalog.length, 231);
  for (const [name, location] of yellow) {
    const hits = catalog.filter((vendor) => vendor.name === name);
    assert.equal(hits.length, 1, name);
    assert.equal(hits[0].location, location, name);
  }
  assert.deepEqual(catalog.filter((v) => v.name.includes('Beef Farmers')).map((v) => [v.name, v.type, v.location]), [
    ['Beef Farmers of Ontario & Bruce County Beef Farmers', 'Outdoor', '2B-08–09'],
    ['Beef Farmers of Ontario & Bruce County Beef Farmers', 'Indoor', 'SOUTH-4'],
  ]);
  assert.equal(catalog.find((v) => v.name === 'Hometown Street Eats, Drayton')?.location, 'WEST-3');
  for (const [name, location] of artisan) {
    const hits = catalog.filter((vendor) => vendor.name === name);
    assert.equal(hits.length, 1, name);
    assert.equal(hits[0].type, 'Indoor');
    assert.equal(hits[0].location, location);
  }
});

test('map updater preserves destinations and Artisan Tent representation', () => {
  for (const [name, location] of yellow) {
    assert.match(mapUpdates, new RegExp(name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')));
    assert.match(mapUpdates, new RegExp(`locationLabel: '${location}'`));
  }
  assert.match(mapUpdates, /booths: \['2B-08', '2B-09'\]/);
  assert.match(mapUpdates, /booths: \['WEST-3'\]/);
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
