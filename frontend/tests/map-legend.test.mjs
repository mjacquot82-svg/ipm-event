import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const nativeMap = await readFile(new URL('../src/components/MapComponent.tsx', import.meta.url), 'utf8');
const webMap = await readFile(new URL('../src/components/MapComponent.web.tsx', import.meta.url), 'utf8');

for (const [platform, source] of [['native', nativeMap], ['web', webMap]]) {
  test(`${platform} Map renders no separate coloured-dot legend`, () => {
    assert.doesNotMatch(source, /showLegend|legendContainer|legendItem|legendDot|legendText/);
    assert.doesNotMatch(source, /Collapsible Legend|Event Grounds/);
    assert.doesNotMatch(source, /categories\.map\(\(category\)/);
  });

  test(`${platform} Map preserves artwork, pins, controls, and location interaction`, () => {
    assert.match(source, /require\('\.\.\/\.\.\/assets\/images\/event-map\.png'\)/);
    assert.match(source, /maximumZoomScale=\{3\}/);
    assert.match(source, /minimumZoomScale=\{1\}/);
    assert.match(source, /\{pinsToShow\.map\(renderPin\)\}/);
    assert.match(source, /styles\.pin,[\s\S]*backgroundColor: pinColor/);
    assert.match(source, /onPress=\{\(\) => handlePinPress\(location\)\}/);
    assert.match(source, /Show All Locations/);
    assert.match(source, /Pinch to zoom • Tap pins for info/);
  });
}
