// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// App Splash Screen Component - Only shows when installed as a PWA

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Image, Animated, Dimensions, Platform } from 'react-native';

interface SplashScreenProps {
  onFinish: () => void;
  duration?: number;
}

export default function SplashScreen({ onFinish, duration = 2500 }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1.1)).current;
  
  // LOGIC GATE: Check if the app is "Installed/Standalone"
  const isStandalone = typeof window !== 'undefined' && 
    (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone);

  useEffect(() => {
    // If we are just on the website, skip the splash screen immediately
    if (!isStandalone) {
      onFinish();
      return;
    }

    // Otherwise, run the animation for the installed app
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

  // If it's the website, render nothing (shows the "Coming Soon" page instantly)
  if (!isStandalone) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Animated.Image
        source={require('../../assets/images/splash-screen.jpg')}
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
