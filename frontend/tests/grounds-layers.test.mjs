import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
const source = fs.readFileSync(new URL('../src/config/groundsParking.ts', import.meta.url), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(mod, mod.exports);
const { GROUNDS_VIEWS, GROUNDS_PARKING_POIS: pois, hitGroundsParking } = mod.exports;

test('parking contains only the official numbered entrances plus the existing accessible symbol', () => {
  assert.deepEqual(pois.map(p => p.id), ['1', '2', '3', '4A', '4B', '5', '7', '8', '9', '10', '11', '12', '13', '14', 'accessible']);
  assert.ok(pois.every(p => ['HIGH', 'MEDIUM'].includes(p.confidence) && p.x > 0 && p.x < 100 && p.y > 182 / 2006 * 100 && p.y < 100));
  assert.deepEqual(pois.filter(p => p.detail === 'Buses Only').map(p => p.id), ['1', '2']);
  assert.equal(pois.find(p => p.id === '3').label, 'Bus Parking');
  assert.equal(pois.find(p => p.id === '5').label, 'Exhibitor Entrance');
  assert.equal(pois.find(p => p.id === '9').label, 'RV Park Entrance');
  assert.doesNotMatch(source, /1194|2512|#176|#95|#82|#57/);
});

test('marker labels and geographic hit tests agree at Fit and zoom, including separated adjacent entrances', () => {
  for (const width of [320, 360, 375, 390, 393, 412, 430, 768]) {
    const height = width * 2006 / 1344;
    for (const scale of [1, 1.5, 2, 4]) {
      for (const poi of pois) {
        assert.equal(hitGroundsParking(poi.x * width / 100 + poi.offset[0] / scale,
          poi.y * height / 100 + poi.offset[1] / scale, width, height, scale)?.id, poi.id);
      }
      assert.equal(hitGroundsParking(width, height, width, height, scale), null);
    }
  }
});

test('legacy Parking selector and overlay are retired from Grounds', () => {
 const ui=fs.readFileSync(new URL('../src/components/GroundsMap.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(ui,/GroundsViewSelector|GroundsParkingOverlay|hitGroundsParking/);
});

test('two-layer refinement preserves approved traffic renderer, artwork, areas and Parking positions', () => {
  const base = '5e445dd3706865132d6a468ecd4bdf5577ef6fe4';
  for (const file of ['src/components/GroundsParkingOverlay.tsx', 'assets/images/grounds-site-map.jpg']) {
    const expected = execFileSync('git', ['show', `${base}:frontend/${file}`], { maxBuffer: 10 * 1024 * 1024 });
    assert.deepEqual(fs.readFileSync(new URL('../' + file, import.meta.url)), expected, file);
  }
  const old = execFileSync('git', ['show', `${base}:frontend/src/config/groundsParking.ts`], { encoding: 'utf8' });
  assert.equal(source.slice(source.indexOf('export type GroundsParkingPoi')), old.slice(old.indexOf('export type GroundsParkingPoi')));
});

test('shared barricade keeps approved rendering while routes remain conditional', () => {
 const original=execFileSync('git',['show','aca902a4:frontend/src/components/GroundsTrafficOverlay.tsx'],{encoding:'utf8'});
 const current=fs.readFileSync(new URL('../src/components/GroundsTrafficOverlay.tsx',import.meta.url),'utf8');
 assert.equal(current, original.replace('{showTraffic && <View pointerEvents="none" testID="grounds-traffic-notice"','{<View pointerEvents="none" testID="grounds-traffic-notice"'));
});
