import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const geoPath = path.join(root, 'src/data/rv-park-campsite-geometry.json');
const inventoryPath = path.join(root, 'src/data/rv-park-site-inventory.json');
const mapSrc = fs.readFileSync(path.join(root, 'src/components/RvParkDetailMap.tsx'), 'utf8');
const groundsSrc = fs.readFileSync(path.join(root, 'src/components/GroundsMap.tsx'), 'utf8');
const tentedSrc = fs.readFileSync(path.join(root, 'src/components/TentedCityMap.tsx'), 'utf8');
const screenSrc = fs.readFileSync(path.join(root, 'app/(tabs)/map.tsx'), 'utf8');
const zonesSrc = fs.readFileSync(path.join(root, 'src/config/groundsZones.ts'), 'utf8');
const mapLocationsSrc = fs.readFileSync(path.join(root, 'src/config/mapLocations.ts'), 'utf8');
const geo = JSON.parse(fs.readFileSync(geoPath, 'utf8'));
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));

const cache = new Map();
function load(url) {
  if (cache.has(url.href)) return cache.get(url.href).exports;
  const mod = { exports: {} }; cache.set(url.href, mod);
  const source = ts.transpileModule(fs.readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const require = (name) => name.endsWith('.json')
    ? JSON.parse(fs.readFileSync(new URL(name, url), 'utf8'))
    : name.startsWith('.') ? load(new URL(name.endsWith('.ts') ? name : name + '.ts', url)) : createRequire(url)(name);
  new Function('require', 'module', 'exports', source)(require, mod, mod.exports);
  return mod.exports;
}

const searchMod = load(pathToFileURL(path.join(root, 'src/config/rvParkSearch.ts')));
const geometryMod = load(pathToFileURL(path.join(root, 'src/config/rvParkGeometry.ts')));
const {
  normalizeRvSiteQuery, findRvParkPlace, rvParkPlaceTitle, searchRvParkPlaces,
} = searchMod;
const { RV_PARK_CAMPSITES, RV_PARK_LANDMARKS, getRvParkSite, RV_PARK_TOTAL_CAMPSITES } = geometryMod;

test('geometry has exactly 690 unique campsites matching inventory', () => {
  assert.equal(geo.total_campsites, 690);
  assert.equal(geo.sites.length, 690);
  assert.equal(inventory.unique_site_ids, 690);
  assert.equal(RV_PARK_TOTAL_CAMPSITES, 690);
  assert.equal(RV_PARK_CAMPSITES.length, 690);
  const ids = new Set(geo.sites.map((s) => s.SITE_ID));
  assert.equal(ids.size, 690);
  for (const id of inventory.site_ids) assert.ok(ids.has(id), 'missing ' + id);
});

test('required sample sites exist with rect_pct geometry', () => {
  for (const id of ['A1', 'M27', 'R44']) {
    const site = getRvParkSite(id);
    assert.ok(site, id);
    assert.equal(site.SITE_ID, id);
    assert.ok(site.GEOMETRY.rect_pct.w > 0);
    assert.ok(site.GEOMETRY.rect_pct.h > 0);
  }
  const sOrT = getRvParkSite('S1') || getRvParkSite('T1');
  assert.ok(sOrT, 'S or T site');
});

test('missing ranges are not invented', () => {
  for (const id of ['C16', 'C24', 'D16', 'D24', 'Q5', 'Q25', 'Q44', 'I32', 'P44']) {
    assert.equal(getRvParkSite(id), undefined, id);
    const result = findRvParkPlace(id);
    assert.equal(result.status, 'not_found');
    assert.equal(result.title, 'Site not found');
  }
});

test('Q1–Q4 only; northern / low-multi-instance label used', () => {
  assert.ok(getRvParkSite('Q1'));
  assert.ok(getRvParkSite('Q4'));
  assert.equal(getRvParkSite('Q5'), undefined);
  const q1 = getRvParkSite('Q1');
  assert.equal(q1.SOURCE_CONFIDENCE, 'low-multi-instance');
  assert.equal(q1.label_instances, 11);
  // Northern = smallest cy → lowest y percent among Q row
  assert.ok(q1.GEOMETRY.rect_pct.y < 40, 'Q1 should use top-block northern instance');
});

test('normalization M27 / m27 / M 27 → M27', () => {
  assert.equal(normalizeRvSiteQuery('M27'), 'M27');
  assert.equal(normalizeRvSiteQuery('m27'), 'M27');
  assert.equal(normalizeRvSiteQuery('M 27'), 'M27');
  assert.equal(normalizeRvSiteQuery('m-27'), 'M27');
  assert.equal(findRvParkPlace('m 27').status, 'found');
  assert.equal(findRvParkPlace('m 27').site.SITE_ID, 'M27');
  assert.equal(rvParkPlaceTitle(findRvParkPlace('M27').site), 'RV Site M27');
});

test('invalid query → Site not found', () => {
  const miss = findRvParkPlace('ZZ99');
  assert.equal(miss.status, 'not_found');
  assert.equal(miss.title, 'Site not found');
  assert.equal(findRvParkPlace('Unsuitable for trailers').status, 'not_found');
});

test('Office and Dump Station landmarks are searchable', () => {
  const office = findRvParkPlace('Office');
  assert.equal(office.status, 'found');
  assert.equal(office.title, 'RV Park Office');
  const dump = findRvParkPlace('Dump Station');
  assert.equal(dump.status, 'found');
  assert.equal(dump.title, 'Dump Station');
  assert.equal(findRvParkPlace('Dump').status, 'found');
  assert.equal(RV_PARK_LANDMARKS.length, 2);
});

test('highlight uses cyan/light-blue fill + yellow outer border + boothHighlightStyle', () => {
  assert.match(mapSrc, /boothHighlightStyle/);
  assert.match(mapSrc, /SITE_CELL_FILL = 'rgba\(103, 232, 249/);
  assert.match(mapSrc, /SITE_CELL_BORDER = '#F5C518'/);
  assert.match(mapSrc, /testID="rv-site-highlight"/);
});

test('nav: Grounds → RV via View RV Site Map; map.tsx mode rv', () => {
  assert.match(zonesSrc, /action: 'switch-rv'/);
  assert.match(groundsSrc, /View RV Site Map/);
  assert.match(groundsSrc, /onSwitchToRv/);
  assert.match(screenSrc, /mode === 'rv'/);
  assert.match(screenSrc, /RvParkDetailMap/);
  assert.match(screenSrc, /setMode\('rv'\)/);
});

test('Fit/reset control present', () => {
  assert.match(mapSrc, /testID="rv-map-fit-reset"/);
  assert.match(mapSrc, /maximize-2/);
  assert.match(mapSrc, /resetMapCamera/);
});

test('shared camera engine: Camping flyTo uses tentedCityCamera; gestures via mapInteraction', () => {
  assert.match(mapSrc, /from '\.\.\/config\/tentedCityCamera'/);
  assert.match(mapSrc, /flyToRect/);
  assert.match(mapSrc, /from '\.\.\/config\/mapInteraction'/);
  assert.match(mapSrc, /attachWebMapGestures/);
  assert.match(mapSrc, /createMapNativeGestures/);
  assert.match(mapSrc, /resetMapCamera/);
  assert.match(mapSrc, /WEB_TOUCH_LOCK/);
  assert.match(tentedSrc, /from '\.\.\/config\/mapInteraction'/);
  assert.match(tentedSrc, /attachWebMapGestures/);
  assert.match(tentedSrc, /createMapNativeGestures/);
  assert.match(tentedSrc, /from '\.\.\/config\/tentedCityCamera'/);
  assert.match(tentedSrc, /flyToRect/);
  // Grounds still imports tentedCityCamera directly on this branch (not required to migrate).
  assert.match(groundsSrc, /from '\.\.\/config\/tentedCityCamera'/);
});

test('Camping shares TC gesture markers via mapInteraction (no local gesture engine)', () => {
  const interaction = fs.readFileSync(path.join(root, 'src/config/mapInteraction.ts'), 'utf8');
  assert.match(interaction, /export function finishWebGesture/);
  assert.match(interaction, /rubberBandEffect: true/);
  assert.match(interaction, /DOUBLE_TAP_SCALE/);
  assert.match(interaction, /blocksExternalGesture/);
  assert.match(interaction, /minPointers\(1\)/);
  assert.match(interaction, /deceleration: 0\.996/);
  assert.match(interaction, /setPointerCapture/);
  assert.doesNotMatch(mapSrc, /function resolveDomNode/);
  assert.doesNotMatch(mapSrc, /Gesture\.Pinch\(/);
  assert.doesNotMatch(mapSrc, /const finishWebGesture/);
  assert.doesNotMatch(tentedSrc, /Gesture\.Pinch\(/);
  assert.doesNotMatch(tentedSrc, /function resolveDomNode/);
});

test('Camping search flyTo is one-shot via focusedKey (no recenter loop)', () => {
  assert.match(mapSrc, /focusedKey/);
  assert.match(mapSrc, /if \(!opts\?\.forceFly && focusedKey\.current === key\) return/);
  assert.match(mapSrc, /focusedKey\.current = key/);
  assert.match(mapSrc, /resetMapCamera\(cam\)/);
  assert.doesNotMatch(mapSrc, /setInterval/);
  assert.doesNotMatch(mapSrc, /requestAnimationFrame/);
});

test('Grounds / Tented City / unified search unaffected by campsite flood', () => {
  // Campsites not dumped into mapLocations / global Grounds aliases
  assert.doesNotMatch(mapLocationsSrc, /\bM27\b/);
  assert.doesNotMatch(mapLocationsSrc, /\bA1\b/);
  assert.match(zonesSrc, /'rv park': 'rv-park'/);
  assert.doesNotMatch(zonesSrc, /'m27'/);
  // Tented search module unchanged in role
  assert.match(tentedSrc, /searchEventMap/);
  assert.match(screenSrc, /findTentedCityPlace/);
  // Searching RV module does not invent global export into mapLocations
  assert.equal(searchRvParkPlaces('M27')[0].SITE_ID, 'M27');
  assert.ok(fs.existsSync(path.join(root, 'assets/images/rv-park-detail-map.png')));
});

test('offline assets + geometry bundled', () => {
  assert.match(mapSrc, /rv-park-detail-map\.png/);
  assert.ok(fs.existsSync(geoPath));
  assert.ok(fs.existsSync(path.join(root, 'assets/maps/IPM-RV-Map-no-road-names.pdf')));
});

const selectorSrc = fs.readFileSync(path.join(root, 'src/components/MapModeSelector.tsx'), 'utf8');

test('Maps shows Grounds, Tented City, and Camping Map selectors', () => {
  assert.match(screenSrc, /MapModeSelector/);
  assert.match(selectorSrc, /label: 'Grounds'/);
  assert.match(selectorSrc, /label: 'Tented City'/);
  assert.match(selectorSrc, /label: 'Camping Map'/);
  assert.doesNotMatch(selectorSrc, /label: 'RV Detail'/);
  assert.doesNotMatch(selectorSrc, /label: 'RV Park'/);
  assert.match(selectorSrc, /testID = 'map-mode-selector'/);
  assert.match(selectorSrc, /testID=\{testID\}/);
  assert.match(selectorSrc, /map-mode-\$\{option\.id\}/);
  assert.match(selectorSrc, /id: 'grounds'/);
  assert.match(selectorSrc, /id: 'tented'/);
  assert.match(selectorSrc, /id: 'rv'/);
});

test('Camping Map selector opens RV detail directly via shared RvParkDetailMap', () => {
  assert.match(screenSrc, /MapModeSelector mode=\{mode\} onChange=\{setMode\}/);
  assert.match(screenSrc, /mode === 'rv'/);
  assert.match(screenSrc, /<RvParkDetailMap/);
  assert.equal((screenSrc.match(/import RvParkDetailMap from/g) || []).length, 1);
  assert.match(screenSrc, /hideModeSelector/);
});

test('Grounds and Tented City selectors still wired', () => {
  assert.match(screenSrc, /mode === 'grounds'/);
  assert.match(screenSrc, /mode !== 'tented'/);
  assert.match(screenSrc, /<GroundsMap/);
  assert.match(screenSrc, /<TentedCityMap/);
  assert.match(screenSrc, /onSwitchToTented=\{\(loc\) =>/);
  assert.match(screenSrc, /setMode\('tented'\)/);
  assert.match(screenSrc, /onSwitchToRv=\{\(\) => setMode\('rv'\)\}/);
});

test('Grounds → RV Park → View RV Site Map secondary entry preserved', () => {
  assert.match(zonesSrc, /action: 'switch-rv'/);
  assert.match(groundsSrc, /View RV Site Map/);
  assert.match(groundsSrc, /onSwitchToRv/);
  assert.match(screenSrc, /onSwitchToRv=\{\(\) => setMode\('rv'\)\}/);
});

test('mobile selector scrolls horizontally and keeps Camping Map label full', () => {
  assert.match(selectorSrc, /ScrollView/);
  assert.match(selectorSrc, /horizontal/);
  assert.match(selectorSrc, /Camping Map/);
  assert.match(selectorSrc, /numberOfLines=\{1\}/);
  assert.match(selectorSrc, /minWidth: 300/);
  assert.doesNotMatch(selectorSrc, /Camping…|Camp\b|RV Detail/);
});
