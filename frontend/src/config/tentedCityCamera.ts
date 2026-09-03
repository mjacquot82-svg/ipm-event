/** Pure Tented City camera math. Exported fns are Reanimated worklets. */

export const MIN_SCALE = 1;
export const MAX_SCALE = 4.5;
export const DOUBLE_TAP_SCALE = 2.4;
export const MIN_OVERLAP_FRACTION = 0.15;
export const RUBBER_BAND_PIXELS = 72;

export type CameraState = {
  scale: number;
  tx: number;
  ty: number;
};

export type CameraLayout = {
  viewportW: number;
  viewportH: number;
  mapW: number;
  mapH: number;
  left: number;
  top: number;
};

export type TranslationBounds = {
  minTx: number;
  maxTx: number;
  minTy: number;
  maxTy: number;
};

export type ZoomAroundFocalInput = {
  scale: number;
  tx: number;
  ty: number;
  nextScale: number;
  focalX: number;
  focalY: number;
  left: number;
  top: number;
  minScale?: number;
  maxScale?: number;
};

export type PinchAroundMovingFocalInput = {
  scale: number;
  tx: number;
  ty: number;
  nextScale: number;
  startFocalX: number;
  startFocalY: number;
  focalX: number;
  focalY: number;
  left: number;
  top: number;
  minScale?: number;
  maxScale?: number;
};

export type MapPointInput = {
  mapX: number;
  mapY: number;
  scale: number;
  focalX: number;
  focalY: number;
  left: number;
  top: number;
};

export type FlyToRectInput = {
  rectX: number;
  rectY: number;
  rectW: number;
  rectH: number;
  viewportW: number;
  viewportH: number;
  mapW: number;
  mapH: number;
  left: number;
  top: number;
  reservedBottom: number;
  mild?: boolean;
};

export type FocalQuery = {
  scale: number;
  tx: number;
  ty: number;
  focalX: number;
  focalY: number;
  left: number;
  top: number;
};

export function clamp(n: number, min: number, max: number) {
  'worklet';
  return Math.max(min, Math.min(max, n));
}

export function clampScale(scale: number, min: number = MIN_SCALE, max: number = MAX_SCALE) {
  'worklet';
  return clamp(scale, min, max);
}

/**
 * Zoom so the map point currently under the viewport focal stays there.
 * `left`/`top` are the untransformed letterbox offsets of the map layer.
 * `focalX`/`focalY` are viewport-relative.
 */
export function zoomAroundFocal(args: ZoomAroundFocalInput): CameraState {
  'worklet';
  const minScale = args.minScale ?? MIN_SCALE;
  const maxScale = args.maxScale ?? MAX_SCALE;
  const nextScale = clampScale(args.nextScale, minScale, maxScale);
  const prev = args.scale === 0 ? 1 : args.scale;
  const ratio = nextScale / prev;
  return {
    scale: nextScale,
    tx: args.focalX - args.left - (args.focalX - args.left - args.tx) * ratio,
    ty: args.focalY - args.top - (args.focalY - args.top - args.ty) * ratio,
  };
}

/**
 * Pinch: zoom around the begin-focal, then pan by centroid travel.
 * The map point under startFocal stays under the live focal (fingers).
 * Does not rubber-band; caller only clamps scale via zoomAroundFocal.
 */
export function pinchAroundMovingFocal(args: PinchAroundMovingFocalInput): CameraState {
  'worklet';
  const zoomed = zoomAroundFocal({
    scale: args.scale,
    tx: args.tx,
    ty: args.ty,
    nextScale: args.nextScale,
    focalX: args.startFocalX,
    focalY: args.startFocalY,
    left: args.left,
    top: args.top,
    minScale: args.minScale,
    maxScale: args.maxScale,
  });
  return {
    scale: zoomed.scale,
    tx: zoomed.tx + (args.focalX - args.startFocalX),
    ty: zoomed.ty + (args.focalY - args.startFocalY),
  };
}

/**
 * Allowed pan range. At fit (scale=1) translation is ~0. When zoomed, pan
 * range grows with the extra pixels, but a mild slice of the map
 * (default 15% of the shorter viewport side) always stays on screen.
 * No letterbox lock: pinch-around-fingers must not yank back at 1.1–1.5x.
 */
export function translationBounds(
  scale: number,
  layout: CameraLayout,
  minOverlapFraction: number = MIN_OVERLAP_FRACTION,
): TranslationBounds {
  'worklet';
  if (scale <= 1) {
    return { minTx: 0, maxTx: 0, minTy: 0, maxTy: 0 };
  }

  const vw = layout.viewportW;
  const vh = layout.viewportH;
  const sw = layout.mapW * scale;
  const sh = layout.mapH * scale;
  const minOverlap = minOverlapFraction * Math.min(vw, vh);

  const needX = Math.min(minOverlap, sw);
  let minX0 = needX - sw;
  let maxX0 = vw - needX;
  if (minX0 > maxX0) {
    const centered = (vw - sw) / 2;
    minX0 = centered;
    maxX0 = centered;
  }

  const needY = Math.min(minOverlap, sh);
  let minY0 = needY - sh;
  let maxY0 = vh - needY;
  if (minY0 > maxY0) {
    const centered = (vh - sh) / 2;
    minY0 = centered;
    maxY0 = centered;
  }

  return {
    minTx: minX0 - layout.left,
    maxTx: maxX0 - layout.left,
    minTy: minY0 - layout.top,
    maxTy: maxY0 - layout.top,
  };
}

export function clampTranslation(
  state: CameraState,
  layout: CameraLayout,
  minOverlapFraction: number = MIN_OVERLAP_FRACTION,
): CameraState {
  'worklet';
  const bounds = translationBounds(state.scale, layout, minOverlapFraction);
  return {
    scale: state.scale,
    tx: clamp(state.tx, bounds.minTx, bounds.maxTx),
    ty: clamp(state.ty, bounds.minTy, bounds.maxTy),
  };
}

/** Diminishing overscroll so a fling/pinch can rubber-band, then snap back. */
export function rubberBand(value: number, min: number, max: number, band: number = RUBBER_BAND_PIXELS) {
  'worklet';
  if (max < min) return (min + max) / 2;
  if (value < min) {
    const extra = min - value;
    return min - (extra * band) / (band + extra);
  }
  if (value > max) {
    const extra = value - max;
    return max + (extra * band) / (band + extra);
  }
  return value;
}

export function rubberBandTranslation(state: CameraState, layout: CameraLayout): CameraState {
  'worklet';
  const bounds = translationBounds(state.scale, layout);
  return {
    scale: state.scale,
    tx: rubberBand(state.tx, bounds.minTx, bounds.maxTx),
    ty: rubberBand(state.ty, bounds.minTy, bounds.maxTy),
  };
}

/** Place a map-local pixel at a viewport focal point. */
export function cameraForMapPoint(args: MapPointInput): CameraState {
  'worklet';
  return {
    scale: args.scale,
    tx: args.focalX - args.left - args.mapX * args.scale,
    ty: args.focalY - args.top - args.mapY * args.scale,
  };
}

/**
 * Search fly-to: same framing as before (scale 280ms, reserved bottom),
 * then clamp so the camera stays in bounds.
 */
export function flyToRect(args: FlyToRectInput): CameraState {
  'worklet';
  const usableH = Math.max(args.viewportH - args.reservedBottom, 160);
  const cx = ((args.rectX + args.rectW / 2) / 100) * args.mapW;
  const cy = ((args.rectY + args.rectH / 2) / 100) * args.mapH;
  const boxW = Math.max((args.rectW / 100) * args.mapW, 18);
  const boxH = Math.max((args.rectH / 100) * args.mapH, 18);
  const nextScale = args.mild
    ? clamp(Math.min(args.viewportW / (boxW * 0.92), usableH / (boxH * 1.05), 3.15), 2.05, 3.15)
    : clamp(Math.min(args.viewportW / (boxW * 5), usableH / (boxH * 5), MAX_SCALE), 1.85, 3.4);
  const cam = cameraForMapPoint({
    mapX: cx,
    mapY: cy,
    scale: nextScale,
    focalX: args.viewportW / 2,
    focalY: usableH * 0.46,
    left: args.left,
    top: args.top,
  });
  return clampTranslation(cam, {
    viewportW: args.viewportW,
    viewportH: args.viewportH,
    mapW: args.mapW,
    mapH: args.mapH,
    left: args.left,
    top: args.top,
  });
}

/** One friction step; withDecay does the live inertia. */
export function decayStep(velocity: number, dtMs: number, deceleration: number = 0.998) {
  'worklet';
  return velocity * Math.pow(deceleration, Math.max(dtMs, 0));
}

export function mapPointUnderFocal(args: FocalQuery) {
  'worklet';
  const s = args.scale === 0 ? 1 : args.scale;
  return {
    x: (args.focalX - args.left - args.tx) / s,
    y: (args.focalY - args.top - args.ty) / s,
  };
}
