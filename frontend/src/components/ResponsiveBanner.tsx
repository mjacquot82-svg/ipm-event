// Responsive Banner Component
// Swaps between mobile and desktop images based on screen width

import React from 'react';
import { View, Image, StyleSheet, useWindowDimensions, Platform } from 'react-native';

const BREAKPOINT = 768;

// Import images
const desktopBanner = require('../../assets/images/ipm-banner-desktop.png');
const mobileBanner = require('../../assets/images/ipm-banner-mobile.png');

interface ResponsiveBannerProps {
  style?: any;
}

const ResponsiveBanner: React.FC<ResponsiveBannerProps> = ({ style }) => {
  const { width } = useWindowDimensions();
  const isMobile = width < BREAKPOINT;

  // Desktop aspect ratio: 1800/180 = 10
  // Mobile aspect ratio: 1080/500 = 2.16
  const aspectRatio = isMobile ? (1080 / 500) : (1800 / 180);
  const imageSource = isMobile ? mobileBanner : desktopBanner;

  return (
    <View style={[styles.container, style]}>
      <Image
        source={imageSource}
        style={[
          styles.image,
          { aspectRatio }
        ]}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: '4%', // Match ad spots (92% width)
  },
  image: {
    width: '100%',
    borderRadius: 12,
    // No fixed height - let aspectRatio control it
  },
});

export default ResponsiveBanner;
