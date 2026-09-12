import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, Platform, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withDecay, withTiming } from 'react-native-reanimated';
import colors from '../theme/colors';
import { groundsLayerLayout, groundsPaintViewport } from '../config/groundsLayout';
import { GROUNDS_MAP, GROUNDS_ZONES, GroundsZone, hitTestGroundsZone, resolveGroundsZone } from '../config/groundsZones';
import {
  clampTranslation, DOUBLE_TAP_SCALE, flyToRect, mapPointUnderFocal, pinchAroundMovingFocal,
  rubberBandTranslation, translationBounds, zoomAroundFocal,
} from '../config/tentedCityCamera';

const MAP_SOURCE = require('../../assets/images/grounds-site-map.jpg');
const INFO_CARD_BOTTOM = 68;
/** Same language as MNP stage parent-fallback highlight. */
const SELECTED_FILL = 'rgba(0, 229, 255, 0.45)';
const SELECTED_OUTER = '#FFD600';
const SELECTED_INNER = '#FFFFFF';
const WEB_TOUCH_LOCK = { touchAction: 'none', overscrollBehavior: 'none', userSelect: 'none' } as object;
type Pt = { x: number; y: number };
type DomTarget = {
  addEventListener: (type: string, listener: (event: any) => void, options?: any) => void;
  removeEventListener: (type: string, listener: (event: any) => void, options?: any) => void;
  getBoundingClientRect: () => { left: number; top: number };
};

function resolveDomNode(ref: unknown): DomTarget | null {
  if (!ref || typeof ref !== 'object') return null;
  const node = ref as any;
  if (typeof node.addEventListener === 'function' && typeof node.removeEventListener === 'function' && typeof node.getBoundingClientRect === 'function') return node;
  const inner = node._nativeNode ?? (typeof node.getNode === 'function' ? node.getNode() : null);
  return inner && inner !== ref ? resolveDomNode(inner) : null;
}

function ZoneHighlight({ zone }: { zone: GroundsZone }) {
  const poly = zone.polygon;
  if (Platform.OS === 'web' && poly && poly.length >= 3) {
    const points = poly.map(([x, y]) => `${x},${y}`).join(' ');
    // viewBox is percent space (0–100) matching overlay % coords on the artwork.
    return React.createElement(
      'svg',
      {
        viewBox: '0 0 100 100',
        preserveAspectRatio: 'none',
        'data-testid': `grounds-zone-highlight-${zone.id}`,
        style: {
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
          pointerEvents: 'none',
        },
      },
      React.createElement('polygon', {
        points,
        fill: SELECTED_FILL,
        stroke: SELECTED_OUTER,
        strokeWidth: 0.95,
        strokeLinejoin: 'round',
      }),
      React.createElement('polygon', {
        points,
        fill: 'none',
        stroke: SELECTED_INNER,
        strokeWidth: 0.28,
        strokeLinejoin: 'round',
      }),
    );
  }
  return (
    <View
      testID={`grounds-zone-highlight-${zone.id}`}
      pointerEvents="none"
      style={[
        styles.halo,
        {
          left: `${zone.rect.x}%`,
          top: `${zone.rect.y}%`,
          width: `${zone.rect.w}%`,
          height: `${zone.rect.h}%`,
        },
      ]}
    >
      <View style={styles.haloInner} />
    </View>
  );
}

export default function GroundsMap({ highlightedLocation, onSwitchToTented }: {
  highlightedLocation?: string | null;
  onSwitchToTented: () => void;
}) {
  const viewportRef = useRef<View>(null);
  const windowSize = useWindowDimensions();
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const [selected, setSelected] = useState<GroundsZone | null>(null);
  const viewport = groundsPaintViewport(measured, windowSize);
  const layer = useMemo(() => groundsLayerLayout(viewport), [viewport.width, viewport.height]);
  const scale = useSharedValue(1), tx = useSharedValue(0), ty = useSharedValue(0);
  const startScale = useSharedValue(1), startX = useSharedValue(0), startY = useSharedValue(0);
  const startFocalX = useSharedValue(0), startFocalY = useSharedValue(0);
  const viewW = useSharedValue(1), viewH = useSharedValue(1), mapW = useSharedValue(1), mapH = useSharedValue(1);
  const originX = useSharedValue(0), originY = useSharedValue(0);

  useEffect(() => {
    viewW.value = viewport.width; viewH.value = viewport.height;
    mapW.value = layer.width; mapH.value = layer.height;
    originX.value = layer.left; originY.value = layer.top;
  }, [viewport.width, viewport.height, layer.width, layer.height, layer.left, layer.top]);

  const flyTo = useCallback((zone: GroundsZone) => {
    const cam = flyToRect({
      rectX: zone.rect.x, rectY: zone.rect.y, rectW: zone.rect.w, rectH: zone.rect.h,
      viewportW: viewport.width, viewportH: viewport.height, mapW: layer.width, mapH: layer.height,
      left: layer.left, top: layer.top, reservedBottom: zone.action === 'info' ? 132 : 60, mild: true,
    });
    cancelAnimation(scale); cancelAnimation(tx); cancelAnimation(ty);
    scale.value = withTiming(cam.scale, { duration: 280 });
    tx.value = withTiming(cam.tx, { duration: 280 });
    ty.value = withTiming(cam.ty, { duration: 280 });
  }, [viewport.width, viewport.height, layer.width, layer.height, layer.left, layer.top]);

  const chooseZone = useCallback((zone: GroundsZone | null) => {
    if (!zone) return;
    setSelected(zone);
    flyTo(zone);
    if (zone.action === 'switch-tented') setTimeout(onSwitchToTented, 280);
  }, [flyTo, onSwitchToTented]);

  const hitViewportPoint = useCallback((x: number, y: number) => {
    const point = mapPointUnderFocal({ scale: scale.value, tx: tx.value, ty: ty.value, focalX: x, focalY: y, left: layer.left, top: layer.top });
    chooseZone(hitTestGroundsZone((point.x / layer.width) * 100, (point.y / layer.height) * 100));
  }, [chooseZone, layer.left, layer.top, layer.width, layer.height]);

  useEffect(() => {
    const zone = resolveGroundsZone(highlightedLocation);
    if (!zone) return;
    setSelected(zone);
    flyTo(zone);
  }, [highlightedLocation, viewport.width]);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const node = resolveDomNode(viewportRef.current);
    if (!node) return undefined;
    const pointers = new Map<string, Pt>();
    let fromTouch = false, moved = false;
    let mode: 'none' | 'pan' | 'pinch' = 'none';
    let baseScale = 1, baseX = 0, baseY = 0, focalX = 0, focalY = 0, span = 1;
    let origin: Pt = { x: 0, y: 0 };
    let lastTapAt = 0, lastTapX = 0, lastTapY = 0;
    const layout = () => ({ viewportW: viewW.value, viewportH: viewH.value, mapW: mapW.value, mapH: mapH.value, left: originX.value, top: originY.value });
    const local = (x: number, y: number) => { const box = node.getBoundingClientRect(); return { x: x - box.left, y: y - box.top }; };
    const list = () => Array.from(pointers.values());
    const middle = () => { const p = list(); return p.length > 1 ? { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 } : p[0] || { x: 0, y: 0 }; };
    const distance = () => { const p = list(); return p.length > 1 ? Math.max(Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y), 1) : 1; };
    const applyDoubleTap = (fx: number, fy: number) => {
      cancelAnimation(scale); cancelAnimation(tx); cancelAnimation(ty);
      if (scale.value > 1.2) {
        scale.value = withTiming(1, { duration: 220 }); tx.value = withTiming(0, { duration: 220 }); ty.value = withTiming(0, { duration: 220 });
      } else {
        const next = zoomAroundFocal({
          scale: scale.value, tx: tx.value, ty: ty.value, nextScale: DOUBLE_TAP_SCALE,
          focalX: fx, focalY: fy, left: originX.value, top: originY.value,
        });
        const cam = clampTranslation(next, layout());
        scale.value = withTiming(cam.scale, { duration: 220 }); tx.value = withTiming(cam.tx, { duration: 220 }); ty.value = withTiming(cam.ty, { duration: 220 });
      }
    };
    // Port of TentedCityMap finishWebGesture: only settle when out of bounds / under-zoomed.
    const finishWebGesture = () => {
      const lay = layout();
      if (scale.value < 1) {
        scale.value = withTiming(1, { duration: 200 }); tx.value = withTiming(0, { duration: 200 }); ty.value = withTiming(0, { duration: 200 });
        return;
      }
      if (scale.value <= 1) { tx.value = 0; ty.value = 0; return; }
      const bounds = translationBounds(scale.value, lay);
      const outside = tx.value < bounds.minTx || tx.value > bounds.maxTx || ty.value < bounds.minTy || ty.value > bounds.maxTy;
      if (!outside) return;
      const cam = clampTranslation({ scale: scale.value, tx: tx.value, ty: ty.value }, lay);
      tx.value = withTiming(cam.tx, { duration: 180 }); ty.value = withTiming(cam.ty, { duration: 180 });
    };
    const begin = () => {
      cancelAnimation(scale); cancelAnimation(tx); cancelAnimation(ty);
      baseScale = scale.value; baseX = tx.value; baseY = ty.value; moved = false;
      const mid = middle(); focalX = mid.x; focalY = mid.y; origin = mid;
      if (pointers.size >= 2) { mode = 'pinch'; span = distance(); }
      else if (pointers.size === 1) { mode = 'pan'; if (baseScale <= 1) { baseX = 0; baseY = 0; tx.value = 0; ty.value = 0; } }
      else mode = 'none';
    };
    const move = () => {
      const mid = middle();
      if (mode === 'pinch' && pointers.size >= 2) {
        const ratio = distance() / span;
        const next = pinchAroundMovingFocal({
          scale: baseScale, tx: baseX, ty: baseY, nextScale: baseScale * ratio,
          startFocalX: focalX, startFocalY: focalY, focalX: mid.x, focalY: mid.y,
          left: originX.value, top: originY.value,
        });
        scale.value = next.scale; tx.value = next.tx; ty.value = next.ty;
        moved ||= Math.abs(ratio - 1) > 0.02 || Math.hypot(mid.x - focalX, mid.y - focalY) > 8;
      } else if (mode === 'pan' && pointers.size === 1) {
        moved ||= Math.hypot(mid.x - origin.x, mid.y - origin.y) > 8;
        if (baseScale <= 1) return;
        const soft = rubberBandTranslation({ scale: baseScale, tx: baseX + mid.x - focalX, ty: baseY + mid.y - focalY }, layout());
        tx.value = soft.tx; ty.value = soft.ty;
      }
    };
    const lift = () => {
      if (pointers.size) { const pinching = mode === 'pinch'; begin(); if (pinching) moved = true; return; }
      const wasTap = mode === 'pan' && !moved;
      const tap = { x: focalX, y: focalY };
      finishWebGesture();
      mode = 'none'; fromTouch = false;
      if (wasTap) {
        const now = Date.now();
        if (now - lastTapAt < 300 && Math.hypot(tap.x - lastTapX, tap.y - lastTapY) < 28) {
          lastTapAt = 0;
          applyDoubleTap(tap.x, tap.y);
        } else {
          lastTapAt = now; lastTapX = tap.x; lastTapY = tap.y;
          hitViewportPoint(tap.x, tap.y);
        }
      }
    };
    const wheel = (e: any) => {
      e.preventDefault(); const p = local(e.clientX, e.clientY);
      const next = zoomAroundFocal({
        scale: scale.value, tx: tx.value, ty: ty.value, nextScale: scale.value * Math.exp(-e.deltaY * 0.0018),
        focalX: p.x, focalY: p.y, left: originX.value, top: originY.value,
      });
      const cam = next.scale < 1 ? { scale: 1, tx: 0, ty: 0 } : clampTranslation(next, layout());
      scale.value = cam.scale; tx.value = cam.tx; ty.value = cam.ty;
    };
    const touchStart = (e: any) => { fromTouch = true; for (const t of e.changedTouches) pointers.set('t' + t.identifier, local(t.clientX, t.clientY)); begin(); };
    const touchMove = (e: any) => { e.preventDefault(); fromTouch = true; for (const t of e.changedTouches) pointers.set('t' + t.identifier, local(t.clientX, t.clientY)); move(); };
    const touchEnd = (e: any) => { for (const t of e.changedTouches) pointers.delete('t' + t.identifier); lift(); };
    const pointerDown = (e: any) => { if (fromTouch) return; pointers.set('p' + e.pointerId, local(e.clientX, e.clientY)); begin(); };
    const pointerMove = (e: any) => { if (fromTouch || !pointers.has('p' + e.pointerId)) return; pointers.set('p' + e.pointerId, local(e.clientX, e.clientY)); move(); };
    const pointerUp = (e: any) => { if (fromTouch) return; pointers.delete('p' + e.pointerId); lift(); };
    const capture = { passive: false, capture: true };
    node.addEventListener('wheel', wheel, { passive: false });
    node.addEventListener('pointerdown', pointerDown, capture); node.addEventListener('pointermove', pointerMove, capture); node.addEventListener('pointerup', pointerUp, capture); node.addEventListener('pointercancel', pointerUp, capture);
    node.addEventListener('touchstart', touchStart, capture); node.addEventListener('touchmove', touchMove, capture); node.addEventListener('touchend', touchEnd, capture); node.addEventListener('touchcancel', touchEnd, capture);
    return () => {
      node.removeEventListener('wheel', wheel); node.removeEventListener('pointerdown', pointerDown, capture); node.removeEventListener('pointermove', pointerMove, capture); node.removeEventListener('pointerup', pointerUp, capture); node.removeEventListener('pointercancel', pointerUp, capture);
      node.removeEventListener('touchstart', touchStart, capture); node.removeEventListener('touchmove', touchMove, capture); node.removeEventListener('touchend', touchEnd, capture); node.removeEventListener('touchcancel', touchEnd, capture);
    };
  }, [viewport.width, viewport.height, hitViewportPoint]);

  const pinch = Gesture.Pinch().onBegin((e) => {
    cancelAnimation(scale); cancelAnimation(tx); cancelAnimation(ty);
    startScale.value = scale.value; startX.value = tx.value; startY.value = ty.value; startFocalX.value = e.focalX; startFocalY.value = e.focalY;
  }).onUpdate((e) => {
    const next = pinchAroundMovingFocal({
      scale: startScale.value, tx: startX.value, ty: startY.value, nextScale: startScale.value * e.scale,
      startFocalX: startFocalX.value, startFocalY: startFocalY.value, focalX: e.focalX, focalY: e.focalY,
      left: originX.value, top: originY.value,
    });
    scale.value = next.scale; tx.value = next.tx; ty.value = next.ty;
  }).onEnd(() => {
    const lay = { viewportW: viewW.value, viewportH: viewH.value, mapW: mapW.value, mapH: mapH.value, left: originX.value, top: originY.value };
    if (scale.value < 1) {
      scale.value = withTiming(1); tx.value = withTiming(0); ty.value = withTiming(0);
      return;
    }
    const bounds = translationBounds(scale.value, lay);
    const outside = tx.value < bounds.minTx || tx.value > bounds.maxTx || ty.value < bounds.minTy || ty.value > bounds.maxTy;
    if (!outside) return;
    const cam = clampTranslation({ scale: scale.value, tx: tx.value, ty: ty.value }, lay);
    tx.value = withTiming(cam.tx); ty.value = withTiming(cam.ty);
  });
  const pan = Gesture.Pan().minPointers(1).maxPointers(1).onBegin(() => {
    startX.value = tx.value; startY.value = ty.value;
  }).onUpdate((e) => {
    if (scale.value <= 1) return;
    const soft = rubberBandTranslation({
      scale: scale.value, tx: startX.value + e.translationX, ty: startY.value + e.translationY,
    }, { viewportW: viewW.value, viewportH: viewH.value, mapW: mapW.value, mapH: mapH.value, left: originX.value, top: originY.value });
    tx.value = soft.tx; ty.value = soft.ty;
  }).onEnd((e) => {
    if (scale.value <= 1) { tx.value = 0; ty.value = 0; return; }
    const bounds = translationBounds(scale.value, {
      viewportW: viewW.value, viewportH: viewH.value, mapW: mapW.value, mapH: mapH.value, left: originX.value, top: originY.value,
    });
    tx.value = withDecay({ velocity: e.velocityX, clamp: [bounds.minTx, bounds.maxTx], rubberBandEffect: true, rubberBandFactor: 0.55, deceleration: 0.996 });
    ty.value = withDecay({ velocity: e.velocityY, clamp: [bounds.minTy, bounds.maxTy], rubberBandEffect: true, rubberBandFactor: 0.55, deceleration: 0.996 });
  });
  const tap = Gesture.Tap().maxDuration(250).onEnd((e, ok) => { if (ok) runOnJS(hitViewportPoint)(e.x, e.y); });
  const doubleTap = Gesture.Tap().numberOfTaps(2).maxDuration(280).onEnd((e, ok) => {
    if (!ok) return;
    cancelAnimation(scale); cancelAnimation(tx); cancelAnimation(ty);
    if (scale.value > 1.2) {
      scale.value = withTiming(1, { duration: 220 }); tx.value = withTiming(0, { duration: 220 }); ty.value = withTiming(0, { duration: 220 });
      return;
    }
    const next = zoomAroundFocal({
      scale: scale.value, tx: tx.value, ty: ty.value, nextScale: DOUBLE_TAP_SCALE,
      focalX: e.x, focalY: e.y, left: originX.value, top: originY.value,
    });
    const cam = clampTranslation(next, {
      viewportW: viewW.value, viewportH: viewH.value, mapW: mapW.value, mapH: mapH.value, left: originX.value, top: originY.value,
    });
    scale.value = withTiming(cam.scale, { duration: 220 }); tx.value = withTiming(cam.tx, { duration: 220 }); ty.value = withTiming(cam.ty, { duration: 220 });
  });
  pinch.blocksExternalGesture(pan);
  doubleTap.blocksExternalGesture(tap);
  const composed = Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, tap));
  const cameraStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));
  const webLock = Platform.OS === 'web' ? WEB_TOUCH_LOCK : null;
  const map = (
    <Animated.View style={[styles.gestureRoot, webLock]} collapsable={false}>
      <Animated.View style={[styles.layer, { width: layer.width, height: layer.height, left: layer.left, top: layer.top, transformOrigin: 'top left' }, cameraStyle]}>
        <Image source={MAP_SOURCE} resizeMode="stretch" style={styles.image} />
        {selected ? <ZoneHighlight zone={selected} /> : null}
      </Animated.View>
    </Animated.View>
  );
  const reset = () => {
    setSelected(null);
    cancelAnimation(scale); cancelAnimation(tx); cancelAnimation(ty);
    scale.value = withTiming(1, { duration: 220 });
    tx.value = withTiming(0, { duration: 220 });
    ty.value = withTiming(0, { duration: 220 });
  };
  const onLayout = (e: LayoutChangeEvent) => { const { width, height } = e.nativeEvent.layout; if (width > 1 && height > 1) setMeasured({ width, height }); };

  return <View style={styles.root}>
    <View ref={viewportRef} style={[styles.viewport, webLock]} onLayout={onLayout} collapsable={false}>
      {Platform.OS === 'web' ? map : <GestureDetector gesture={composed}>{map}</GestureDetector>}
    </View>
    <TouchableOpacity style={styles.reset} onPress={reset} accessibilityLabel="Fit map to grounds" testID="grounds-fit-reset">
      <Feather name="maximize-2" size={18} color={colors.textPrimary} />
    </TouchableOpacity>
    {selected?.action === 'info' ? (
      <View style={styles.card} pointerEvents="box-none" testID="grounds-info-card">
        <View style={styles.cardInner} pointerEvents="auto">
          <View style={styles.cardRow}>
            <View style={styles.cardCopy}>
              <Text style={styles.title}>{selected.label}</Text>
              <Text style={styles.fact}>{selected.fact}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelected(null)} accessibilityLabel="Dismiss">
              <Feather name="x" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    ) : (
      <View style={styles.hint} pointerEvents="none">
        <Text style={styles.hintText}>Drag · pinch · double-tap · tap a map area</Text>
      </View>
    )}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', height: '100%', position: 'relative', backgroundColor: '#D9D1BE' },
  viewport: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  gestureRoot: { ...StyleSheet.absoluteFillObject },
  layer: { position: 'absolute', overflow: 'visible' },
  image: { width: '100%', height: '100%' },
  halo: {
    position: 'absolute',
    marginLeft: -2,
    marginTop: -2,
    borderWidth: 4,
    borderColor: SELECTED_OUTER,
    backgroundColor: SELECTED_FILL,
    borderRadius: 2,
  },
  haloInner: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: SELECTED_INNER,
  },
  reset: {
    position: 'absolute', right: 12, bottom: 108, width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', elevation: 4,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, zIndex: 5,
  },
  card: { position: 'absolute', left: 12, right: 12, bottom: INFO_CARD_BOTTOM, zIndex: 6 },
  cardInner: {
    padding: 14, borderRadius: 16, backgroundColor: '#FFF', elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardCopy: { flex: 1, paddingRight: 8 },
  title: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  fact: { marginTop: 4, fontSize: 14, color: colors.textSecondary },
  hint: {
    position: 'absolute', alignSelf: 'center', bottom: 72, backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, zIndex: 4,
  },
  hintText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
});

// Keep map asset dimensions referenced for audits / tree-shaking clarity.
void GROUNDS_MAP;
