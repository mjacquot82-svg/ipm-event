// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// Static startup splash shown while the app initializes.

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, Platform, Text } from 'react-native';
import colors from '../theme/colors';

export default function SplashScreen() {
  const [showReassurance, setShowReassurance] = useState(
    Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false
  );

  useEffect(() => {
    if (showReassurance) return undefined;
    const timer = setTimeout(() => setShowReassurance(true), 2500);
    return () => clearTimeout(timer);
  }, [showReassurance]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/images/ipm-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      {showReassurance && (
        <View style={styles.reassurance} accessibilityLiveRegion="polite">
          <Text style={styles.reassuranceTitle}>Limited connection — IPM is still loading</Text>
          <Text style={styles.reassuranceMessage}>
            We&apos;re opening saved information so you can keep using the app.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '78%',
    maxWidth: 420,
    height: undefined,
    aspectRatio: 1612 / 1487,
  },
  reassurance: {
    alignItems: 'center',
    marginTop: 24,
    maxWidth: 400,
    paddingHorizontal: 24,
  },
  reassuranceTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    textAlign: 'center',
  },
  reassuranceMessage: {
    color: colors.textSecondary,
    fontSize: 17,
    lineHeight: 25,
    marginTop: 12,
    textAlign: 'center',
  },
});
