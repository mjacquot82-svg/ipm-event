import { VendorMapArrival } from '../../src/components/VendorTutorial';
import EntrancesParkingMap from '../../src/components/EntrancesParkingMap';
import { MapEducationAnchors, MapEducationMode, MapEducationReplay, MapsEducation, ScheduleMapArrival } from '../../src/components/MapEducation';
// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { desktopMapStyles, useDesktopMapWorkspace } from '../../src/theme/desktopMapWorkspace';
import { View, StyleSheet, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import GroundsMap from '../../src/components/GroundsMap';
import TentedCityMap from '../../src/components/TentedCityMap';
import RvParkDetailMap from '../../src/components/RvParkDetailMap';
import MapModeSelector, { MapMode } from '../../src/components/MapModeSelector';
import colors from '../../src/theme/colors';
import { usePageAnalytics } from '../../src/analytics/usePageAnalytics';
import { mapLocations } from '../../src/config/mapLocations';
import { findTentedCityPlace, resolveMapTypeForLocation } from '../../src/config/tentedCitySearch';
import { tentedCityVendors } from '../../src/data/tentedCityVendors';
import { resolveGroundsZone } from '../../src/config/groundsZones';
import type { ParadeRouteId } from '../../src/config/tentedCityParadeRoutes';

function paramStr(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function resolveInitialMode(args: {
  mapType?: string;
  location?: string;
  source?: string;
  unavailable: boolean;
  verify1A: boolean;
}): MapMode {
  const { mapType, location, source, unavailable, verify1A } = args;
  // Explicit route param wins — schedule/vendors set this so mode does not depend on remount.
  if (mapType === 'tented' || mapType === 'grounds' || mapType === 'rv' || mapType === 'entrances') return mapType;
  const groundsZone = resolveGroundsZone(location || null);
  if (groundsZone?.id === 'rv-park' && source === 'rv-detail') return 'rv';
  if (unavailable || verify1A) return 'tented';
  if (location && resolveMapTypeForLocation(location, tentedCityVendors) === 'tented') return 'tented';
  if (location && findTentedCityPlace(location, tentedCityVendors)) return 'tented';
  // Vendors Find-on-Map is always Tented City (mapped or unavailable sheet).
  if (source === 'vendors') return 'tented';
  return 'grounds';
}

export default function MapScreen() {
  const anchors = useRef({});
  const replay = useRef<(() => void) | null>(null);
  return <MapEducationReplay.Provider value={replay}><MapEducationAnchors.Provider value={anchors}><MapContent /></MapEducationAnchors.Provider></MapEducationReplay.Provider>;
}
function MapContent() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    location?: string | string[];
    vendorName?: string | string[];
    vendorLocation?: string | string[];
    vendorType?: string | string[];
    eventId?: string | string[];
    scheduleWalkthrough?: string | string[];
    vendorWalkthrough?: string | string[];
    vendorTutorialName?: string | string[];
    eventTitle?: string | string[];
    showOnly?: string | string[];
    source?: string | string[];
    mapStatus?: string | string[];
    verify1a?: string | string[];
    mapType?: string | string[];
    paradeRoute?: string | string[];
  }>();
  const location = paramStr(params.location);
  const vendorName = paramStr(params.vendorName);
  const vendorLocation = paramStr(params.vendorLocation);
  const source = paramStr(params.source);
  const eventTitle = source === 'schedule' ? paramStr(params.eventTitle) : undefined;
  const eventId = source === 'schedule' ? paramStr(params.eventId) : undefined;
  const mapStatus = paramStr(params.mapStatus);
  const verify1a = paramStr(params.verify1a);
  const mapType = paramStr(params.mapType);
  const paradeRoute = paramStr(params.paradeRoute);
  const initialParadeRoute: ParadeRouteId | null = paradeRoute === 'tuesday' || paradeRoute === 'wed-sat' ? paradeRoute : null;

  const locationId = mapLocations.find((item) => item.name === location)?.id;
  usePageAnalytics('map', source || 'other', 'map_opened', locationId ? { location_id: locationId } : {});

  const unavailable = mapStatus === 'unavailable';
  const verify1A = verify1a === '1' || verify1a === 'true';
  const desiredMode = useMemo(
    () =>
      resolveInitialMode({
        mapType,
        location,
        source,
        unavailable,
        verify1A,
      }),
    [mapType, location, source, unavailable, verify1A],
  );

  const [mode, setMode] = useState<MapMode>(desiredMode);
  const desktop = useDesktopMapWorkspace(mode);
  const groundsDesktop = useDesktopMapWorkspace('grounds');
  const tentedDesktop = useDesktopMapWorkspace('tented');
  const rvDesktop = useDesktopMapWorkspace('rv');
  const entrancesDesktop = useDesktopMapWorkspace('entrances');
  const [overrideLocation, setOverrideLocation] = useState<string | null>(null);

  // Tab navigators keep Map mounted — sync mode when schedule/vendors navigate with new params.
  useEffect(() => {
    setMode(desiredMode);
    setOverrideLocation(null);
  }, [desiredMode, location]);

  const selector = (
    <View style={[styles.selectorHost, desktop && { top: 32, left: desktop.left + 16, right: 'auto', width: desktop.width - 32 }]} pointerEvents="box-none">
      <MapModeSelector mode={mode} onChange={setMode} desktop={Boolean(desktop)} />
    </View>
  );

  return (
    <MapEducationMode.Provider value={mode}><View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View
        style={[styles.tentedHost, tentedDesktop && desktopMapStyles.host, tentedDesktop, mode !== 'tented' && styles.tentedHostHidden]}
        pointerEvents={mode === 'tented' ? 'auto' : 'none'}
        accessibilityElementsHidden={mode !== 'tented'}
        importantForAccessibility={mode === 'tented' ? 'yes' : 'no-hide-descendants'}
        collapsable={false}
      >
        <TentedCityMap
          initialQuery={unavailable || initialParadeRoute ? '' : (overrideLocation || (typeof location === 'string' ? location : '') || '')}
          initialVendorName={vendorName}
          initialVendorLocation={vendorLocation}
          initialVendorType={paramStr(params.vendorType)}
          mapUnavailable={unavailable}
          initialEventTitle={!overrideLocation ? eventTitle : undefined}
          initialEventId={!overrideLocation ? eventId : undefined}
          initialParadeRoute={initialParadeRoute}
          exactInitialPlace={source === 'vendors' && !overrideLocation && !vendorName}
          verify1A={verify1A}
          onSwitchToGrounds={(loc) => {
            if (loc) setOverrideLocation(loc);
            setMode('grounds');
          }}
          hideModeSelector
        />
      </View>
      {mode === 'rv' ? (
        <View style={[styles.rvHost, rvDesktop && desktopMapStyles.host, rvDesktop]}>
          <RvParkDetailMap
            onSwitchToGrounds={() => setMode('grounds')}
            hideModeSelector
          />
        </View>
      ) : null}
      {mode === 'grounds' ? (
        <View style={[styles.grounds, groundsDesktop && desktopMapStyles.host, groundsDesktop]}>
          <GroundsMap
            highlightedLocation={overrideLocation || location || null}
            initialEventTitle={!overrideLocation ? eventTitle : undefined}
            initialEventId={!overrideLocation ? eventId : undefined}
            onSwitchToTented={(loc) => {
              if (loc) setOverrideLocation(loc);
              setMode('tented');
            }}
            onSwitchToRv={() => setMode('rv')}
          />
        </View>
      ) : null}
      {mode === 'entrances' ? <View style={[styles.entrances, entrancesDesktop && desktopMapStyles.host, entrancesDesktop]}><EntrancesParkingMap /></View> : null}
      {selector}
      <VendorMapArrival token={source === 'vendors' ? paramStr(params.vendorWalkthrough) : undefined} name={paramStr(params.vendorTutorialName)} onComplete={() => router.setParams({ vendorWalkthrough: undefined, vendorTutorialName: undefined })} />
      <ScheduleMapArrival token={source === 'schedule' ? paramStr(params.scheduleWalkthrough) : undefined} title={eventTitle} onComplete={() => router.setParams({ scheduleWalkthrough: undefined })} />
      {/* Existing destination params defer auto-onboarding for this visit, without changing routing or seen state. */}
      <MapsEducation mode={mode} onShowMap={setMode} autoStart={!Boolean(location || paramStr(params.showOnly) === 'true' || unavailable || verify1A)} />
    </View></MapEducationMode.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative', backgroundColor: colors.background },
  tentedHost: { ...StyleSheet.absoluteFillObject },
  tentedHostHidden: { opacity: 0, zIndex: 0 },
  grounds: { ...StyleSheet.absoluteFillObject, zIndex: 2, backgroundColor: colors.background },
  rvHost: { ...StyleSheet.absoluteFillObject, zIndex: 3, backgroundColor: colors.background },
  entrances: { ...StyleSheet.absoluteFillObject, zIndex: 3, backgroundColor: colors.background },
  selectorHost: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    zIndex: 40,
    alignItems: 'center',
  },
});
