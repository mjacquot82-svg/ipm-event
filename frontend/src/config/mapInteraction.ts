/**
 * Shared map interaction primitives — extracted from TentedCityMap (reference).
 * GroundsMap and TentedCityMap must reuse these so physical feel stays aligned.
 */
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  runOnJS,
  withDecay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {
  clampTranslation,
  DOUBLE_TAP_SCALE,
  MAX_SCALE,
  pinchAroundMovingFocal,
  rubberBandTranslation,
  translationBounds,
  zoomAroundFocal,
  type CameraLayout,
} from './tentedCityCamera';

export const WEB_TOUCH_LOCK = {
  touchAction: 'none',
  overscrollBehavior: 'none',
  userSelect: 'none',
} as object;

export const MAP_DECAY = {
  rubberBandEffect: true as const,
  rubberBandFactor: 0.55,
  deceleration: 0.996,
};

type Pt = { x: number; y: number };

type DomListener = (event: any) => void;
type DomListenOpts = { passive?: boolean; capture?: boolean };
export type DomTarget = {
  addEventListener: (type: string, listener: DomListener, options?: DomListenOpts) => void;
  removeEventListener: (type: string, listener: DomListener, options?: DomListenOpts) => void;
  getBoundingClientRect: () => { left: number; top: number };
};

export function resolveDomNode(ref: unknown): DomTarget | null {
  if (!ref || typeof ref !== 'object') return null;
  const node = ref as {
    addEventListener?: unknown;
    removeEventListener?: unknown;
    getBoundingClientRect?: unknown;
    _nativeNode?: unknown;
    getNode?: () => unknown;
  };
  if (
    typeof node.addEventListener === 'function'
    && typeof node.removeEventListener === 'function'
    && typeof node.getBoundingClientRect === 'function'
  ) {
    return node as DomTarget;
  }
  const inner = node._nativeNode ?? (typeof node.getNode === 'function' ? node.getNode() : null);
  return inner && inner !== ref ? resolveDomNode(inner) : null;
}

export type MapCameraShared = {
  scale: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  startScale: SharedValue<number>;
  startX: SharedValue<number>;
  startY: SharedValue<number>;
  startFocalX: SharedValue<number>;
  startFocalY: SharedValue<number>;
  viewW: SharedValue<number>;
  viewH: SharedValue<number>;
  mapW: SharedValue<number>;
  mapH: SharedValue<number>;
  originX: SharedValue<number>;
  originY: SharedValue<number>;
};

export type MapInteractionOptions = {
  /** Optional single-tap hit (Grounds zones). TC leaves this unset. */
  onSingleTap?: (x: number, y: number) => void;
  /** Defaults to tentedCityCamera MAX_SCALE — do not invent per-map ceilings. */
  maxScale?: number;
};

function readLayout(cam: MapCameraShared): CameraLayout {
  'worklet';
  return {
    viewportW: cam.viewW.value,
    viewportH: cam.viewH.value,
    mapW: cam.mapW.value,
    mapH: cam.mapH.value,
    left: cam.originX.value,
    top: cam.originY.value,
  };
}

/** Settle after web pinch/pan: clamp only when under-zoomed or outside bounds. */
export function finishWebGesture(cam: MapCameraShared) {
  const layout = {
    viewportW: cam.viewW.value,
    viewportH: cam.viewH.value,
    mapW: cam.mapW.value,
    mapH: cam.mapH.value,
    left: cam.originX.value,
    top: cam.originY.value,
  };
  if (cam.scale.value < 1) {
    cam.scale.value = withTiming(1, { duration: 200 });
    cam.tx.value = withTiming(0, { duration: 200 });
    cam.ty.value = withTiming(0, { duration: 200 });
    return;
  }
  if (cam.scale.value <= 1) {
    cam.tx.value = 0;
    cam.ty.value = 0;
    return;
  }
  const bounds = translationBounds(cam.scale.value, layout);
  const outside =
    cam.tx.value < bounds.minTx
    || cam.tx.value > bounds.maxTx
    || cam.ty.value < bounds.minTy
    || cam.ty.value > bounds.maxTy;
  if (!outside) return;
  const next = clampTranslation(
    { scale: cam.scale.value, tx: cam.tx.value, ty: cam.ty.value },
    layout,
  );
  cam.tx.value = withTiming(next.tx, { duration: 180 });
  cam.ty.value = withTiming(next.ty, { duration: 180 });
}

export function applyDoubleTapZoom(cam: MapCameraShared, focalX: number, focalY: number, maxScale: number = MAX_SCALE) {
  cancelAnimation(cam.scale);
  cancelAnimation(cam.tx);
  cancelAnimation(cam.ty);
  if (cam.scale.value > 1.2) {
    cam.scale.value = withTiming(1, { duration: 220 });
    cam.tx.value = withTiming(0, { duration: 220 });
    cam.ty.value = withTiming(0, { duration: 220 });
    return;
  }
  const layout = {
    viewportW: cam.viewW.value,
    viewportH: cam.viewH.value,
    mapW: cam.mapW.value,
    mapH: cam.mapH.value,
    left: cam.originX.value,
    top: cam.originY.value,
  };
  const next = zoomAroundFocal({
    scale: cam.scale.value,
    tx: cam.tx.value,
    ty: cam.ty.value,
    nextScale: DOUBLE_TAP_SCALE,
    focalX,
    focalY,
    left: cam.originX.value,
    top: cam.originY.value,
    maxScale,
  });
  const settled = clampTranslation(next, layout);
  cam.scale.value = withTiming(settled.scale, { duration: 220 });
  cam.tx.value = withTiming(settled.tx, { duration: 220 });
  cam.ty.value = withTiming(settled.ty, { duration: 220 });
}

/** Fit / reset camera to full map (scale 1, translation 0). */
export function resetMapCamera(cam: Pick<MapCameraShared, 'scale' | 'tx' | 'ty'>, duration = 220) {
  cancelAnimation(cam.scale);
  cancelAnimation(cam.tx);
  cancelAnimation(cam.ty);
  cam.scale.value = withTiming(1, { duration });
  cam.tx.value = withTiming(0, { duration });
  cam.ty.value = withTiming(0, { duration });
}

/**
 * Attach TC-equivalent pointer/touch/wheel handlers to a DOM viewport.
 * Returns a cleanup function.
 */
export function attachWebMapGestures(
  node: DomTarget,
  cam: MapCameraShared,
  options: MapInteractionOptions = {},
): () => void {
  const maxScale = options.maxScale ?? MAX_SCALE;
  const onSingleTap = options.onSingleTap;
  const pointers = new Map<string, Pt>();
  let fromTouch = false;
  let mode: 'none' | 'pan' | 'pinch' = 'none';
  let startCamScale = 1;
  let startCamX = 0;
  let startCamY = 0;
  let beginFocalX = 0;
  let beginFocalY = 0;
  let beginSpan = 1;
  let originPt: Pt = { x: 0, y: 0 };
  let moved = false;
  let lastTapAt = 0;
  let lastTapX = 0;
  let lastTapY = 0;
  let suppressClick = false;

  const currentLayout = (): CameraLayout => ({
    viewportW: cam.viewW.value,
    viewportH: cam.viewH.value,
    mapW: cam.mapW.value,
    mapH: cam.mapH.value,
    left: cam.originX.value,
    top: cam.originY.value,
  });
  const toLocal = (clientX: number, clientY: number): Pt => {
    const box = node.getBoundingClientRect();
    return { x: clientX - box.left, y: clientY - box.top };
  };
  const listed = () => Array.from(pointers.values());
  const midpoint = (): Pt => {
    const pts = listed();
    if (pts.length >= 2) return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    if (pts.length === 1) return pts[0];
    return { x: 0, y: 0 };
  };
  const spanOf = () => {
    const pts = listed();
    if (pts.length < 2) return 1;
    return Math.max(Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y), 1);
  };

  const beginFromPointers = () => {
    cancelAnimation(cam.scale);
    cancelAnimation(cam.tx);
    cancelAnimation(cam.ty);
    startCamScale = cam.scale.value;
    startCamX = cam.tx.value;
    startCamY = cam.ty.value;
    moved = false;
    if (pointers.size >= 2) {
      mode = 'pinch';
      const m = midpoint();
      beginFocalX = m.x;
      beginFocalY = m.y;
      beginSpan = spanOf();
    } else if (pointers.size === 1) {
      mode = 'pan';
      const m = midpoint();
      beginFocalX = m.x;
      beginFocalY = m.y;
      originPt = m;
      if (startCamScale <= 1) {
        cam.tx.value = 0;
        cam.ty.value = 0;
        startCamX = 0;
        startCamY = 0;
      }
    } else {
      mode = 'none';
    }
  };

  const applyWebGesture = () => {
    if (mode === 'pinch' && pointers.size >= 2) {
      const m = midpoint();
      const next = pinchAroundMovingFocal({
        scale: startCamScale,
        tx: startCamX,
        ty: startCamY,
        nextScale: startCamScale * (spanOf() / beginSpan),
        startFocalX: beginFocalX,
        startFocalY: beginFocalY,
        focalX: m.x,
        focalY: m.y,
        left: cam.originX.value,
        top: cam.originY.value,
        maxScale,
      });
      cam.scale.value = next.scale;
      cam.tx.value = next.tx;
      cam.ty.value = next.ty;
      if (Math.hypot(m.x - beginFocalX, m.y - beginFocalY) > 8 || Math.abs(spanOf() / beginSpan - 1) > 0.02) {
        moved = true;
      }
    } else if (mode === 'pan' && pointers.size === 1) {
      const m = midpoint();
      if (Math.hypot(m.x - originPt.x, m.y - originPt.y) > 8) moved = true;
      if (startCamScale <= 1) {
        cam.tx.value = 0;
        cam.ty.value = 0;
        return;
      }
      const soft = rubberBandTranslation({
        scale: startCamScale,
        tx: startCamX + (m.x - beginFocalX),
        ty: startCamY + (m.y - beginFocalY),
      }, currentLayout());
      cam.tx.value = soft.tx;
      cam.ty.value = soft.ty;
    }
  };

  const onLift = () => {
    if (pointers.size === 0) {
      const wasMode = mode;
      const wasMoved = moved;
      const tapX = beginFocalX;
      const tapY = beginFocalY;
      finishWebGesture(cam);
      mode = 'none';
      fromTouch = false;
      if (!wasMoved && wasMode === 'pan') {
        const now = Date.now();
        if (now - lastTapAt < 300 && Math.hypot(tapX - lastTapX, tapY - lastTapY) < 28) {
          lastTapAt = 0;
          applyDoubleTapZoom(cam, tapX, tapY, maxScale);
        } else {
          lastTapAt = now;
          lastTapX = tapX;
          lastTapY = tapY;
          if (onSingleTap) onSingleTap(tapX, tapY);
        }
      }
    } else {
      const wasPinch = mode === 'pinch';
      beginFromPointers();
      if (wasPinch) moved = true;
    }
  };

  const onWheel = (event: { preventDefault: () => void; deltaY: number; clientX: number; clientY: number }) => {
    event.preventDefault();
    const box = node.getBoundingClientRect();
    const next = zoomAroundFocal({
      scale: cam.scale.value,
      tx: cam.tx.value,
      ty: cam.ty.value,
      nextScale: cam.scale.value * Math.exp(-event.deltaY * 0.0018),
      focalX: event.clientX - box.left,
      focalY: event.clientY - box.top,
      left: cam.originX.value,
      top: cam.originY.value,
      maxScale,
    });
    const layout = currentLayout();
    if (next.scale < 1) {
      cam.scale.value = 1;
      cam.tx.value = 0;
      cam.ty.value = 0;
      return;
    }
    const bounds = translationBounds(next.scale, layout);
    const outside =
      next.tx < bounds.minTx
      || next.tx > bounds.maxTx
      || next.ty < bounds.minTy
      || next.ty > bounds.maxTy;
    const settled = outside ? clampTranslation(next, layout) : next;
    cam.scale.value = settled.scale;
    cam.tx.value = settled.tx;
    cam.ty.value = settled.ty;
  };

  const onTouchStart = (event: any) => {
    fromTouch = true;
    for (const key of Array.from(pointers.keys())) {
      if (String(key).startsWith('p')) pointers.delete(key);
    }
    for (const t of event.changedTouches) {
      pointers.set('t' + t.identifier, toLocal(t.clientX, t.clientY));
    }
    beginFromPointers();
  };
  const onTouchMove = (event: any) => {
    event.preventDefault();
    fromTouch = true;
    for (const t of event.changedTouches) {
      pointers.set('t' + t.identifier, toLocal(t.clientX, t.clientY));
    }
    applyWebGesture();
  };
  const onTouchEnd = (event: any) => {
    if (moved) {
      event.preventDefault();
      event.stopPropagation();
    }
    for (const t of event.changedTouches) pointers.delete('t' + t.identifier);
    onLift();
  };
  const onPointerDown = (event: any) => {
    if (fromTouch) return;
    if (event.target && typeof event.target.setPointerCapture === 'function') {
      try { event.target.setPointerCapture(event.pointerId); } catch { /* Safari */ }
    }
    pointers.set('p' + event.pointerId, toLocal(event.clientX, event.clientY));
    beginFromPointers();
  };
  const onPointerMove = (event: any) => {
    if (fromTouch) return;
    const key = 'p' + event.pointerId;
    if (!pointers.has(key)) return;
    pointers.set(key, toLocal(event.clientX, event.clientY));
    applyWebGesture();
  };
  const onPointerUp = (event: any) => {
    if (fromTouch) return;
    if (moved) {
      suppressClick = true;
      event.preventDefault();
      event.stopPropagation();
    }
    pointers.delete('p' + event.pointerId);
    onLift();
  };
  const onClick = (event: any) => {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const capture = { passive: false, capture: true };
  node.addEventListener('wheel', onWheel, { passive: false });
  node.addEventListener('pointerdown', onPointerDown, capture);
  node.addEventListener('pointermove', onPointerMove, capture);
  node.addEventListener('pointerup', onPointerUp, capture);
  node.addEventListener('pointercancel', onPointerUp, capture);
  node.addEventListener('click', onClick, capture);
  node.addEventListener('touchstart', onTouchStart, capture);
  node.addEventListener('touchmove', onTouchMove, capture);
  node.addEventListener('touchend', onTouchEnd, capture);
  node.addEventListener('touchcancel', onTouchEnd, capture);

  return () => {
    node.removeEventListener('wheel', onWheel);
    node.removeEventListener('pointerdown', onPointerDown, capture);
    node.removeEventListener('pointermove', onPointerMove, capture);
    node.removeEventListener('pointerup', onPointerUp, capture);
    node.removeEventListener('pointercancel', onPointerUp, capture);
    node.removeEventListener('click', onClick, capture);
    node.removeEventListener('touchstart', onTouchStart, capture);
    node.removeEventListener('touchmove', onTouchMove, capture);
    node.removeEventListener('touchend', onTouchEnd, capture);
    node.removeEventListener('touchcancel', onTouchEnd, capture);
  };
}

/** Native (RNGH) pinch / pan / double-tap — same lifecycle as TentedCityMap. */
export function createMapNativeGestures(cam: MapCameraShared, options: MapInteractionOptions = {}) {
  const maxScale = options.maxScale ?? MAX_SCALE;
  const onSingleTap = options.onSingleTap;

  const pinch = Gesture.Pinch()
    .onBegin((e) => {
      cancelAnimation(cam.scale);
      cancelAnimation(cam.tx);
      cancelAnimation(cam.ty);
      cam.startScale.value = cam.scale.value;
      cam.startX.value = cam.tx.value;
      cam.startY.value = cam.ty.value;
      cam.startFocalX.value = e.focalX;
      cam.startFocalY.value = e.focalY;
    })
    .onUpdate((e) => {
      const next = pinchAroundMovingFocal({
        scale: cam.startScale.value,
        tx: cam.startX.value,
        ty: cam.startY.value,
        nextScale: cam.startScale.value * e.scale,
        startFocalX: cam.startFocalX.value,
        startFocalY: cam.startFocalY.value,
        focalX: e.focalX,
        focalY: e.focalY,
        left: cam.originX.value,
        top: cam.originY.value,
        maxScale,
      });
      cam.scale.value = next.scale;
      cam.tx.value = next.tx;
      cam.ty.value = next.ty;
    })
    .onEnd(() => {
      const layout = readLayout(cam);
      if (cam.scale.value < 1) {
        cam.scale.value = withTiming(1, { duration: 200 });
        cam.tx.value = withTiming(0, { duration: 200 });
        cam.ty.value = withTiming(0, { duration: 200 });
        return;
      }
      const bounds = translationBounds(cam.scale.value, layout);
      const outside =
        cam.tx.value < bounds.minTx
        || cam.tx.value > bounds.maxTx
        || cam.ty.value < bounds.minTy
        || cam.ty.value > bounds.maxTy;
      if (!outside) return;
      const settled = clampTranslation(
        { scale: cam.scale.value, tx: cam.tx.value, ty: cam.ty.value },
        layout,
      );
      cam.tx.value = withTiming(settled.tx, { duration: 180 });
      cam.ty.value = withTiming(settled.ty, { duration: 180 });
    });

  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onBegin(() => {
      cancelAnimation(cam.tx);
      cancelAnimation(cam.ty);
      if (cam.scale.value <= 1) {
        cam.tx.value = 0;
        cam.ty.value = 0;
        cam.startX.value = 0;
        cam.startY.value = 0;
        return;
      }
      cam.startX.value = cam.tx.value;
      cam.startY.value = cam.ty.value;
    })
    .onUpdate((e) => {
      if (cam.scale.value <= 1) {
        cam.tx.value = 0;
        cam.ty.value = 0;
        return;
      }
      const soft = rubberBandTranslation({
        scale: cam.scale.value,
        tx: cam.startX.value + e.translationX,
        ty: cam.startY.value + e.translationY,
      }, readLayout(cam));
      cam.tx.value = soft.tx;
      cam.ty.value = soft.ty;
    })
    .onEnd((e) => {
      if (cam.scale.value <= 1) {
        cam.tx.value = 0;
        cam.ty.value = 0;
        return;
      }
      const bounds = translationBounds(cam.scale.value, readLayout(cam));
      cam.tx.value = withDecay({
        velocity: e.velocityX,
        clamp: [bounds.minTx, bounds.maxTx],
        ...MAP_DECAY,
      });
      cam.ty.value = withDecay({
        velocity: e.velocityY,
        clamp: [bounds.minTy, bounds.maxTy],
        ...MAP_DECAY,
      });
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e, success) => {
      if (!success) return;
      cancelAnimation(cam.scale);
      cancelAnimation(cam.tx);
      cancelAnimation(cam.ty);
      if (cam.scale.value > 1.2) {
        cam.scale.value = withTiming(1, { duration: 220 });
        cam.tx.value = withTiming(0, { duration: 220 });
        cam.ty.value = withTiming(0, { duration: 220 });
        return;
      }
      const next = zoomAroundFocal({
        scale: cam.scale.value,
        tx: cam.tx.value,
        ty: cam.ty.value,
        nextScale: DOUBLE_TAP_SCALE,
        focalX: e.x,
        focalY: e.y,
        left: cam.originX.value,
        top: cam.originY.value,
        maxScale,
      });
      const settled = clampTranslation(next, readLayout(cam));
      cam.scale.value = withTiming(settled.scale, { duration: 220 });
      cam.tx.value = withTiming(settled.tx, { duration: 220 });
      cam.ty.value = withTiming(settled.ty, { duration: 220 });
    });

  pinch.blocksExternalGesture(pan);

  if (onSingleTap) {
    const tap = Gesture.Tap()
      .maxDuration(250)
      .onEnd((e, ok) => {
        if (ok) runOnJS(onSingleTap)(e.x, e.y);
      });
    doubleTap.blocksExternalGesture(tap);
    return Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, tap));
  }

  return Gesture.Simultaneous(pinch, pan, doubleTap);
}
