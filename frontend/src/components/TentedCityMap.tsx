import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Image, StyleSheet, TextInput, TouchableOpacity, Keyboard,
  LayoutChangeEvent, Platform, useWindowDimensions, ScrollView,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import colors from '../theme/colors';
import { tentedCityVendors } from '../data/tentedCityVendors';
import { tentedCityVenues } from '../config/tentedCityVenues';
import type { Rect, TentedCityPlace } from '../config/tentedCityTypes';
import { findTentedCityPlace, placeRect, placeTitle, searchTentedCity } from '../config/tentedCitySearch';
import { tentedCityLayerLayout, tentedCityPaintViewport } from '../config/tentedCityLayout';
import { boothHighlightStyle } from '../config/tentedCityHighlight';
import { TENTED_CITY_VERIFY_PARENTS, TENTED_CITY_INDIVIDUAL_BOOTHS, TENTED_CITY_BOOTH_DIVIDER_SEGMENTS, TENTED_CITY_TRUSTED_PARENT_ONLY_RANGES, focusRectForFootprint, AREA_BY_LABEL, AREA_BY_ID, isTrustedParentOnlyArea, type TentedCityIndividualBooth } from '../config/tentedCityGeometry';
import { footprintForVendor } from '../config/tentedCityVendorMatch';
import {
  findSemanticAreaForVendor, findSemanticAreaForGeometryArea, findSemanticAreaForLocation, semanticAreaRect, TENTED_CITY_SEMANTIC_AREAS,
  type SemanticMapArea,
} from '../config/tentedCitySemanticMap';
import { getScheduleData, ScheduleEvent } from '../services/spreadsheetDataService';
import {
  BOOTH_DIVIDER_VISIBLE_SCALE, flyToRect,
} from '../config/tentedCityCamera';
import {
  WEB_TOUCH_LOCK,
  attachWebMapGestures,
  createMapNativeGestures,
  resetMapCamera,
  resolveDomNode,
  type MapCameraShared,
} from '../config/mapInteraction';

const MAP_SOURCE = require('../../assets/images/tented-city-map-app-ready.svg');
const TAB_BAR_HEIGHT = 60;
const INFO_CARD_GAP = 8;
const INFO_CARD_BOTTOM = TAB_BAR_HEIGHT + INFO_CARD_GAP;
const SELECTED_RESERVED_BOTTOM = TAB_BAR_HEIGHT + 108;
const PARENT_RANGE_FILL = 'rgba(245, 197, 24, 0.45)';
/** Exact selected booth: opaque user-location blue so the full cell stays blue over yellow parent. */
const EXACT_BOOTH_CELL_FILL = colors.userLocation;
function BoothHighlight({ rect, layer, border, borderColor, outset = 0, style, testID, children }: {
  rect: Rect; layer: { width: number; height: number }; border: number; borderColor: string;
  outset?: number; style: StyleProp<ViewStyle>; testID: string; children?: React.ReactNode;
}) {
  const { borderWidth: edge, ...frame } = boothHighlightStyle(rect, layer, border, outset);
  const stroke = { position: 'absolute' as const, backgroundColor: borderColor };
  return <View testID={testID} pointerEvents="none" style={[style, frame]}>
    <View style={{ position: 'absolute', top: edge, bottom: edge, left: edge, right: edge }}>{children}</View>
    {/* Filled edges allow subpixel widths; CSS borders round up and enlarge tiny cells. */}
    <View style={[stroke, { top: 0, left: 0, right: 0, height: edge }]} />
    <View style={[stroke, { bottom: 0, left: 0, right: 0, height: edge }]} />
    <View style={[stroke, { top: 0, bottom: 0, left: 0, width: edge }]} />
    <View style={[stroke, { top: 0, bottom: 0, right: 0, width: edge }]} />
  </View>;
}

type FilterId = 'all' | 'food' | 'stages' | 'vendors';
const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'vendors', label: 'Vendors' }, { id: 'food', label: 'Food' }, { id: 'stages', label: 'Stages' },
];

export default function TentedCityMap({
  initialQuery = '', mapUnavailable = false, exactInitialPlace = false, verify1A: verify1AProp = false, onSwitchToGrounds, hideModeSelector = false,
}: {
  initialQuery?: string | null; mapUnavailable?: boolean; exactInitialPlace?: boolean; verify1A?: boolean; onSwitchToGrounds?: () => void; hideModeSelector?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [selected, setSelected] = useState<TentedCityPlace | null>(null);
  const [selectedSemanticArea, setSelectedSemanticArea] = useState<SemanticMapArea | null>(null);
  const [selectedBoothId, setSelectedBoothId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>('all');
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [unavailable, setUnavailable] = useState(Boolean(mapUnavailable));
  const [unmappedInitialLocation, setUnmappedInitialLocation] = useState(false);
  const [verify1A, setVerify1A] = useState(Boolean(verify1AProp));
  const verifyTaps = useRef({ count: 0, at: 0 });
  const viewportRef = useRef<View>(null);
  const windowSize = useWindowDimensions();
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const viewport = tentedCityPaintViewport(measured, windowSize);
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startFocalX = useSharedValue(0);
  const startFocalY = useSharedValue(0);
  const viewW = useSharedValue(1);
  const viewH = useSharedValue(1);
  const mapW = useSharedValue(1);
  const mapH = useSharedValue(1);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);
  const layer = useMemo(() => tentedCityLayerLayout(viewport), [viewport]);
  const mapSize = layer.mapSize;
  const cam = useMemo<MapCameraShared>(() => ({
    scale, tx, ty, startScale, startX, startY, startFocalX, startFocalY,
    viewW, viewH, mapW, mapH, originX, originY,
  }), []);


  useEffect(() => {
    viewW.value = viewport.width; viewH.value = viewport.height;
    mapW.value = mapSize.width; mapH.value = mapSize.height;
    originX.value = layer.left; originY.value = layer.top;
  }, [viewport.width, viewport.height, mapSize.width, mapSize.height, layer.left, layer.top]);

  useEffect(() => {
    let alive = true;
    void getScheduleData({ preferCache: true }).then((result) => { if (alive) setEvents(result.data.events || []); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const applyFocus = (rect: Rect | null | undefined, mild = false, reservedBottom = TAB_BAR_HEIGHT) => {
    if (!rect || !viewport.width || !mapSize.width) return;
    const cam = flyToRect({
      rectX: rect.x, rectY: rect.y, rectW: rect.w, rectH: rect.h,
      viewportW: viewport.width, viewportH: viewport.height, mapW: mapSize.width, mapH: mapSize.height,
      left: layer.left, top: layer.top, reservedBottom, mild,
    });
    cancelAnimation(scale); cancelAnimation(tx); cancelAnimation(ty);
    scale.value = withTiming(cam.scale, { duration: 280 });
    tx.value = withTiming(cam.tx, { duration: 280 });
    ty.value = withTiming(cam.ty, { duration: 280 });
  };

  const resetView = () => {
    resetMapCamera(cam);
  };

  const resetMap = () => {
    setSelected(null);
    setSelectedSemanticArea(null);
    setSelectedBoothId(null);
    setQuery('');
    setFocused(false);
    setUnavailable(false);
    setUnmappedInitialLocation(false);
    Keyboard.dismiss();
    resetView();
  };

  const selectPlace = (place: TentedCityPlace, fromQuery?: string) => {
    setUnmappedInitialLocation(false);
    setSelected(place);
    const footprint = place.kind === 'vendor' ? footprintForVendor(place.vendor) : null;
    const individual = footprint?.class === 'confident_lot' && footprint.lotIds.length === 1
      ? TENTED_CITY_INDIVIDUAL_BOOTHS.find((booth) => booth.id === footprint.lotIds[0]) || null
      : null;
    const individualParent = individual ? AREA_BY_LABEL.get(individual.parentRangeLabel) : null;
    const footprintArea = footprint?.areaId ? AREA_BY_ID.get(footprint.areaId) || null : null;
    const semanticArea = individual && individualParent
      ? findSemanticAreaForGeometryArea(individualParent)
      : place.kind === 'vendor'
        ? (findSemanticAreaForVendor(place.vendor)
          || (footprintArea && !footprintArea.flagged ? findSemanticAreaForGeometryArea(footprintArea) : null))
        : null;
    setSelectedSemanticArea(semanticArea);
    setSelectedBoothId(individual?.semanticId || null);
    setQuery(fromQuery ?? placeTitle(place));
    setFocused(false);
    Keyboard.dismiss();
    if (footprint) {
      const focusRect = footprint.parentRect && (footprint.class === 'range_or_named' || isTrustedParentOnlyArea(footprintArea))
        ? footprint.parentRect
        : footprint.rect;
      applyFocus(focusRectForFootprint(focusRect, footprint.parentRect), true, SELECTED_RESERVED_BOTTOM);
    } else if (place.kind === 'stage') applyFocus(placeRect(place), false, SELECTED_RESERVED_BOTTOM);
  };

  const selectSemanticArea = (area: SemanticMapArea) => {
    setUnmappedInitialLocation(false);
    setSelectedSemanticArea(area);
    setSelectedBoothId(null);
    setSelected(null);
    setQuery(area.label);
    setFocused(false);
    Keyboard.dismiss();
    applyFocus(semanticAreaRect(area), false, SELECTED_RESERVED_BOTTOM);
  };

  const selectIndividualBooth = (booth: TentedCityIndividualBooth) => {
    setSelectedBoothId(booth.semanticId);
    setSelected(null);
    const parent = AREA_BY_LABEL.get(booth.parentRangeLabel);
    setSelectedSemanticArea(parent ? findSemanticAreaForGeometryArea(parent) : null);
    setQuery(booth.humanLabel);
    setFocused(false);
    Keyboard.dismiss();
    applyFocus(focusRectForFootprint(booth.rect, AREA_BY_LABEL.get(booth.parentRangeLabel)?.rect), true, SELECTED_RESERVED_BOTTOM);
  };

  const clearSelection = () => {
    setSelected(null); setSelectedSemanticArea(null); setSelectedBoothId(null); setQuery(''); setFocused(false); setUnavailable(false); setUnmappedInitialLocation(false); Keyboard.dismiss(); resetView();
  };

  useEffect(() => { setUnavailable(Boolean(mapUnavailable)); }, [mapUnavailable]);
  useEffect(() => { setVerify1A(Boolean(verify1AProp)); }, [verify1AProp]);
  useEffect(() => {
    setUnmappedInitialLocation(false);
    if (mapUnavailable || !initialQuery) return;
    const place = findTentedCityPlace(initialQuery, tentedCityVendors);
    if (!place) {
      const semanticArea = findSemanticAreaForLocation(initialQuery);
      if (semanticArea) selectSemanticArea(semanticArea);
      else {
        setSelected(null);
        setSelectedSemanticArea(null);
        setSelectedBoothId(null);
        setQuery(initialQuery);
        setUnmappedInitialLocation(true);
      }
      return;
    }
    if (exactInitialPlace && (place.kind !== 'vendor' || place.vendor.name !== initialQuery)) {
      const semanticArea = findSemanticAreaForLocation(initialQuery);
      if (semanticArea) {
        selectSemanticArea(semanticArea);
        return;
      }
      if (place.kind === 'vendor' && place.vendor.locationLabel
        && place.vendor.locationLabel.replace(/[^A-Za-z0-9]+/g, '').toUpperCase()
          === initialQuery.replace(/[^A-Za-z0-9]+/g, '').toUpperCase()) {
        selectPlace(place, placeTitle(place));
      }
      return;
    }
    // Stages may have rect:null but a parentVenueId fallback (placeRect).
    // Only treat as unmapped when no usable rect (own or parent) exists.
    if (place.kind === 'stage' && !placeRect(place)) {
      setSelected(null);
      setSelectedSemanticArea(null);
      setSelectedBoothId(null);
      setQuery(initialQuery);
      setUnmappedInitialLocation(true);
      return;
    }
    selectPlace(place, placeTitle(place));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, mapUnavailable, exactInitialPlace, viewport.width]);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const node = resolveDomNode(viewportRef.current);
    if (!node) return undefined;
    return attachWebMapGestures(node, cam);
  }, [viewport.width, viewport.height, cam]);

  const results = useMemo(
    () => (focused || query.trim() ? searchTentedCity(query, tentedCityVendors, filter) : []),
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
      // Keep only stages with their own rect. Parent-fallback stages (MNP Lifestyles
      // children) stay omitted so three dots do not stack on the same parent footprint.
      // Find-on-Map still works via placeRect parent fallback.
      return tentedCityVenues.filter((v) => v.kind === 'stage' && v.rect).map((v) => ({ key: v.id, rect: v.rect!, place: { kind: 'stage' as const, venue: v } }));
    }
    return [];
  }, [filter]);

  const composed = useMemo(() => createMapNativeGestures(cam), [cam]);
  const mapStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));
  const boothDividerStyle = useAnimatedStyle(() => ({
    opacity: scale.value >= BOOTH_DIVIDER_VISIBLE_SCALE ? 0.5 : 0,
  }));
  const webLock = Platform.OS === 'web' ? WEB_TOUCH_LOCK : null;
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 1 && height > 1 && (!measured || width !== measured.width || height !== measured.height)) setMeasured({ width, height });
  };
  const vendorFootprint = selected?.kind === 'vendor' ? footprintForVendor(selected.vendor) : null;
  const highlight = vendorFootprint ? vendorFootprint.rect : selected?.kind === 'stage' ? placeRect(selected) : null;
  const exactSelectedBooth = selectedBoothId
    ? TENTED_CITY_INDIVIDUAL_BOOTHS.find((booth) => booth.semanticId === selectedBoothId) || null
    : null;
  const parentRangeForExact = exactSelectedBooth
    ? AREA_BY_LABEL.get(exactSelectedBooth.parentRangeLabel) || null
    : null;
  const useExactBoothHierarchy = Boolean(exactSelectedBooth && parentRangeForExact);
  const footprintGeometryArea = vendorFootprint?.areaId ? AREA_BY_ID.get(vendorFootprint.areaId) || null : null;
  const parentOnlyFootprint = Boolean(
    vendorFootprint
      && !useExactBoothHierarchy
      && (
        vendorFootprint.class === 'range_or_named'
        || isTrustedParentOnlyArea(footprintGeometryArea)
        || vendorFootprint.lotIds.length !== 1
      ),
  );
  // Semantic tap / schedule alias for Quilt Tent & Rural Expo: same yellow parent fill as vendor parent-only.
  const parentOnlySemanticGeometry = (!useExactBoothHierarchy && selectedSemanticArea
    ? TENTED_CITY_TRUSTED_PARENT_ONLY_RANGES.find((area) => findSemanticAreaForGeometryArea(area)?.id === selectedSemanticArea.id)
    : null) || null;
  const parentOnlyFillRect = useExactBoothHierarchy
    ? null
    : (parentOnlyFootprint && vendorFootprint?.parentRect)
      || parentOnlySemanticGeometry?.rect
      || null;
  const selectedTitle = selected ? placeTitle(selected) : selectedSemanticArea?.label || '';
  const selectedBooth = selected?.kind === 'vendor' ? selected.vendor.locationLabel : selectedBoothId ? TENTED_CITY_INDIVIDUAL_BOOTHS.find((booth) => booth.semanticId === selectedBoothId)?.humanLabel || '' : '';
  const selectedMeta = selected?.kind === 'vendor'
    ? `${selected.vendor.category}${selected.vendor.tent ? `  \u00b7  ${selected.vendor.tent}` : ''}${vendorFootprint ? '' : '  \u00b7  map location not available'}`
    : selected?.kind === 'stage'
      ? selected.venue.note || (selected.venue.rect ? 'Stage' : 'On the schedule \u2014 booth not on this map yet')
      : '';

  const visibleIndividualBooths = useMemo(() => {
    if (!selectedSemanticArea) return [];
    return TENTED_CITY_INDIVIDUAL_BOOTHS.filter((booth) => {
      const parent = AREA_BY_LABEL.get(booth.parentRangeLabel);
      return parent ? findSemanticAreaForGeometryArea(parent)?.id === selectedSemanticArea.id : false;
    });
  }, [selectedSemanticArea]);

  const mapGestures = (
    <Animated.View style={[styles.gestureRoot, webLock]} collapsable={false}>
      <Animated.View style={[styles.mapLayer, { width: layer.width, height: layer.height, left: layer.left, top: layer.top, transformOrigin: 'top left' }, mapStyle]}>
        <Image source={MAP_SOURCE} style={[styles.mapImage, { width: layer.width, height: layer.height }]} resizeMode="stretch" />
        {TENTED_CITY_BOOTH_DIVIDER_SEGMENTS.map((seg) => (
          <Animated.View
            key={seg.key}
            pointerEvents="none"
            testID="booth-divider"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.boothDivider,
              boothDividerStyle,
              {
                left: `${seg.x}%`,
                top: `${seg.y}%`,
                height: `${seg.h}%`,
              },
            ]}
          />
        ))}
        {useExactBoothHierarchy && parentRangeForExact ? (
          <View
            pointerEvents="none"
            testID="selected-parent-range-fill"
            style={[
              styles.parentRangeFill,
              {
                left: `${parentRangeForExact.rect.x}%`,
                top: `${parentRangeForExact.rect.y}%`,
                width: `${parentRangeForExact.rect.w}%`,
                height: `${parentRangeForExact.rect.h}%`,
              },
            ]}
          />
        ) : parentOnlyFillRect ? (
          <View
            pointerEvents="none"
            testID="selected-parent-range-fill"
            style={[
              styles.parentRangeFill,
              {
                left: `${parentOnlyFillRect.x}%`,
                top: `${parentOnlyFillRect.y}%`,
                width: `${parentOnlyFillRect.w}%`,
                height: `${parentOnlyFillRect.h}%`,
              },
            ]}
          />
        ) : null}
        {TENTED_CITY_SEMANTIC_AREAS.map((area) => {
          const rect = semanticAreaRect(area);
          const active = selectedSemanticArea?.id === area.id;
          const showSemanticFill = active && !useExactBoothHierarchy && !parentOnlyFillRect;
          return <TouchableOpacity
            key={area.id}
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityLabel={`Select ${area.label}`}
            onPress={() => selectSemanticArea(area)}
            style={[styles.semanticHitbox, { left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` }, showSemanticFill && styles.semanticHitboxActive]}
          />;
        })}
        {visibleIndividualBooths.map((booth) => {
          const active = selectedBoothId === booth.semanticId;
          return <React.Fragment key={booth.semanticId}><TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Select booth ${booth.humanLabel}`}
            onPress={() => selectIndividualBooth(booth)}
            activeOpacity={1}
            style={[styles.individualBoothHitbox, { left: `${booth.rect.x}%`, top: `${booth.rect.y}%`, width: `${booth.rect.w}%`, height: `${booth.rect.h}%` }]}
          />
            {active ? (
              <View
                pointerEvents="none"
                testID="selected-booth-highlight"
                style={[
                  styles.exactBoothCellFill,
                  {
                    left: `${booth.rect.x}%`,
                    top: `${booth.rect.y}%`,
                    width: `${booth.rect.w}%`,
                    height: `${booth.rect.h}%`,
                  },
                ]}
              />
            ) : null}
          </React.Fragment>;
        })}
        {filterDots.map((dot) => (
          <TouchableOpacity key={dot.key} activeOpacity={0.8} onPress={() => selectPlace(dot.place)} style={[styles.filterDot, { left: `${dot.rect.x + dot.rect.w / 2}%`, top: `${dot.rect.y + dot.rect.h / 2}%` }]} />
        ))}
        {verify1A ? TENTED_CITY_VERIFY_PARENTS.map((parent) => (
          <View key={parent.id} pointerEvents="none" style={[styles.verifyParent, { left: `${parent.rect.x}%`, top: `${parent.rect.y}%`, width: `${parent.rect.w}%`, height: `${parent.rect.h}%` }]}>
            <Text style={styles.verifyParentLabel}>{parent.label}</Text>
          </View>
        )) : null}
        {useExactBoothHierarchy || parentOnlyFillRect ? null : parentOnlyFootprint && vendorFootprint ? (
          <>
            {vendorFootprint.rects.map((rect, i) => (
              <BoothHighlight testID="vendor-booth-highlight" rect={rect} key={`fp-${i}-${rect.x}-${rect.y}`} layer={layer} border={0} borderColor="transparent" style={styles.footprint}>
                <View style={[styles.parentRangeFillInner, { backgroundColor: PARENT_RANGE_FILL }]} />
              </BoothHighlight>
            ))}
          </>
        ) : vendorFootprint ? vendorFootprint.rects.map((rect, i) => (
          <BoothHighlight testID="vendor-booth-highlight" rect={rect} key={`fp-${i}-${rect.x}-${rect.y}`} layer={layer} border={0} borderColor="transparent" style={styles.footprint}>
            <View style={[styles.parentRangeFillInner, { backgroundColor: PARENT_RANGE_FILL }]} />
          </BoothHighlight>
        )) : highlight ? (
          // Stages (incl. MNP parent-fallback): full footprint rectangle like exact-booth selection.
          // No circular/ring destination marker — cyan fill + strong white border over placeRect.
          <View
            pointerEvents="none"
            testID="selected-stage-highlight"
            style={[
              styles.exactBoothCellFill,
              {
                left: `${highlight.x}%`,
                top: `${highlight.y}%`,
                width: `${highlight.w}%`,
                height: `${highlight.h}%`,
                // Keep cyan identity (#00E5FF) but translucent so printed tent text stays readable.
                backgroundColor: 'rgba(0, 229, 255, 0.45)',
                borderWidth: 3,
                borderColor: '#FFFFFF',
              },
            ]}
          />
        ) : null}
      </Animated.View>
    </Animated.View>
  );

  return (
    <View style={styles.root} collapsable={false}>
      <View
        ref={viewportRef}
        style={[styles.viewport, webLock]}
        onLayout={onLayout}
        collapsable={false}
      >
        {Platform.OS === 'web' ? mapGestures : (
          <GestureDetector gesture={composed}>{mapGestures}</GestureDetector>
        )}
      </View>
      <View style={styles.chrome} pointerEvents="box-none">
      <View style={[styles.topOverlay, hideModeSelector && styles.topOverlayWithParentSelector]} pointerEvents="box-none">
        {hideModeSelector ? (
          <TouchableOpacity
            style={styles.verifyTapTarget}
            onPress={() => {
              const now = Date.now();
              if (now - verifyTaps.current.at > 900) verifyTaps.current.count = 0;
              verifyTaps.current.at = now; verifyTaps.current.count += 1;
              if (verifyTaps.current.count >= 5) { verifyTaps.current.count = 0; setVerify1A((on) => !on); }
            }}
            accessibilityLabel="Tented City map"
          />
        ) : (
        <View style={styles.modeRow}>
          <TouchableOpacity style={styles.modeBtn} onPress={onSwitchToGrounds} accessibilityLabel="Show grounds map"><Text style={styles.modeBtnText}>Grounds</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.modeBtn, styles.modeBtnOn]} onPress={() => {
            const now = Date.now();
            if (now - verifyTaps.current.at > 900) verifyTaps.current.count = 0;
            verifyTaps.current.at = now; verifyTaps.current.count += 1;
            if (verifyTaps.current.count >= 5) { verifyTaps.current.count = 0; setVerify1A((on) => !on); }
          }} accessibilityLabel="Tented City">
            <Text style={[styles.modeBtnText, styles.modeBtnTextOn]}>Tented City</Text>
          </TouchableOpacity>
        </View>
        )}
        <View style={styles.searchCard}>
          <Feather name="search" size={18} color="#6B7280" />
          <TextInput value={query} onChangeText={(text) => { setQuery(text); setUnmappedInitialLocation(false); setFocused(true); if (!text.trim()) { setSelected(null); setSelectedBoothId(null); setSelectedSemanticArea(null); } }} onFocus={() => setFocused(true)} placeholder="Find a vendor, booth, or stage" placeholderTextColor="#9CA3AF" style={styles.searchInput} autoCapitalize="none" autoCorrect={false} returnKeyType="search" onSubmitEditing={() => { if (results[0]) selectPlace(results[0]); }} />
          {query ? <TouchableOpacity onPress={clearSelection} hitSlop={8} accessibilityLabel="Clear search"><Feather name="x" size={18} color="#6B7280" /></TouchableOpacity> : null}
        </View>
        <View style={styles.filters}>
          {FILTERS.map((item) => {
            const on = filter === item.id;
            return <TouchableOpacity key={item.id} style={[styles.chip, on && styles.chipOn]} onPress={() => setFilter(item.id)}><Text style={[styles.chipText, on && styles.chipTextOn]}>{item.label}</Text></TouchableOpacity>;
          })}
        </View>
        {verify1A ? <View style={styles.verifyBanner} pointerEvents="none"><Text style={styles.verifyBannerText}>Tented City geometry overlay on. Five taps on Tented City to hide.</Text></View> : null}
        {focused && query.trim().length > 0 ? (
          <ScrollView style={styles.results} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {results.map((hit, i) => {
              const title = placeTitle(hit);
              const meta = hit.kind === 'vendor' ? hit.vendor.locationLabel : 'Stage';
              return (
                <TouchableOpacity key={`${title}-${i}`} style={styles.resultRow} onPress={() => selectPlace(hit)}>
                  <Feather name={hit.kind === 'stage' ? 'mic' : 'map-pin'} size={16} color={colors.primary} />
                  <View style={{ flex: 1 }}><Text style={styles.resultName} numberOfLines={1}>{title}</Text><Text style={styles.resultMeta}>{meta}</Text></View>
                </TouchableOpacity>
              );
            })}
            {results.length === 0 ? <Text style={styles.empty}>No matching places on this map.</Text> : null}
          </ScrollView>
        ) : null}
      </View>
      <View style={styles.fabCol}>
        <TouchableOpacity style={styles.fab} onPress={resetMap} accessibilityLabel="Reset map zoom"><Feather name="maximize-2" size={18} color={colors.textPrimary} /></TouchableOpacity>
      </View>
      {unmappedInitialLocation ? (
        <View style={styles.infoCard} accessibilityRole="alert">
          <View style={styles.infoHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.infoTitle}>This location isn’t mapped yet.</Text>
              <Text style={styles.infoMeta}>We only show locations matched confidently to the current site map.</Text>
            </View>
            <TouchableOpacity onPress={clearSelection} hitSlop={10} accessibilityLabel="Dismiss"><Feather name="x" size={20} color={colors.textMuted} /></TouchableOpacity>
          </View>
        </View>
      ) : selected || selectedSemanticArea ? (
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.infoTitle} numberOfLines={2}>{selectedTitle}</Text>
              {selectedBooth ? <Text style={styles.infoBooth} numberOfLines={1}>{selectedBooth}</Text> : null}
              {selectedSemanticArea && !selected ? <Text style={styles.infoBooth} numberOfLines={2}>{selectedSemanticArea.category}</Text> : null}
              {selectedMeta ? <Text style={styles.infoMeta} numberOfLines={1}>{selectedMeta}</Text> : null}
            </View>
            <TouchableOpacity onPress={clearSelection} hitSlop={10} accessibilityLabel="Dismiss"><Feather name="x" size={20} color={colors.textMuted} /></TouchableOpacity>
          </View>
          {stageEvents.length > 0 ? <View style={styles.events}>{stageEvents.map((event) => <Text key={event.id} style={styles.eventLine} numberOfLines={1}>{event.start_time ? `${event.start_time}  \u00b7  ` : ''}{event.title}</Text>)}</View> : null}
        </View>
      ) : unavailable ? (
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}><Text style={styles.infoTitle}>Map location not available</Text></View>
            <TouchableOpacity onPress={clearSelection} hitSlop={10} accessibilityLabel="Dismiss"><Feather name="x" size={20} color={colors.textMuted} /></TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.hint} pointerEvents="none"><Feather name="zoom-in" size={14} color={colors.textMuted} /><Text style={styles.hintText}>Drag \u00b7 pinch \u00b7 double-tap</Text></View>
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, position: 'relative', width: '100%', height: '100%', backgroundColor: '#C9B896' },
  viewport: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  gestureRoot: { ...StyleSheet.absoluteFillObject },
  chrome: { ...StyleSheet.absoluteFillObject, paddingBottom: TAB_BAR_HEIGHT, justifyContent: 'flex-end' },
  mapLayer: { position: 'absolute', overflow: 'visible' },
  mapImage: { width: '100%', height: '100%' },
  boothDivider: { position: 'absolute', width: StyleSheet.hairlineWidth, marginLeft: -StyleSheet.hairlineWidth / 2, backgroundColor: 'rgba(60, 42, 28, 0.42)', zIndex: 1 },
  semanticHitbox: { position: 'absolute', backgroundColor: 'transparent' },
  semanticHitboxActive: { borderWidth: 0, backgroundColor: PARENT_RANGE_FILL },
  individualBoothHitbox: { position: 'absolute', backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(245,197,24,0.22)' },
  parentRangeFill: { position: 'absolute', backgroundColor: PARENT_RANGE_FILL, zIndex: 2 },
  parentRangeFillHighlight: { position: 'absolute', overflow: 'hidden', zIndex: 2 },
  footprint: { position: 'absolute', overflow: 'hidden', zIndex: 2 },
  parentRangeFillInner: { ...StyleSheet.absoluteFillObject },
  exactBoothCellFill: { position: 'absolute', backgroundColor: EXACT_BOOTH_CELL_FILL, zIndex: 4 },
  filterDot: { position: 'absolute', width: 12, height: 12, marginLeft: -6, marginTop: -6, borderRadius: 6, backgroundColor: colors.accent, borderWidth: 2, borderColor: '#FFFFFF' },
  topOverlayWithParentSelector: { paddingTop: 52 },
  verifyTapTarget: { height: 44, alignSelf: 'stretch' },
  topOverlay: { position: 'absolute', top: 8, left: 12, right: 12, zIndex: 20 },
  modeRow: { alignSelf: 'center', flexDirection: 'row', backgroundColor: 'rgba(232,228,218,0.95)', borderRadius: 12, padding: 3, marginBottom: 8, gap: 4 },
  modeBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  modeBtnOn: { backgroundColor: '#FFFFFF' },
  modeBtnText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  modeBtnTextOn: { color: colors.primary },
  searchCard: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  searchInput: { flex: 1, fontSize: 16, color: '#111827', paddingVertical: 10 },
  filters: { flexDirection: 'row', gap: 8, marginTop: 8 },
  chip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: '#4B5563' },
  chipTextOn: { color: '#FFFFFF' },
  results: { marginTop: 6, backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden', maxHeight: 260 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB', minHeight: 48 },
  resultName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  resultMeta: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  empty: { padding: 14, color: '#6B7280' },
  fabCol: { position: 'absolute', right: 12, bottom: 108, zIndex: 30 },
  fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  infoCard: { marginHorizontal: 12, marginBottom: INFO_CARD_GAP, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6, zIndex: 20 },
  infoHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  infoTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  infoBooth: { fontSize: 16, fontWeight: '800', color: colors.primary, marginTop: 4 },
  infoMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  events: { marginTop: 8, gap: 4 },
  eventLine: { fontSize: 13, color: '#374151' },
  hint: { alignSelf: 'center', marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  hintText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  verifyParent: { position: 'absolute', borderWidth: 2, borderColor: '#22D3EE', backgroundColor: 'transparent' },
  verifyParentLabel: { position: 'absolute', top: -14, left: 0, fontSize: 10, fontWeight: '800', color: '#0E7490', backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 4 },
  verifyLot: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  verifyLotLabel: { fontSize: 8, fontWeight: '800', color: '#111827', backgroundColor: 'rgba(255,255,255,0.82)', paddingHorizontal: 1 },
  verifyBanner: { marginTop: 8, backgroundColor: 'rgba(14,116,144,0.92)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  verifyBannerText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
