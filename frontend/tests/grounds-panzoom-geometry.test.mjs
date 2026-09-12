import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const zonesSource = fs.readFileSync(path.join(root, 'src/config/groundsZones.ts'), 'utf8');
const componentSource = fs.readFileSync(path.join(root, 'src/components/GroundsMap.tsx'), 'utf8');
const mapInteractionSrc = fs.readFileSync(path.join(root, 'src/config/mapInteraction.ts'), 'utf8');

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

const {
  GROUNDS_ZONES,
  hitTestGroundsZone,
  pointInGroundsPolygon,
  resolveGroundsZone,
} = load(new URL('../src/config/groundsZones.ts', import.meta.url));

function zone(id) {
  return GROUNDS_ZONES.find((z) => z.id === id);
}

test('every grounds zone has a polygon with >= 3 points', () => {
  for (const z of GROUNDS_ZONES) {
    assert.ok(Array.isArray(z.polygon), z.id);
    assert.ok(z.polygon.length >= 3, z.id);
  }
});

test('Tractor Plowing polygon is rotated parallelogram (not oversized AABB fill)', () => {
  const z = zone('tractor-plowing');
  assert.equal(z.polygon.length, 4);
  // Corners must not all sit on axis-aligned bbox corners only — left edge x varies with y.
  const xs = z.polygon.map((p) => p[0]);
  const ys = z.polygon.map((p) => p[1]);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 20);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 20);
  // Centroid inside printed field; a point in the NW bbox gap (old overflow) is outside polygon.
  assert.equal(pointInGroundsPolygon(63.5, 36.0, z.polygon), false, 'NW AABB corner gap should be outside');
  assert.equal(pointInGroundsPolygon(74.0, 47.5, z.polygon), true, 'field centre inside');
  assert.equal(hitTestGroundsZone(74.0, 47.5)?.id, 'tractor-plowing');
});

test('Horse / RV / West / North / Tented City polygons hit-test centres', () => {
  for (const id of ['horse-plowing', 'rv-park', 'west-parking', 'north-parking', 'tented-city']) {
    const z = zone(id);
    const cx = z.polygon.reduce((s, p) => s + p[0], 0) / z.polygon.length;
    const cy = z.polygon.reduce((s, p) => s + p[1], 0) / z.polygon.length;
    assert.equal(hitTestGroundsZone(cx, cy)?.id, id, id);
  }
});

test('Bus Stop ≠ Bus Parking #1194; no bus-parking geometry invented', () => {
  assert.equal(resolveGroundsZone('Bus Stop')?.id, 'bus-stop');
  assert.equal(resolveGroundsZone('Bus Parking #1194'), null);
  assert.equal(resolveGroundsZone('Bus Parking'), null);
  assert.doesNotMatch(zonesSource, /id: 'bus-parking'/);
  assert.doesNotMatch(zonesSource, /'bus parking':/);
  assert.ok(!GROUNDS_ZONES.some((z) => z.id === 'bus-parking' || /1194/.test(z.label)));
});

test('Accessible Parking grounds icon is digitized from artwork; Bus Parking still absent', () => {
  assert.equal(resolveGroundsZone('Accessible Parking')?.id, 'accessible-parking');
  assert.match(zonesSource, /id: 'accessible-parking'/);
  assert.ok(zone('accessible-parking').polygon.length >= 3);
});

test('GroundsMap uses polygon SVG highlight + MNP cyan/yellow language', () => {
  assert.match(componentSource, /SELECTED_FILL/);
  assert.match(componentSource, /#FFD600/);
  assert.match(componentSource, /rgba\(0, 229, 255/);
  assert.match(componentSource, /createElement\(\s*'svg'/);
  assert.match(componentSource, /polygon/);
  assert.match(componentSource, /ZoneHighlight/);
});

test('GroundsMap ports TC pan/pinch finish + double-tap + fit reset', () => {
  assert.match(componentSource, /attachWebMapGestures/);
  assert.match(componentSource, /createMapNativeGestures/);
  assert.match(componentSource, /finishWebGesture|mapInteraction/);
  assert.match(mapInteractionSrc, /DOUBLE_TAP_SCALE/);
  assert.match(mapInteractionSrc, /rubberBandEffect:\s*true/);
  assert.match(mapInteractionSrc, /minPointers\(1\)/);
  assert.match(componentSource, /grounds-fit-reset/);
  assert.match(componentSource, /Fit map to grounds/);
  // Selected highlight persists via selected state + ZoneHighlight
  assert.match(componentSource, /selected \? <ZoneHighlight/);
});

test('routing aliases preserved (TC/grounds/plowing/camping/parking)', () => {
  assert.equal(resolveGroundsZone('Tented City')?.id, 'tented-city');
  assert.equal(resolveGroundsZone('Tractor Plowing')?.id, 'tractor-plowing');
  assert.equal(resolveGroundsZone('Horse Plowing')?.id, 'horse-plowing');
  assert.equal(resolveGroundsZone('RV Park')?.id, 'rv-park');
  assert.equal(resolveGroundsZone('camping')?.id, 'rv-park');
  assert.equal(resolveGroundsZone('West Parking Lot')?.id, 'west-parking');
  assert.equal(resolveGroundsZone('North Parking')?.id, 'north-parking');
  assert.equal(resolveGroundsZone('Plowing Fields')?.id, 'tractor-plowing');
});

test('digitized source comment documents artwork coordinate space', () => {
  assert.match(zonesSource, /grounds-site-map\.jpg/);
  assert.match(zonesSource, /not 911 north-up/);
});
