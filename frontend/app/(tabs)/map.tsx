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
import { findTentedCityVenue } from '../../src/config/tentedCityVenues';

export default function MapScreen() {
  const { contentWidth } = useAttendeeLayout();
  const { location, showOnly, source } = useLocalSearchParams<{ location?: string; showOnly?: string; source?: string }>();
  const locationId = mapLocations.find((item) => item.name === location)?.id;
  usePageAnalytics('map', source || 'other', 'map_opened', locationId ? { location_id: locationId } : {});

  const tentedMatch = findTentedCityVenue(location);
  const [mode, setMode] = useState<'grounds' | 'tented'>(tentedMatch || source === 'schedule' || source === 'vendors' ? 'tented' : 'grounds');

  return (
    <View style={[styles.container, attendeePageContent]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.toggle}>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'grounds' && styles.toggleBtnOn]}
          onPress={() => setMode('grounds')}
        >
          <Text style={[styles.toggleText, mode === 'grounds' && styles.toggleTextOn]}>Grounds</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'tented' && styles.toggleBtnOn]}
          onPress={() => setMode('tented')}
        >
          <Text style={[styles.toggleText, mode === 'tented' && styles.toggleTextOn]}>Tented City</Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.mapCard, { width: contentWidth }]}>
        {mode === 'tented' ? (
          <TentedCityMap initialQuery={location || ''} />
        ) : (
          <MapComponent
            mapWidth={contentWidth}
            highlightedLocation={location || null}
            showOnlyHighlighted={showOnly === 'true'}
          />
        )}
      </View>
      <AttendeeAttribution source="map_attribution" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
