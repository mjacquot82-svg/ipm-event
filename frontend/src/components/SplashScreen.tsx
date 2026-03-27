// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// This version bypasses the splash screen entirely for web browsers.

import React, { useEffect } from 'react';
import { StyleSheet, Animated, Dimensions, Platform } from 'react-native';

export default function SplashScreen({ onFinish }) {
  const fadeAnim = React.useRef(new Animated.Value(1)).current;

  // Check if we are in a regular web browser (not the installed app)
  const isWebBrowser = Platform.OS === 'web' && 
    typeof window !== 'undefined' && 
    !window.matchMedia('(display-mode: standalone)').matches;

  useEffect(() => {
    // If it's the website, tell the app we are "finished" immediately
    if (isWebBrowser) {
      onFinish();
      return;
    }

    // Only run this timer for the installed App version
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [onFinish, isWebBrowser]);

  // If it's the website, return nothing. The "Coming Soon" page shows instantly.
  if (isWebBrowser) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Animated.Image
        source={require('../../assets/images/splash-icon.png')}
        style={styles.backgroundImage}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 9999,
  },
  backgroundImage: {
    width: width,
    height: height,
  },
});
