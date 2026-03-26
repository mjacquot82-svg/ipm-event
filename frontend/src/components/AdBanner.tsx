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
  const containerStyle = isTop ? styles.topContainer : styles.bottomContainer;
  const bannerHeight = isTop ? 100 : 50;

  return (
    <View style={[styles.container, containerStyle]}>
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
    width: '100%',
    alignItems: 'center',
    backgroundColor: colors.background,
    zIndex: 100,
  },
  topContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bottomContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  banner: {
    width: 320,
    overflow: 'hidden',
    borderRadius: 4,
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
    letterSpacing: 0.5,
  },
  placeholderTextLarge: {
    fontSize: 14,
  },
});

export default AdBanner;
