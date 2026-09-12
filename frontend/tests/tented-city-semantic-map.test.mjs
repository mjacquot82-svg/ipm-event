import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const manifestPath = new URL('../src/data/tented-city-map-manifest.json', import.meta.url);
const svgPath = new URL('../assets/images/tented-city-map-app-ready.svg', import.meta.url);
const componentPath = new URL('../src/components/TentedCityMap.tsx', import.meta.url);
const helperPath = new URL('../src/config/tentedCitySemanticMap.ts', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const svg = fs.readFileSync(svgPath, 'utf8');
const component = fs.readFileSync(componentPath, 'utf8');
const helper = fs.readFileSync(helperPath, 'utf8');
const normalize = (value) => value.toUpperCase().replace(/[’']/g, '').replace(/[^A-Z0-9]+/g, ' ').trim();

test('manifest and supplied SVG expose all unique semantic regions', () => {
  assert.equal(manifest.coordinate_system.viewBox, '0 0 774 603');
  assert.equal(manifest.areas.length, 99);
  assert.equal(new Set(manifest.areas.map((area) => area.id)).size, 99);
  for (const area of manifest.areas) assert.match(svg, new RegExp(`id="${area.id}"`));
});

test('exact semantic lookup resolves known regions and safely rejects unknown labels', () => {
  const find = (query) => manifest.areas.find((area) => normalize(area.id) === normalize(query) || normalize(area.label) === normalize(query)) || null;
  assert.equal(find('1A 1-12')?.id, '1a-1-12');
  assert.equal(find('ACCESSIBLE PARKING')?.id, 'accessible-parking');
  assert.equal(find('not an official region'), null);
  assert.match(helper, /findSemanticAreaForVendor/);
  assert.match(helper, /findSemanticAreaForLocation/);
  assert.match(helper, /EVENT CENTRE 1 WEST 2/);
  assert.match(helper, /dancing-tractors-combine-derby-west-2/);
});

test('map wires semantic areas, selection, focus, and official SVG source', () => {
  assert.match(component, /tented-city-map-app-ready\.svg/);
  assert.match(component, /TENTED_CITY_SEMANTIC_AREAS\.map/);
  assert.match(component, /selectSemanticArea/);
  assert.match(component, /semanticAreaRect/);
  assert.match(component, /accessibilityLabel={`Select \$\{area\.label\}`}/);
  assert.match(component, /findSemanticAreaForLocation\(initialQuery\)/);
  assert.match(component, /selectSemanticArea\(semanticArea\)/);
});


test('parent-only Quilt Tent / Rural Expo resolve; flagged 6B stays unmapped', () => {
  assert.match(helper, /QUILT TENT/);
  assert.match(helper, /quilt-tent-3a-39-44-g2/);
  assert.match(helper, /RURAL EXPO COURTYARD/);
  assert.match(helper, /rural-expo-courtyard-3b-39-44/);
  assert.ok(manifest.areas.some((area) => area.id === 'quilt-tent-3a-39-44-g2'));
  assert.ok(manifest.areas.some((area) => area.id === 'rural-expo-courtyard-3b-39-44'));
  assert.equal(manifest.areas.some((area) => /6b.?26/i.test(area.id + area.label)), false);
});
