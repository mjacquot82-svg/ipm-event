import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const vendors = JSON.parse(fs.readFileSync(path.join(root, 'public/api/vendors.json'), 'utf8')).vendors;
const mapUpdates = fs.readFileSync(path.join(root, 'src/data/tentedCityVendorsSept16.ts'), 'utf8');
const mapSource = fs.readdirSync(path.join(root, 'src/data'))
  .filter((file) => /^tentedCityVendorsPart\d+\.ts$/.test(file))
  .map((file) => fs.readFileSync(path.join(root, 'src/data', file), 'utf8'))
  .join('\n');

const actionable = [
  ['Your Ultimate Structures Inc., Beachville', '2A-09'],
  ['Eastern Silk Road, Kitchener', '4B-04'],
  ['JW Custom Fab, Cargill', '5A-21'],
  ['National Energy Equipment Inc.', '2B-15'],
  ['Weldesign Hardware Inc., Burgessville', '2B-22'],
  ['Huron-Bruce Provincial Liberal Association', '3A-06'],
  ['CSN Auto Reset Group', '4B-02'],
  ['Maple Court Retirement', '4B-08'],
];

const orange = [
  'Norfolk Drone Services', 'Iron-Haven Structures', 'Doc MacCheesey', 'Turquesa Mexican Food',
  'Chepstow & District Lions Club', "Tilly's Fresh Fair Style Lemonade", 'Little Bowl', 'The Back 40 Smoke Box',
];

test('Sept 16 actionable directory records are present exactly once at workbook lots', () => {
  for (const [name, location] of actionable) {
    const hits = vendors.filter((vendor) => vendor.name === name);
    assert.equal(hits.length, 1, `${name} directory cardinality`);
    assert.equal(hits[0].location, location, `${name} directory location`);
    assert.equal(hits[0].type, 'Outdoor');
  }
});

test('Sept 16 map updater contains one assignment per actionable exhibitor', () => {
  for (const [name, location] of actionable.slice(0, 3)) {
    assert.match(mapUpdates, new RegExp(`'${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
    assert.match(mapUpdates, new RegExp(`locationLabel: '${location}'`));
    assert.match(mapUpdates, new RegExp(`booths: \\['${location}'\\]`));
  }
  for (const [name, location] of actionable.filter((_, index) => [3, 5, 6, 7].includes(index))) {
    assert.match(mapUpdates, new RegExp(`name: '${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
    assert.match(mapUpdates, new RegExp(`locationLabel: '${location}'`));
    assert.match(mapUpdates, new RegExp(`booths: \\['${location}'\\]`));
  }
  assert.match(mapUpdates, /'Weldesign Hardware Inc\., Burgessville': \{ locationLabel: '2B-22', booths: \['2B-22'\] \}/);
  assert.equal((mapUpdates.match(/Weldesign Hardware Inc\., Burgessville/g) || []).length, 3);
});

test('holds and orange exhibitors remain untouched in public output', () => {
  assert.deepEqual(vendors.filter((v) => v.name.includes('Beef Farmers')).map((v) => [v.name, v.location]), [
    ['Beef Farmers of Ontario & Bruce County Beef Farmer', '2B-08'],
    ['Beef Farmers of Ontario & Bruce County Beef Farmers', ''],
    ['Beef Farmers of Ontario & Bruce County Beef Farmers', ''],
  ]);
  assert.deepEqual(vendors.find((v) => v.name === 'Hometown Street Eats, Drayton').location, '2B-25');
  for (const name of orange) {
    assert.equal(vendors.some((v) => v.name === name), false, `${name} must remain absent from directory`);
    assert.equal(mapSource.includes(`"name":"${name}"`), false, `${name} must remain absent from map catalog`);
  }
});
