import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import { Feather } from '@expo/vector-icons';
import {
  locations,
  Location as LocationData,
  VENUE_CENTER,
  getLocationTypeColor,
  getLocationTypeIcon,
  getVendorByLocationId,
  getSessionsByLocationId,
} from '../data/mockData';
import colors from '../theme/colors';
import BottomSheet from './BottomSheet';

// Conditionally import MapView only on native platforms
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

// Web Fallback Map Component
const WebMapFallback: React.FC<{
  locations: LocationData[];
  onMarkerPress: (location: LocationData) => void;
  userLocation: UserLocation | null;
}> = ({ locations, onMarkerPress, userLocation }) => {
  return (
    <View style={webStyles.container}>
      <View style={webStyles.header}>
        <Feather name="map" size={48} color={colors.primary} />
        <Text style={webStyles.title}>Event Map</Text>
        <Text style={webStyles.subtitle}>Moscone Center, San Francisco</Text>
        {userLocation && (
          <View style={webStyles.userLocationBadge}>
            <Feather name="navigation" size={14} color={colors.userLocation} />
            <Text style={webStyles.userLocationText}>
              Your location: {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
            </Text>
          </View>
        )}
      </View>
      
      {/* Legend */}
      <View style={webStyles.legendContainer}>
        <View style={webStyles.legendItem}>
          <View style={[webStyles.legendDot, { backgroundColor: colors.stage }]} />
          <Text style={webStyles.legendText}>Stages</Text>
        </View>
        <View style={webStyles.legendItem}>
          <View style={[webStyles.legendDot, { backgroundColor: colors.vendor }]} />
          <Text style={webStyles.legendText}>Vendors</Text>
        </View>
        <View style={webStyles.legendItem}>
          <View style={[webStyles.legendDot, { backgroundColor: colors.utility }]} />
          <Text style={webStyles.legendText}>Utilities</Text>
        </View>
      </View>

      <ScrollView style={webStyles.locationsList} showsVerticalScrollIndicator={false}>
        <Text style={webStyles.sectionTitle}>Venue Locations</Text>
        {locations.map((location) => {
          const typeColor = getLocationTypeColor(location.type);
          const iconName = getLocationTypeIcon(location.type);
          return (
            <TouchableOpacity
              key={location.id}
              style={webStyles.locationCard}
              onPress={() => onMarkerPress(location)}
              activeOpacity={0.7}
            >
              <View style={[webStyles.locationIcon, { backgroundColor: typeColor }]}>
                <Feather name={iconName as any} size={20} color="#FFFFFF" />
              </View>
              <View style={webStyles.locationInfo}>
                <Text style={webStyles.locationName}>{location.name}</Text>
                <Text style={webStyles.locationCoords}>
                  {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={webStyles.webNotice}>
        <Feather name="info" size={16} color={colors.info} />
        <Text style={webStyles.webNoticeText}>
          Full interactive map available on iOS/Android
        </Text>
      </View>
    </View>
  );
};

const webStyles = StyleSheet.create({
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

// Native Map Component
const NativeMapComponent: React.FC = () => {
  const mapRef = useRef<any>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [isBottomSheetVisible, setIsBottomSheetVisible] = useState<boolean>(false);
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

  const handleGetDirections = useCallback(() => {
    if (selectedLocation) {
      Alert.alert(
        'Get Directions',
        `Navigation to ${selectedLocation.name} will be implemented in Phase 2`,
        [{ text: 'OK' }]
      );
    }
  }, [selectedLocation]);

  const renderMarker = (location: LocationData) => {
    const markerColor = getLocationTypeColor(location.type);
    const iconName = getLocationTypeIcon(location.type);

    return (
      <Marker
        key={location.id}
        coordinate={{ latitude: location.lat, longitude: location.lng }}
        onPress={() => handleMarkerPress(location)}
        tracksViewChanges={false}
      >
        <View style={[styles.markerContainer, { backgroundColor: markerColor }]}>
          <Feather name={iconName as any} size={16} color="#FFFFFF" />
        </View>
      </Marker>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading map...</Text>
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
        mapType="standard"
        customMapStyle={darkMapStyle}
      >
        {locations.map(renderMarker)}
      </MapView>

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
          <Feather name="target" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

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
      />
    </View>
  );
};

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#181818' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#4e4e4e' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
];

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
  controlsContainer: {
    position: 'absolute',
    right: 16,
    top: 100,
    gap: 12,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceElevated,
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
    top: 100,
    backgroundColor: colors.mapOverlay,
    padding: 12,
    borderRadius: 12,
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
    backgroundColor: colors.surfaceElevated,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  permissionText: {
    color: colors.textSecondary,
    fontSize: 13,
    flex: 1,
  },
});

// Main Map Component - handles platform detection
const MapComponent: React.FC = () => {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [isBottomSheetVisible, setIsBottomSheetVisible] = useState<boolean>(false);

  // For web, set up basic location tracking
  useEffect(() => {
    if (Platform.OS === 'web') {
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
    }
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
    if (selectedLocation) {
      Alert.alert(
        'Get Directions',
        `Navigation to ${selectedLocation.name} will be implemented in Phase 2`,
        [{ text: 'OK' }]
      );
    }
  }, [selectedLocation]);

  if (Platform.OS === 'web') {
    return (
      <>
        <WebMapFallback
          locations={locations}
          onMarkerPress={handleMarkerPress}
          userLocation={userLocation}
        />
        <BottomSheet
          isVisible={isBottomSheetVisible}
          onClose={handleCloseBottomSheet}
          location={selectedLocation}
          onGetDirections={handleGetDirections}
        />
      </>
    );
  }

  return <NativeMapComponent />;
};

export default MapComponent;
