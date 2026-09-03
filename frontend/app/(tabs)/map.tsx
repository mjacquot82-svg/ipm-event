// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useState } from 'react';
import { View, StyleSheet, StatusBar, TouchableOpacity, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import MapComponent from '../../src/components/MapComponent';
import TentedCityMap from '../../src/components/TentedCityMap';
import { AttendeeAttribution } from '../../src/components/AttendeeAttribution';
import colors from '../../src/theme/colors';
import {
  ATTENDEE_CARD_RADIUS,
  attendeePageContent,
  useAttendeeLayout,
} from '../../src/theme/attendeePageLayout';
import { usePageAnalytics } from '../../src/analytics/usePageAnalytics';
import { mapLocations } from '../../src/config/mapLocations';
import { findTentedCityPlace } from '../../src/config/tentedCitySearch';
import { tentedCityVendors } from '../../src/data/tentedCityVendors';

export default function MapScreen() {
  const { contentWidth } = useAttendeeLayout();
  const { location, showOnly, source, mapStatus, verify1a } = useLocalSearchParams<{
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
  const [mode, setMode] = useState<'grounds' | 'tented'>(
    tentedMatch || source === 'schedule' || source === 'vendors' || unavailable || verify1A ? 'tented' : 'grounds',
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
        />
      </View>
      {mode === 'grounds' ? (
        <View style={[styles.grounds, attendeePageContent]}>
          <View style={styles.toggle}>
            <View style={[styles.toggleBtn, styles.toggleBtnOn]}>
              <Text style={[styles.toggleText, styles.toggleTextOn]}>Grounds</Text>
            </View>
            <TouchableOpacity style={styles.toggleBtn} onPress={() => setMode('tented')}>
              <Text style={styles.toggleText}>Tented City</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.mapCard, { width: contentWidth }]}>
            <MapComponent
              mapWidth={contentWidth}
              highlightedLocation={location || null}
              showOnlyHighlighted={showOnly === 'true'}
            />
          </View>
          <AttendeeAttribution source="map_attribution" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: colors.background,
  },
  tentedHost: {
    ...StyleSheet.absoluteFillObject,
  },
  tentedHostHidden: {
    opacity: 0,
    zIndex: 0,
  },
  grounds: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    backgroundColor: colors.background,
  },
  toggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: 8,
    backgroundColor: '#E8E4DA',
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  toggleBtnOn: {
    backgroundColor: '#FFFFFF',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  toggleTextOn: {
    color: '#A6262D',
  },
  mapCard: {
    flex: 1,
    alignSelf: 'center',
    borderRadius: ATTENDEE_CARD_RADIUS,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
});
