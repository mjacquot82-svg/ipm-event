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
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
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
import {
  clampTranslation,
  DOUBLE_TAP_SCALE,
  flyToRect,
  rubberBandTranslation,
  translationBounds,
  zoomAroundFocal,
} from '../config/tentedCityCamera';

const MAP_SOURCE = require('../../assets/images/tented-city-map.png');
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

type WheelLike = {
  preventDefault: () => void;
  deltaY: number;
  clientX: number;
  clientY: number;
};

type WheelTarget = {
  addEventListener: (type: string, listener: (event: WheelLike) => void, options?: { passive?: boolean }) => void;
  removeEventListener: (type: string, listener: (event: WheelLike) => void) => void;
  getBoundingClientRect: () => { left: number; top: number };
};

function resolveDomNode(ref: unknown): WheelTarget | null {
  if (!ref || typeof ref !== 'object') return null;
  const node = ref as {
    addEventListener?: unknown;
    removeEventListener?: unknown;
    getBoundingClientRect?: unknown;
    _nativeNode?: unknown;
    getNode?: () => unknown;
  };
  if (
    typeof node.addEventListener === 'function' &&
    typeof node.removeEventListener === 'function' &&
    typeof node.getBoundingClientRect === 'function'
  ) {
    return node as WheelTarget;
  }
  const inner = node._nativeNode ?? (typeof node.getNode === 'function' ? node.getNode() : null);
  return inner && inner !== ref ? resolveDomNode(inner) : null;
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
  const fillOpacity = useSharedValue(0.52);
  const viewW = useSharedValue(1);
  const viewH = useSharedValue(1);
  const mapW = useSharedValue(1);
  const mapH = useSharedValue(1);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);

  const layer = useMemo(() => tentedCityLayerLayout(viewport), [viewport]);
  const mapSize = layer.mapSize;

  useEffect(() => {
    viewW.value = viewport.width;
    viewH.value = viewport.height;
    mapW.value = mapSize.width;
    mapH.value = mapSize.height;
    originX.value = layer.left;
    originY.value = layer.top;
  }, [viewport.width, viewport.height, mapSize.width, mapSize.height, layer.left, layer.top]);

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
    const cam = flyToRect({
      rectX: rect.x,
      rectY: rect.y,
      rectW: rect.w,
      rectH: rect.h,
      viewportW: viewport.width,
      viewportH: viewport.height,
      mapW: mapSize.width,
      mapH: mapSize.height,
      left: layer.left,
      top: layer.top,
      reservedBottom,
      mild,
    });
    cancelAnimation(scale);
    cancelAnimation(tx);
    cancelAnimation(ty);
    scale.value = withTiming(cam.scale, { duration: 280 });
    tx.value = withTiming(cam.tx, { duration: 280 });
    ty.value = withTiming(cam.ty, { duration: 280 });
  };

  const resetView = () => {
    cancelAnimation(scale);
    cancelAnimation(tx);
    cancelAnimation(ty);
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

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const node = resolveDomNode(viewportRef.current);
    if (!node) return undefined;
    const onWheel = (event: WheelLike) => {
      event.preventDefault();
      const box = node.getBoundingClientRect();
      const next = zoomAroundFocal({
        scale: scale.value,
        tx: tx.value,
        ty: ty.value,
        nextScale: scale.value * Math.exp(-event.deltaY * 0.0018),
        focalX: event.clientX - box.left,
        focalY: event.clientY - box.top,
        left: originX.value,
        top: originY.value,
      });
      const cam =
        next.scale <= 1.02
          ? { scale: 1, tx: 0, ty: 0 }
          : clampTranslation(next, {
              viewportW: viewW.value,
              viewportH: viewH.value,
              mapW: mapW.value,
              mapH: mapH.value,
              left: originX.value,
              top: originY.value,
            });
      scale.value = cam.scale;
      tx.value = cam.tx;
      ty.value = cam.ty;
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [viewport.width, viewport.height]);

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
      return tentedCityVenues
        .filter((v) => v.kind === 'stage' && v.rect)
        .map((v) => ({ key: v.id, rect: v.rect!, place: { kind: 'stage' as const, venue: v } }));
    }
    return [];
  }, [filter]);

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      cancelAnimation(scale);
      cancelAnimation(tx);
      cancelAnimation(ty);
      startScale.value = scale.value;
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      const next = zoomAroundFocal({
        scale: startScale.value,
        tx: startX.value,
        ty: startY.value,
        nextScale: startScale.value * e.scale,
        focalX: e.focalX,
        focalY: e.focalY,
        left: originX.value,
        top: originY.value,
      });
      const layout = {
        viewportW: viewW.value,
        viewportH: viewH.value,
        mapW: mapW.value,
        mapH: mapH.value,
        left: originX.value,
        top: originY.value,
      };
      const soft = rubberBandTranslation(next, layout);
      scale.value = next.scale;
      tx.value = soft.tx;
      ty.value = soft.ty;
    })
    .onEnd(() => {
      const layout = {
        viewportW: viewW.value,
        viewportH: viewH.value,
        mapW: mapW.value,
        mapH: mapH.value,
        left: originX.value,
        top: originY.value,
      };
      if (scale.value <= 1.02) {
        scale.value = withTiming(1, { duration: 200 });
        tx.value = withTiming(0, { duration: 200 });
        ty.value = withTiming(0, { duration: 200 });
        return;
      }
      const cam = clampTranslation(
        { scale: scale.value, tx: tx.value, ty: ty.value },
        layout,
      );
      scale.value = withTiming(cam.scale, { duration: 180 });
      tx.value = withTiming(cam.tx, { duration: 180 });
      ty.value = withTiming(cam.ty, { duration: 180 });
    });

  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onBegin(() => {
      cancelAnimation(tx);
      cancelAnimation(ty);
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      const layout = {
        viewportW: viewW.value,
        viewportH: viewH.value,
        mapW: mapW.value,
        mapH: mapH.value,
        left: originX.value,
        top: originY.value,
      };
      const soft = rubberBandTranslation(
        { scale: scale.value, tx: startX.value + e.translationX, ty: startY.value + e.translationY },
        layout,
      );
      tx.value = soft.tx;
      ty.value = soft.ty;
    })
    .onEnd((e) => {
      const layout = {
        viewportW: viewW.value,
        viewportH: viewH.value,
        mapW: mapW.value,
        mapH: mapH.value,
        left: originX.value,
        top: originY.value,
      };
      if (scale.value <= 1.02) {
        tx.value = withTiming(0, { duration: 180 });
        ty.value = withTiming(0, { duration: 180 });
        return;
      }
      const bounds = translationBounds(scale.value, layout);
      tx.value = withDecay({
        velocity: e.velocityX,
        clamp: [bounds.minTx, bounds.maxTx],
        rubberBandEffect: true,
        rubberBandFactor: 0.55,
        deceleration: 0.996,
      });
      ty.value = withDecay({
        velocity: e.velocityY,
        clamp: [bounds.minTy, bounds.maxTy],
        rubberBandEffect: true,
        rubberBandFactor: 0.55,
        deceleration: 0.996,
      });
    });
