// Responsive Banner Component
// Uses HTML <picture> element for proper responsive image swapping on web

import React from 'react';
import { View, Image, StyleSheet, useWindowDimensions, Platform } from 'react-native';

const BREAKPOINT = 768;

// Image paths for web (served from public folder)
const DESKTOP_IMAGE_PATH = '/images/ipm-banner-desktop.png';
const MOBILE_IMAGE_PATH = '/images/ipm-banner-mobile.png';

// Import images for React Native (native platforms only)
const desktopBannerNative = require('../../assets/images/ipm-banner-desktop.png');
const mobileBannerNative = require('../../assets/images/ipm-banner-mobile.png');

interface ResponsiveBannerProps {
  style?: any;
}

const ResponsiveBanner: React.FC<ResponsiveBannerProps> = ({ style }) => {
  const { width } = useWindowDimensions();
  const isMobile = width < BREAKPOINT;

  // For web, use standard HTML picture element with string paths
  if (Platform.OS === 'web') {
    return (
      <div style={{
        width: '100%',
        paddingLeft: '4%',
        paddingRight: '4%',
        boxSizing: 'border-box' as const,
      }}>
        <style>
          {`
            .banner-wrapper {
              width: 100%;
              height: auto;
            }
            .banner-image {
              width: 100%;
              height: auto;
              display: block;
              object-fit: contain;
              object-position: center;
              border-radius: 12px;
            }
          `}
        </style>
        <picture className="banner-wrapper">
          <source 
            media="(max-width: 767px)" 
            srcSet={MOBILE_IMAGE_PATH} 
          />
          <source 
            media="(min-width: 768px)" 
            srcSet={DESKTOP_IMAGE_PATH} 
          />
          <img 
            src={DESKTOP_IMAGE_PATH} 
            alt="IPM 2026 Banner" 
            className="banner-image"
          />
        </picture>
      </div>
    );
  }

  // For native platforms, use React Native Image with proper aspect ratio
  const aspectRatio = isMobile ? (1080 / 500) : (1800 / 180);
  const imageSource = isMobile ? mobileBannerNative : desktopBannerNative;

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
    alignItems: 'center',
    paddingHorizontal: '4%',
  },
  image: {
    width: '100%',
    borderRadius: 12,
  },
});

export default ResponsiveBanner;
