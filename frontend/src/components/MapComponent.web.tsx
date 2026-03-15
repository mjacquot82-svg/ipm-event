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
      {/* Header with Logo */}
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Feather name="truck" size={28} color={colors.textPrimary} />
        </View>
        <Text style={styles.title}>IPM 2026</Text>
        <Text style={styles.subtitle}>Walkerton, Bruce County, Ontario</Text>
        {userLocation && (
          <View style={styles.userLocationBadge}>
            <Feather name="navigation" size={14} color={colors.userLocation} />
            <Text style={styles.userLocationText}>
              {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
            </Text>
          </View>
        )}
      </View>

      {/* Directions Banner */}
      {directions.isActive && directions.destination && (
        <View style={styles.directionsBanner}>
          <View style={styles.directionsInfo}>
            <Feather name="navigation" size={20} color={colors.accent} />
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
      
      {/* Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.field }]} />
          <Text style={styles.legendText}>Fields</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.stage }]} />
          <Text style={styles.legendText}>Stages</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.vendor }]} />
          <Text style={styles.legendText}>Exhibitors</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#4ECDC4' }]} />
          <Text style={styles.legendText}>Services</Text>
        </View>
      </View>

      <ScrollView style={styles.locationsList} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>IPM Locations</Text>
        {locations.map((location) => {
          const typeColor = getLocationTypeColor(location.type);
          const iconName = getLocationTypeIcon(location.type, location.utilitySubtype, location.fieldSubtype);
          const isDestination = directions.isActive && directions.destination?.id === location.id;
          const isField = location.type === 'field';
          
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
              <View style={[
                styles.locationIcon, 
                { backgroundColor: typeColor },
                isField && styles.fieldIcon,
              ]}>
                {isField ? (
                  <Feather name="truck" size={20} color="#FFFFFF" />
                ) : (
                  <Feather name={iconName as any} size={20} color="#FFFFFF" />
                )}
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationName}>{location.name}</Text>
                <Text style={styles.locationCoords}>
                  {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </Text>
              </View>
              {isDestination ? (
                <View style={styles.navigatingBadge}>
                  <Feather name="navigation" size={14} color={colors.accent} />
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
          Full satellite map with directions on iOS/Android
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logoCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 10,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  userLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
  },
  userLocationText: {
    fontSize: 11,
    color: colors.userLocation,
  },
  directionsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    margin: 16,
    padding: 14,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: colors.accent,
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
    fontSize: 11,
    color: colors.textMuted,
  },
  directionsDestination: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cancelButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  locationsList: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 12,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 50,
    marginBottom: 10,
  },
  destinationCard: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldIcon: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  locationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  locationName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  locationCoords: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  navigatingBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  webNoticeText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});

export default MapComponent;
