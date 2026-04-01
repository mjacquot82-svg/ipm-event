// Responsive Banner Component  
// Use dangerouslySetInnerHTML to inject pure HTML that React Native Web cannot modify

import React, { useEffect } from 'react';
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
  // For web: inject pure HTML using dangerouslySetInnerHTML
  if (Platform.OS === 'web') {
    const bannerHTML = `
      <style>
        .ipm-rb-wrap {
          width: 100%;
          padding: 0 4%;
          box-sizing: border-box;
          line-height: 0;
          margin-top: 8px;
        }
        .ipm-rb-wrap img {
          width: 100%;
          height: auto;
          display: block;
          border-radius: 12px;
          object-fit: contain;
        }
        .ipm-rb-mob { display: block; }
        .ipm-rb-desk { display: none; }
        @media screen and (min-width: ${BREAKPOINT}px) {
          .ipm-rb-mob { display: none !important; }
          .ipm-rb-desk { display: block !important; }
        }
      </style>
      <div class="ipm-rb-wrap">
        <img src="${MOBILE_IMAGE_PATH}" alt="IPM 2026 Banner" class="ipm-rb-mob" />
        <img src="${DESKTOP_IMAGE_PATH}" alt="IPM 2026 Banner" class="ipm-rb-desk" />
      </div>
    `;

    return (
      <div dangerouslySetInnerHTML={{ __html: bannerHTML }} />
    );
  }

  // For native platforms, use React Native Image with useWindowDimensions
  const { width } = useWindowDimensions();
  const isMobile = width < BREAKPOINT;
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
