// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// AD BANNER COMPONENT - DYNAMIC VERSION WITH ROUTE-BASED COLORS

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import { usePathname } from 'expo-router';
import { AdUnit } from '../config/AdCampaignsConfig';

interface AdBannerProps {
  adUnit: AdUnit;
  position: 'top' | 'bottom';
  pointerEvents?: 'box-none' | 'none' | 'auto';
}

// Define colors and ad IDs for each route
const routeConfig: Record<string, { color: string; adId: number; name: string }> = {
  '/': { color: '#8B1538', adId: 1, name: 'Home' },           // Maroon
  '/index': { color: '#8B1538', adId: 1, name: 'Home' },      // Maroon
  '/map': { color: '#2E7D32', adId: 2, name: 'Map' },         // Green
  '/schedule': { color: '#1565C0', adId: 3, name: 'Schedule' }, // Blue
  '/leaderboard': { color: '#F57C00', adId: 4, name: 'Leaderboard' }, // Orange
  '/about': { color: '#7B1FA2', adId: 5, name: 'About' },     // Purple
  '/itinerary': { color: '#00838F', adId: 6, name: 'Itinerary' }, // Teal
};

// Default config for unknown routes
const defaultConfig = { color: '#616161', adId: 0, name: 'Unknown' }; // Grey

const AdBanner: React.FC<AdBannerProps> = ({ adUnit, position, pointerEvents = 'auto' }) => {
  const pathname = usePathname();
  
  // Get route config based on current path
  const config = routeConfig[pathname] || defaultConfig;
  
  if (!adUnit.enabled) return null;

  const handlePress = async () => {
    try {
      const canOpen = await Linking.canOpenURL(adUnit.targetUrl);
      if (canOpen) {
        await Linking.openURL(adUnit.targetUrl);
      }
    } catch (error) {
      console.error('Error opening ad URL:', error);
    }
  };

  const isTop = position === 'top';
  const adSpotNumber = isTop ? config.adId : config.adId + 10; // Bottom ads get +10 to differentiate

  if (isTop) {
    // TOP AD - 92% width, borderRadius: 12, shadow
    return (
      <View style={styles.topContainer} pointerEvents={pointerEvents}>
        <TouchableOpacity
          style={[styles.topBanner, { backgroundColor: config.color }]}
          onPress={handlePress}
          activeOpacity={0.9}
        >
          {adUnit.imageUrl ? (
            <Image
              source={{ uri: adUnit.imageUrl }}
              style={styles.topBannerImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.topPlaceholder, { backgroundColor: config.color }]}>
              <Text style={styles.adSpotNumber}>AD SPOT #{adSpotNumber}</Text>
              <Text style={styles.pageName}>{config.name} - Top</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // BOTTOM AD - 92% width, borderRadius: 12, shadow
  return (
    <View style={styles.bottomContainer} pointerEvents={pointerEvents}>
      <TouchableOpacity
        style={[styles.bottomBanner, { backgroundColor: config.color }]}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {adUnit.imageUrl ? (
          <Image
            source={{ uri: adUnit.imageUrl }}
            style={styles.bottomBannerImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.bottomPlaceholder, { backgroundColor: config.color }]}>
            <Text style={styles.adSpotNumberSmall}>AD SPOT #{adSpotNumber}</Text>
            <Text style={styles.pageNameSmall}>{config.name} - Bottom</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  // TOP AD CONTAINER - marginTop: 10
  topContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: '4%', // Creates 92% width effect
    marginTop: 10,
  },
  
  // TOP BANNER - borderRadius: 12, shadow matching Quick Actions
  topBanner: {
    width: '100%',
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
    // Shadow matching Quick Actions buttons
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  topBannerImage: {
    width: '100%',
    height: 80,
  },
  
  topPlaceholder: {
    width: '100%',
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // BOTTOM AD CONTAINER
  bottomContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: '4%', // Creates 92% width effect
  },
  
  // BOTTOM BANNER - borderRadius: 12, shadow matching Quick Actions
  bottomBanner: {
    width: '100%',
    height: 50,
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    // Shadow matching Quick Actions buttons
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  bottomBannerImage: {
    width: '100%',
    height: 50,
  },
  
  bottomPlaceholder: {
    width: '100%',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Ad spot number - large and bold for top
  adSpotNumber: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1,
  },
  
  // Page name - smaller subtitle for top
  pageName: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  
  // Ad spot number - smaller for bottom
  adSpotNumberSmall: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1,
  },
  
  // Page name - smaller for bottom
  pageNameSmall: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default AdBanner;
