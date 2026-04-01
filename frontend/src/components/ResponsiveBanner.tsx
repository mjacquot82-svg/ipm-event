// Responsive Banner Component
// Uses window.innerWidth directly for web

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
  // For native, use useWindowDimensions
  const dimensions = useWindowDimensions();
  
  // For web, we'll check window.innerWidth synchronously
  const getIsMobile = (): boolean => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.innerWidth < BREAKPOINT;
    }
    return dimensions.width < BREAKPOINT;
  };
  
  const [isMobile, setIsMobile] = useState(getIsMobile);
  
  // Use layout effect for immediate update before paint
  useLayoutEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleResize = () => {
        setIsMobile(window.innerWidth < BREAKPOINT);
      };
      
      // Update immediately
      handleResize();
      
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);
  
  // For web
  if (Platform.OS === 'web') {
    const imageSrc = isMobile ? MOBILE_IMAGE_PATH : DESKTOP_IMAGE_PATH;
    
    return (
      <div style={{
        width: '100%',
        paddingLeft: '4%',
        paddingRight: '4%',
        boxSizing: 'border-box' as const,
        lineHeight: 0,
        margin: 0,
        padding: 0,
        paddingInline: '4%',
      }}>
        <img 
          src={imageSrc}
          alt="IPM 2026 Banner" 
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            objectFit: 'contain' as const,
            objectPosition: 'center',
            borderRadius: 12,
            margin: 0,
            padding: 0,
          }}
        />
      </div>
    );
  }

  // For native platforms
  const isNativeMobile = dimensions.width < BREAKPOINT;
  const aspectRatio = isNativeMobile ? (1080 / 500) : (1800 / 180);
  const imageSource = isNativeMobile ? mobileBannerNative : desktopBannerNative;

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
