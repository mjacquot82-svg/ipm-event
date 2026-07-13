// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import colors from '../theme/colors';

type CachedDataBannerProps = {
  lastSuccessfulUpdate: string | null;
};

function formatLastUpdate(timestamp: string | null) {
  if (!timestamp) {
    return 'Last update unavailable';
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Last update unavailable';
  }

  return `Last updated ${date.toLocaleString()}`;
}

export default function CachedDataBanner({ lastSuccessfulUpdate }: CachedDataBannerProps) {
  return (
    <View style={styles.container}>
      <Feather name="info" size={16} color={colors.info} />
      <View style={styles.textContainer}>
        <Text style={styles.message}>Showing saved event information</Text>
        <Text style={styles.timestamp}>{formatLastUpdate(lastSuccessfulUpdate)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.surfaceHighlight,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  timestamp: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
});
