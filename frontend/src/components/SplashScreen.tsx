// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// App Splash Screen Component - Full Image Background

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';

interface SplashScreenProps {
  onFinish: () => void;
  duration?: number;
}

export default function SplashScreen({ onFinish, duration = 2500 }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1.1)).current;

  useEffect(() => {
    // Subtle zoom out animation for the background
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: duration,
      useNativeDriver: true,
    }).start();

    // After duration, fade out and call onFinish
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
  }, [duration, onFinish]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Animated.Image
        source={require('../../assets/images/ipm-final-v1.jpg')}
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
    backgroundColor: '#1a0a0a', // Dark fallback matching image edges
    zIndex: 9999,
  },
  backgroundImage: {
    width: width,
    height: height,
    position: 'absolute',
  },
});
