// Responsive Banner Component
// Uses matchMedia API for reliable responsive image switching

import React, { useState, useEffect, useLayoutEffect } from 'react';
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
  // Use matchMedia API for reliable breakpoint detection on web
  const [isDesktop, setIsDesktop] = useState(false);
  
  useLayoutEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Create media query
      const mediaQuery = window.matchMedia(`(min-width: ${BREAKPOINT}px)`);
      
      // Set initial value
      setIsDesktop(mediaQuery.matches);
      
      // Listen for changes
      const handler = (e: MediaQueryListEvent) => {
        setIsDesktop(e.matches);
      };
      
      // Use addEventListener for modern browsers
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
      } else {
        // Fallback for older browsers
        mediaQuery.addListener(handler);
        return () => mediaQuery.removeListener(handler);
      }
    }
  }, []);

  // For web: show one image based on matchMedia result
  if (Platform.OS === 'web') {
    const imageSrc = isDesktop ? DESKTOP_IMAGE_PATH : MOBILE_IMAGE_PATH;
    
    return (
      <div 
        style={{
          width: '100%',
          margin: 0,
          padding: '0 4%',
          lineHeight: 0,
          boxSizing: 'border-box' as const,
        }}
      >
        <img 
          src={imageSrc} 
          alt="IPM Banner" 
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            margin: 0,
            padding: 0,
            objectFit: 'contain' as const,
            borderRadius: 12,
          }}
        />
      </div>
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
