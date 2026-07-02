// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// Static startup splash shown while the app initializes.

import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import colors from '../theme/colors';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/images/ipm-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
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
});
