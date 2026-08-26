import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const nativeMap = await readFile(new URL('../src/components/MapComponent.tsx', import.meta.url), 'utf8');
const webMap = await readFile(new URL('../src/components/MapComponent.web.tsx', import.meta.url), 'utf8');
const locationData = await readFile(new URL('../src/config/mapLocations.ts', import.meta.url), 'utf8');

for (const [platform, source] of [['native', nativeMap], ['web', webMap]]) {
  test(`${platform} Map renders no separate coloured-dot legend`, () => {
    assert.doesNotMatch(source, /showLegend|legendContainer|legendItem|legendDot|legendText/);
    assert.doesNotMatch(source, /Collapsible Legend|Event Grounds/);
    assert.doesNotMatch(source, /categories\.map\(\(category\)/);
  });

  test(`${platform} Map preserves artwork and zoom without a location-marker overlay`, () => {
    assert.match(source, /require\('\.\.\/\.\.\/assets\/images\/event-map\.png'\)/);
    assert.match(source, /maximumZoomScale=\{3\}/);
    assert.match(source, /minimumZoomScale=\{1\}/);
    assert.doesNotMatch(source, /\{pinsToShow\.map\(renderPin\)\}/);
    assert.match(source, /Location data is preserved but intentionally not overlaid for attendees/);
    assert.match(source, />Pinch to zoom<\/Text>/);
  });
}

test('all 12 configured location records remain preserved', () => {
  const records = [...locationData.matchAll(/\bid:\s*'[^']+'/g)];
  assert.equal(records.length, 12);
  assert.match(locationData, /export const mapLocations: MapLocation\[\] = \[/);
  assert.match(locationData, /export const categoryColors:/);
});
