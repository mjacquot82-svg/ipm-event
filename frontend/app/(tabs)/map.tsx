// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import GroundsMap from '../../src/components/GroundsMap';
import TentedCityMap from '../../src/components/TentedCityMap';
import RvParkDetailMap from '../../src/components/RvParkDetailMap';
import MapModeSelector, { MapMode } from '../../src/components/MapModeSelector';
import colors from '../../src/theme/colors';
import { usePageAnalytics } from '../../src/analytics/usePageAnalytics';
import { mapLocations } from '../../src/config/mapLocations';
import { findTentedCityPlace } from '../../src/config/tentedCitySearch';
import { tentedCityVendors } from '../../src/data/tentedCityVendors';
import { resolveGroundsZone } from '../../src/config/groundsZones';

export default function MapScreen() {
  const { location, source, mapStatus, verify1a } = useLocalSearchParams<{
    location?: string;
    showOnly?: string;
    source?: string;
    mapStatus?: string;
    verify1a?: string;
  }>();
  const locationId = mapLocations.find((item) => item.name === location)?.id;
  usePageAnalytics('map', source || 'other', 'map_opened', locationId ? { location_id: locationId } : {});

  const unavailable = mapStatus === 'unavailable';
  const verify1A = verify1a === '1' || verify1a === 'true';
  const tentedMatch = !unavailable && findTentedCityPlace(location, tentedCityVendors);
  const groundsZone = resolveGroundsZone(typeof location === 'string' ? location : null);
  const openRv = groundsZone?.id === 'rv-park' && source === 'rv-detail';
  const [mode, setMode] = useState<MapMode>(
    openRv
      ? 'rv'
      : tentedMatch || source === 'schedule' || source === 'vendors' || unavailable || verify1A
        ? 'tented'
        : 'grounds',
  );

  const selector = (
    <View style={styles.selectorHost} pointerEvents="box-none">
      <MapModeSelector mode={mode} onChange={setMode} />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View
        style={[styles.tentedHost, mode !== 'tented' && styles.tentedHostHidden]}
        pointerEvents={mode === 'tented' ? 'auto' : 'none'}
        accessibilityElementsHidden={mode !== 'tented'}
        importantForAccessibility={mode === 'tented' ? 'yes' : 'no-hide-descendants'}
        collapsable={false}
      >
        <TentedCityMap
          initialQuery={unavailable ? '' : typeof location === 'string' ? location : ''}
          mapUnavailable={unavailable}
          exactInitialPlace={source === 'vendors'}
          verify1A={verify1A}
          onSwitchToGrounds={() => setMode('grounds')}
          hideModeSelector
        />
      </View>
      {mode === 'rv' ? (
        <View style={styles.rvHost}>
          <RvParkDetailMap
            onSwitchToGrounds={() => setMode('grounds')}
            hideModeSelector
          />
        </View>
      ) : null}
      {mode === 'grounds' ? (
        <View style={styles.grounds}>
          <GroundsMap
            highlightedLocation={location || null}
            onSwitchToTented={() => setMode('tented')}
            onSwitchToRv={() => setMode('rv')}
          />
        </View>
      ) : null}
      {selector}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative', backgroundColor: colors.background },
  tentedHost: { ...StyleSheet.absoluteFillObject },
  tentedHostHidden: { opacity: 0, zIndex: 0 },
  grounds: { ...StyleSheet.absoluteFillObject, zIndex: 2, backgroundColor: colors.background },
  rvHost: { ...StyleSheet.absoluteFillObject, zIndex: 3, backgroundColor: colors.background },
  selectorHost: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    zIndex: 40,
    alignItems: 'center',
  },
});
