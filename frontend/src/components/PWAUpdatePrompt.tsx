import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  activatePwaUpdate,
  dismissPwaUpdate,
  subscribeToPwaUpdates,
} from '../services/pwaUpdateService';
import colors from '../theme/colors';

export default function PWAUpdatePrompt() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    return subscribeToPwaUpdates(setAvailable);
  }, []);

  if (Platform.OS !== 'web' || !available) return null;

  return (
    <View
      style={styles.prompt}
      accessibilityRole="alert"
      accessibilityLabel="IPM app update available"
    >
      <View style={styles.copy}>
        <Text style={styles.title}>IPM app update available</Text>
        <Text style={styles.message}>
          Refresh to get the latest maps, schedule and app improvements.
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Later"
          onPress={dismissPwaUpdate}
          style={styles.laterButton}
        >
          <Text style={styles.laterText}>Later</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Refresh"
          onPress={activatePwaUpdate}
          style={styles.refreshButton}
        >
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: {
    alignItems: 'stretch',
    backgroundColor: '#FFFFFF',
    borderColor: colors.primary,
    borderRadius: 14,
    borderWidth: 2,
    bottom: 76,
    elevation: 8,
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
  copy: { flexShrink: 1 },
  title: { color: colors.textPrimary, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  message: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  laterButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  laterText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  refreshButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  refreshText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
