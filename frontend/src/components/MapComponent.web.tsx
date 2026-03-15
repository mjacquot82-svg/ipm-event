import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { Feather } from '@expo/vector-icons';
import {
  locations,
  Location as LocationData,
  getLocationTypeColor,
  getLocationTypeIcon,
} from '../data/mockData';
import colors from '../theme/colors';
import BottomSheet from './BottomSheet';

interface UserLocation {
  latitude: number;
  longitude: number;
}

interface DirectionsState {
  destination: LocationData | null;
  isActive: boolean;
}

const MapComponent: React.FC = () => {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [isBottomSheetVisible, setIsBottomSheetVisible] = useState<boolean>(false);
  const [directions, setDirections] = useState<DirectionsState>({
    destination: null,
    isActive: false,
  });

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        Location.getCurrentPositionAsync({}).then((location) => {
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        });
      }
    });
  }, []);

  const handleMarkerPress = useCallback((location: LocationData) => {
    setSelectedLocation(location);
    setIsBottomSheetVisible(true);
  }, []);

  const handleCloseBottomSheet = useCallback(() => {
    setIsBottomSheetVisible(false);
    setSelectedLocation(null);
  }, []);

  const handleGetDirections = useCallback(() => {
    if (!selectedLocation) return;
    
    if (!userLocation) {
      Alert.alert(
        'Location Required',
        'Please enable location services to get directions.',
        [{ text: 'OK' }]
      );
      return;
    }

    setDirections({
      destination: selectedLocation,
      isActive: true,
    });
    
    setIsBottomSheetVisible(false);
  }, [selectedLocation, userLocation]);

  const handleCancelDirections = useCallback(() => {
    setDirections({
      destination: null,
      isActive: false,
    });
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Feather name="map" size={48} color={colors.primary} />
        <Text style={styles.title}>Event Map</Text>
        <Text style={styles.subtitle}>Moscone Center, San Francisco</Text>
        {userLocation && (
          <View style={styles.userLocationBadge}>
            <Feather name="navigation" size={14} color={colors.userLocation} />
            <Text style={styles.userLocationText}>
              Your location: {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
            </Text>
          </View>
        )}
      </View>

      {/* Directions Banner */}
      {directions.isActive && directions.destination && (
        <View style={styles.directionsBanner}>
          <View style={styles.directionsInfo}>
            <Feather name="navigation" size={20} color={colors.primary} />
            <View style={styles.directionsTextContainer}>
              <Text style={styles.directionsLabel}>Navigating to</Text>
              <Text style={styles.directionsDestination}>{directions.destination.name}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelDirections}
            activeOpacity={0.8}
          >
            <Feather name="x" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.stage }]} />
          <Text style={styles.legendText}>Stages</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.vendor }]} />
          <Text style={styles.legendText}>Vendors</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.utility }]} />
          <Text style={styles.legendText}>Utilities</Text>
        </View>
      </View>

      <ScrollView style={styles.locationsList} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Venue Locations</Text>
        {locations.map((location) => {
          const typeColor = getLocationTypeColor(location.type);
          const iconName = getLocationTypeIcon(location.type, location.utilitySubtype);
          const isDestination = directions.isActive && directions.destination?.id === location.id;
          
          return (
            <TouchableOpacity
              key={location.id}
              style={[
                styles.locationCard,
                isDestination && styles.destinationCard,
              ]}
              onPress={() => handleMarkerPress(location)}
              activeOpacity={0.7}
            >
              <View style={[styles.locationIcon, { backgroundColor: typeColor }]}>
                <Feather name={iconName as any} size={20} color="#FFFFFF" />
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationName}>{location.name}</Text>
                <Text style={styles.locationCoords}>
                  {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </Text>
              </View>
              {isDestination ? (
                <View style={styles.navigatingBadge}>
                  <Feather name="navigation" size={14} color={colors.primary} />
                </View>
              ) : (
                <Feather name="chevron-right" size={20} color={colors.textMuted} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.webNotice}>
        <Feather name="info" size={16} color={colors.info} />
        <Text style={styles.webNoticeText}>
          Full interactive map with directions available on iOS/Android
        </Text>
      </View>

      <BottomSheet
        isVisible={isBottomSheetVisible}
        onClose={handleCloseBottomSheet}
        location={selectedLocation}
        onGetDirections={handleGetDirections}
        hasUserLocation={!!userLocation}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  userLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
  },
  userLocationText: {
    fontSize: 12,
    color: colors.userLocation,
  },
  directionsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  directionsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  directionsTextContainer: {
    marginLeft: 12,
  },
  directionsLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  directionsDestination: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cancelButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  locationsList: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 12,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  destinationCard: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  locationIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  locationName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  locationCoords: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  navigatingBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  webNoticeText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});

export default MapComponent;
