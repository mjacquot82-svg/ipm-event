// Responsive Banner Component  
// React Native Web compatible - uses useWindowDimensions for responsive behavior

import React from 'react';
import { View, Image, StyleSheet, useWindowDimensions, Platform } from 'react-native';

const BREAKPOINT = 768;

// Image paths - use URI format for web, require for native
const DESKTOP_IMAGE_URI = '/images/ipm-banner-desktop.png';
const MOBILE_IMAGE_URI = '/images/ipm-banner-mobile.png';

// Native asset imports (only used on native platforms)
const desktopBannerNative = require('../../assets/images/ipm-banner-desktop.png');
const mobileBannerNative = require('../../assets/images/ipm-banner-mobile.png');

interface ResponsiveBannerProps {
  style?: any;
}

const ResponsiveBanner: React.FC<ResponsiveBannerProps> = ({ style }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINT;
  
  // Choose image based on screen width
  // For web: use URI paths (served from public folder)
  // For native: use require() imported assets
  const imageSource = Platform.select({
    web: isDesktop 
      ? { uri: DESKTOP_IMAGE_URI } 
      : { uri: MOBILE_IMAGE_URI },
    default: isDesktop 
      ? desktopBannerNative 
      : mobileBannerNative,
  });
  
  // Desktop banner: 1800x180 = aspect ratio 10
  // Mobile banner: 1080x500 = aspect ratio 2.16
  const aspectRatio = isDesktop ? (1800 / 180) : (1080 / 500);

  return (
    <View style={[styles.container, style]}>
      <Image
        source={imageSource}
        style={[styles.image, { aspectRatio }]}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: '4%',
  },
  image: {
    width: '100%',
    borderRadius: 12,
  },
});

export default ResponsiveBanner;
