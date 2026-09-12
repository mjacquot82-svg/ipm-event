import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const campingMap = fs.readFileSync(path.join(root, 'src/components/RvParkDetailMap.tsx'), 'utf8');
const tentedMap = fs.readFileSync(path.join(root, 'src/components/TentedCityMap.tsx'), 'utf8');
const interaction = fs.readFileSync(path.join(root, 'src/config/mapInteraction.ts'), 'utf8');

test('Camping and TC both reuse shared mapInteraction (one implementation)', () => {
  for (const src of [campingMap, tentedMap]) {
    assert.match(src, /attachWebMapGestures/);
    assert.match(src, /createMapNativeGestures/);
    assert.match(src, /resetMapCamera/);
    assert.match(src, /WEB_TOUCH_LOCK/);
    assert.doesNotMatch(src, /function resolveDomNode/);
    assert.doesNotMatch(src, /const finishWebGesture/);
    assert.doesNotMatch(src, /Gesture\.Pinch\(/);
  }
  assert.match(interaction, /export function finishWebGesture/);
  assert.match(interaction, /export function attachWebMapGestures/);
  assert.match(interaction, /export function createMapNativeGestures/);
  assert.match(interaction, /pinchAroundMovingFocal/);
  assert.match(interaction, /rubberBandEffect: true/);
  assert.match(interaction, /rubberBandFactor: 0\.55/);
  assert.match(interaction, /deceleration: 0\.996/);
  assert.match(interaction, /DOUBLE_TAP_SCALE/);
  assert.match(interaction, /blocksExternalGesture/);
  assert.match(interaction, /minPointers\(1\)/);
  assert.match(interaction, /setPointerCapture/);
  assert.match(interaction, /suppressClick/);
});

test('finishWebGesture clamps only when outside / under-zoomed', () => {
  assert.match(interaction, /if \(!outside\) return/);
  assert.match(interaction, /if \(cam\.scale\.value < 1\)/);
  assert.match(interaction, /if \(cam\.scale\.value <= 1\)/);
});

test('Camping FoM / search focus is one-shot; Fit frees camera', () => {
  assert.match(campingMap, /focusedKey/);
  assert.match(campingMap, /focusedKey\.current === key/);
  assert.match(campingMap, /resetMapCamera\(cam\)/);
  assert.match(campingMap, /flyToRect/);
  assert.doesNotMatch(campingMap, /setInterval/);
});

test('TC omits onSingleTap; Camping omits onSingleTap', () => {
  assert.match(campingMap, /attachWebMapGestures\(node, cam\)/);
  assert.match(tentedMap, /attachWebMapGestures\(node, cam\)/);
  assert.doesNotMatch(campingMap, /onSingleTap/);
  assert.doesNotMatch(tentedMap, /onSingleTap/);
});

test('Camping keeps highlight / search / selector language', () => {
  assert.match(campingMap, /boothHighlightStyle/);
  assert.match(campingMap, /SITE_CELL_FILL/);
  assert.match(campingMap, /searchRvParkPlaces/);
  assert.match(campingMap, /Camping Map/);
  assert.match(campingMap, /rv-site-search/);
});
