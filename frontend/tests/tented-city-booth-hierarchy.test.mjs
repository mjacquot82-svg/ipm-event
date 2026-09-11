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
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      downlevelIteration: true,
      target: ts.ScriptTarget.ES2019,
    },
  }).outputText;
  const require = (name) => (name.endsWith('.json')
    ? JSON.parse(fs.readFileSync(new URL(name, url), 'utf8'))
    : name.startsWith('.') ? load(new URL(name + '.ts', url)) : createRequire(url)(name));
  new Function('require', 'module', 'exports', source)(require, mod, mod.exports);
  return mod.exports;
}

const geoUrl = new URL('../src/config/tentedCityGeometry.ts', import.meta.url);
const matchUrl = new URL('../src/config/tentedCityVendorMatch.ts', import.meta.url);
const mapPath = new URL('../src/components/TentedCityMap.tsx', import.meta.url);
const colorsPath = new URL('../src/theme/colors.ts', import.meta.url);
const reportPath = new URL('../src/data/tented-city-vendor-match-report.json', import.meta.url);

const {
  TENTED_CITY_INDIVIDUAL_BOOTHS,
  AREA_BY_LABEL,
  individualBoothsForArea,
  LOT_BY_ID,
} = load(geoUrl);
const { footprintForVendor, matchVendor } = load(matchUrl);
const { default: colors } = load(colorsPath);
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const mapSrc = fs.readFileSync(mapPath, 'utf8');

function loadVendors() {
  const dir = new URL('../src/data/', import.meta.url);
  return fs.readdirSync(dir)
    .filter((f) => /^tentedCityVendorsPart\d+\.ts$/.test(f))
    .sort()
    .flatMap((f) => {
      const text = fs.readFileSync(new URL(f, dir), 'utf8');
      return JSON.parse(text.slice(text.indexOf('= [') + 2, text.lastIndexOf(']') + 1));
    });
}

const vendors = loadVendors();

function vendorByLocation(locationLabel) {
  const v = vendors.find((row) => row.locationLabel === locationLabel);
  assert.ok(v, `missing vendor for ${locationLabel}`);
  return v;
}

test('ACE and Kodiak resolve confident_lot with parent range + one individual booth', () => {
  for (const [location, namePart] of [['1A-09', 'ACE'], ['2B-06', 'Kodiak']]) {
    const vendor = vendorByLocation(location);
    assert.match(vendor.name, new RegExp(namePart, 'i'));
    const match = matchVendor(vendor);
    const footprint = footprintForVendor(vendor);
    assert.equal(match.class, 'confident_lot', location);
    assert.ok(footprint, location);
    assert.equal(footprint.class, 'confident_lot', location);
    assert.deepEqual(footprint.lotIds, [location]);
    assert.ok(footprint.parentRect, `${location} parentRect`);
    assert.equal(footprint.rects.length, 1, `${location} one rect`);

    const booth = TENTED_CITY_INDIVIDUAL_BOOTHS.find((b) => b.id === location);
    assert.ok(booth, `${location} individual booth`);
    assert.deepEqual(booth.rect, LOT_BY_ID.get(location).rect);
    const parent = AREA_BY_LABEL.get(booth.parentRangeLabel);
    assert.ok(parent, booth.parentRangeLabel);
    assert.deepEqual(footprint.parentRect, parent.rect);

    // Report snapshot stays aligned with live matcher for these trusted stalls.
    const snap = location === '1A-09' ? report.ace : null;
    if (snap) {
      assert.equal(snap.class, 'confident_lot');
      assert.deepEqual(snap.lotIds, [location]);
      assert.deepEqual(snap.rect, booth.rect);
    }
  }
});

test('TentedCityMap source encodes yellow parent + blue exact hierarchy markers', () => {
  assert.equal(colors.userLocation, '#3A7BC8');
  assert.match(mapSrc, /selected-parent-range-fill/);
  assert.match(mapSrc, /PARENT_RANGE_FILL = 'rgba\(245, 197, 24, 0\.45\)'/);
  assert.match(mapSrc, /EXACT_BOOTH_FILL = 'rgba\(58, 123, 200, 0\.78\)'/);
  assert.match(mapSrc, /EXACT_BOOTH_BORDER = colors\.userLocation/);
  assert.match(mapSrc, /useExactBoothHierarchy/);
  assert.match(mapSrc, /BoothHighlight testID="selected-booth-highlight" rect=\{booth\.rect\}/);
  assert.match(mapSrc, /BoothHighlight testID="vendor-booth-highlight" rect=\{rect\}/);
  // Exact blue uses user-location token; no heavy yellow booth outline on the exact cell.
  assert.match(mapSrc, /borderColor=\{EXACT_BOOTH_BORDER\}/);
  assert.doesNotMatch(mapSrc, /selected-booth-highlight"[^>]*borderColor="#F5C518"/);
  assert.doesNotMatch(mapSrc, /individualBoothSelected/);
  // No double-stacked exact blue (vendor block skipped when hierarchy is active).
  assert.match(mapSrc, /useExactBoothHierarchy \? null : parentOnlyFootprint/);
  // Official SVG stays overlay-only.
  assert.match(mapSrc, /tented-city-map-app-ready\.svg/);
});

test('parent-only ranges never expose individual blue cells', () => {
  for (const label of ['3A 39-44', '3B 39-44', '6B 26-29']) {
    const area = AREA_BY_LABEL.get(label);
    assert.ok(area, label);
    assert.equal(individualBoothsForArea(area).length, 0, `${label} no fabricated individuals`);
    assert.ok(!TENTED_CITY_INDIVIDUAL_BOOTHS.some((b) => b.parentRangeLabel === label));
  }
  assert.match(mapSrc, /parentOnlyFootprint/);
  assert.match(mapSrc, /PARENT_RANGE_FILL/);
  // Parent-only path fills yellow and does not mint selected-booth-highlight outside trusted individuals.
  assert.equal((mapSrc.match(/testID="selected-booth-highlight"/g) || []).length, 1);
});

test('reset and vendor switch clear hierarchy selection state', () => {
  assert.match(mapSrc, /setSelectedBoothId\(null\)/);
  assert.match(mapSrc, /const resetMap = \(\) => \{[\s\S]*?setSelectedBoothId\(null\)/);
  assert.match(mapSrc, /const clearSelection = \(\) => \{[\s\S]*?setSelectedBoothId\(null\)/);
  assert.match(mapSrc, /if \(!text\.trim\(\)\) \{ setSelected\(null\); setSelectedBoothId\(null\); setSelectedSemanticArea\(null\); \}/);
  // Vendor search feeds selectedBoothId through selectPlace → useExactBoothHierarchy.
  assert.match(mapSrc, /setSelectedBoothId\(individual\?\.semanticId \|\| null\)/);
  assert.match(mapSrc, /selectIndividualBooth/);
});
