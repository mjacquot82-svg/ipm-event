// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, StatusBar, TouchableOpacity, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import GroundsMap from '../../src/components/GroundsMap';
import TentedCityMap from '../../src/components/TentedCityMap';
import colors from '../../src/theme/colors';
import { usePageAnalytics } from '../../src/analytics/usePageAnalytics';
import { mapLocations } from '../../src/config/mapLocations';
import { resolveMapTypeForLocation } from '../../src/config/tentedCitySearch';
import { tentedCityVendors } from '../../src/data/tentedCityVendors';

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
}): 'grounds' | 'tented' {
  const { mapType, location, source, unavailable, verify1A } = args;
  // Explicit route param wins — schedule/vendors set this so mode does not depend on remount.
  if (mapType === 'tented' || mapType === 'grounds') return mapType;
  if (unavailable || verify1A) return 'tented';
  if (location && resolveMapTypeForLocation(location, tentedCityVendors) === 'tented') return 'tented';
  // Vendors Find-on-Map is always Tented City (mapped or unavailable sheet).
  if (source === 'vendors') return 'tented';
  return 'grounds';
}

export default function MapScreen() {
  const params = useLocalSearchParams<{
    location?: string | string[];
    showOnly?: string | string[];
    source?: string | string[];
    mapStatus?: string | string[];
    verify1a?: string | string[];
    mapType?: string | string[];
  }>();
  const location = paramStr(params.location);
  const source = paramStr(params.source);
  const mapStatus = paramStr(params.mapStatus);
  const verify1a = paramStr(params.verify1a);
  const mapType = paramStr(params.mapType);

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

  const [mode, setMode] = useState<'grounds' | 'tented'>(desiredMode);

  // Tab navigators keep Map mounted — sync mode when schedule/vendors navigate with new params.
  useEffect(() => {
    setMode(desiredMode);
  }, [desiredMode]);

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
        />
      </View>
      {mode === 'grounds' ? (
        <View style={styles.grounds}>
          <GroundsMap highlightedLocation={location || null} onSwitchToTented={() => setMode('tented')} />
          <View style={styles.toggle} pointerEvents="box-none">
            <View style={[styles.toggleBtn, styles.toggleBtnOn]}><Text style={[styles.toggleText, styles.toggleTextOn]}>Grounds</Text></View>
            <TouchableOpacity style={styles.toggleBtn} onPress={() => setMode('tented')}><Text style={styles.toggleText}>Tented City</Text></TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative', backgroundColor: colors.background },
  tentedHost: { ...StyleSheet.absoluteFillObject },
  tentedHostHidden: { opacity: 0, zIndex: 0 },
  grounds: { ...StyleSheet.absoluteFillObject, zIndex: 2, backgroundColor: colors.background },
  toggle: { position: 'absolute', top: 8, alignSelf: 'center', zIndex: 20, flexDirection: 'row', backgroundColor: 'rgba(232,228,218,0.95)', borderRadius: 12, padding: 3, gap: 4 },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  toggleBtnOn: { backgroundColor: '#FFFFFF' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  toggleTextOn: { color: '#A6262D' },
});
