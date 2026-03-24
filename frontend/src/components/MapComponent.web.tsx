// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  Animated,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import colors from '../theme/colors';
import { 
  mapLocations, 
  categoryColors, 
  categoryIcons,
  findLocationByName,
  MapLocation,
  LocationCategory 
} from '../config/mapLocations';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAP_HEIGHT = SCREEN_HEIGHT - 180;

interface MapComponentProps {
  highlightedLocation?: string | null;
  showOnlyHighlighted?: boolean;
  onLocationSelect?: (location: MapLocation) => void;
}

const MapComponent: React.FC<MapComponentProps> = ({ 
  highlightedLocation,
  showOnlyHighlighted = false,
  onLocationSelect 
}) => {
  const [selectedPin, setSelectedPin] = useState<MapLocation | null>(null);
  const [showLegend, setShowLegend] = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // Find and highlight location when prop changes
  useEffect(() => {
    if (highlightedLocation) {
      const location = findLocationByName(highlightedLocation);
      if (location) {
        setSelectedPin(location);
      }
    }
  }, [highlightedLocation]);

  // Pulse animation for selected pin
  useEffect(() => {
    if (selectedPin) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: false, // Web doesn't support native driver
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: false,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [selectedPin, pulseAnim]);

  const handlePinPress = (location: MapLocation) => {
    setSelectedPin(selectedPin?.id === location.id ? null : location);
    onLocationSelect?.(location);
  };

  const renderPin = (location: MapLocation) => {
    const isSelected = selectedPin?.id === location.id;
    const isHighlighted = highlightedLocation && 
      findLocationByName(highlightedLocation)?.id === location.id;
    const pinColor = categoryColors[location.category];
    const iconName = categoryIcons[location.category] as any;

    // Calculate absolute positions based on percentage
    const pinLeft = (location.x / 100) * SCREEN_WIDTH;
    const pinTop = (location.y / 100) * MAP_HEIGHT;

    return (
      <TouchableOpacity
        key={location.id}
        style={[
          styles.pinContainer,
          {
            left: pinLeft - 15,
            top: pinTop - 15,
          },
        ]}
        onPress={() => handlePinPress(location)}
        activeOpacity={0.8}
      >
        {(isSelected || isHighlighted) && (
          <Animated.View
            style={[
              styles.pinPulse,
              {
                backgroundColor: pinColor,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
        )}
        <View
          style={[
            styles.pin,
            { backgroundColor: pinColor },
            (isSelected || isHighlighted) && styles.pinSelected,
          ]}
        >
          <Feather name={iconName} size={14} color="#FFFFFF" />
        </View>
        {(isSelected || isHighlighted) && (
          <View style={styles.pinLabelContainer}>
            <Text style={styles.pinLabel}>{location.name}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Get unique categories for legend
  const categories = [...new Set(mapLocations.map(loc => loc.category))];

  // Filter pins based on showOnlyHighlighted mode
  const highlightedLocationData = highlightedLocation ? findLocationByName(highlightedLocation) : null;
  const pinsToShow = showOnlyHighlighted && highlightedLocationData
    ? [highlightedLocationData]
    : mapLocations;

  return (
    <View style={styles.container}>
      {/* Map with pins */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.mapContainer}
        contentContainerStyle={styles.mapContent}
        maximumZoomScale={3}
        minimumZoomScale={1}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        bouncesZoom={true}
      >
        <View style={styles.mapWrapper}>
          <Image
            source={require('../../assets/images/event-map.png')}
            style={styles.mapImage}
            resizeMode="cover"
          />
          
          {/* Render pins (filtered if showOnlyHighlighted) */}
          {pinsToShow.map(renderPin)}
        </View>
      </ScrollView>

      {/* Selected location info card */}
      {selectedPin && (
        <View style={styles.infoCard}>
          <View style={styles.infoCardHeader}>
            <View style={[styles.infoCardIcon, { backgroundColor: categoryColors[selectedPin.category] }]}>
              <Feather 
                name={categoryIcons[selectedPin.category] as any} 
                size={20} 
                color="#FFFFFF" 
              />
            </View>
            <View style={styles.infoCardContent}>
              <Text style={styles.infoCardTitle}>{selectedPin.name}</Text>
              <Text style={styles.infoCardCategory}>
                {selectedPin.category.charAt(0).toUpperCase() + selectedPin.category.slice(1)}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => setSelectedPin(null)}
              style={styles.infoCardClose}
            >
              <Feather name="x" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          {selectedPin.description && (
            <Text style={styles.infoCardDescription}>{selectedPin.description}</Text>
          )}
        </View>
      )}

      {/* Collapsible Legend */}
      <TouchableOpacity 
        style={styles.legendContainer}
        onPress={() => setShowLegend(!showLegend)}
        activeOpacity={0.9}
      >
        <View style={styles.legendHeader}>
          <Text style={styles.legendTitle}>IPM 2026</Text>
          <Feather 
            name={showLegend ? "chevron-up" : "chevron-down"} 
            size={18} 
            color={colors.textMuted} 
          />
        </View>
        {showLegend && (
          <>
            <Text style={styles.legendSubtitle}>Event Grounds</Text>
            <View style={styles.legendDivider} />
            {categories.map((category) => (
              <View key={category} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: categoryColors[category] }]} />
                <Text style={styles.legendText}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </Text>
              </View>
            ))}
          </>
        )}
      </TouchableOpacity>

      {/* Zoom hint */}
      <View style={styles.zoomHint}>
        <Feather name="zoom-in" size={16} color={colors.textMuted} />
        <Text style={styles.zoomHintText}>Pinch to zoom • Tap pins for info</Text>
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
    minHeight: MAP_HEIGHT,
  },
  mapWrapper: {
    position: 'relative',
    width: SCREEN_WIDTH,
    height: MAP_HEIGHT,
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  // Pin styles
  pinContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  pin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  pinSelected: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
  },
  pinPulse: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    opacity: 0.3,
  },
  pinLabelContainer: {
    position: 'absolute',
    top: 38,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    minWidth: 60,
    alignItems: 'center',
  },
  pinLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  // Info card styles
  infoCard: {
    position: 'absolute',
    bottom: 130,
    left: 16,
    right: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCardContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  infoCardCategory: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  infoCardClose: {
    padding: 4,
  },
  infoCardDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
    lineHeight: 20,
  },
  // Legend styles
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
    minWidth: 140,
  },
  legendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  // Zoom hint
  zoomHint: {
    position: 'absolute',
    bottom: 90,
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
