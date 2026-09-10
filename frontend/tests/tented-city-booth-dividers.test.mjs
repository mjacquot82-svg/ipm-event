import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
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
    : name.startsWith('.') ? load(new URL(name + '.ts', url)) : createRequire(url)(name));
  new Function('require', 'module', 'exports', source)(require, mod, mod.exports);
  return mod.exports;
}

const geoUrl = new URL('../src/config/tentedCityGeometry.ts', import.meta.url);
const camUrl = new URL('../src/config/tentedCityCamera.ts', import.meta.url);
const mapPath = new URL('../src/components/TentedCityMap.tsx', import.meta.url);
const {
  TENTED_CITY_SAFE_INDIVIDUAL_RANGES,
  TENTED_CITY_BOOTH_DIVIDER_SEGMENTS,
  TENTED_CITY_INDIVIDUAL_BOOTHS,
  individualBoothsForArea,
  boothDividerSegmentsForArea,
  AREA_BY_LABEL,
  LOT_BY_ID,
} = load(geoUrl);
const { BOOTH_DIVIDER_VISIBLE_SCALE, MIN_SCALE, DOUBLE_TAP_SCALE } = load(camUrl);
const mapSrc = fs.readFileSync(mapPath, 'utf8');

test('dividers are derived only from TENTED_CITY_SAFE_INDIVIDUAL_RANGES', () => {
  const expected = TENTED_CITY_SAFE_INDIVIDUAL_RANGES.flatMap((area) => boothDividerSegmentsForArea(area));
  assert.equal(TENTED_CITY_BOOTH_DIVIDER_SEGMENTS.length, expected.length);
  assert.deepEqual(
    TENTED_CITY_BOOTH_DIVIDER_SEGMENTS.map((s) => s.key),
    expected.map((s) => s.key),
  );
  for (const seg of TENTED_CITY_BOOTH_DIVIDER_SEGMENTS) {
    assert.ok(TENTED_CITY_SAFE_INDIVIDUAL_RANGES.some((a) => a.id === seg.parentRangeId));
  }
});

test('divider zoom threshold hides below and shows at/above', () => {
  assert.equal(BOOTH_DIVIDER_VISIBLE_SCALE, 2);
  assert.ok(BOOTH_DIVIDER_VISIBLE_SCALE > MIN_SCALE);
  assert.ok(BOOTH_DIVIDER_VISIBLE_SCALE <= DOUBLE_TAP_SCALE);
  assert.match(mapSrc, /BOOTH_DIVIDER_VISIBLE_SCALE/);
  assert.match(mapSrc, /scale\.value >= BOOTH_DIVIDER_VISIBLE_SCALE \? 0\.5 : 0/);
  assert.match(mapSrc, /testID="booth-divider"/);
  assert.match(mapSrc, /TENTED_CITY_BOOTH_DIVIDER_SEGMENTS/);
});

function assertRangeCells(label, expectedCells) {
  const area = AREA_BY_LABEL.get(label);
  assert.ok(area, label);
  const booths = individualBoothsForArea(area);
  assert.equal(booths.length, expectedCells, `${label} booths`);
  const segs = boothDividerSegmentsForArea(area);
  assert.equal(segs.length, expectedCells - 1, `${label} dividers`);
  const sorted = [...booths].sort((a, b) => a.boothNumber - b.boothNumber);
  for (let i = 1; i < sorted.length; i += 1) {
    const seg = segs[i - 1];
    assert.equal(seg.x, sorted[i].rect.x);
    assert.equal(seg.y, sorted[i].rect.y);
    assert.equal(seg.h, sorted[i].rect.h);
    // Shared edge matches left booth right edge within float tolerance.
    assert.ok(Math.abs((sorted[i - 1].rect.x + sorted[i - 1].rect.w) - seg.x) < 0.02);
  }
}

test('verified 12-booth range produces 12 cells / 11 dividers', () => {
  assertRangeCells('1A 1-12', 12);
});

test('verified 14-booth range produces 14 cells / 13 dividers', () => {
  assertRangeCells('1A 25-38', 14);
});

test('verified 6-booth range produces 6 cells / 5 dividers', () => {
  assertRangeCells('3B 1-6', 6);
});

test('verified 8-booth range produces 8 cells / 7 dividers', () => {
  assertRangeCells('5A 5-12', 8);
});

test('parent-only ranges produce no individual divider overlay', () => {
  for (const label of ['3A 39-44', '3B 39-44', '6B 26-29']) {
    const area = AREA_BY_LABEL.get(label);
    assert.ok(area, label);
    assert.equal(individualBoothsForArea(area).length, 0);
    assert.equal(boothDividerSegmentsForArea(area).length, 0);
    assert.ok(!TENTED_CITY_BOOTH_DIVIDER_SEGMENTS.some((s) => s.parentRangeLabel === label));
    assert.ok(!TENTED_CITY_SAFE_INDIVIDUAL_RANGES.some((a) => a.label === label));
  }
});

test('selected-booth highlight still uses exact individual booth rects', () => {
  assert.match(mapSrc, /BoothHighlight testID="selected-booth-highlight" rect=\{booth\.rect\}/);
  assert.match(mapSrc, /BoothHighlight testID="vendor-booth-highlight" rect=\{rect\}/);
  assert.match(mapSrc, /boothHighlightStyle/);
  const ace = TENTED_CITY_INDIVIDUAL_BOOTHS.find((b) => b.id === '1A-09');
  assert.ok(ace);
  assert.deepEqual(ace.rect, LOT_BY_ID.get('1A-09').rect);
});

test('map does not rewrite SVG or invent a second geometry system', () => {
  assert.match(mapSrc, /tented-city-map-app-ready\.svg/);
  assert.doesNotMatch(mapSrc, /reinterpret|equal-slice|invented.?lots/i);
  assert.match(mapSrc, /TENTED_CITY_SAFE_INDIVIDUAL_RANGES|TENTED_CITY_BOOTH_DIVIDER_SEGMENTS/);
});
