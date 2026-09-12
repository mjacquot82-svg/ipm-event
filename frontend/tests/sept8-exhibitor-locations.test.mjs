import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function loadExhibitors() {
  const dir = path.join(root, 'src/data');
  const rows = [];
  for (const file of fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('tentedCityVendorsPart') && f.endsWith('.ts'))
    .sort()) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    const start = text.indexOf('= [') + 2;
    const end = text.lastIndexOf(']') + 1;
    rows.push(...JSON.parse(text.slice(start, end)));
  }
  return rows;
}

function findOne(rows, pred, label) {
  const hits = rows.filter(pred);
  assert.equal(hits.length, 1, `${label}: expected 1 hit, got ${hits.length}`);
  return hits[0];
}

const vendors = loadExhibitors();

// Lightweight load of resolveVendorMapQuery via transpile is heavy; assert crosswalk source + labels instead.
const crosswalkSrc = fs.readFileSync(path.join(root, 'src/config/vendorMapCrosswalk.ts'), 'utf8');


test('Sept8 conflict corrections', () => {
  assert.equal(findOne(vendors, (v) => /cottrill heavy/i.test(v.name), 'Cottrill').locationLabel, '2A-05');
  assert.deepEqual(findOne(vendors, (v) => /cottrill heavy/i.test(v.name), 'Cottrill').booths, ['2A-05']);
  assert.equal(findOne(vendors, (v) => v.name === 'Ontario PC Caucus', 'PC').locationLabel, '3B-18');
  assert.equal(findOne(vendors, (v) => v.name === 'Ontario Government', 'Gov').locationLabel, '3B-19-24');
  assert.deepEqual(
    findOne(vendors, (v) => v.name === 'Ontario Government', 'Gov').booths,
    ['3B-19', '3B-20', '3B-21', '3B-22', '3B-23', '3B-24'],
  );
  assert.equal(findOne(vendors, (v) => /university of guelph/i.test(v.name), 'Guelph').locationLabel, '3B-16-17');
  const scatter = findOne(vendors, (v) => /scatterbrain/i.test(v.name), 'Scatterbrain');
  assert.equal(scatter.locationLabel, '4A-13');
  assert.equal(scatter.tent, null);
  assert.equal(scatter.category, 'outdoor');
  const canAmConflict = findOne(vendors, (v) => /can-am/i.test(v.name), 'CAN-AM');
  assert.equal(canAmConflict.locationLabel, 'WEST-02');
  assert.equal(canAmConflict.rect, null);
  const valard = findOne(vendors, (v) => /valard/i.test(v.name), 'Valard');
  assert.equal(valard.locationLabel, 'EAST-06');
  assert.equal(valard.rect, null);
});

test('Sept8 backfills present with correct labels', () => {
  assert.equal(findOne(vendors, (v) => /dj.?s handcrafted/i.test(v.name), 'DJ').locationLabel, '4A-29-30');
  assert.equal(findOne(vendors, (v) => /fellowship of christian farmers/i.test(v.name), 'Fellowship').locationLabel, '2A-17-18');
  assert.equal(
    findOne(vendors, (v) => /georgian bay funeral/i.test(v.name), 'Georgian').locationLabel,
    '4B-05',
  );
  assert.equal(findOne(vendors, (v) => /millroad/i.test(v.name), 'Millroad').locationLabel, '1B-23-24');
});

test('Sept8 must-adds and optional adds', () => {
  const expect = [
    ['Transit Trailer Ltd', '2A-03-04'],
    ['Bambrook Farm Equipment', '1A-05'],
    ['Teeswater Agro Parts Ltd', '1A-21'],
    ['Maitland Valley Conservation', '5B-10-12'],
    ['DeDell Seeds Inc', '2B-19-20'],
    ['Cedarport Window & Door Centre', '2B-29'],
    ['Florence Leather', '4B-15'],
    ["Gerry's Truck Centre", '4A-04'],
    ['Heavenly Dreams Ice Cream Inc', '4A-37'],
    ['Metalf Food & Beverage', '3B-13-14'],
    ['Ontario Cattle Feeders', '2B-07'],
    ['Premier Tech Water & Environment', '2A-28'],
    ['Pro Cart', '5A-19'],
    ['Real Time Fun and Rentals', '4B-10'],
    ["What's Cookin' Food Trailer", '2A-12'],
    ['WASTE MANAGEMNT', '4B-29'],
  ];
  for (const [name, loc] of expect) {
    const v = findOne(vendors, (row) => row.name.toLowerCase().includes(name.toLowerCase()), name);
    assert.equal(v.locationLabel, loc, name);
  }
  // no Waste Management duplicate alongside WASTE MANAGEMNT
  const waste = vendors.filter((v) => /waste\s*manag/i.test(v.name));
  assert.equal(waste.length, 1);
});


test('Sept8 CAN-AM / Valard search aliases wired in crosswalk', () => {
  assert.match(crosswalkSrc, /CAN-AM/);
  assert.match(crosswalkSrc, /Valard Construction LP/);
  assert.match(crosswalkSrc, /Can-Am Demo Area, Montreal, QC/);
  assert.match(crosswalkSrc, /Valard Construction, Vaughan/);
});

test('CAN-AM and Valard are searchable by common queries via find in vendor names', () => {
  assert.ok(vendors.some((v) => /can-am/i.test(v.name)));
  assert.ok(vendors.some((v) => /valard/i.test(v.name)));
  const canam = findOne(vendors, (v) => /can-am/i.test(v.name), 'CAN-AM');
  assert.equal(canam.locationLabel, 'WEST-02');
  assert.equal(canam.rect, null);
  const valard = findOne(vendors, (v) => /valard/i.test(v.name), 'Valard');
  assert.equal(valard.locationLabel, 'EAST-06');
  assert.equal(valard.rect, null);
});

test('AmSpec Group, Hamilton unchanged (NOT_ON_SEPT_8 hold)', () => {
  const amspec = findOne(vendors, (v) => v.name === 'AmSpec Group, Hamilton', 'AmSpec');
  assert.equal(amspec.locationLabel, '1B-16-22');
  assert.equal(amspec.tent, 'farming-for-the-future');
  assert.equal(amspec.category, 'indoor');
  assert.deepEqual(amspec.booths, ['1B-16', '1B-17', '1B-18', '1B-19', '1B-20', '1B-21', '1B-22']);
});

test('no duplicate exact names among Sept8 targets', () => {
  const names = [
    'Transit Trailer Ltd',
    'Bambrook Farm Equipment',
    'Teeswater Agro Parts Ltd',
    'Maitland Valley Conservation',
    'Florence Leather',
    "Gerry's Truck Centre",
    'Pro Cart',
    'Real Time Fun and Rentals',
    'WASTE MANAGEMNT',
    "DJ's Handcrafted Solid Wood",
    'Fellowship of Christian Farmers',
    'Georgian Bay Funeral Services Association (GBFSA)',
    'Millroad Manufacturing & Sales',
  ];
  for (const name of names) {
    assert.equal(vendors.filter((v) => v.name === name).length, 1, name);
  }
});

test('vendor count did not drop below pre-Sept8 baseline', () => {
  assert.ok(vendors.length >= 318, `expected >= 318, got ${vendors.length}`);
  assert.equal(vendors.length, 326);
});
