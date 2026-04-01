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
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= BREAKPOINT;
  
  // Calculate actual image width (92% of screen - accounting for 4% padding each side)
  const imageWidth = screenWidth * 0.92;
  
  // Desktop banner: 1800x180 (aspect ratio 10:1 - very thin)
  // Mobile banner: 1080x500 (aspect ratio 2.16:1)
  // Calculate height based on width and EXACT aspect ratio to prevent cropping
  const desktopAspectRatio = 1800 / 180; // = 10
  const mobileAspectRatio = 1080 / 500;  // = 2.16
  
  const desktopHeight = imageWidth / desktopAspectRatio;
  const mobileHeight = imageWidth / mobileAspectRatio;
  const imageHeight = isDesktop ? desktopHeight : mobileHeight;
  
  // Choose image based on screen width
  const imageSource = Platform.select({
    web: isDesktop 
      ? { uri: DESKTOP_IMAGE_URI } 
      : { uri: MOBILE_IMAGE_URI },
    default: isDesktop 
      ? desktopBannerNative 
      : mobileBannerNative,
  });
  
  // On mobile, add small top margin for visual separation
  const topMargin = isDesktop ? 0 : 4;

  return (
    <View style={[styles.container, { marginTop: topMargin }, style]}>
      <Image
        source={imageSource}
        style={{
          width: imageWidth,
          height: imageHeight,
          borderRadius: 12,
        }}
        resizeMode="stretch"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  image: {
    borderRadius: 12,
  },
});

export default ResponsiveBanner;
