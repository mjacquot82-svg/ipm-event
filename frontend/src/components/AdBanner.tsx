// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// AD BANNER COMPONENT - FINAL VERSION WITH REAL ASSETS

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import { AdUnit } from '../config/AdCampaignsConfig';
import colors from '../theme/colors';

interface AdBannerProps {
  adUnit: AdUnit;
  position: 'top' | 'bottom';
  pointerEvents?: 'box-none' | 'none' | 'auto';
}

const AdBanner: React.FC<AdBannerProps> = ({ adUnit, position, pointerEvents = 'auto' }) => {
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

  if (isTop) {
    // TOP AD - 92% width, borderRadius: 12, shadow
    return (
      <View style={styles.topContainer} pointerEvents={pointerEvents}>
        <TouchableOpacity
          style={styles.topBanner}
          onPress={handlePress}
          activeOpacity={0.9}
        >
          {adUnit.imageUrl ? (
            <Image
              source={{ uri: adUnit.imageUrl }}
              style={styles.topBannerImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.topPlaceholder}>
              <Text style={styles.placeholderText}>{adUnit.placeholderText}</Text>
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
        style={styles.bottomBanner}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {adUnit.imageUrl ? (
          <Image
            source={{ uri: adUnit.imageUrl }}
            style={styles.bottomBannerImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.bottomPlaceholder}>
            <Text style={styles.placeholderText}>{adUnit.placeholderText}</Text>
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
    backgroundColor: '#8B1538',
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
    backgroundColor: '#8B1538',
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
    backgroundColor: '#8B1538',
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
    backgroundColor: '#8B1538',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  placeholderText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default AdBanner;
