import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image, Keyboard, LayoutChangeEvent, Platform, StyleSheet, Text, TextInput,
  TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDecay, withTiming } from 'react-native-reanimated';
import colors from '../theme/colors';
import { rvParkLayerLayout, rvParkPaintViewport } from '../config/rvParkLayout';
import { rvParkSiteRect, type RvParkSite } from '../config/rvParkGeometry';
import { findRvParkPlace, normalizeRvSiteQuery, rvParkPlaceTitle, searchRvParkPlaces } from '../config/rvParkSearch';
import { boothHighlightStyle } from '../config/tentedCityHighlight';
import {
  clampTranslation, flyToRect, pinchAroundMovingFocal,
  rubberBandTranslation, translationBounds, zoomAroundFocal,
} from '../config/tentedCityCamera';

const MAP_SOURCE = require('../../assets/images/rv-park-detail-map.png');
const TAB_BAR_HEIGHT = 60;
const INFO_CARD_GAP = 8;
const INFO_CARD_BOTTOM = TAB_BAR_HEIGHT + INFO_CARD_GAP;
const SELECTED_RESERVED_BOTTOM = TAB_BAR_HEIGHT + 108;
/** Cyan / light-blue fill for exact campsite cell. */
const SITE_CELL_FILL = 'rgba(103, 232, 249, 0.55)';
/** Yellow outer border (boothHighlightStyle pattern). */
const SITE_CELL_BORDER = '#F5C518';
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

function SiteHighlight({ site, layer }: { site: RvParkSite; layer: { width: number; height: number } }) {
  const rect = rvParkSiteRect(site);
  const { borderWidth: edge, ...frame } = boothHighlightStyle(rect, layer, 3, 1);
  const stroke = { position: 'absolute' as const, backgroundColor: SITE_CELL_BORDER };
  return (
    <View testID="rv-site-highlight" pointerEvents="none" style={[styles.highlight, frame]}>
      <View style={{ position: 'absolute', top: edge, bottom: edge, left: edge, right: edge, backgroundColor: SITE_CELL_FILL }} />
      <View style={[stroke, { top: 0, left: 0, right: 0, height: edge }]} />
      <View style={[stroke, { bottom: 0, left: 0, right: 0, height: edge }]} />
      <View style={[stroke, { top: 0, bottom: 0, left: 0, width: edge }]} />
      <View style={[stroke, { top: 0, bottom: 0, right: 0, width: edge }]} />
    </View>
  );
}

export default function RvParkDetailMap({
  initialQuery = '',
  onSwitchToGrounds,
  hideModeSelector = false,
}: {
  initialQuery?: string | null;
  onSwitchToGrounds: () => void;
  hideModeSelector?: boolean;
}) {
  const viewportRef = useRef<View>(null);
  const windowSize = useWindowDimensions();
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [selected, setSelected] = useState<RvParkSite | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const viewport = rvParkPaintViewport(measured, windowSize);
  const layer = useMemo(() => rvParkLayerLayout(viewport), [viewport.width, viewport.height]);
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

  const flyTo = useCallback((site: RvParkSite) => {
    const rect = rvParkSiteRect(site);
    const cam = flyToRect({
      rectX: rect.x, rectY: rect.y, rectW: rect.w, rectH: rect.h,
      viewportW: viewport.width, viewportH: viewport.height, mapW: layer.width, mapH: layer.height,
      left: layer.left, top: layer.top, reservedBottom: SELECTED_RESERVED_BOTTOM, mild: true,
    });
    cancelAnimation(scale); cancelAnimation(tx); cancelAnimation(ty);
    scale.value = withTiming(cam.scale, { duration: 280 });
    tx.value = withTiming(cam.tx, { duration: 280 });
    ty.value = withTiming(cam.ty, { duration: 280 });
  }, [viewport.width, viewport.height, layer.width, layer.height, layer.left, layer.top]);

  const selectSite = useCallback((site: RvParkSite) => {
    setSelected(site);
    setNotFound(false);
    setTitle(rvParkPlaceTitle(site));
    setFocused(false);
    Keyboard.dismiss();
    flyTo(site);
  }, [flyTo]);

  const applyQuery = useCallback((raw: string) => {
    const result = findRvParkPlace(raw);
    if (!result) {
      setSelected(null);
      setNotFound(false);
      setTitle(null);
      return;
    }
    if (result.status === 'found') {
      setQuery(result.site.KIND === 'campsite' ? result.site.SITE_ID : result.title);
      selectSite(result.site);
      return;
    }
    setSelected(null);
    setNotFound(true);
    setTitle(result.title);
  }, [selectSite]);

  useEffect(() => {
    if (!initialQuery || !initialQuery.trim()) return;
    applyQuery(initialQuery);
  }, [initialQuery, viewport.width]);

  const results = useMemo(
    () => (focused || query.trim() ? searchRvParkPlaces(query, 12) : []),
    [focused, query],
  );

  const reset = () => {
    setSelected(null);
    setNotFound(false);
    setTitle(null);
    setQuery('');
    setFocused(false);
    cancelAnimation(scale); cancelAnimation(tx); cancelAnimation(ty);
    scale.value = withTiming(1, { duration: 220 });
    tx.value = withTiming(0, { duration: 220 });
    ty.value = withTiming(0, { duration: 220 });
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const node = resolveDomNode(viewportRef.current);
    if (!node) return undefined;
    const pointers = new Map<string, Pt>();
    let fromTouch = false, moved = false;
    let mode: 'none' | 'pan' | 'pinch' = 'none';
    let baseScale = 1, baseX = 0, baseY = 0, focalX = 0, focalY = 0, span = 1;
    let origin: Pt = { x: 0, y: 0 };
    const layout = () => ({ viewportW: viewW.value, viewportH: viewH.value, mapW: mapW.value, mapH: mapH.value, left: originX.value, top: originY.value });
    const local = (x: number, y: number) => { const box = node.getBoundingClientRect(); return { x: x - box.left, y: y - box.top }; };
    const list = () => Array.from(pointers.values());
    const middle = () => { const p = list(); return p.length > 1 ? { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 } : p[0] || { x: 0, y: 0 }; };
    const distance = () => { const p = list(); return p.length > 1 ? Math.max(Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y), 1) : 1; };
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
        const next = pinchAroundMovingFocal({ scale: baseScale, tx: baseX, ty: baseY, nextScale: baseScale * ratio, startFocalX: focalX, startFocalY: focalY, focalX: mid.x, focalY: mid.y, left: originX.value, top: originY.value });
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
      const cam = scale.value < 1 ? { scale: 1, tx: 0, ty: 0 } : clampTranslation({ scale: scale.value, tx: tx.value, ty: ty.value }, layout());
      scale.value = withTiming(cam.scale, { duration: 180 }); tx.value = withTiming(cam.tx, { duration: 180 }); ty.value = withTiming(cam.ty, { duration: 180 });
      mode = 'none'; fromTouch = false;
    };
    const wheel = (e: any) => {
      e.preventDefault(); const p = local(e.clientX, e.clientY);
      const next = zoomAroundFocal({ scale: scale.value, tx: tx.value, ty: ty.value, nextScale: scale.value * Math.exp(-e.deltaY * 0.0018), focalX: p.x, focalY: p.y, left: originX.value, top: originY.value });
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
  }, [viewport.width, viewport.height]);

  const pinch = Gesture.Pinch().onBegin((e) => {
    cancelAnimation(scale); cancelAnimation(tx); cancelAnimation(ty);
    startScale.value = scale.value; startX.value = tx.value; startY.value = ty.value; startFocalX.value = e.focalX; startFocalY.value = e.focalY;
  }).onUpdate((e) => {
    const next = pinchAroundMovingFocal({ scale: startScale.value, tx: startX.value, ty: startY.value, nextScale: startScale.value * e.scale, startFocalX: startFocalX.value, startFocalY: startFocalY.value, focalX: e.focalX, focalY: e.focalY, left: originX.value, top: originY.value });
    scale.value = next.scale; tx.value = next.tx; ty.value = next.ty;
  }).onEnd(() => {
    const cam = clampTranslation({ scale: scale.value, tx: tx.value, ty: ty.value }, { viewportW: viewW.value, viewportH: viewH.value, mapW: mapW.value, mapH: mapH.value, left: originX.value, top: originY.value });
    scale.value = withTiming(cam.scale); tx.value = withTiming(cam.tx); ty.value = withTiming(cam.ty);
  });
  const pan = Gesture.Pan().maxPointers(1).onBegin(() => { startX.value = tx.value; startY.value = ty.value; }).onUpdate((e) => {
    if (scale.value <= 1) return;
    const soft = rubberBandTranslation({ scale: scale.value, tx: startX.value + e.translationX, ty: startY.value + e.translationY }, { viewportW: viewW.value, viewportH: viewH.value, mapW: mapW.value, mapH: mapH.value, left: originX.value, top: originY.value });
    tx.value = soft.tx; ty.value = soft.ty;
  }).onEnd((e) => {
    if (scale.value <= 1) { tx.value = 0; ty.value = 0; return; }
    const bounds = translationBounds(scale.value, { viewportW: viewW.value, viewportH: viewH.value, mapW: mapW.value, mapH: mapH.value, left: originX.value, top: originY.value });
    tx.value = withDecay({ velocity: e.velocityX, clamp: [bounds.minTx, bounds.maxTx] }); ty.value = withDecay({ velocity: e.velocityY, clamp: [bounds.minTy, bounds.maxTy] });
  });
  const composed = Gesture.Simultaneous(pinch, pan);
  const cameraStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));
  const webLock = Platform.OS === 'web' ? WEB_TOUCH_LOCK : null;
  const onLayout = (e: LayoutChangeEvent) => { const { width, height } = e.nativeEvent.layout; if (width > 1 && height > 1) setMeasured({ width, height }); };

  const map = (
    <Animated.View style={[styles.gestureRoot, webLock]} collapsable={false}>
      <Animated.View style={[styles.layer, { width: layer.width, height: layer.height, left: layer.left, top: layer.top, transformOrigin: 'top left' }, cameraStyle]}>
        <Image source={MAP_SOURCE} resizeMode="stretch" style={styles.image} accessibilityLabel="RV park site map" />
        {selected ? <SiteHighlight site={selected} layer={layer} /> : null}
      </Animated.View>
    </Animated.View>
  );

  return (
    <View style={styles.root} testID="rv-park-detail-map">
      <View ref={viewportRef} style={[styles.viewport, webLock]} onLayout={onLayout} collapsable={false}>
        {Platform.OS === 'web' ? map : <GestureDetector gesture={composed}>{map}</GestureDetector>}
      </View>

      <View style={styles.chrome} pointerEvents="box-none">
        <View style={[styles.topOverlay, hideModeSelector && styles.topOverlayWithParentSelector]} pointerEvents="box-none">
          {hideModeSelector ? null : (
          <View style={styles.modeRow}>
            <TouchableOpacity style={styles.modeBtn} onPress={onSwitchToGrounds} accessibilityLabel="Show grounds map">
              <Text style={styles.modeBtnText}>Grounds</Text>
            </TouchableOpacity>
            <View style={[styles.modeBtn, styles.modeBtnOn]}>
              <Text style={[styles.modeBtnText, styles.modeBtnTextOn]}>Camping Map</Text>
            </View>
          </View>
          )}
          <View style={styles.searchCard}>
            <Feather name="search" size={18} color="#6B7280" />
            <TextInput
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                setFocused(true);
                setNotFound(false);
                if (!text.trim()) { setSelected(null); setTitle(null); }
              }}
              onFocus={() => setFocused(true)}
              placeholder="Find site (e.g. M27)"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => applyQuery(query)}
              testID="rv-site-search"
            />
            {query ? (
              <TouchableOpacity onPress={reset} hitSlop={8} accessibilityLabel="Clear search">
                <Feather name="x" size={18} color="#6B7280" />
              </TouchableOpacity>
            ) : null}
          </View>
          {focused && query.trim() ? (
            <View style={styles.results}>
              {results.length ? results.map((site) => (
                <TouchableOpacity
                  key={site.SITE_ID}
                  style={styles.resultRow}
                  onPress={() => { setQuery(site.KIND === 'campsite' ? site.SITE_ID : rvParkPlaceTitle(site)); selectSite(site); }}
                >
                  <Text style={styles.resultName}>{rvParkPlaceTitle(site)}</Text>
                  <Text style={styles.resultMeta}>{site.SITE_ID}</Text>
                </TouchableOpacity>
              )) : (
                <Text style={styles.empty}>Site not found</Text>
              )}
            </View>
          ) : null}
        </View>

        <TouchableOpacity style={styles.reset} onPress={reset} accessibilityLabel="Reset map zoom" testID="rv-map-fit-reset">
          <Feather name="maximize-2" size={18} color={colors.textPrimary} />
        </TouchableOpacity>

        {selected || notFound ? (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={styles.cardCopy}>
                <Text style={styles.title} testID="rv-site-title">{title || 'Site not found'}</Text>
                {selected ? (
                  <Text style={styles.fact}>
                    {selected.KIND === 'campsite'
                      ? `Row ${selected.ROW} · Site ${selected.NUMBER}`
                      : selected.KIND === 'office'
                        ? 'Park office'
                        : 'Dump station'}
                  </Text>
                ) : (
                  <Text style={styles.fact}>No matching RV site for “{normalizeRvSiteQuery(query) || query}”.</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => { setSelected(null); setNotFound(false); setTitle(null); }} accessibilityLabel="Dismiss">
                <Feather name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.hint} pointerEvents="none">
            <Text style={styles.hintText}>Search a site · pinch · drag · Fit to reset</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', height: '100%', position: 'relative', backgroundColor: '#D9D1BE' },
  viewport: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  gestureRoot: { ...StyleSheet.absoluteFillObject },
  layer: { position: 'absolute', overflow: 'visible' },
  image: { width: '100%', height: '100%' },
  highlight: { position: 'absolute', overflow: 'hidden', zIndex: 4 },
  chrome: { ...StyleSheet.absoluteFillObject, paddingBottom: TAB_BAR_HEIGHT, justifyContent: 'flex-end' },
  topOverlayWithParentSelector: { paddingTop: 52 },
  topOverlay: { position: 'absolute', top: 8, left: 12, right: 12, zIndex: 20 },
  modeRow: { alignSelf: 'center', flexDirection: 'row', backgroundColor: 'rgba(232,228,218,0.95)', borderRadius: 12, padding: 3, marginBottom: 8, gap: 4 },
  modeBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  modeBtnOn: { backgroundColor: '#FFFFFF' },
  modeBtnText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  modeBtnTextOn: { color: colors.primary },
  searchCard: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  searchInput: { flex: 1, fontSize: 16, color: '#111827', paddingVertical: 10 },
  results: { marginTop: 6, backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden', maxHeight: 260 },
  resultRow: { paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB', minHeight: 48 },
  resultName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  resultMeta: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  empty: { padding: 14, color: '#6B7280' },
  reset: { position: 'absolute', right: 12, bottom: 108, width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, zIndex: 30 },
  card: { marginHorizontal: 12, marginBottom: INFO_CARD_GAP, padding: 14, borderRadius: 16, backgroundColor: '#FFF', elevation: 6, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, zIndex: 20 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardCopy: { flex: 1, paddingRight: 8 },
  title: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  fact: { marginTop: 4, fontSize: 14, color: colors.textSecondary },
  hint: { alignSelf: 'center', marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  hintText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
});
