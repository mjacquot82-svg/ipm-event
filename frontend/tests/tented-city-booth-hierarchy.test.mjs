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
  isTrustedParentOnlyArea,
  parseRangeToken,
  TENTED_CITY_TRUSTED_PARENT_ONLY_RANGES,
} = load(geoUrl);
const { footprintForVendor, matchVendor } = load(matchUrl);
const semanticUrl = new URL('../src/config/tentedCitySemanticMap.ts', import.meta.url);
const {
  findSemanticAreaForLocation,
  findSemanticAreaForVendor,
  findSemanticAreaForGeometryArea,
} = load(semanticUrl);
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

test('TentedCityMap source encodes yellow parent + high-visibility cyan exact booth', () => {
  assert.equal(colors.userLocation, '#3A7BC8');
  assert.match(mapSrc, /selected-parent-range-fill/);
  assert.match(mapSrc, /PARENT_RANGE_FILL = 'rgba\(245, 197, 24, 0\.45\)'/);
  // Exact booth: bright cyan fill + white border so the stall dominates yellow parent on phone.
  assert.match(mapSrc, /EXACT_BOOTH_CELL_FILL = '#00E5FF'/);
  assert.match(mapSrc, /EXACT_BOOTH_CELL_BORDER = '#FFFFFF'/);
  assert.match(mapSrc, /EXACT_BOOTH_CELL_BORDER_WIDTH = 3/);
  assert.match(mapSrc, /exactBoothCellFill/);
  assert.match(mapSrc, /borderWidth: EXACT_BOOTH_CELL_BORDER_WIDTH/);
  assert.match(mapSrc, /borderColor: EXACT_BOOTH_CELL_BORDER/);
  assert.match(mapSrc, /testID="selected-booth-highlight"/);
  assert.match(mapSrc, /left: `\$\{booth\.rect\.x\}%`/);
  assert.match(mapSrc, /width: `\$\{booth\.rect\.w\}%`/);
  assert.match(mapSrc, /height: `\$\{booth\.rect\.h\}%`/);
  assert.doesNotMatch(mapSrc, /EXACT_BOOTH_CELL_FILL = colors\.userLocation/);
  assert.doesNotMatch(mapSrc, /EXACT_BOOTH_FILL = 'rgba\(58, 123, 200/);
  assert.doesNotMatch(mapSrc, /BoothHighlight testID="selected-booth-highlight"/);
  assert.doesNotMatch(mapSrc, /individualBoothSelected/);
  assert.match(mapSrc, /useExactBoothHierarchy/);
  assert.match(mapSrc, /BoothHighlight testID="vendor-booth-highlight" rect=\{rect\}/);
  assert.match(mapSrc, /useExactBoothHierarchy \|\| parentOnlyFillRect \? null : parentOnlyFootprint/);
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

test('3A/3B 39-44 trusted parent geometry fills yellow parent-only (no blue)', () => {
  assert.deepEqual(
    TENTED_CITY_TRUSTED_PARENT_ONLY_RANGES.map((a) => a.label).sort(),
    ['3A 39-44', '3B 39-44'],
  );
  for (const label of ['3A 39-44', '3B 39-44']) {
    const area = AREA_BY_LABEL.get(label);
    assert.ok(area, label);
    assert.equal(area.flagged, false, label);
    assert.ok(isTrustedParentOnlyArea(area), label);
    assert.equal(individualBoothsForArea(area).length, 0, label);
    assert.ok(parseRangeToken(label), label);
    assert.ok(parseRangeToken(label.replace(' ', '-')), label);
    const semantic = findSemanticAreaForGeometryArea(area);
    assert.ok(semantic, `${label} semantic`);
    assert.equal(findSemanticAreaForLocation(label)?.id, semantic.id);
  }

  const quilt = vendorByLocation('3A-39-44');
  assert.match(quilt.name, /Quilt/i);
  const quiltMatch = matchVendor(quilt);
  const quiltFoot = footprintForVendor(quilt);
  assert.equal(quiltMatch.class, 'range_or_named');
  assert.equal(quiltMatch.reason, 'trusted-parent-only-range');
  assert.deepEqual(quiltMatch.lotIds, []);
  assert.deepEqual(quiltMatch.parentRect, AREA_BY_LABEL.get('3A 39-44').rect);
  assert.ok(quiltFoot);
  assert.equal(quiltFoot.class, 'range_or_named');
  assert.deepEqual(quiltFoot.parentRect, AREA_BY_LABEL.get('3A 39-44').rect);
  assert.equal(findSemanticAreaForVendor(quilt)?.id, 'quilt-tent-3a-39-44-g2');

  const propane = vendorByLocation('3B-39-44');
  const propaneMatch = matchVendor(propane);
  assert.equal(propaneMatch.class, 'range_or_named');
  assert.equal(propaneMatch.reason, 'trusted-parent-only-range');
  assert.deepEqual(propaneMatch.lotIds, []);
  assert.deepEqual(propaneMatch.parentRect, AREA_BY_LABEL.get('3B 39-44').rect);
  assert.equal(findSemanticAreaForVendor(propane)?.id, 'rural-expo-courtyard-3b-39-44');

  // Map source: parent-only yellow path, never selected-booth blue for these ranges.
  assert.match(mapSrc, /isTrustedParentOnlyArea/);
  assert.match(mapSrc, /parentOnlyFootprint/);
  assert.match(mapSrc, /parentOnlyFillRect/);
  assert.match(mapSrc, /parentOnlySemanticGeometry/);
  assert.match(mapSrc, /selected-parent-range-fill/);
  assert.equal((mapSrc.match(/testID="selected-booth-highlight"/g) || []).length, 1);
});


test('AmSpec Farming for the Future stays shared parent-only (no invented stall)', () => {
  const amspec = vendors.find((row) => /AmSpec Group,? Hamilton/i.test(row.name));
  assert.ok(amspec, 'AmSpec vendor');
  assert.equal(amspec.tent, 'farming-for-the-future');
  assert.equal(amspec.locationLabel, '1B-16-22');
  assert.deepEqual(amspec.booths, ['1B-16', '1B-17', '1B-18', '1B-19', '1B-20', '1B-21', '1B-22']);
  const match = matchVendor(amspec);
  const footprint = footprintForVendor(amspec);
  assert.ok(footprint);
  assert.equal(footprint.lotIds.length, 7);
  assert.notEqual(footprint.lotIds.length, 1);
  // Multi-lot shared tent must not resolve to a single individual booth selection.
  assert.equal(TENTED_CITY_INDIVIDUAL_BOOTHS.some((b) => b.id === '1B-16-22'), false);
  assert.ok(footprint.parentRect || footprint.rect);
  // UI source still gates exact cyan highlight behind useExactBoothHierarchy (single booth).
  assert.match(mapSrc, /vendorFootprint\.lotIds\.length !== 1/);
});

test('6B 26-29 stays safe unmapped without yellow or blue', () => {
  const area = AREA_BY_LABEL.get('6B 26-29');
  assert.ok(area);
  assert.equal(area.flagged, true);
  assert.equal(isTrustedParentOnlyArea(area), false);
  assert.equal(individualBoothsForArea(area).length, 0);
  assert.equal(findSemanticAreaForLocation('6B 26-29'), null);
  assert.equal(findSemanticAreaForLocation('6B-26-29'), null);
  const fake = matchVendor({ name: '6B probe', locationLabel: '6B-26-29', booths: ['6B-26', '6B-27', '6B-28', '6B-29'] });
  assert.equal(fake.class, 'unmatched');
  assert.match(fake.reason, /6B-26-29-numbering-unproven/);
  assert.equal(fake.rect, null);
  assert.equal(fake.parentRect, null);
  assert.equal(footprintForVendor({ name: '6B probe', locationLabel: '6B-26-29', booths: ['6B-26', '6B-27', '6B-28', '6B-29'] }), null);
  assert.match(mapSrc, /This location isn’t mapped yet\./);
});

test('regression: trusted exact booths keep yellow parent + blue exact', () => {
  for (const [location, namePart] of [
    ['2B-06', 'Kodiak'],
    ['1A-09', 'ACE'],
    ['2B-23', 'GGS|Grain'],
    ['4A-14', 'Hip Town'],
    ['5A-33', 'Stumped'],
    ['1B-15', 'Harkness'],
  ]) {
    const vendor = vendors.find((row) => row.locationLabel === location && new RegExp(namePart, 'i').test(row.name))
      || vendorByLocation(location);
    assert.match(vendor.name, new RegExp(namePart, 'i'), location);
    const match = matchVendor(vendor);
    const footprint = footprintForVendor(vendor);
    assert.equal(match.class, 'confident_lot', location);
    assert.ok(footprint, location);
    assert.equal(footprint.lotIds.length, 1, location);
    const booth = TENTED_CITY_INDIVIDUAL_BOOTHS.find((b) => b.id === location);
    assert.ok(booth, location);
    assert.ok(AREA_BY_LABEL.get(booth.parentRangeLabel), booth.parentRangeLabel);
  }
});
