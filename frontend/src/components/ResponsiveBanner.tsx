// Responsive Banner Component
// React Native Web compatible - uses useWindowDimensions for responsive behavior.

import React from 'react';
import { View, Image, StyleSheet, useWindowDimensions } from 'react-native';

const BREAKPOINT = 768;
const BANNER_ASPECT_RATIO = 1536 / 1024;
const MOBILE_PORTRAIT_ASPECT_RATIO = 1;

const heroImage = require('../../assets/images/ipm-hero.png');

interface ResponsiveBannerProps {
  style?: any;
}

const ResponsiveBanner: React.FC<ResponsiveBannerProps> = ({ style }) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isDesktop = screenWidth >= BREAKPOINT;
  const isPortraitMobile = !isDesktop && screenHeight > screenWidth;
  const imageWidth = screenWidth * 0.92;
  const topMargin = isDesktop ? 0 : 4;
  const aspectRatio = isPortraitMobile ? MOBILE_PORTRAIT_ASPECT_RATIO : BANNER_ASPECT_RATIO;
  const resizeMode = isPortraitMobile ? 'contain' : 'cover';
  const centeredObjectFit = {
    objectFit: resizeMode,
    objectPosition: 'center center',
  };

  return (
    <View style={[styles.container, { marginTop: topMargin }, style]}>
      <View style={[styles.imageFrame, {
        width: imageWidth,
        aspectRatio,
      }]}>
        <Image
          source={heroImage}
          style={[styles.image, centeredObjectFit as any]}
          resizeMode={resizeMode}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  imageFrame: {
    backgroundColor: '#F4C86A',
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

export default ResponsiveBanner;
