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
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2019 },
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

const { AREA_BY_ID, AREA_BY_LABEL, parseInclusiveLotSpan } = load(new URL('../src/config/tentedCityGeometry.ts', import.meta.url));
const { footprintForVendor, matchVendor } = load(new URL('../src/config/tentedCityVendorMatch.ts', import.meta.url));
const vendors = loadExhibitors();
const mapSrc = fs.readFileSync(new URL('../src/components/TentedCityMap.tsx', import.meta.url), 'utf8');

function byName(re) {
  const v = vendors.find((row) => re.test(row.name));
  assert.ok(v, String(re));
  return v;
}

test('parseInclusiveLotSpan reads sub-parent ranges like 3B-19-24', () => {
  assert.deepEqual(parseInclusiveLotSpan('3B-19-24'), { section: '3B', start: 19, end: 24 });
  assert.deepEqual(parseInclusiveLotSpan('3B 19-24'), { section: '3B', start: 19, end: 24 });
  assert.equal(parseInclusiveLotSpan('2A-05'), null);
});

test('Ontario Government exact 3B-19-24 is smaller than parent 3B 13-24', () => {
  const og = byName(/^Ontario Government$/);
  const parent = AREA_BY_LABEL.get('3B 13-24');
  assert.ok(parent);
  const withBooths = footprintForVendor(og);
  assert.ok(withBooths);
  assert.equal(withBooths.class, 'confident_lot');
  assert.deepEqual(withBooths.lotIds, ['3B-19', '3B-20', '3B-21', '3B-22', '3B-23', '3B-24']);
  assert.equal(withBooths.areaId, 'range-3B-13-24');
  assert.ok(withBooths.rect.w < parent.rect.w - 0.5, 'exact width must be clearly smaller than parent');
  assert.ok(Math.abs(withBooths.rect.y - parent.rect.y) < 0.01, 'same strip Y as parent');
  assert.notEqual(withBooths.rect.y, 41.875, 'must not use Mutual Square / stale 3A Y');

  const labelOnly = footprintForVendor({ name: 'Ontario Government', locationLabel: '3B-19-24', booths: [] });
  assert.ok(labelOnly);
  assert.deepEqual(labelOnly.lotIds, withBooths.lotIds);
  assert.deepEqual(labelOnly.rect, withBooths.rect);
});

test('no silent parent fallback for exact multi-booth in map source', () => {
  // parentOnlyFootprint must not treat multi-lot confident_lot as parent-only.
  const pof = mapSrc.slice(mapSrc.indexOf('const parentOnlyFootprint'), mapSrc.indexOf('const exactVendorFootprint'));
  assert.doesNotMatch(pof, /lotIds\.length/);
  assert.match(mapSrc, /exactVendorFootprint/);
  assert.match(mapSrc, /SELECTED_STAGE_FILL/);
  assert.match(mapSrc, /child-cell union/);
});

test('University of Guelph 3B-16-17 exact union stays inside parent', () => {
  const v = byName(/University of Guelph/);
  const fp = footprintForVendor(v);
  const parent = AREA_BY_LABEL.get('3B 13-24');
  assert.ok(fp);
  assert.equal(fp.class, 'confident_lot');
  assert.deepEqual(fp.lotIds, ['3B-16', '3B-17']);
  assert.ok(fp.rect.w < parent.rect.w);
});

test('Transit Trailer / Cottrill / Bambrook footprints stay confident_lot', () => {
  for (const [re, lots] of [
    [/^Transit Trailer/, ['2A-03', '2A-04']],
    [/Cottrill/, ['2A-05']],
    [/Bambrook/, ['1A-05']],
  ]) {
    const v = byName(re);
    const fp = footprintForVendor(v);
    assert.ok(fp, String(re));
    assert.equal(fp.class, 'confident_lot', String(re));
    assert.deepEqual(fp.lotIds, lots, String(re));
    assert.ok(fp.rect, String(re));
  }
});

test('trusted parent-only Quilt / Rural Expo still range_or_named', () => {
  const quilt = byName(/^Quilt Tent$/);
  assert.equal(matchVendor(quilt).class, 'range_or_named');
  assert.equal(matchVendor(quilt).reason, 'trusted-parent-only-range');
});
