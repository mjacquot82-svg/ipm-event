// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// Native fallback - uses react-native-maps instead of Mapbox (requires dev build)

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../theme/colors';
import MapComponent from './MapComponent';

// For Expo Go, we use the standard MapComponent with react-native-maps
// Mapbox native requires a development build (eas build)
const MapboxMap: React.FC = () => {
  return <MapComponent />;
};

export default MapboxMap;
