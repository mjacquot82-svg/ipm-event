// Responsive Banner Component
// React Native Web compatible - uses useWindowDimensions for responsive behavior.

import React from 'react';
import { View, Image, StyleSheet, useWindowDimensions } from 'react-native';

const BREAKPOINT = 768;
const DESKTOP_BANNER_ASPECT_RATIO = 2.05;
const TABLET_BANNER_ASPECT_RATIO = 1.72;
const MOBILE_PORTRAIT_ASPECT_RATIO = 1;
const MOBILE_LANDSCAPE_ASPECT_RATIO = 1.5;
const LOGO_ASPECT_RATIO = 447 / 559;

const fieldImage = require('../../assets/images/field.png');
const logoImage = require('../../assets/images/gemini4.png');

interface ResponsiveBannerProps {
  style?: any;
}

const ResponsiveBanner: React.FC<ResponsiveBannerProps> = ({ style }) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isDesktop = screenWidth >= BREAKPOINT;
  const isTablet = screenWidth >= BREAKPOINT && screenWidth < 1024;
  const isMobile = screenWidth < BREAKPOINT;
  const isPortrait = screenHeight > screenWidth;
  const imageWidth = screenWidth * 0.92;
  const topMargin = isDesktop ? 0 : 4;
  const aspectRatio = isMobile
    ? isPortrait
      ? MOBILE_PORTRAIT_ASPECT_RATIO
      : MOBILE_LANDSCAPE_ASPECT_RATIO
    : isTablet
      ? TABLET_BANNER_ASPECT_RATIO
      : DESKTOP_BANNER_ASPECT_RATIO;
  const logoWidth = isMobile ? '62%' : isTablet ? '44%' : '38%';
  const centeredCover = {
    objectFit: 'cover',
    objectPosition: 'center center',
  };

  return (
    <View style={[styles.container, { marginTop: topMargin }, style]}>
      <View style={[styles.imageFrame, {
        width: imageWidth,
        aspectRatio,
      }]}>
        <Image
          source={fieldImage}
          style={[styles.backgroundImage, centeredCover as any]}
          resizeMode="cover"
        />
        <View style={styles.logoLayer} pointerEvents="none">
          <Image
            source={logoImage}
            style={[styles.logo, {
              width: logoWidth,
            }]}
            resizeMode="contain"
          />
        </View>
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
    borderRadius: 12,
    overflow: 'hidden',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  logoLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    aspectRatio: LOGO_ASPECT_RATIO,
  },
});

export default ResponsiveBanner;
