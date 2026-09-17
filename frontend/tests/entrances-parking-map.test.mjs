import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const selector = await readFile(new URL('../src/components/MapModeSelector.tsx', import.meta.url), 'utf8');
const screen = await readFile(new URL('../app/(tabs)/map.tsx', import.meta.url), 'utf8');
const grounds = await readFile(new URL('../src/config/groundsZones.ts', import.meta.url), 'utf8');
const search = await readFile(new URL('../src/config/mapSearch.ts', import.meta.url), 'utf8');
const viewer = await readFile(new URL('../src/components/EntrancesParkingMap.tsx', import.meta.url), 'utf8');
const groundsMap = await readFile(new URL('../src/components/GroundsMap.tsx', import.meta.url), 'utf8');
const traffic = await readFile(new URL('../src/components/GroundsTrafficOverlay.tsx', import.meta.url), 'utf8');

test('Maps has exactly four approved top-level modes and a separate official map view', async () => {
  assert.deepEqual([...selector.matchAll(/id: '(grounds|tented|rv|entrances)'/g)].map((m) => m[1]), ['grounds', 'tented', 'rv', 'entrances']);
  assert.match(screen, /mode === 'entrances'/);
  assert.match(screen, /<EntrancesParkingMap/);
  assert.match(viewer, /entrances-parking-map\.png/);
  assert.ok((await stat(new URL('../assets/images/entrances-parking-map.png', import.meta.url))).size > 1000);
});

test('obsolete Grounds parking overlay zones and search entries are absent', () => {
  assert.doesNotMatch(grounds, /id: '(west|north)-parking'/);
  assert.doesNotMatch(search, /zoneId: '(west|north)-parking'/);
});

test('approved traffic arrows are passive and rendered on normal Grounds', () => {
  assert.match(groundsMap, /<GroundsTrafficOverlay width=\{layer\.width\} height=\{layer\.height\} scale=\{scale\} \/>/);
  assert.match(traffic, /TRAFFIC-01/);
  assert.match(traffic, /TRAFFIC-02/);
  assert.match(traffic, /TRAFFIC-03/);
  assert.match(traffic, /testID="grounds-traffic-overlay"/);
  assert.match(traffic, /pointerEvents="none"/);
  assert.doesNotMatch(groundsMap, /GroundsViewSelector|GroundsParkingOverlay|groundsView/);
});
