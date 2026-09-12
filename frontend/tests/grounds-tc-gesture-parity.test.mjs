import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const groundsMap = fs.readFileSync(path.join(root, 'src/components/GroundsMap.tsx'), 'utf8');
const tentedMap = fs.readFileSync(path.join(root, 'src/components/TentedCityMap.tsx'), 'utf8');
const interaction = fs.readFileSync(path.join(root, 'src/config/mapInteraction.ts'), 'utf8');
const groundsCamera = fs.readFileSync(path.join(root, 'src/config/groundsCamera.ts'), 'utf8');
const cameraPath = path.join(root, 'src/config/tentedCityCamera.ts');

function stripWorkletsAndTypes(src) {
  let s = src.replace(/^\s*'worklet';\s*$/gm, '');
  s = s.replace(/^export type[\s\S]*?^};\n/gm, '');
  s = s.replace(/\?: /g, ': ');
  s = s.replace(/: ZoomAroundFocalInput\b/g, '');
  s = s.replace(/: PinchAroundMovingFocalInput\b/g, '');
  s = s.replace(/: MapPointInput\b/g, '');
  s = s.replace(/: FlyToRectInput\b/g, '');
  s = s.replace(/: FocalQuery\b/g, '');
  s = s.replace(/: CameraState\b/g, '');
  s = s.replace(/: CameraLayout\b/g, '');
  s = s.replace(/: TranslationBounds\b/g, '');
  s = s.replace(/: number\b/g, '');
  s = s.replace(/: boolean\b/g, '');
  s = s.replace(/: string\b/g, '');
  return s;
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grounds-tc-parity-'));
const tmpFile = path.join(tmpDir, 'tentedCityCamera.mjs');
fs.writeFileSync(tmpFile, stripWorkletsAndTypes(fs.readFileSync(cameraPath, 'utf8')));
const camera = await import(pathToFileURL(tmpFile).href);

test('both maps reuse shared mapInteraction (no duplicated web gesture engines)', () => {
  for (const src of [groundsMap, tentedMap]) {
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
  assert.match(interaction, /setPointerCapture/);
  assert.match(interaction, /suppressClick/);
});

test('Grounds does not independently retune max/initial/double-tap scale', () => {
  assert.match(groundsCamera, /from '\.\/tentedCityCamera'/);
  assert.match(groundsCamera, /GROUNDS_INITIAL_SCALE = 1/);
  assert.doesNotMatch(groundsMap, /GROUNDS_INITIAL_SCALE/);
  assert.doesNotMatch(groundsMap, /GROUNDS_MAX_SCALE/);
  assert.doesNotMatch(groundsMap, /didInitCamera/);
  assert.equal(camera.MAX_SCALE, 4.5);
  assert.equal(camera.DOUBLE_TAP_SCALE, 2.4);
  assert.equal(camera.MIN_SCALE, 1);
});

test('finishWebGesture clamps only when outside / under-zoomed', () => {
  assert.match(interaction, /if \(!outside\) return/);
  assert.match(interaction, /if \(cam\.scale\.value < 1\)/);
  assert.match(interaction, /if \(cam\.scale\.value <= 1\)/);
});

test('FoM is one-shot via focusedKey; Fit resets camera freely', () => {
  assert.match(groundsMap, /focusedKey/);
  assert.match(groundsMap, /if \(focusedKey\.current === key\) return/);
  assert.match(groundsMap, /resetMapCamera\(cam\)/);
  assert.match(groundsMap, /flyToRect/);
  assert.doesNotMatch(groundsMap, /requestAnimationFrame/);
  // No continuous recenter loop after FoM.
  assert.doesNotMatch(groundsMap, /setInterval/);
});

test('Grounds keeps zone single-tap; TC omits onSingleTap', () => {
  assert.match(groundsMap, /onSingleTap:\s*hitViewportPoint/);
  assert.match(tentedMap, /attachWebMapGestures\(node, cam\)/);
  assert.doesNotMatch(tentedMap, /onSingleTap/);
});

test('portrait Grounds letterbox layout still allows mild-zoom pan (shared bounds)', () => {
  // Grounds artwork 1344x2006 on a phone viewport — letterboxed, then mild zoom.
  const vw = 390, vh = 844;
  const aspect = 1344 / 2006;
  const mapW = vw;
  const mapH = vw / aspect;
  const layout = {
    viewportW: vw,
    viewportH: vh,
    mapW,
    mapH,
    left: (vw - mapW) / 2,
    top: (vh - mapH) / 2,
  };
  const fit = camera.translationBounds(1, layout);
  assert.deepEqual(fit, { minTx: 0, maxTx: 0, minTy: 0, maxTy: 0 });
  const mild = camera.translationBounds(1.2, layout);
  assert.ok(mild.maxTx - mild.minTx > 40, 'horizontal pan room near fit');
  assert.ok(mild.maxTy - mild.minTy > 40, 'vertical pan room near fit');
  const wild = camera.clampTranslation({ scale: 2.5, tx: -9000, ty: 9000 }, layout);
  assert.ok(Math.abs(wild.tx) < 5000);
  assert.ok(Math.abs(wild.ty) < 5000);
});

test('search / routing / highlight language preserved on Grounds', () => {
  assert.match(groundsMap, /searchEventMap/);
  assert.match(groundsMap, /onSwitchToTented/);
  assert.match(groundsMap, /SELECTED_FILL/);
  assert.match(groundsMap, /#FFD600/);
  assert.match(groundsMap, /ZoneHighlight/);
  assert.match(groundsMap, /grounds-map-search/);
});
