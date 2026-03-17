// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors from '../../src/theme/colors';

// Import the appropriate map component based on platform
const MapComponent = Platform.select({
  web: () => require('../../src/components/MapboxMap.web').default,
  default: () => require('../../src/components/MapComponent').default,
})();

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <MapComponent />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
