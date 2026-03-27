// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// App Splash Screen Component - Only shows when installed as a PWA

import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, Dimensions, Platform } from 'react-native';

interface SplashScreenProps {
  onFinish: () => void;
  duration?: number;
}

export default function SplashScreen({ onFinish, duration = 2500 }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1.1)).current;
  
  // This check identifies if the user is viewing the "Installed" App version
  const isStandalone = typeof window !== 'undefined' && 
    (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone);

  useEffect(() => {
    // BOTTOM LINE: If NOT the installed app, skip straight to the "Coming Soon" site
    if (!isStandalone) {
      onFinish();
      return;
    }

    // Otherwise, run the animation for the App
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: duration,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onFinish, isStandalone]);

  // If it's the website, don't show the splash image at all
  if (!isStandalone) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Animated.Image
        source={require('../../assets/images/splash-screen.png')}
        style={[
          styles.backgroundImage,
          { transform: [{ scale: scaleAnim }] }
        ]}
        resizeMode="cover"
      />
    </Animated.View>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a0a0a', 
    zIndex: 9999,
  },
  backgroundImage: {
    width: width,
    height: height,
    position: 'absolute',
  },
});
