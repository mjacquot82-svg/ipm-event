// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { Feather } from '@expo/vector-icons';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  locations,
  Location as LocationData,
  VENUE_CENTER,
  getLocationTypeColor,
  getLocationTypeIcon,
} from '../data/mockData';
import colors from '../theme/colors';
import BottomSheet from './BottomSheet';

// Set Mapbox access token
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
mapboxgl.accessToken = MAPBOX_TOKEN;

interface UserLocation {
  latitude: number;
  longitude: number;
}

interface DirectionsState {
  destination: LocationData | null;
  isActive: boolean;
}

const MapboxMapWeb: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const routeLayerAdded = useRef(false);
  
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [isBottomSheetVisible, setIsBottomSheetVisible] = useState<boolean>(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [directions, setDirections] = useState<DirectionsState>({
    destination: null,
    isActive: false,
  });

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [VENUE_CENTER.longitude, VENUE_CENTER.latitude],
      zoom: 14,
      attributionControl: false,
    });

    map.current.on('load', () => {
      setMapLoaded(true);
      
      // Add navigation controls
      map.current?.addControl(
        new mapboxgl.NavigationControl(),
        'top-right'
      );
    });

    // Get user location
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

    return () => {
      markers.current.forEach((marker) => marker.remove());
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Add markers when map is loaded
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove existing markers
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    // Add markers for each location
    locations.forEach((location) => {
      const color = getLocationTypeColor(location.type);
      const iconName = getLocationTypeIcon(location.type, location.utilitySubtype, location.fieldSubtype);
      
      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'mapbox-marker';
      el.style.width = location.type === 'field' ? '32px' : '28px';
      el.style.height = location.type === 'field' ? '32px' : '28px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = color;
      el.style.border = location.type === 'field' ? `3px solid ${colors.accent}` : '2px solid #FFFFFF';
      el.style.cursor = 'pointer';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
      
      // Add icon (using emoji as fallback since Feather doesn't work in DOM)
      const iconMap: Record<string, string> = {
        'truck': '🚜',
        'mic': '🎤',
        'shopping-bag': '🛍️',
        'coffee': '☕',
        'users': '🚻',
        'help-circle': 'ℹ️',
        'heart': '❤️',
        'grid': '🌾',
        'eye': '👁️',
        'award': '🏆',
        'info': 'ℹ️',
      };
      
      const icon = location.type === 'field' ? '🚜' : (iconMap[iconName] || '📍');
      el.innerHTML = `<span style="font-size: 14px;">${icon}</span>`;
      
      el.addEventListener('click', () => {
        handleMarkerPress(location);
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([location.lng, location.lat])
        .addTo(map.current!);

      markers.current.push(marker);
    });
  }, [mapLoaded]);

  // Update route line when directions change
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove existing route
    if (map.current.getLayer('route')) {
      map.current.removeLayer('route');
    }
    if (map.current.getSource('route')) {
      map.current.removeSource('route');
    }

    // Add new route if directions are active
    if (directions.isActive && directions.destination && userLocation) {
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [userLocation.longitude, userLocation.latitude],
              [directions.destination.lng, directions.destination.lat],
            ],
          },
        },
      });

      map.current.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': colors.primary,
          'line-width': 4,
          'line-dasharray': [2, 1],
        },
      });

      // Fit bounds to show both points
      const bounds = new mapboxgl.LngLatBounds()
        .extend([userLocation.longitude, userLocation.latitude])
        .extend([directions.destination.lng, directions.destination.lat]);
      
      map.current.fitBounds(bounds, { padding: 100 });
    }
  }, [directions, userLocation, mapLoaded]);

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

  const handleCenterOnVenue = useCallback(() => {
    map.current?.flyTo({
      center: [VENUE_CENTER.longitude, VENUE_CENTER.latitude],
      zoom: 14,
      duration: 1000,
    });
  }, []);

  const handleCenterOnUser = useCallback(() => {
    if (userLocation) {
      map.current?.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 15,
        duration: 1000,
      });
    }
  }, [userLocation]);

  return (
    <View style={styles.container}>
      {/* Map Container */}
      <View style={styles.mapWrapper}>
        <div
          ref={mapContainer}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
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

      {/* Map Controls */}
      <View style={styles.controlsContainer}>
        {userLocation && (
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
        <Text style={styles.mapboxText}>🗺️ Mapbox Satellite</Text>
      </View>

      {/* User Location Badge */}
      {userLocation && (
        <View style={styles.userLocationBadge}>
          <Feather name="navigation" size={14} color={colors.userLocation} />
          <Text style={styles.userLocationText}>
            {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
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
  mapWrapper: {
    flex: 1,
    overflow: 'hidden',
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
    left: 16,
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
    bottom: 80,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  mapboxText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '500',
  },
  userLocationBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  userLocationText: {
    fontSize: 11,
    color: colors.userLocation,
  },
});

export default MapboxMapWeb;
