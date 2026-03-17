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
import MapboxGL from '@rnmapbox/maps';
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

// Initialize Mapbox with access token
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
MapboxGL.setAccessToken(MAPBOX_TOKEN);

interface UserLocation {
  latitude: number;
  longitude: number;
}

interface DirectionsState {
  destination: LocationData | null;
  isActive: boolean;
}

const MapboxMap: React.FC = () => {
  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);
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
    if (userLocation && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [userLocation.longitude, userLocation.latitude],
        zoomLevel: 15,
        animationDuration: 500,
      });
    }
  }, [userLocation]);

  const handleCenterOnVenue = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [VENUE_CENTER.longitude, VENUE_CENTER.latitude],
        zoomLevel: 14,
        animationDuration: 500,
      });
    }
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
    
    // Fit the map to show both user and destination
    if (cameraRef.current) {
      const bounds = {
        ne: [
          Math.max(userLocation.longitude, selectedLocation.lng) + 0.002,
          Math.max(userLocation.latitude, selectedLocation.lat) + 0.002,
        ],
        sw: [
          Math.min(userLocation.longitude, selectedLocation.lng) - 0.002,
          Math.min(userLocation.latitude, selectedLocation.lat) - 0.002,
        ],
      };
      
      cameraRef.current.fitBounds(bounds.ne, bounds.sw, 100, 500);
    }
  }, [selectedLocation, userLocation]);

  const handleCancelDirections = useCallback(() => {
    setDirections({
      destination: null,
      isActive: false,
    });
  }, []);

  // Create GeoJSON for locations
  const locationsGeoJSON = {
    type: 'FeatureCollection' as const,
    features: locations.map((location) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [location.lng, location.lat],
      },
      properties: {
        id: location.id,
        name: location.name,
        type: location.type,
        color: getLocationTypeColor(location.type),
      },
    })),
  };

  // Create route line if directions are active
  const routeGeoJSON = directions.isActive && directions.destination && userLocation ? {
    type: 'FeatureCollection' as const,
    features: [{
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [userLocation.longitude, userLocation.latitude],
          [directions.destination.lng, directions.destination.lat],
        ],
      },
      properties: {},
    }],
  } : null;

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
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={MapboxGL.StyleURL.SatelliteStreet}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={true}
        scaleBarEnabled={true}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          centerCoordinate={[VENUE_CENTER.longitude, VENUE_CENTER.latitude]}
          zoomLevel={14}
          animationDuration={1000}
        />

        {/* User location */}
        {locationPermission && (
          <MapboxGL.UserLocation
            visible={true}
            showsUserHeadingIndicator={true}
          />
        )}

        {/* Location markers */}
        <MapboxGL.ShapeSource
          id="locations"
          shape={locationsGeoJSON}
          onPress={(e) => {
            const feature = e.features?.[0];
            if (feature?.properties?.id) {
              const location = locations.find(l => l.id === feature.properties?.id);
              if (location) {
                handleMarkerPress(location);
              }
            }
          }}
        >
          {/* Field markers (green/olive) */}
          <MapboxGL.CircleLayer
            id="field-markers"
            filter={['==', ['get', 'type'], 'field']}
            style={{
              circleRadius: 14,
              circleColor: colors.field,
              circleStrokeWidth: 3,
              circleStrokeColor: colors.accent,
            }}
          />
          
          {/* Stage markers (red) */}
          <MapboxGL.CircleLayer
            id="stage-markers"
            filter={['==', ['get', 'type'], 'stage']}
            style={{
              circleRadius: 12,
              circleColor: colors.stage,
              circleStrokeWidth: 2,
              circleStrokeColor: '#FFFFFF',
            }}
          />
          
          {/* Vendor markers (gold) */}
          <MapboxGL.CircleLayer
            id="vendor-markers"
            filter={['==', ['get', 'type'], 'vendor']}
            style={{
              circleRadius: 10,
              circleColor: colors.vendor,
              circleStrokeWidth: 2,
              circleStrokeColor: '#FFFFFF',
            }}
          />
          
          {/* Utility markers (teal) */}
          <MapboxGL.CircleLayer
            id="utility-markers"
            filter={['==', ['get', 'type'], 'utility']}
            style={{
              circleRadius: 10,
              circleColor: colors.utility,
              circleStrokeWidth: 2,
              circleStrokeColor: '#FFFFFF',
            }}
          />
        </MapboxGL.ShapeSource>

        {/* Route line */}
        {routeGeoJSON && (
          <MapboxGL.ShapeSource id="route" shape={routeGeoJSON}>
            <MapboxGL.LineLayer
              id="routeLine"
              style={{
                lineColor: colors.primary,
                lineWidth: 4,
                lineCap: 'round',
                lineJoin: 'round',
                lineDasharray: [2, 1],
              }}
            />
          </MapboxGL.ShapeSource>
        )}
      </MapboxGL.MapView>

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
          <View style={[styles.legendDot, { backgroundColor: colors.utility }]} />
          <Text style={styles.legendText}>Services</Text>
        </View>
      </View>

      {/* Mapbox Badge */}
      <View style={styles.mapboxBadge}>
        <Text style={styles.mapboxText}>Powered by Mapbox</Text>
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
  mapboxBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: colors.mapOverlay,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  mapboxText: {
    color: colors.textMuted,
    fontSize: 10,
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
});

export default MapboxMap;
