// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// AD BANNER COMPONENT - WITH POINTER EVENTS SUPPORT

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

  return (
    <View 
      style={isTop ? styles.topContainer : styles.bottomContainer}
      pointerEvents={pointerEvents}
    >
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
  topContainer: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bottomContainer: {
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  banner: {
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
});

export default AdBanner;
