// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import MapComponent from '../../src/components/MapComponent';
import colors from '../../src/theme/colors';
import {
  ATTENDEE_CARD_RADIUS,
  attendeePageContent,
  useAttendeeLayout,
} from '../../src/theme/attendeePageLayout';

export default function MapScreen() {
  const { contentWidth } = useAttendeeLayout();
  // Get location parameter from navigation
  const { location, showOnly } = useLocalSearchParams<{ location?: string; showOnly?: string }>();

  return (
    <View style={[styles.container, attendeePageContent]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={[styles.mapCard, { width: contentWidth }]}>
        <MapComponent
          mapWidth={contentWidth}
          highlightedLocation={location || null}
          showOnlyHighlighted={showOnly === 'true'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapCard: {
    flex: 1,
    alignSelf: 'center',
    borderRadius: ATTENDEE_CARD_RADIUS,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
});
