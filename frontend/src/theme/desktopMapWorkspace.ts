import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GROUNDS_IMAGE_ASPECT } from '../config/groundsLayout';
import { TENTED_CITY_IMAGE_ASPECT } from '../config/tentedCityLayout';
import { RV_PARK_IMAGE_ASPECT } from '../config/rvParkLayout';

export const DESKTOP_MAP_BREAKPOINT = 768;
export const DESKTOP_MAP_MAX_WIDTH = 1360;
const HEADER = 120;
const FOOTER = 64;
const INSET = 16;
const ASPECTS = { grounds: GROUNDS_IMAGE_ASPECT, tented: TENTED_CITY_IMAGE_ASPECT, rv: RV_PARK_IMAGE_ASPECT, entrances: 2977 / 2105 };
type MapKind = keyof typeof ASPECTS;

/** A full-artwork desktop frame; mobile and the map engine keep their existing sizing. */
export function desktopMapWorkspace(kind: MapKind, width: number, height: number, topInset = 0) {
  if (width < DESKTOP_MAP_BREAKPOINT) return null;
  const header = HEADER + (kind === 'tented' ? 44 : 0);
  const maxWidth = Math.min(width - 48, DESKTOP_MAP_MAX_WIDTH);
  const availableHeight = Math.max(1, height - topInset - 60 - INSET * 2 - header - FOOTER);
  const mapHeight = Math.min(availableHeight, (maxWidth - INSET * 2) / ASPECTS[kind]);
  const frameWidth = Math.min(maxWidth, Math.max(380, mapHeight * ASPECTS[kind] + INSET * 2));
  return {
    width: frameWidth,
    height: mapHeight + header + FOOTER,
    left: (width - frameWidth) / 2,
    top: INSET,
    right: 'auto' as const,
    bottom: 'auto' as const,
  };
}

export function useDesktopMapWorkspace(kind: MapKind) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return Platform.OS === 'web' ? desktopMapWorkspace(kind, width, height, insets.top || 0) : null;
}

export const desktopMapStyles = StyleSheet.create({
  host: { borderRadius: 16, shadowColor: '#403B30', shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 3 } },
  root: { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden' },
  viewport: { top: HEADER, bottom: FOOTER, left: INSET, right: INSET },
  tentedViewport: { top: HEADER + 44 },
  search: { top: 64, left: INSET, right: INSET, paddingTop: 0 },
  chrome: { paddingBottom: 0 },
  verifyTarget: { position: 'absolute', top: -10, left: 0, right: 0, height: 10 },
  fit: { right: INSET, bottom: 10 },
  hint: { position: 'absolute', left: INSET, right: 72, bottom: 16, marginBottom: 0, paddingHorizontal: 0, paddingVertical: 0, backgroundColor: 'transparent' },
  info: { marginBottom: FOOTER },
  groundsInfo: { bottom: FOOTER },
});
