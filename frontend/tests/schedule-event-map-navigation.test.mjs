import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';
import ts from 'typescript';

const schedulePath = new URL('../app/(tabs)/schedule.tsx', import.meta.url);
const scheduleSource = fs.readFileSync(schedulePath, 'utf8');
const mapPath = new URL('../app/(tabs)/map.tsx', import.meta.url);
const mapSource = fs.readFileSync(mapPath, 'utf8');

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
    : name.startsWith('.') ? load(new URL(name.endsWith('.ts') || name.endsWith('.tsx') ? name : name + '.ts', url)) : createRequire(url)(name));
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

const { resolveMapTypeForLocation, findTentedCityPlace } = load(new URL('../src/config/tentedCitySearch.ts', import.meta.url));
const vendors = loadExhibitors();

const MNP_SCHEDULE_LOCATIONS = [
  'The Beyond Wireless Stage',
  "Harley's Pub & Perk - Stage",
  'Quality Homes - Stage',
];

test('Find on the Map dismisses the modal without replaying modal history', () => {
  const locationStart = scheduleSource.indexOf('{/* Location */}');
  const categoryStart = scheduleSource.indexOf('{/* Category */}', locationStart);
  assert.ok(locationStart >= 0 && categoryStart > locationStart);
  const locationSection = scheduleSource.slice(locationStart, categoryStart);

  assert.match(locationSection, /dismissEventModalForMap\(\)/);
  assert.match(locationSection, /router\.replace\(/);
  assert.match(locationSection, /pathname:\s*['"]\/\(tabs\)\/map['"]/);
  assert.match(locationSection, /showOnly:\s*['"]true['"]/);
  assert.match(locationSection, /source:\s*['"]schedule['"]/);
  assert.match(locationSection, /mapType:\s*resolveMapTypeForLocation\(selectedEvent\.location_name,\s*tentedCityVendors\)/);
  assert.doesNotMatch(locationSection, /closeEventModal\(\)/);
  assert.doesNotMatch(locationSection, /window\.history\.(back|go|forward)/);
});

test('normal event-detail browser Back history remains present separately', () => {
  assert.match(scheduleSource, /const eventModalHistoryRef = useRef\(false\)/);
  assert.match(scheduleSource, /const closeEventModal = useCallback/);
  assert.match(scheduleSource, /window\.history\.go\(returnToItineraryRef\.current \? -2 : -1\)/);
});

test('Beyond/Harley/Quality Homes Tap to View Map resolve mapType tented', () => {
  for (const location of MNP_SCHEDULE_LOCATIONS) {
    assert.equal(resolveMapTypeForLocation(location, vendors), 'tented', location);
    const place = findTentedCityPlace(location, vendors);
    assert.ok(place, location);
    assert.equal(place.kind, 'stage');
  }
});

test('schedule navigation wires mapType from resolveMapTypeForLocation', () => {
  assert.match(scheduleSource, /import \{ resolveMapTypeForLocation \} from/);
  assert.match(scheduleSource, /import \{ tentedCityVendors \} from/);
  assert.match(scheduleSource, /mapType:\s*resolveMapTypeForLocation\(selectedEvent\.location_name,\s*tentedCityVendors\)/);
});

test('map screen prefers explicit mapType and syncs mode when params change', () => {
  assert.match(mapSource, /mapType/);
  assert.match(mapSource, /resolveMapTypeForLocation/);
  assert.match(mapSource, /useEffect\(\(\) => \{\s*setMode\(desiredMode\);\s*\}, \[desiredMode\]\)/s);
  assert.match(mapSource, /if \(mapType === 'tented' \|\| mapType === 'grounds'\) return mapType/);
  // Must not blindly force every schedule source onto tented (grounds destinations stay grounds).
  assert.doesNotMatch(mapSource, /source === 'schedule'/);
});

test('grounds destinations resolve mapType grounds', () => {
  assert.equal(resolveMapTypeForLocation('West Parking Lot', vendors), 'grounds');
  assert.equal(resolveMapTypeForLocation('RV Park', vendors), 'grounds');
  assert.equal(resolveMapTypeForLocation('Bus Stop', vendors), 'grounds');
  assert.equal(resolveMapTypeForLocation(null, vendors), 'grounds');
});

test('MNP EAST-2 selection location survives navigation params (location preserved)', () => {
  const locationStart = scheduleSource.indexOf('{/* Location */}');
  const categoryStart = scheduleSource.indexOf('{/* Category */}', locationStart);
  const locationSection = scheduleSource.slice(locationStart, categoryStart);
  assert.match(locationSection, /location:\s*selectedEvent\.location_name/);
  assert.match(locationSection, /showOnly:\s*['"]true['"]/);
});
