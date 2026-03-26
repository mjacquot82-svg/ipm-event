// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// AD BANNER COMPONENT - POLISHED STYLES

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
  const bannerHeight = isTop ? 80 : 50;

  if (isTop) {
    // TOP BANNER - Simple style
    return (
      <View style={styles.topContainer} pointerEvents={pointerEvents}>
        <TouchableOpacity
          style={[styles.topBanner, { height: bannerHeight }]}
          onPress={handlePress}
          activeOpacity={0.9}
        >
          {adUnit.imageUrl ? (
            <Image
              source={{ uri: adUnit.imageUrl }}
              style={[styles.bannerImage, { height: bannerHeight }]}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.placeholder, { height: bannerHeight }]}>
              <Text style={styles.placeholderText}>{adUnit.placeholderText}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // BOTTOM BANNER - Polished floating style
  return (
    <View style={styles.bottomContainer} pointerEvents={pointerEvents}>
      <TouchableOpacity
        style={styles.floatingBanner}
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
  // TOP BANNER STYLES
  topContainer: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBanner: {
    width: 320,
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 4,
  },
  bannerImage: {
    width: 320,
  },
  placeholder: {
    width: 320,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  placeholderText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  // BOTTOM BANNER - POLISHED FLOATING STYLES
  bottomContainer: {
    alignItems: 'center',
    backgroundColor: 'transparent', // Transparent area around the ad
  },
  floatingBanner: {
    width: 320,
    height: 50,
    alignSelf: 'center',
    // Floating container styles
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: 'white',
    overflow: 'hidden',
    // Shadow/Elevation for "pop" effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  bottomBannerImage: {
    width: 320,
    height: 50,
    borderRadius: 12,
  },
  bottomPlaceholder: {
    width: 320,
    height: 50,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AdBanner;
