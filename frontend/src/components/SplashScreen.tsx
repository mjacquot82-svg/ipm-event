// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// Static Splash Screen - No animation, just the IPM Final image for the App.

import React, { useEffect } from 'react';
import { View, StyleSheet, Image, Dimensions, Platform } from 'react-native';

interface SplashScreenProps {
  onFinish: () => void;
  duration?: number;
}

export default function SplashScreen({ onFinish, duration = 2000 }: SplashScreenProps) {
  
  // Logic Gate: Skip for web browsers, show for the installed App
  const isWebBrowser = Platform.OS === 'web' && 
    typeof window !== 'undefined' && 
    !window.matchMedia('(display-mode: standalone)').matches;

  useEffect(() => {
    if (isWebBrowser) {
      onFinish();
      return;
    }

    // Simple timer to hold the image before entering the app
    const timer = setTimeout(() => {
      onFinish();
    }, duration);

    return () => clearTimeout(timer);
  }, [onFinish, isWebBrowser, duration]);

  // If it's the website, show nothing (Coming Soon page loads instantly)
  if (isWebBrowser) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/images/ipm-final-v1.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
    </View>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000', 
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundImage: {
    width: width,
    height: height,
    position: 'absolute',
  },
});
