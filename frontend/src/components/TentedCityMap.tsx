import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Keyboard,
  LayoutChangeEvent,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import colors from '../theme/colors';
import { tentedCityVendors } from '../data/tentedCityVendors';
import { tentedCityVenues } from '../config/tentedCityVenues';
import type { Rect, TentedCityPlace } from '../config/tentedCityTypes';
import {
  findTentedCityPlace,
  placeRect,
  placeTitle,
  searchTentedCity,
} from '../config/tentedCitySearch';
import { tentedCityLayerLayout, tentedCityPaintViewport } from '../config/tentedCityLayout';
import { TENTED_CITY_VERIFY_PARENTS, focusRectForFootprint } from '../config/tentedCityGeometry';
import { footprintForVendor } from '../config/tentedCityVendorMatch';
import { getScheduleData, ScheduleEvent } from '../services/spreadsheetDataService';

const MAP_SOURCE = require('../../assets/images/tented-city-map.png');
const MIN_SCALE = 1;
const MAX_SCALE = 4.5;
/** Matches frontend/app/(tabs)/_layout.tsx NAV_ICONS_HEIGHT. Overlay tab bar on web. */
const TAB_BAR_HEIGHT = 60;
const INFO_CARD_GAP = 8;
const INFO_CARD_BOTTOM = TAB_BAR_HEIGHT + INFO_CARD_GAP;
const SELECTED_RESERVED_BOTTOM = TAB_BAR_HEIGHT + 108;

type FilterId = 'all' | 'food' | 'stages' | 'vendors';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'food', label: 'Food' },
  { id: 'stages', label: 'Stages' },
];

function clamp(n: number, min: number, max: number) {
  'worklet';
  return Math.max(min, Math.min(max, n));
}

export default function TentedCityMap({
  initialQuery = '',
  mapUnavailable = false,
  exactInitialPlace = false,
  verify1A: verify1AProp = false,
  onSwitchToGrounds,
}: {
  initialQuery?: string | null;
  mapUnavailable?: boolean;
  exactInitialPlace?: boolean;
  verify1A?: boolean;
  onSwitchToGrounds?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [selected, setSelected] = useState<TentedCityPlace | null>(null);
  const [filter, setFilter] = useState<FilterId>('all');
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [unavailable, setUnavailable] = useState(Boolean(mapUnavailable));
  const [verify1A, setVerify1A] = useState(Boolean(verify1AProp));
  const verifyTaps = useRef({ count: 0, at: 0 });
  const windowSize = useWindowDimensions();
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const viewport = tentedCityPaintViewport(measured, windowSize);

  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const fillOpacity = useSharedValue(0.52);

  const layer = useMemo(() => tentedCityLayerLayout(viewport), [viewport]);
  const mapSize = layer.mapSize;

  useEffect(() => {
    let alive = true;
    void getScheduleData({ preferCache: true })
      .then((result) => {
        if (alive) setEvents(result.data.events || []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const applyFocus = (rect: Rect | null | undefined, mild = false, reservedBottom = TAB_BAR_HEIGHT) => {
    if (!rect || !viewport.width || !mapSize.width) return;
    const { width: vw, height: vh } = viewport;
    const { width: mw, height: mh } = mapSize;
    const usableH = Math.max(vh - reservedBottom, 160);
    const cx = ((rect.x + rect.w / 2) / 100) * mw;
    const cy = ((rect.y + rect.h / 2) / 100) * mh;
    const boxW = Math.max((rect.w / 100) * mw, 18);
    const boxH = Math.max((rect.h / 100) * mh, 18);
    const nextScale = mild
      ? clamp(Math.min(vw / (boxW * 0.92), usableH / (boxH * 1.05), 3.15), 2.05, 3.15)
      : clamp(Math.min(vw / (boxW * 5), usableH / (boxH * 5), MAX_SCALE), 1.85, 3.4);
    const left = (vw - mw) / 2;
    const top = (vh - mh) / 2;
    const nextX = vw / 2 - left - cx * nextScale;
    const nextY = usableH * 0.46 - top - cy * nextScale;
    scale.value = withTiming(nextScale, { duration: 280 });
    tx.value = withTiming(nextX, { duration: 280 });
    ty.value = withTiming(nextY, { duration: 280 });
  };

  const resetView = () => {
    scale.value = withTiming(1, { duration: 220 });
    tx.value = withTiming(0, { duration: 220 });
    ty.value = withTiming(0, { duration: 220 });
  };

  const selectPlace = (place: TentedCityPlace, fromQuery?: string) => {
    setSelected(place);
    setQuery(fromQuery ?? placeTitle(place));
    setFocused(false);
    Keyboard.dismiss();
    const footprint = place.kind === 'vendor' ? footprintForVendor(place.vendor) : null;
    if (footprint) {
      applyFocus(focusRectForFootprint(footprint.rect, footprint.parentRect), true, SELECTED_RESERVED_BOTTOM);
    } else if (place.kind === 'stage') {
      applyFocus(placeRect(place), false, SELECTED_RESERVED_BOTTOM);
    }
  };

  const clearSelection = () => {
    setSelected(null);
    setQuery('');
    setFocused(false);
    setUnavailable(false);
    Keyboard.dismiss();
    resetView();
  };

  useEffect(() => {
    setUnavailable(Boolean(mapUnavailable));
  }, [mapUnavailable]);

  useEffect(() => {
    setVerify1A(Boolean(verify1AProp));
  }, [verify1AProp]);

  useEffect(() => {
    if (mapUnavailable || !initialQuery) return;
    const place = findTentedCityPlace(initialQuery, tentedCityVendors);
    if (!place) return;
    if (exactInitialPlace && (place.kind !== 'vendor' || place.vendor.name !== initialQuery)) {
      return;
    }
    selectPlace(place, placeTitle(place));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, mapUnavailable, exactInitialPlace, viewport.width]);

  const results = useMemo(
    () => (focused || query.trim() ? searchTentedCity(query, tentedCityVendors, filter, 8) : []),
    [query, filter, focused],
  );

  const stageEvents = useMemo(() => {
    if (selected?.kind !== 'stage') return [];
    const names = new Set(selected.venue.names.map((n) => n.toLowerCase().replace(/[\u2019']/g, "'").replace(/\s+/g, ' ').trim()));
    return events.filter((e) => e.location_name && names.has(e.location_name.toLowerCase().replace(/[\u2019']/g, "'").replace(/\s+/g, ' ').trim())).slice(0, 4);
  }, [events, selected]);

  const filterDots = useMemo(() => {
    if (filter === 'food') {
      return tentedCityVendors.flatMap((v) => {
        if (v.category !== 'food') return [];
        const fp = footprintForVendor(v);
        if (!fp) return [];
        return [{ key: v.name, rect: fp.rect, place: { kind: 'vendor' as const, vendor: v } }];
      });
    }
    if (filter === 'stages') {
      return tentedCityVenues
        .filter((v) => v.kind === 'stage' && v.rect)
        .map((v) => ({ key: v.id, rect: v.rect!, place: { kind: 'stage' as const, venue: v } }));
    }
    return [];
  }, [filter]);

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = scale.value;
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      const next = clamp(startScale.value * e.scale, MIN_SCALE, MAX_SCALE);
      const ratio = next / startScale.value;
      scale.value = next;
      tx.value = e.focalX - (e.focalX - startX.value) * ratio;
      ty.value = e.focalY - (e.focalY - startY.value) * ratio;
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onBegin(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = startX.value + e.translationX;
      ty.value = startY.value + e.translationY;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e, success) => {
      if (!success) return;
      if (scale.value > 1.2) {
        scale.value = withTiming(1);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
      } else {
        const next = 2.4;
        scale.value = withTiming(next);
        tx.value = withTiming(e.x - (e.x - tx.value) * (next / scale.value));
        ty.value = withTiming(e.y - (e.y - ty.value) * (next / scale.value));
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

  const mapStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 1 && height > 1 && (!measured || width !== measured.width || height !== measured.height)) {
      setMeasured({ width, height });
    }
  };

  const vendorFootprint = selected?.kind === 'vendor' ? footprintForVendor(selected.vendor) : null;
  const highlight = vendorFootprint ? vendorFootprint.rect : selected?.kind === 'stage' ? placeRect(selected) : null;
  useEffect(() => {
    if (!vendorFootprint) return;
    fillOpacity.value = 0.5;
    fillOpacity.value = withRepeat(withTiming(0.78, { duration: 700 }), -1, true);
  }, [vendorFootprint?.lotIds.join('|'), vendorFootprint?.areaId]);
  const footprintFillStyle = useAnimatedStyle(() => ({ opacity: fillOpacity.value }));
  const selectedTitle = selected ? placeTitle(selected) : '';
  const selectedBooth = selected?.kind === 'vendor' ? selected.vendor.locationLabel : '';
  const selectedMeta = selected?.kind === 'vendor'
    ? `${selected.vendor.category}${selected.vendor.tent ? `  \u00b7  ${selected.vendor.tent}` : ''}${vendorFootprint ? '' : '  \u00b7  map location not available'}`
    : selected?.kind === 'stage'
      ? selected.venue.note || (selected.venue.rect ? 'Stage' : 'On the schedule \u2014 booth not on this map yet')
      : '';

  return (
    <View style={styles.root} collapsable={false}>
      <View
        style={[styles.viewport, Platform.OS === 'web' ? ({ touchAction: 'none' } as object) : null]}
        onLayout={onLayout}
        collapsable={false}
      >
        <GestureDetector gesture={composed}>
          <Animated.View
            style={[
              styles.mapLayer,
              {
                width: layer.width,
                height: layer.height,
                left: layer.left,
                top: layer.top,
                transformOrigin: 'top left',
              },
              mapStyle,
            ]}
          >
            <Image
              source={MAP_SOURCE}
              style={[styles.mapImage, { width: layer.width, height: layer.height }]}
              resizeMode="stretch"
            />
            {filterDots.map((dot) => (
              <TouchableOpacity
                key={dot.key}
                activeOpacity={0.8}
                onPress={() => selectPlace(dot.place)}
                style={[
                  styles.filterDot,
                  {
                    left: `${dot.rect.x + dot.rect.w / 2}%`,
                    top: `${dot.rect.y + dot.rect.h / 2}%`,
                  },
                ]}
              />
            ))}
            {verify1A
              ? TENTED_CITY_VERIFY_PARENTS.map((parent) => (
                <View
                  key={parent.id}
                  pointerEvents="none"
                  style={[
                    styles.verifyParent,
                    {
                      left: `${parent.rect.x}%`,
                      top: `${parent.rect.y}%`,
                      width: `${parent.rect.w}%`,
                      height: `${parent.rect.h}%`,
                    },
                  ]}
                >
                  <Text style={styles.verifyParentLabel}>{parent.label}</Text>
                </View>
              ))
              : null}
            {vendorFootprint ? (
              <>
                <View
                  pointerEvents="none"
                  style={[
                    styles.footprintHalo,
                    {
                      left: `${vendorFootprint.rect.x}%`,
                      top: `${vendorFootprint.rect.y}%`,
                      width: `${vendorFootprint.rect.w}%`,
                      height: `${vendorFootprint.rect.h}%`,
                    },
                  ]}
                />
                <View
                  pointerEvents="none"
                  style={[
                    styles.footprint,
                    {
                      left: `${vendorFootprint.rect.x}%`,
                      top: `${vendorFootprint.rect.y}%`,
                      width: `${vendorFootprint.rect.w}%`,
                      height: `${vendorFootprint.rect.h}%`,
                    },
                  ]}
                >
                  <Animated.View style={[styles.footprintFill, footprintFillStyle]} />
                </View>
              </>
            ) : highlight ? (
              <View
                pointerEvents="none"
                style={[
                  styles.pulse,
                  {
                    left: `${highlight.x + highlight.w / 2}%`,
                    top: `${highlight.y + highlight.h / 2}%`,
                  },
                ]}
              >
                <View style={styles.pulseRing} />
                <View style={styles.pin} />
              </View>
            ) : null}
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={styles.chrome} pointerEvents="box-none">
      <View style={styles.topOverlay} pointerEvents="box-none">
        <View style={styles.modeRow}>
          <TouchableOpacity style={styles.modeBtn} onPress={onSwitchToGrounds} accessibilityLabel="Show grounds map">
            <Text style={styles.modeBtnText}>Grounds</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, styles.modeBtnOn]}
            onPress={() => {
              const now = Date.now();
              if (now - verifyTaps.current.at > 900) verifyTaps.current.count = 0;
              verifyTaps.current.at = now;
              verifyTaps.current.count += 1;
              if (verifyTaps.current.count >= 5) {
                verifyTaps.current.count = 0;
                setVerify1A((on) => !on);
              }
            }}
            accessibilityLabel="Tented City"
          >
            <Text style={[styles.modeBtnText, styles.modeBtnTextOn]}>Tented City</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchCard}>
          <Feather name="search" size={18} color="#6B7280" />
          <TextInput
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setFocused(true);
              if (!text.trim()) setSelected(null);
            }}
            onFocus={() => setFocused(true)}
            placeholder="Find a vendor, booth, or stage"
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => {
              if (results[0]) selectPlace(results[0]);
            }}
          />
          {query ? (
            <TouchableOpacity onPress={clearSelection} hitSlop={8} accessibilityLabel="Clear search">
              <Feather name="x" size={18} color="#6B7280" />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.filters}>
          {FILTERS.map((item) => {
            const on = filter === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => setFilter(item.id)}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {verify1A ? (
          <View style={styles.verifyBanner} pointerEvents="none">
            <Text style={styles.verifyBannerText}>Tented City geometry overlay on. Five taps on Tented City to hide.</Text>
          </View>
        ) : null}

        {focused && query.trim().length > 0 ? (
          <View style={styles.results}>
            {results.map((hit, i) => {
              const title = placeTitle(hit);
              const meta = hit.kind === 'vendor' ? hit.vendor.locationLabel : 'Stage';
              return (
                <TouchableOpacity key={`${title}-${i}`} style={styles.resultRow} onPress={() => selectPlace(hit)}>
                  <Feather name={hit.kind === 'stage' ? 'mic' : 'map-pin'} size={16} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName} numberOfLines={1}>{title}</Text>
                    <Text style={styles.resultMeta}>{meta}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {results.length === 0 ? <Text style={styles.empty}>No matching places on this map.</Text> : null}
          </View>
        ) : null}
      </View>

      <View style={styles.fabCol}>
        <TouchableOpacity style={styles.fab} onPress={resetView} accessibilityLabel="Reset map zoom">
          <Feather name="maximize-2" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {selected ? (
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.infoTitle} numberOfLines={2}>{selectedTitle}</Text>
              {selectedBooth ? <Text style={styles.infoBooth} numberOfLines={1}>{selectedBooth}</Text> : null}
              {selectedMeta ? <Text style={styles.infoMeta} numberOfLines={1}>{selectedMeta}</Text> : null}
            </View>
            <TouchableOpacity onPress={clearSelection} hitSlop={10} accessibilityLabel="Dismiss">
              <Feather name="x" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          {stageEvents.length > 0 ? (
            <View style={styles.events}>
              {stageEvents.map((event) => (
                <Text key={event.id} style={styles.eventLine} numberOfLines={1}>
                  {event.start_time ? `${event.start_time}  \u00b7  ` : ''}{event.title}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : unavailable ? (
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.infoTitle}>Map location not available</Text>
            </View>
            <TouchableOpacity onPress={clearSelection} hitSlop={10} accessibilityLabel="Dismiss">
              <Feather name="x" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.hint} pointerEvents="none">
          <Feather name="zoom-in" size={14} color={colors.textMuted} />
          <Text style={styles.hintText}>Pinch to zoom \u00b7 drag to pan</Text>
        </View>
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
    width: '100%',
    height: '100%',
    backgroundColor: '#C9B896',
  },
  viewport: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  chrome: {
    ...StyleSheet.absoluteFillObject,
    paddingBottom: TAB_BAR_HEIGHT,
    justifyContent: 'flex-end',
  },
  mapLayer: { position: 'absolute', overflow: 'visible' },
  mapImage: { width: '100%', height: '100%' },
  filterDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    marginLeft: -6,
    marginTop: -6,
    borderRadius: 6,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  pulse: {
    position: 'absolute',
    width: 28,
    height: 28,
    marginLeft: -14,
    marginTop: -22,
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    top: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(166,38,45,0.28)',
  },
  pin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: '#F5C518',
    marginTop: 6,
  },
  topOverlay: { position: 'absolute', top: 8, left: 12, right: 12, zIndex: 20 },
  modeRow: {
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(232,228,218,0.95)',
    borderRadius: 12,
    padding: 3,
    marginBottom: 8,
    gap: 4,
  },
  modeBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  modeBtnOn: { backgroundColor: '#FFFFFF' },
  modeBtnText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  modeBtnTextOn: { color: colors.primary },
  searchCard: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: { flex: 1, fontSize: 16, color: '#111827', paddingVertical: 10 },
  filters: { flexDirection: 'row', gap: 8, marginTop: 8 },
  chip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: '#4B5563' },
  chipTextOn: { color: '#FFFFFF' },
  results: {
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    maxHeight: 260,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    minHeight: 48,
  },
  resultName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  resultMeta: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  empty: { padding: 14, color: '#6B7280' },
  fabCol: { position: 'absolute', right: 12, bottom: 108, zIndex: 15 },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  infoCard: {
    marginHorizontal: 12,
    marginBottom: INFO_CARD_GAP,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    zIndex: 20,
  },
  infoHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  infoTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  infoBooth: { fontSize: 16, fontWeight: '800', color: colors.primary, marginTop: 4 },
  infoMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  events: { marginTop: 8, gap: 4 },
  eventLine: { fontSize: 13, color: '#374151' },
  hint: {
    alignSelf: 'center',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  hintText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  footprintHalo: {
    position: 'absolute',
    marginLeft: -5,
    marginTop: -5,
    paddingRight: 10,
    paddingBottom: 10,
    borderWidth: 5,
    borderColor: 'rgba(245,197,24,0.55)',
    backgroundColor: 'rgba(245,197,24,0.18)',
  },
  footprint: {
    position: 'absolute',
    borderWidth: 4,
    borderColor: '#F5C518',
    overflow: 'hidden',
  },
  footprintFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#A6262D',
  },
  verifyParent: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#22D3EE',
    backgroundColor: 'transparent',
  },
  verifyParentLabel: {
    position: 'absolute',
    top: -14,
    left: 0,
    fontSize: 10,
    fontWeight: '800',
    color: '#0E7490',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 4,
  },
  verifyLot: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyLotLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#111827',
    backgroundColor: 'rgba(255,255,255,0.82)',
    paddingHorizontal: 1,
  },
  verifyBanner: {
    marginTop: 8,
    backgroundColor: 'rgba(14,116,144,0.92)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  verifyBannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
