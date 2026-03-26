// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// AD BANNER COMPONENT - FINALIZED STYLES

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
    // TOP AD - 92% width, centered, borderRadius: 12, consistent with Quick Actions
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
              resizeMode="cover"
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

  // BOTTOM AD - Floating pill, 92% width, borderRadius: 12, centered
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
            resizeMode="cover"
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
  // TOP AD CONTAINER
  topContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: '4%', // Creates the 92% effect with centering
    marginTop: 8, // Small margin so it doesn't touch the very top
  },
  
  // TOP BANNER - 92% width, borderRadius: 12
  topBanner: {
    width: '100%', // Will be 92% due to container padding
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  
  topBannerImage: {
    width: '100%',
    height: 80,
    borderRadius: 12,
  },
  
  topPlaceholder: {
    width: '100%',
    height: 80,
    backgroundColor: '#8B1538', // IPM branding red
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  
  // BOTTOM AD CONTAINER
  bottomContainer: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  
  // BOTTOM BANNER - Floating, 92% width, borderRadius: 12
  bottomBanner: {
    width: '92%',
    height: 50,
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    // Shadow for floating effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  
  bottomBannerImage: {
    width: '100%',
    height: 50,
    borderRadius: 12,
  },
  
  bottomPlaceholder: {
    width: '100%',
    height: 50,
    backgroundColor: '#8B1538', // IPM branding red - same as top
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  
  // PLACEHOLDER TEXT
  placeholderText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default AdBanner;
