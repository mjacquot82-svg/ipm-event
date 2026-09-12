import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Keyboard, LayoutChangeEvent, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import colors from '../theme/colors';
import { groundsLayerLayout, groundsPaintViewport } from '../config/groundsLayout';
import { GROUNDS_MAP, GroundsZone, hitTestGroundsZone, resolveGroundsZone } from '../config/groundsZones';
import { searchEventMap, type EventMapHit } from '../config/mapSearch';
import { tentedCityVendors } from '../data/tentedCityVendors';
import { flyToRect, mapPointUnderFocal } from '../config/tentedCityCamera';
import {
  WEB_TOUCH_LOCK,
  attachWebMapGestures,
  createMapNativeGestures,
  resetMapCamera,
  resolveDomNode,
  type MapCameraShared,
} from '../config/mapInteraction';

const MAP_SOURCE = require('../../assets/images/grounds-site-map.jpg');
const INFO_CARD_BOTTOM = 68;
/** Same language as MNP stage parent-fallback highlight. */
const SELECTED_FILL = 'rgba(0, 229, 255, 0.45)';
const SELECTED_OUTER = '#FFD600';
const SELECTED_INNER = '#FFFFFF';

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

export default function GroundsMap({ highlightedLocation, onSwitchToTented, onSwitchToRv }: {
  highlightedLocation?: string | null;
  onSwitchToTented: (location?: string) => void;
  onSwitchToRv?: () => void;
}) {
  const viewportRef = useRef<View>(null);
  const windowSize = useWindowDimensions();
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const [selected, setSelected] = useState<GroundsZone | null>(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const focusedKey = useRef<string | null>(null);
  const viewport = groundsPaintViewport(measured, windowSize);
  const layer = useMemo(() => groundsLayerLayout(viewport), [viewport.width, viewport.height]);
  const scale = useSharedValue(1), tx = useSharedValue(0), ty = useSharedValue(0);
  const startScale = useSharedValue(1), startX = useSharedValue(0), startY = useSharedValue(0);
  const startFocalX = useSharedValue(0), startFocalY = useSharedValue(0);
  const viewW = useSharedValue(1), viewH = useSharedValue(1), mapW = useSharedValue(1), mapH = useSharedValue(1);
  const originX = useSharedValue(0), originY = useSharedValue(0);

  const cam = useMemo<MapCameraShared>(() => ({
    scale, tx, ty, startScale, startX, startY, startFocalX, startFocalY,
    viewW, viewH, mapW, mapH, originX, originY,
  }), []);

  useEffect(() => {
    viewW.value = viewport.width; viewH.value = viewport.height;
    mapW.value = layer.width; mapH.value = layer.height;
    originX.value = layer.left; originY.value = layer.top;
  }, [viewport.width, viewport.height, layer.width, layer.height, layer.left, layer.top]);

  const flyTo = useCallback((zone: GroundsZone) => {
    const next = flyToRect({
      rectX: zone.rect.x, rectY: zone.rect.y, rectW: zone.rect.w, rectH: zone.rect.h,
      viewportW: viewport.width, viewportH: viewport.height, mapW: layer.width, mapH: layer.height,
      left: layer.left, top: layer.top, reservedBottom: zone.action === 'info' || zone.action === 'switch-rv' ? 160 : 60, mild: true,
    });
    cancelAnimation(scale); cancelAnimation(tx); cancelAnimation(ty);
    scale.value = withTiming(next.scale, { duration: 280 });
    tx.value = withTiming(next.tx, { duration: 280 });
    ty.value = withTiming(next.ty, { duration: 280 });
  }, [viewport.width, viewport.height, layer.width, layer.height, layer.left, layer.top]);

  const chooseZone = useCallback((zone: GroundsZone | null, opts?: { switchTented?: boolean }) => {
    if (!zone) return;
    setSelected(zone);
    flyTo(zone);
    if ((opts?.switchTented ?? true) && zone.action === 'switch-tented') setTimeout(() => onSwitchToTented(), 280);
  }, [flyTo, onSwitchToTented]);

  const selectHit = useCallback((hit: EventMapHit) => {
    setFocused(false);
    Keyboard.dismiss();
    if (hit.mapType === 'tented') {
      onSwitchToTented(hit.kind === 'semantic' ? hit.query : hit.place.kind === 'vendor' ? hit.place.vendor.name : hit.place.venue.label);
      return;
    }
    setQuery(hit.title);
    focusedKey.current = `${hit.query}::${hit.zone.id}`;
    chooseZone(hit.zone, { switchTented: false });
  }, [chooseZone, onSwitchToTented]);

  const hitViewportPoint = useCallback((x: number, y: number) => {
    const point = mapPointUnderFocal({ scale: scale.value, tx: tx.value, ty: ty.value, focalX: x, focalY: y, left: layer.left, top: layer.top });
    chooseZone(hitTestGroundsZone((point.x / layer.width) * 100, (point.y / layer.height) * 100));
  }, [chooseZone, layer.left, layer.top, layer.width, layer.height]);

  useEffect(() => {
    const zone = resolveGroundsZone(highlightedLocation);
    if (!zone) return;
    setSelected(zone);
    const key = `${highlightedLocation || ''}::${zone.id}`;
    if (focusedKey.current === key) return;
    focusedKey.current = key;
    flyTo(zone);
  }, [highlightedLocation, flyTo]);

  // Shared TC web gesture lifecycle (pinchAroundMovingFocal, finishWebGesture clamp-only-outside,
  // rubber-band pan, double-tap, optional single-tap zone hit). No Grounds-only constants.
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const node = resolveDomNode(viewportRef.current);
    if (!node) return undefined;
    return attachWebMapGestures(node, cam, { onSingleTap: hitViewportPoint });
  }, [viewport.width, viewport.height, hitViewportPoint, cam]);

  const composed = useMemo(
    () => createMapNativeGestures(cam, { onSingleTap: hitViewportPoint }),
    [cam, hitViewportPoint],
  );
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
  const results = useMemo(
    () => (focused || query.trim() ? searchEventMap(query, tentedCityVendors, 'all') : []),
    [query, focused],
  );
  const reset = () => {
    setSelected(null);
    setQuery('');
    setFocused(false);
    Keyboard.dismiss();
    resetMapCamera(cam);
  };
  const onLayout = (e: LayoutChangeEvent) => { const { width, height } = e.nativeEvent.layout; if (width > 1 && height > 1) setMeasured({ width, height }); };

  return <View style={styles.root}>
    <View ref={viewportRef} style={[styles.viewport, webLock]} onLayout={onLayout} collapsable={false}>
      {Platform.OS === 'web' ? map : <GestureDetector gesture={composed}>{map}</GestureDetector>}
    </View>
    <View style={styles.searchWrap} pointerEvents="box-none">
      <View style={styles.searchCard}>
        <Feather name="search" size={18} color="#6B7280" />
        <TextInput
          value={query}
          onChangeText={(text) => { setQuery(text); setFocused(true); }}
          onFocus={() => setFocused(true)}
          placeholder="Find a vendor, booth, stage, or place"
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          testID="grounds-map-search"
          onSubmitEditing={() => { if (results[0]) selectHit(results[0]); }}
        />
        {query ? <TouchableOpacity onPress={() => { setQuery(''); setFocused(false); }} hitSlop={8} accessibilityLabel="Clear search"><Feather name="x" size={18} color="#6B7280" /></TouchableOpacity> : null}
      </View>
      {focused && query.trim().length > 0 ? (
        <ScrollView style={styles.results} keyboardShouldPersistTaps="handled" nestedScrollEnabled testID="grounds-map-results">
          {results.map((hit) => (
            <TouchableOpacity key={hit.key} style={styles.resultRow} onPress={() => selectHit(hit)}>
              <Feather name={hit.mapType === 'grounds' ? 'navigation' : hit.kind === 'stage' ? 'mic' : 'map-pin'} size={16} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName} numberOfLines={1}>{hit.title}</Text>
                <Text style={styles.resultMeta}>{hit.subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {results.length === 0 ? <Text style={styles.empty}>No matching mapped places.</Text> : null}
        </ScrollView>
      ) : null}
    </View>
    <TouchableOpacity style={styles.reset} onPress={reset} accessibilityLabel="Fit map to grounds" testID="grounds-fit-reset">
      <Feather name="maximize-2" size={18} color={colors.textPrimary} />
    </TouchableOpacity>
    {selected?.action === 'info' || selected?.action === 'switch-rv' ? (
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
          {selected.action === 'switch-rv' && onSwitchToRv ? (
            <TouchableOpacity style={styles.rvCta} onPress={onSwitchToRv} accessibilityLabel="View RV Site Map" testID="view-rv-site-map">
              <Text style={styles.rvCtaText}>View RV Site Map</Text>
            </TouchableOpacity>
          ) : null}
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
  searchWrap: { position: 'absolute', top: 52, left: 12, right: 12, zIndex: 12 },
  searchCard: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  searchInput: { flex: 1, fontSize: 16, color: '#111827', paddingVertical: 10 },
  results: { marginTop: 6, backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden', maxHeight: 260 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB', minHeight: 48 },
  resultName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  resultMeta: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  empty: { padding: 14, color: '#6B7280' },
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
  rvCta: { marginTop: 12, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  rvCtaText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});

// Keep map asset dimensions referenced for audits / tree-shaking clarity.
void GROUNDS_MAP;
