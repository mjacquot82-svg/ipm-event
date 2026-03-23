// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// Web map component - simplified version

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import colors from '../theme/colors';
import { locations, getLocationTypeColor, getLocationTypeIcon, Location } from '../data/mockData';
import BottomSheet from './BottomSheet';

const { height } = Dimensions.get('window');

const MapComponent: React.FC = () => {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [showBottomSheet, setShowBottomSheet] = useState(false);

  const handleMarkerPress = (location: Location) => {
    setSelectedLocation(location);
    setShowBottomSheet(true);
  };

  const handleCloseBottomSheet = () => {
    setShowBottomSheet(false);
    setSelectedLocation(null);
  };

  const locationTypes = ['field', 'stage', 'vendor', 'utility'];

  return (
    <View style={styles.container}>
      {/* Map Placeholder */}
      <View style={styles.mapPlaceholder}>
        <View style={styles.mapContent}>
          <Feather name="map" size={64} color={colors.primary} />
          <Text style={styles.mapTitle}>IPM 2026 Event Map</Text>
          <Text style={styles.mapSubtitle}>Interactive map coming soon</Text>
          <Text style={styles.mapInfo}>
            Browse locations below to explore the event grounds
          </Text>
        </View>
      </View>

      {/* Locations List */}
      <View style={styles.locationsContainer}>
        <Text style={styles.locationsTitle}>Event Locations</Text>
        <ScrollView 
          style={styles.locationsList}
          showsVerticalScrollIndicator={false}
        >
          {locations.map((location) => {
            const typeColor = getLocationTypeColor(location.type);
            const typeIcon = getLocationTypeIcon(location.type);
            
            return (
              <TouchableOpacity
                key={location.id}
                style={styles.locationCard}
                onPress={() => handleMarkerPress(location)}
                activeOpacity={0.7}
              >
                <View style={[styles.locationIcon, { backgroundColor: typeColor }]}>
                  <Feather name={typeIcon as any} size={20} color="#FFFFFF" />
                </View>
                <View style={styles.locationInfo}>
                  <Text style={styles.locationName}>{location.name}</Text>
                  <Text style={styles.locationType}>
                    {location.type.charAt(0).toUpperCase() + location.type.slice(1)}
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            );
          })}
          <View style={styles.bottomPadding} />
        </ScrollView>
      </View>

      {/* Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendHeader}>
          <Text style={styles.legendTitle}>Legend</Text>
        </View>
        {locationTypes.map((type) => (
          <View key={type} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: getLocationTypeColor(type) }]} />
            <Text style={styles.legendText}>
              {type === 'field' ? 'Fields' : 
               type === 'stage' ? 'Stages' : 
               type === 'vendor' ? 'Exhibitors' : 'Services'}
            </Text>
          </View>
        ))}
      </View>

      {/* Bottom Sheet */}
      {selectedLocation && (
        <BottomSheet
          visible={showBottomSheet}
          onClose={handleCloseBottomSheet}
          location={selectedLocation}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapPlaceholder: {
    height: height * 0.35,
    backgroundColor: colors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapContent: {
    alignItems: 'center',
    padding: 20,
  },
  mapTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 16,
  },
  mapSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
  },
  mapInfo: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  locationsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  locationsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  locationsList: {
    flex: 1,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  locationType: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  legendContainer: {
    position: 'absolute',
    left: 16,
    top: 100,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
  },
  legendHeader: {
    marginBottom: 8,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  bottomPadding: {
    height: 120,
  },
});

export default MapComponent;
