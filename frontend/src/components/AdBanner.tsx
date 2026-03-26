// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

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
  const bannerHeight = isTop ? 100 : 50;

  // Top banner has background, bottom banner is TRANSPARENT (floating)
  const containerStyle = isTop 
    ? [styles.container, styles.topContainer]
    : [styles.container, styles.bottomContainer];

  return (
    <View style={containerStyle}>
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
            <Text style={[styles.placeholderText, isTop && styles.placeholderTextLarge]}>
              {adUnit.placeholderText}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    zIndex: 100,
  },
  // TOP BANNER - Has solid background
  topContainer: {
    width: '100%',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  // BOTTOM BANNER - TRANSPARENT background (truly floating)
  bottomContainer: {
    backgroundColor: 'transparent',
    // NO border, NO width: 100% - just the 320px banner floating
  },
  banner: {
    width: 320,
    overflow: 'hidden',
    borderRadius: 4,
    marginVertical: 4,
    // Shadow to make it "pop" and look floating
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
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
    letterSpacing: 0.5,
  },
  placeholderTextLarge: {
    fontSize: 14,
  },
});

export default AdBanner;
