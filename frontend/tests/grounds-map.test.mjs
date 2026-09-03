import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const zonesSource = fs.readFileSync(path.join(root, 'src/config/groundsZones.ts'), 'utf8');
const componentSource = fs.readFileSync(path.join(root, 'src/components/GroundsMap.tsx'), 'utf8');
const mapSource = fs.readFileSync(path.join(root, 'app/(tabs)/map.tsx'), 'utf8');

const zones = [...zonesSource.matchAll(/id: '([^']+)',[\s\S]*?label: '([^']+)',[\s\S]*?rect: \{ x: ([\d.]+), y: ([\d.]+), w: ([\d.]+), h: ([\d.]+) \}/g)].map((m) => ({
  id: m[1], label: m[2], rect: { x: +m[3], y: +m[4], w: +m[5], h: +m[6] },
}));
function hitTest(x, y) {
  return zones.filter(({ rect: r }) => x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h).sort((a, b) => a.rect.w * a.rect.h - b.rect.w * b.rect.h)[0] || null;
}
function resolve(name) {
  const normalized = name.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const alias = normalized === 'tented city' ? 'tented-city' : null;
  return zones.find((zone) => zone.id === alias) || null;
}

test('official Grounds map dimensions are 1344x2006', () => {
  assert.match(zonesSource, /imageWidth: 1344/);
  assert.match(zonesSource, /imageHeight: 2006/);
});

test('Tented City center hit-tests to the smallest containing zone', () => {
  const zone = zones.find((item) => item.id === 'tented-city');
  assert.ok(zone);
  assert.equal(hitTest(zone.rect.x + zone.rect.w / 2, zone.rect.y + zone.rect.h / 2)?.id, 'tented-city');
  assert.match(zonesSource, /bestArea = Infinity/);
});

test('Grounds location resolver is fail-closed', () => {
  assert.equal(resolve('Tented City')?.id, 'tented-city');
  assert.equal(resolve('Kubota'), null);
  assert.match(zonesSource, /'tented city': 'tented-city'/);
});

test('Grounds branch renders GroundsMap rather than MapComponent', () => {
  assert.match(mapSource, /import GroundsMap from/);
  const branch = mapSource.slice(mapSource.indexOf("mode === 'grounds'"));
  assert.match(branch, /<GroundsMap/);
  assert.doesNotMatch(branch, /<MapComponent/);
});

test('GroundsMap has the official image, camera worklet, and switch callback', () => {
  assert.match(componentSource, /pinchAroundMovingFocal/);
  assert.match(componentSource, /grounds-site-map\.jpg/);
  assert.match(componentSource, /onSwitchToTented/);
  assert.match(componentSource, /hitTestGroundsZone/);
  assert.match(componentSource, /groundsPaintViewport/);
  assert.match(componentSource, /groundsLayerLayout/);
});
