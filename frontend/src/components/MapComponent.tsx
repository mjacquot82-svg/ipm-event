// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Feather } from '@expo/vector-icons';
import {
  locations,
  Location as LocationData,
  VENUE_CENTER,
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
  const mapRef = useRef<MapView>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [isBottomSheetVisible, setIsBottomSheetVisible] = useState<boolean>(false);
  const [directions, setDirections] = useState<DirectionsState>({
    destination: null,
    isActive: false,
  });
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let isMounted = true;

    const setupLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status !== 'granted') {
          if (isMounted) {
            setLocationPermission(false);
            setIsLoading(false);
          }
          return;
        }

        if (isMounted) {
          setLocationPermission(true);
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (isMounted) {
          setUserLocation({
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          });
        }

        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 5,
          },
          (location) => {
            if (isMounted) {
              setUserLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              });
            }
          }
        );
      } catch (error) {
        console.error('Location error:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    setupLocation();

    return () => {
      isMounted = false;
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  const handleMarkerPress = useCallback((location: LocationData) => {
    setSelectedLocation(location);
    setIsBottomSheetVisible(true);
  }, []);

  const handleCloseBottomSheet = useCallback(() => {
    setIsBottomSheetVisible(false);
    setSelectedLocation(null);
  }, []);

  const handleCenterOnUser = useCallback(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 500);
    }
  }, [userLocation]);

  const handleCenterOnVenue = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(VENUE_CENTER, 500);
    }
  }, []);

  const fitToDirections = useCallback((destination: LocationData) => {
    if (mapRef.current && userLocation) {
      const coordinates = [
        { latitude: userLocation.latitude, longitude: userLocation.longitude },
        { latitude: destination.lat, longitude: destination.lng },
      ];
      
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
        animated: true,
      });
    }
  }, [userLocation]);

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
    
    setTimeout(() => {
      fitToDirections(selectedLocation);
    }, 300);
  }, [selectedLocation, userLocation, fitToDirections]);

  const handleCancelDirections = useCallback(() => {
    setDirections({
      destination: null,
      isActive: false,
    });
  }, []);

  const renderMarker = (location: LocationData) => {
    const markerColor = getLocationTypeColor(location.type);
    const iconName = getLocationTypeIcon(location.type, location.utilitySubtype, location.fieldSubtype);
    const isDestination = directions.isActive && directions.destination?.id === location.id;
    const isMainPlowingField = location.id === 'loc-1' || location.type === 'field';

    return (
      <Marker
        key={location.id}
        coordinate={{ latitude: location.lat, longitude: location.lng }}
        onPress={() => handleMarkerPress(location)}
        tracksViewChanges={false}
      >
        <View style={[
          styles.markerContainer, 
          { backgroundColor: markerColor },
          isDestination && styles.destinationMarker,
          isMainPlowingField && styles.fieldMarker,
        ]}>
          {isMainPlowingField ? (
            <Feather name="truck" size={16} color="#FFFFFF" />
          ) : (
            <Feather name={iconName as any} size={16} color="#FFFFFF" />
          )}
        </View>
      </Marker>
    );
  };

  const renderRouteLine = () => {
    if (!directions.isActive || !directions.destination || !userLocation) {
      return null;
    }

    const routeCoordinates = [
      { latitude: userLocation.latitude, longitude: userLocation.longitude },
      { latitude: directions.destination.lat, longitude: directions.destination.lng },
    ];

    return (
      <Polyline
        coordinates={routeCoordinates}
        strokeColor={colors.primary}
        strokeWidth={4}
        lineDashPattern={[1]}
        lineCap="round"
        lineJoin="round"
      />
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading IPM 2026 map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={VENUE_CENTER}
        showsUserLocation={locationPermission}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        mapType="hybrid"
      >
        {locations.map(renderMarker)}
        {renderRouteLine()}
      </MapView>

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

      {/* Map Controls */}
      <View style={styles.controlsContainer}>
        {locationPermission && userLocation && (
          <TouchableOpacity
            style={styles.controlButton}
            onPress={handleCenterOnUser}
            activeOpacity={0.8}
          >
            <Feather name="navigation" size={22} color={colors.userLocation} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleCenterOnVenue}
          activeOpacity={0.8}
        >
          <Feather name="target" size={22} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Go to Event Button - Prominent */}
      <TouchableOpacity
        style={styles.goToEventButton}
        onPress={handleCenterOnVenue}
        activeOpacity={0.8}
      >
        <Feather name="map-pin" size={18} color="#FFFFFF" />
        <Text style={styles.goToEventText}>Go to IPM 2026</Text>
      </TouchableOpacity>

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

      {/* Permission denied message */}
      {!locationPermission && (
        <View style={styles.permissionBanner}>
          <Feather name="alert-circle" size={16} color={colors.warning} />
          <Text style={styles.permissionText}>
            Location access denied. Enable for live tracking.
          </Text>
        </View>
      )}

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
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 16,
  },
  markerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  destinationMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  fieldMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  directionsBanner: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
  controlsContainer: {
    position: 'absolute',
    right: 16,
    top: 130,
    gap: 12,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  legendContainer: {
    position: 'absolute',
    left: 16,
    top: 130,
    backgroundColor: colors.mapOverlay,
    padding: 12,
    borderRadius: 16,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  permissionBanner: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 50,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  permissionText: {
    color: colors.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  goToEventButton: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  goToEventText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MapComponent;
