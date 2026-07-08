// Responsive Banner Component
// React Native Web compatible - uses useWindowDimensions for responsive behavior.

import React from 'react';
import { View, Image, StyleSheet, useWindowDimensions } from 'react-native';

const BREAKPOINT = 768;
const BANNER_ASPECT_RATIO = 1080 / 620;

const desktopBanner = require('../../assets/images/ipm-banner-desktop.png');
const mobileBanner = require('../../assets/images/ipm-banner-mobile.png');

interface ResponsiveBannerProps {
  style?: any;
}

const ResponsiveBanner: React.FC<ResponsiveBannerProps> = ({ style }) => {
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= BREAKPOINT;
  const imageWidth = screenWidth * 0.92;
  const topMargin = isDesktop ? 0 : 4;

  return (
    <View style={[styles.container, { marginTop: topMargin }, style]}>
      <Image
        source={isDesktop ? desktopBanner : mobileBanner}
        style={{
          width: imageWidth,
          aspectRatio: BANNER_ASPECT_RATIO,
          borderRadius: 12,
        }}
        resizeMode="cover"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
});

export default ResponsiveBanner;
