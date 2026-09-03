import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { activatePwaUpdate, subscribeToPwaUpdates } from '../services/pwaUpdateService';
import { colors } from '../theme/colors';

export default function PWAUpdatePrompt() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    return subscribeToPwaUpdates(setAvailable);
  }, []);

  if (Platform.OS !== 'web' || !available) return null;

  return (
    <View style={styles.prompt} accessibilityRole="alert" accessibilityLabel="IPM app update available">
      <View style={styles.copy}>
        <Text style={styles.title}>A new version of the IPM app is available.</Text>
        <Text style={styles.message}>Update when you’re ready to reload the app.</Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Update the IPM app now"
        onPress={activatePwaUpdate}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Update now</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: colors.primary,
    borderRadius: 14,
    borderWidth: 2,
    bottom: 76,
    elevation: 8,
    flexDirection: 'row',
    gap: 12,
    left: 12,
    maxWidth: 560,
    padding: 14,
    position: 'absolute',
    right: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    zIndex: 1000,
  },
  copy: { flex: 1 },
  title: { color: colors.textPrimary, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  message: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  button: { backgroundColor: colors.primary, borderRadius: 10, minHeight: 44, paddingHorizontal: 14,
    alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
