// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// AD BANNER COMPONENT - CLEAN DEFAULTS

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
}

const AdBanner: React.FC<AdBannerProps> = ({ adUnit, position }) => {
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
  const bannerHeight = isTop ? 80 : 50; // Top: 80, Bottom: 50

  return (
    <View style={isTop ? styles.topContainer : styles.bottomContainer}>
      <TouchableOpacity
        style={[styles.banner, { height: bannerHeight }]}
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
            <Text style={styles.placeholderText}>
              {adUnit.placeholderText}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  // TOP CONTAINER - has background
  topContainer: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  // BOTTOM CONTAINER - NO background (transparent)
  bottomContainer: {
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  // BANNER TOUCHABLE
  banner: {
    width: 320,
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 4,
  },
  // BANNER IMAGE
  bannerImage: {
    width: 320,
  },
  // PLACEHOLDER
  placeholder: {
    width: 320,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
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
