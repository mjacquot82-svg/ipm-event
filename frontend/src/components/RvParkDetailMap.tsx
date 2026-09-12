import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image, Keyboard, LayoutChangeEvent, Platform, StyleSheet, Text, TextInput,
  TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import colors from '../theme/colors';
import { rvParkLayerLayout, rvParkPaintViewport } from '../config/rvParkLayout';
import { rvParkSiteRect, type RvParkSite } from '../config/rvParkGeometry';
import { findRvParkPlace, normalizeRvSiteQuery, rvParkPlaceTitle, searchRvParkPlaces } from '../config/rvParkSearch';
import { boothHighlightStyle } from '../config/tentedCityHighlight';
import { flyToRect } from '../config/tentedCityCamera';
import {
  WEB_TOUCH_LOCK,
  attachWebMapGestures,
  createMapNativeGestures,
  resetMapCamera,
  resolveDomNode,
  type MapCameraShared,
} from '../config/mapInteraction';

const MAP_SOURCE = require('../../assets/images/rv-park-detail-map.png');
const TAB_BAR_HEIGHT = 60;
const INFO_CARD_GAP = 8;
const INFO_CARD_BOTTOM = TAB_BAR_HEIGHT + INFO_CARD_GAP;
const SELECTED_RESERVED_BOTTOM = TAB_BAR_HEIGHT + 108;
/** Cyan / light-blue fill for exact campsite cell. */
const SITE_CELL_FILL = 'rgba(103, 232, 249, 0.55)';
/** Yellow outer border (boothHighlightStyle pattern). */
const SITE_CELL_BORDER = '#F5C518';

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
  const focusedKey = useRef<string | null>(null);
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

  const cam = useMemo<MapCameraShared>(() => ({
    scale, tx, ty, startScale, startX, startY, startFocalX, startFocalY,
    viewW, viewH, mapW, mapH, originX, originY,
  }), []);

  useEffect(() => {
    viewW.value = viewport.width; viewH.value = viewport.height;
    mapW.value = layer.width; mapH.value = layer.height;
    originX.value = layer.left; originY.value = layer.top;
  }, [viewport.width, viewport.height, layer.width, layer.height, layer.left, layer.top]);

  const flyTo = useCallback((site: RvParkSite) => {
    const rect = rvParkSiteRect(site);
    const next = flyToRect({
      rectX: rect.x, rectY: rect.y, rectW: rect.w, rectH: rect.h,
      viewportW: viewport.width, viewportH: viewport.height, mapW: layer.width, mapH: layer.height,
      left: layer.left, top: layer.top, reservedBottom: SELECTED_RESERVED_BOTTOM, mild: true,
    });
    cancelAnimation(scale); cancelAnimation(tx); cancelAnimation(ty);
    scale.value = withTiming(next.scale, { duration: 280 });
    tx.value = withTiming(next.tx, { duration: 280 });
    ty.value = withTiming(next.ty, { duration: 280 });
  }, [viewport.width, viewport.height, layer.width, layer.height, layer.left, layer.top]);

  const selectSite = useCallback((site: RvParkSite, opts?: { forceFly?: boolean }) => {
    setSelected(site);
    setNotFound(false);
    setTitle(rvParkPlaceTitle(site));
    setFocused(false);
    Keyboard.dismiss();
    const key = site.SITE_ID;
    if (!opts?.forceFly && focusedKey.current === key) return;
    focusedKey.current = key;
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
    if (!viewport.width || viewport.width <= 1) return;
    applyQuery(initialQuery);
  }, [initialQuery, viewport.width, applyQuery]);

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
    focusedKey.current = null;
    resetMapCamera(cam);
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const node = resolveDomNode(viewportRef.current);
    if (!node) return undefined;
    return attachWebMapGestures(node, cam);
  }, [viewport.width, viewport.height, cam]);

  const composed = useMemo(() => createMapNativeGestures(cam), [cam]);
  const cameraStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));
  const webLock = Platform.OS === 'web' ? WEB_TOUCH_LOCK : null;
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 1 && height > 1 && (!measured || width !== measured.width || height !== measured.height)) {
      setMeasured({ width, height });
    }
  };

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
                if (!text.trim()) { setSelected(null); setTitle(null); focusedKey.current = null; }
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
                  onPress={() => {
                    setQuery(site.KIND === 'campsite' ? site.SITE_ID : rvParkPlaceTitle(site));
                    selectSite(site, { forceFly: true });
                  }}
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
