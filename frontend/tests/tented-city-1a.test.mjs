import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function firstExisting(paths) {
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('missing ' + paths.join(' | '));
}

const geoPath = firstExisting([
  path.join(root, 'src/data/tented-city-geometry-areas.json'),
  path.join(root, 'src/data/tented-city-geometry.json'),
  path.join(root, 'data/tented-city-geometry.json'),
]);
const mapPath = firstExisting([
  path.join(root, 'components/TentedCityMap.tsx'),
  path.join(root, 'src/components/TentedCityMap.tsx'),
]);
const screenPath = firstExisting([
  path.join(root, 'map.tsx'),
  path.join(root, 'app/(tabs)/map.tsx'),
]);
const vendorPath = firstExisting([
  path.join(root, 'data/tentedCityVendorsPart1.ts'),
  path.join(root, 'src/data/tentedCityVendorsPart1.ts'),
]);
const oneAPath = firstExisting([
  path.join(root, 'config/tentedCity1A.ts'),
  path.join(root, 'src/config/tentedCity1A.ts'),
]);


function round3(n) { return Math.round(n * 1000) / 1000; }
function ptsToPercentRect(pt) {
  return { x: round3(pt.x / 774 * 100), y: round3(pt.y / 603 * 100), w: round3(pt.w / 774 * 100), h: round3(pt.h / 603 * 100) };
}
function formatLotId(section, n) { return section + '-' + String(n).padStart(2, '0'); }
function lotsForArea(area) {
  const n = area.n_lots || 0;
  const start = area.lot_start;
  const pts = area.rect_pts;
  if (!n || start == null || !pts || !area.section) return [];
  const lots = [];
  if (area.split_axis === 'B_to_T') {
    const h = pts.h / n;
    for (let i = 0; i < n; i += 1) {
      const num = start + i;
      const y = pts.y + pts.h - (i + 1) * h;
      lots.push({ id: formatLotId(area.section, num), parent: area.label, n: num, rect: ptsToPercentRect({ x: pts.x, y, w: pts.w, h }), flagged: area.flagged });
    }
    return lots;
  }
  const w = pts.w / n;
  for (let i = 0; i < n; i += 1) {
    const num = start + i;
    const x = pts.x + i * w;
    lots.push({ id: formatLotId(area.section, num), parent: area.label, n: num, rect: ptsToPercentRect({ x, y: pts.y, w, h: pts.h }), flagged: area.flagged });
  }
  return lots;
}

const geo = JSON.parse(fs.readFileSync(geoPath, 'utf8'));
geo.lots = (geo.areas || []).flatMap(lotsForArea);
const lots = Object.fromEntries(geo.lots.map((l) => [l.id, l]));
const areas = Object.fromEntries(geo.areas.map((a) => [a.label, a]));

test('1A has three parents and 38 lots', () => {
  assert.equal(areas['1A 1-12'].n_lots, 12);
  assert.equal(areas['1A 13-24'].n_lots, 12);
  assert.equal(areas['1A 25-38'].n_lots, 14);
  const oneA = geo.lots.filter((l) => l.id.startsWith('1A-'));
  assert.equal(oneA.length, 38);
});

test('1A-01 is on the west edge of 1A 1-12', () => {
  const parent = areas['1A 1-12'].rect;
  const first = lots['1A-01'].rect;
  assert.equal(first.x, parent.x);
  assert.equal(first.y, parent.y);
});

test('1A-12 ends at the east edge of 1A 1-12', () => {
  const parent = areas['1A 1-12'].rect;
  const last = lots['1A-12'].rect;
  assert.ok(Math.abs(last.x + last.w - (parent.x + parent.w)) < 0.02);
});

test('1A-09 is the ninth equal slice and matches ACE PDF geometry', () => {
  const ninth = lots['1A-09'].rect;
  const first = lots['1A-01'].rect;
  assert.equal(ninth.w, first.w);
  assert.equal(ninth.h, first.h);
  assert.equal(ninth.x, 26.935);
  assert.equal(ninth.y, 26.268);
  assert.equal(ninth.w, 0.758);
  const vendors = fs.readFileSync(vendorPath, 'utf8');
  assert.ok(vendors.includes('ACE / JCB, Harriston'));
  assert.ok(vendors.includes('"locationLabel":"1A-09"'));
});

test('1A 25-38 is 14 lots that fill the parent and are not copied from 1A 1-12', () => {
  const parent = areas['1A 25-38'].rect;
  const a = lots['1A-25'].rect;
  const z = lots['1A-38'].rect;
  const wide = lots['1A-01'].rect;
  assert.ok(a.w < wide.w || parent.n_lots === 14);
  assert.equal(areas['1A 25-38'].n_lots, 14);
  assert.ok(Math.abs(a.x - parent.x) < 0.02);
  assert.ok(Math.abs(z.x + z.w - (parent.x + parent.w)) < 0.02);
  assert.notEqual(parent.w, areas['1A 1-12'].rect.w);
});

test('1A adapter still exports 1A helpers from PDF geometry', () => {
  const src = fs.readFileSync(oneAPath, 'utf8');
  assert.match(src, /TENTED_CITY_1A_PARENTS/);
  assert.match(src, /TENTED_CITY_1A_LOTS/);
  assert.match(src, /footprintFor1AVendor/);
  assert.match(src, /tentedCityGeometry/);
});

test('TentedCityMap highlights vendor footprints from PDF geometry', () => {
  const map = fs.readFileSync(mapPath, 'utf8');
  assert.ok(map.includes('footprintForVendor'));
  assert.ok(map.includes('styles.footprint'));
  assert.ok(map.includes('verify1A'));
});

test('map screen keeps Grounds MapComponent and passes verify1A', () => {
  const screen = fs.readFileSync(screenPath, 'utf8');
  assert.ok(screen.includes('import MapComponent from'));
  assert.ok(screen.includes('verify1A={verify1A}'));
});

test('stages without PDF lots can still use the pin path', () => {
  const map = fs.readFileSync(mapPath, 'utf8');
  assert.ok(map.includes('styles.pin'));
  assert.ok(map.includes('vendorFootprint ?'));
});
