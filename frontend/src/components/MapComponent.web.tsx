// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import colors from '../theme/colors';

const { width, height } = Dimensions.get('window');

const MapComponent: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Map Image */}
      <ScrollView
        style={styles.mapContainer}
        contentContainerStyle={styles.mapContent}
        maximumZoomScale={3}
        minimumZoomScale={1}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        bouncesZoom={true}
      >
        <Image
          source={require('../../assets/images/event-map.png')}
          style={styles.mapImage}
          resizeMode="cover"
        />
      </ScrollView>

      {/* Legend */}
      <View style={styles.legendContainer}>
        <Text style={styles.legendTitle}>IPM 2026</Text>
        <Text style={styles.legendSubtitle}>Event Grounds</Text>
        <View style={styles.legendDivider} />
        <View style={styles.legendItem}>
          <Feather name="map-pin" size={14} color={colors.primary} />
          <Text style={styles.legendText}>Huron Tractor</Text>
        </View>
        <View style={styles.legendItem}>
          <Feather name="navigation" size={14} color={colors.field} />
          <Text style={styles.legendText}>Durham Rd & Bruce Rd 3</Text>
        </View>
      </View>

      {/* Zoom hint */}
      <View style={styles.zoomHint}>
        <Feather name="zoom-in" size={16} color={colors.textMuted} />
        <Text style={styles.zoomHintText}>Pinch to zoom</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapContainer: {
    flex: 1,
  },
  mapContent: {
    minHeight: height - 150,
  },
  mapImage: {
    width: width,
    height: height - 100,
  },
  legendContainer: {
    position: 'absolute',
    left: 16,
    top: 16,
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    minWidth: 160,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  legendSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  legendDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  legendText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  zoomHint: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  zoomHintText: {
    fontSize: 12,
    color: colors.textMuted,
  },
});

export default MapComponent;
