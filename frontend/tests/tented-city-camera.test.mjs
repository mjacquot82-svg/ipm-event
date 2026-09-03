import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';

const here = path.dirname(fileURLToPath(import.meta.url));

function firstExisting(paths) {
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('missing ' + paths.join(' | '));
}

const cameraPath = firstExisting([
  path.join(here, '../src/config/tentedCityCamera.ts'),
  path.join(here, 'tentedCityCamera.ts'),
  path.join(here, '../config/tentedCityCamera.ts'),
]);

const mapPath = firstExisting([
  path.join(here, '../src/components/TentedCityMap.tsx'),
  path.join(here, 'TentedCityMap.tsx'),
  path.join(here, '../components/TentedCityMap.tsx'),
]);

function stripWorkletsAndTypes(src) {
  let s = src.replace(/^\s*'worklet';\s*$/gm, '');
  s = s.replace(/^export type[\s\S]*?^};\n/gm, '');
  s = s.replace(/\?: /g, ': ');
  s = s.replace(/: ZoomAroundFocalInput\b/g, '');
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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tented-city-camera-'));
const tmpFile = path.join(tmpDir, 'tentedCityCamera.mjs');
fs.writeFileSync(tmpFile, stripWorkletsAndTypes(fs.readFileSync(cameraPath, 'utf8')));
const camera = await import(pathToFileURL(tmpFile).href);

const layoutPhone = {
  viewportW: 390,
  viewportH: 844,
  mapW: 390,
  mapH: 390 / (1935 / 1508),
  left: 0,
  top: (844 - 390 / (1935 / 1508)) / 2,
};

const layoutWide = {
  viewportW: 800,
  viewportH: 400,
  mapW: 400 * (1935 / 1508),
  mapH: 400,
  left: (800 - 400 * (1935 / 1508)) / 2,
  top: 0,
};

function overlap(state, layout) {
  const r = {
    x: layout.left + state.tx,
    y: layout.top + state.ty,
    w: layout.mapW * state.scale,
    h: layout.mapH * state.scale,
  };
  const x0 = Math.max(r.x, 0);
  const y0 = Math.max(r.y, 0);
  const x1 = Math.min(r.x + r.w, layout.viewportW);
  const y1 = Math.min(r.y + r.h, layout.viewportH);
  return { w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

test('clampScale keeps 1..4.5', () => {
  assert.equal(camera.MIN_SCALE, 1);
  assert.equal(camera.MAX_SCALE, 4.5);
  assert.equal(camera.clampScale(0.2), 1);
  assert.equal(camera.clampScale(9), 4.5);
  assert.equal(camera.clampScale(2.2), 2.2);
  assert.equal(camera.clampScale(3, 2.05, 3.15), 3);
  assert.equal(camera.clampScale(1, 2.05, 3.15), 2.05);
});

test('zoomAroundFocal keeps the map point under the focal in the viewport', () => {
  const start = { scale: 1.4, tx: -48, ty: 22 };
  const focalX = 210;
  const focalY = 390;
  const before = camera.mapPointUnderFocal({
    ...start,
    focalX,
    focalY,
    left: layoutPhone.left,
    top: layoutPhone.top,
  });
  const next = camera.zoomAroundFocal({
    ...start,
    nextScale: 2.7,
    focalX,
    focalY,
    left: layoutPhone.left,
    top: layoutPhone.top,
  });
  const after = camera.mapPointUnderFocal({
    ...next,
    focalX,
    focalY,
    left: layoutPhone.left,
    top: layoutPhone.top,
  });
  assert.ok(Math.abs(after.x - before.x) < 1e-6);
  assert.ok(Math.abs(after.y - before.y) < 1e-6);
  assert.equal(next.scale, 2.7);

  const vx = layoutPhone.left + before.x * next.scale + next.tx;
  const vy = layoutPhone.top + before.y * next.scale + next.ty;
  assert.ok(Math.abs(vx - focalX) < 1e-6);
  assert.ok(Math.abs(vy - focalY) < 1e-6);
});

test('zoomAroundFocal clamps scale and still keeps the focal', () => {
  const start = { scale: 1, tx: 0, ty: 0 };
  const next = camera.zoomAroundFocal({
    ...start,
    nextScale: 99,
    focalX: 120,
    focalY: 400,
    left: layoutPhone.left,
    top: layoutPhone.top,
  });
  assert.equal(next.scale, 4.5);
  const before = camera.mapPointUnderFocal({
    ...start,
    focalX: 120,
    focalY: 400,
    left: layoutPhone.left,
    top: layoutPhone.top,
  });
  const after = camera.mapPointUnderFocal({
    ...next,
    focalX: 120,
    focalY: 400,
    left: layoutPhone.left,
    top: layoutPhone.top,
  });
  assert.ok(Math.abs(after.x - before.x) < 1e-6);
  assert.ok(Math.abs(after.y - before.y) < 1e-6);
});

test('clampTranslation at fit keeps translation ~0', () => {
  const phone = camera.clampTranslation({ scale: 1, tx: 180, ty: -90 }, layoutPhone);
  assert.equal(phone.scale, 1);
  assert.ok(Math.abs(phone.tx) < 1e-6);
  assert.ok(Math.abs(phone.ty) < 1e-6);

  const wide = camera.clampTranslation({ scale: 1, tx: -40, ty: 80 }, layoutWide);
  assert.ok(Math.abs(wide.tx) < 1e-6);
  assert.ok(Math.abs(wide.ty) < 1e-6);
});

test('clampTranslation keeps a mild portion of the map on screen', () => {
  assert.equal(camera.MIN_OVERLAP_FRACTION, 0.15);
  const wild = camera.clampTranslation({ scale: 3.2, tx: -8000, ty: 8000 }, layoutPhone);
  const seen = overlap(wild, layoutPhone);
  const minOverlap = 0.15 * Math.min(layoutPhone.viewportW, layoutPhone.viewportH);
  assert.ok(seen.w + 0.5 >= Math.min(minOverlap, layoutPhone.mapW * wild.scale));
  assert.ok(seen.h + 0.5 >= Math.min(minOverlap, layoutPhone.mapH * wild.scale));
  assert.ok(seen.w > 50);
  assert.ok(seen.h > 50);
});

test('translationBounds does not letterbox-lock at mild zoom', () => {
  const b = camera.translationBounds(1.2, layoutPhone);
  const extraX = Math.max(0, layoutPhone.mapW * 1.2 - layoutPhone.mapW);
  assert.ok(b.maxTx - b.minTx > extraX * 2 + 40);
  const src = fs.readFileSync(cameraPath, 'utf8');
  assert.doesNotMatch(src, /extraX/);
  assert.doesNotMatch(src, /layout\.left - extraX/);
});

test('rubberBand eases past the edge then clamp snaps back', () => {
  const bounds = camera.translationBounds(2.5, layoutPhone);
  const past = camera.rubberBand(bounds.minTx - 400, bounds.minTx, bounds.maxTx);
  assert.ok(past < bounds.minTx);
  assert.ok(past > bounds.minTx - 72);
  const snapped = camera.clampTranslation({ scale: 2.5, tx: past, ty: bounds.maxTy + 200 }, layoutPhone);
  assert.equal(snapped.tx, bounds.minTx);
  assert.ok(snapped.ty <= bounds.maxTy + 1e-6);
});

test('decayStep reduces velocity', () => {
  const v = camera.decayStep(1200, 16);
  assert.ok(v < 1200);
  assert.ok(v > 1100);
});

test('flyToRect frames a booth above the reserved bottom and stays in bounds', () => {
  const cam = camera.flyToRect({
    rectX: 26.935,
    rectY: 26.268,
    rectW: 0.758,
    rectH: 3.947,
    ...layoutPhone,
    reservedBottom: 60 + 108,
    mild: true,
  });
  assert.ok(cam.scale >= 2.05);
  assert.ok(cam.scale <= 3.15);
  const clamped = camera.clampTranslation(cam, layoutPhone);
  assert.ok(Math.abs(clamped.tx - cam.tx) < 1e-6);
  assert.ok(Math.abs(clamped.ty - cam.ty) < 1e-6);
  const seen = overlap(cam, layoutPhone);
  assert.ok(seen.w > 80);
  assert.ok(seen.h > 80);
});

test('TentedCityMap uses the camera helpers, viewport gestures, and inertia', () => {
  const map = fs.readFileSync(mapPath, 'utf8');
  assert.match(map, /from ['"]\.\.\/config\/tentedCityCamera['"]/);
  assert.match(map, /zoomAroundFocal/);
  assert.match(map, /clampTranslation/);
  assert.match(map, /withDecay/);
  assert.match(map, /maxPointers\(1\)/);
  assert.match(map, /DOUBLE_TAP_SCALE/);
  assert.match(map, /flyToRect/);
  assert.match(map, /SELECTED_RESERVED_BOTTOM/);
  assert.match(map, /duration: 280/);
  assert.match(map, /touchAction: 'none'/);
  assert.match(map, /Gesture\.Simultaneous\(pinch, pan, doubleTap\)/);
  assert.match(map, /blocksExternalGesture\(pan\)/);
  assert.doesNotMatch(map, /scale\.value <= 1\.02/);
  assert.match(map, /if \(scale\.value < 1\)/);
  assert.doesNotMatch(map, /averageTouches\(true\)/);
  assert.match(map, /styles\.gestureRoot/);
  assert.match(map, /footprintForVendor/);
  assert.match(map, /onSwitchToGrounds/);
  assert.match(map, /verify1A/);
  assert.match(map, /searchTentedCity\(query, tentedCityVendors, filter\)/);
});
