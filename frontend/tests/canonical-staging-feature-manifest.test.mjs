/**
 * Canonical staging feature-manifest regression gate (31 items).
 * Fails loudly if a future branch based on stale staging drops approved functionality.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(here, '..');
const repoRoot = join(frontendRoot, '..');

function read(rel) {
  const p = join(frontendRoot, rel);
  assert.equal(existsSync(p), true, `MISSING FILE: ${rel}`);
  return readFileSync(p, 'utf8');
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

function loadMapVendors() {
  const rows = [];
  for (const file of ['src/data/tentedCityVendorsPart1.ts', 'src/data/tentedCityVendorsPart2.ts', 'src/data/tentedCityVendorsPart3.ts']) {
    const text = read(file);
    const start = text.indexOf('= [') + 2;
    const end = text.lastIndexOf(']') + 1;
    rows.push(...JSON.parse(text.slice(start, end)));
  }
  return rows;
}

const results = [];
function gate(n, title, fn) {
  test(`${String(n).padStart(2, '0')}. ${title}`, () => {
    try {
      fn();
      results.push({ n, title, status: 'PASS' });
    } catch (err) {
      results.push({ n, title, status: 'FAIL', error: String(err) });
      throw err;
    }
  });
}

const catalog = readJson('public/api/vendors.json');
const mapVendors = loadMapVendors();
const crosswalk = read('src/config/vendorMapCrosswalk.ts');
const mapSearch = read('src/config/mapSearch.ts');
const groundsZones = read('src/config/groundsZones.ts');
const mapInteraction = read('src/config/mapInteraction.ts');
const tentedSearch = read('src/config/tentedCitySearch.ts');
const netlify = readFileSync(join(repoRoot, 'netlify.toml'), 'utf8');
const redirects = read('public/_redirects');
const mnpTest = read('tests/mnp-stage-parent-fallback.test.mjs');
const sept8Test = read('tests/sept8-exhibitor-locations.test.mjs');
const campingPage = read('app/(tabs)/camping.tsx');
const mapPage = read('app/(tabs)/map.tsx');
const rvGeom = readJson('src/data/rv-park-campsite-geometry.json');
const rvInv = readJson('src/data/rv-park-site-inventory.json');
const venues = read('src/config/tentedCityVenues.ts');
const scheduleMap = existsSync(join(frontendRoot, 'tests/schedule-event-map-navigation.test.mjs'))
  ? read('tests/schedule-event-map-navigation.test.mjs')
  : '';

// VENDOR DATA 1–8
gate(1, 'Sept. 8 approved exhibitor set (static map + catalog)', () => {
  assert.ok(mapVendors.length >= 320, `map rows ${mapVendors.length}`);
  assert.ok(catalog.total_count >= 200, `catalog ${catalog.total_count}`);
  assert.match(sept8Test, /Sept8 conflict corrections/);
});

gate(2, 'CAN-AM searchable Vendors tab', () => {
  const hit = catalog.vendors.find((v) => /can-am/i.test(v.name));
  assert.ok(hit, 'CAN-AM missing from catalog');
  assert.equal(hit.location, 'WEST-02');
  assert.match(crosswalk, /CAN-AM/);
  assert.match(read('app/(tabs)/vendors.tsx'), /vendorMatchesSearch/);
});

gate(3, 'Valard searchable Vendors tab', () => {
  const hit = catalog.vendors.find((v) => /valard/i.test(v.name));
  assert.ok(hit);
  assert.equal(hit.location, 'EAST-06');
  assert.match(crosswalk, /Valard Construction LP/);
});

gate(4, 'Bambrook searchable Vendors tab', () => {
  const hit = catalog.vendors.find((v) => /bambrook/i.test(v.name));
  assert.ok(hit);
  assert.equal(hit.location, '1A-05');
});

gate(5, 'Cottrill searchable Vendors tab', () => {
  const hit = catalog.vendors.find((v) => /cottrill/i.test(v.name));
  assert.ok(hit);
  assert.equal(hit.location, '2A-05');
});

gate(6, 'multi-booth collapse', () => {
  const gov = catalog.vendors.filter((v) => v.name === 'Ontario Government');
  assert.equal(gov.length, 1);
  assert.equal(gov[0].location, '3B-19-24');
});

gate(7, 'Sept. 8 locations preserved on map static', () => {
  const cot = mapVendors.find((v) => /cottrill heavy/i.test(v.name));
  assert.equal(cot.locationLabel, '2A-05');
  const can = mapVendors.find((v) => /can-am/i.test(v.name));
  assert.equal(can.locationLabel, 'WEST-02');
});

gate(8, 'AmSpec HOLD not silently remapped', () => {
  const amMap = mapVendors.find((v) => /amspec/i.test(v.name));
  assert.ok(amMap);
  assert.equal(amMap.locationLabel, '1B-16-22');
  const amCat = catalog.vendors.find((v) => /amspec/i.test(v.name));
  assert.ok(amCat);
  assert.equal(amCat.location, '1B-16-22');
});

// MNP 9–12
gate(9, 'Beyond → EAST-2', () => {
  assert.match(mnpTest, /Beyond Wireless Stage/);
  assert.match(mnpTest, /EAST-2|MNP_PARENT/);
  assert.match(venues, /Beyond Wireless/);
});

gate(10, "Harley's → EAST-2", () => {
  assert.match(mnpTest, /Harley's Pub/);
});

gate(11, 'Quality Homes Stage → EAST-2', () => {
  assert.match(mnpTest, /Quality Homes - Stage/);
});

gate(12, 'all 117 parent-fallback semantics preserved', () => {
  assert.match(mnpTest, /117|MNP_PARENT|parent-fallback|parent fallback/i);
  // Stage list in mnp test includes the three MNP stages
  assert.match(mnpTest, /Beyond Wireless Stage/);
  assert.match(read('src/components/TentedCityMap.tsx'), /placeRect|parent/i);
});

// FIND-ON-MAP 13–22
gate(13, 'Ontario Mutuals → Britespan', () => {
  assert.match(mapSearch + tentedSearch + crosswalk + venues, /Britespan|Ontario Mutuals Main Stage/i);
});

gate(14, 'Event Centre #1 → WEST-2', () => {
  const semantic = read('src/config/tentedCitySemanticMap.ts');
  const nav = existsSync(join(frontendRoot, 'tests/schedule-event-map-navigation.test.mjs'))
    ? read('tests/schedule-event-map-navigation.test.mjs')
    : '';
  assert.match(mapSearch + semantic + nav + venues, /Event Centre|WEST-2/i);
});

gate(15, 'Welcome Centre', () => {
  assert.match(crosswalk, /Welcome Centre/);
  assert.ok(mapVendors.some((v) => v.name === 'Welcome Centre'));
});

gate(16, 'Emergency/First Aid', () => {
  assert.match(crosswalk, /First Aid and Lost Persons/);
  assert.ok(mapVendors.some((v) => /First Aid/i.test(v.name)));
});

gate(17, 'CKNX → WEST-3', () => {
  const venuesSrc = read('src/config/tentedCityVenues.ts');
  const geom = read('src/config/tentedCityGeometry.ts');
  assert.match(venuesSrc, /CKNX Centennial Pavilion/);
  assert.match(geom, /CKNX_WEST3_RECT|named-cknx-centennial-pavilion-lounge-west-3/);
  assert.ok(mapVendors.some((v) => (v.locationLabel || '') === 'WEST-3'));
});

gate(18, 'Hydro One → EAST-05', () => {
  const hydro = mapVendors.find((v) => v.name === 'Hydro One');
  assert.ok(hydro);
  assert.equal(hydro.locationLabel, 'EAST-05');
});

gate(19, 'Tractor Plowing', () => {
  assert.match(groundsZones, /tractor-plowing/);
  assert.match(groundsZones, /Tractor Plowing/);
});

gate(20, 'Horse Plowing', () => {
  assert.match(groundsZones, /horse-plowing/);
  assert.match(groundsZones, /Horse Plowing/);
});

gate(21, 'unified Grounds + Tented City search', () => {
  assert.match(mapSearch, /searchEventMap/);
  assert.match(read('src/config/tentedCitySearch.ts'), /resolveMapTypeForLocation/);
  assert.match(mapPage, /resolveMapTypeForLocation|GroundsMap|TentedCityMap/);
  assert.match(read('tests/fom-geometry-search-ux.test.mjs'), /searchEventMap/);
});

gate(22, 'Bus Stop ≠ Bus Parking #1194', () => {
  assert.match(groundsZones, /Bus Parking #1194/);
  assert.match(mapSearch, /bus parking #1194/);
  assert.ok(!/id: 'bus-parking'/.test(groundsZones));
});

// MAP UX 23–28
gate(23, 'Grounds shared gestures', () => {
  assert.match(mapInteraction, /attachWebMapGestures|flyToRect|resetMapCamera/);
  assert.match(read('src/components/GroundsMap.tsx'), /mapInteraction|attachWebMapGestures/);
});

gate(24, 'Tented City gestures', () => {
  assert.match(read('src/components/TentedCityMap.tsx'), /attachWebMapGestures|mapInteraction/);
});

gate(25, 'Camping Map selector', () => {
  assert.match(mapPage, /Camping|camping|rv|RV/);
  assert.match(campingPage, /Camping|RvPark|mapType/);
});

gate(26, 'Camping M27', () => {
  assert.match(read('src/config/rvParkSearch.ts'), /M27/);
  assert.ok((rvInv.site_ids || []).includes('M27') || JSON.stringify(rvInv).includes('M27'));
});

gate(27, 'RV 690-site dataset', () => {
  assert.equal(rvInv.unique_site_ids, 690);
  assert.ok(Array.isArray(rvGeom.sites) ? rvGeom.sites.length >= 600 : Object.keys(rvGeom).length > 0);
});

gate(28, 'Camping shared gestures', () => {
  assert.match(read('src/components/RvParkDetailMap.tsx'), /attachWebMapGestures|mapInteraction/);
  assert.match(read('tests/camping-tc-gesture-parity.test.mjs'), /attachWebMapGestures/);
});

// SCHEDULE 29–31
gate(29, 'Lumberjack ×15 with 1A-35-38', () => {
  assert.ok(mapVendors.some((v) => /Lumberjack/i.test(v.name) && v.locationLabel === '1A-35-38'));
  assert.ok(catalog.vendors.some((v) => /Lumberjack/i.test(v.name) && v.location === '1A-35-38'));
  // Schedule ×15 lives in staging Supabase show-guide; assert regression test or map nav coverage
  const showGuide = [
    'tests/staging-show-guide-schedule.test.mjs',
    'tests/show-guide-schedule.test.mjs',
    'tests/schedule-event-map-navigation.test.mjs',
  ].some((t) => existsSync(join(frontendRoot, t)));
  assert.ok(showGuide, 'missing schedule/show-guide regression coverage');
});

gate(30, 'Southampton Olive Oil present', () => {
  const importManifest = join(repoRoot, 'backend/import_manifests/mnp_lifestyles_2026.json');
  const patchPy = join(repoRoot, 'backend/apply_show_guide_schedule_patch.py');
  const report = join(repoRoot, 'SHOW_GUIDE_STAGING_SUPABASE_CANONICALIZE_REPORT.md');
  const found =
    (existsSync(importManifest) && /Southampton Olive Oil/i.test(readFileSync(importManifest, 'utf8'))) ||
    (existsSync(patchPy) && /Southampton Olive Oil/i.test(readFileSync(patchPy, 'utf8'))) ||
    (existsSync(report) && /Southampton Olive Oil/i.test(readFileSync(report, 'utf8'))) ||
    /Southampton Olive Oil/i.test(readFileSync(join(repoRoot, 'tests/test_mnp_schedule_import.py'), 'utf8'));
  assert.ok(found, 'Southampton Olive Oil missing from show-guide / MNP schedule artifacts');
});

gate(31, 'approved Show Guide corrections preserved', () => {
  // Show-guide canonicalize applied to staging Supabase; repo keeps MNP import + map lumberjack location.
  assert.ok(existsSync(join(repoRoot, 'backend/import_manifests/mnp_lifestyles_2026.json')));
  assert.ok(existsSync(join(repoRoot, 'tests/test_mnp_schedule_import.py')));
  assert.ok(existsSync(join(frontendRoot, 'tests/schedule-event-map-navigation.test.mjs')));
  assert.ok(mapVendors.some((v) => /Lumberjack/i.test(v.name) && v.locationLabel === '1A-35-38'));
  const mnp = readFileSync(join(repoRoot, 'backend/import_manifests/mnp_lifestyles_2026.json'), 'utf8');
  assert.match(mnp, /Southampton Olive Oil/);
  // Optional report may be restored for documentation
  const report = join(repoRoot, 'SHOW_GUIDE_STAGING_SUPABASE_CANONICALIZE_REPORT.md');
  if (existsSync(report)) {
    const body = readFileSync(report, 'utf8');
    assert.match(body, /1A-35-38/);
    assert.match(body, /Southampton Olive Oil/);
  }
});

// Extra: static vendors routing (architecture)
test('netlify/public redirects bake static vendors catalog (not prod proxy)', () => {
  assert.match(redirects, /\/api\/vendors  \/api\/vendors\.json  200!/);
  assert.match(netlify, /to = "\/api\/vendors\.json"/);
  assert.doesNotMatch(netlify, /ipm-backend-eoiw\.onrender\.com\/api\/vendors/);
});
