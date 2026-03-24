// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import MapComponent from '../../src/components/MapComponent';
import colors from '../../src/theme/colors';

export default function MapScreen() {
  // Get location parameter from navigation
  const { location } = useLocalSearchParams<{ location?: string }>();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <MapComponent highlightedLocation={location || null} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
