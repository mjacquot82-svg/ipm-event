// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import colors from '../theme/colors';
import { ATTENDEE_CARD_RADIUS, useAttendeeLayout } from '../theme/attendeePageLayout';

type CachedDataBannerProps = {
  lastSuccessfulUpdate: string | null;
  informationType?: 'event' | 'vendor';
  prominent?: boolean;
};

function formatLastUpdate(timestamp: string | null) {
  if (!timestamp) {
    return 'Last update unavailable';
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Last update unavailable';
  }

  return `Last updated: ${date.toLocaleString()}`;
}

export default function CachedDataBanner({
  lastSuccessfulUpdate,
  informationType = 'event',
  prominent = false,
}: CachedDataBannerProps) {
  const { sectionStyle } = useAttendeeLayout();
  const informationLabel = informationType === 'vendor' ? 'vendor information' : 'event information';

  return (
    <View
      style={[styles.container, prominent && styles.prominentContainer, sectionStyle]}
      accessibilityLiveRegion="polite"
    >
      <Feather name="info" size={prominent ? 22 : 16} color={colors.info} />
      <View style={styles.textContainer}>
        <Text style={[styles.title, prominent && styles.prominentTitle]}>Limited internet connection</Text>
        <Text style={[styles.message, prominent && styles.prominentMessage]}>
          {`You're seeing saved ${informationLabel} so you can keep using IPM. We'll update it automatically when your connection improves.`}
        </Text>
        <Text style={[styles.timestamp, prominent && styles.prominentTimestamp]}>{formatLastUpdate(lastSuccessfulUpdate)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.surfaceHighlight,
    borderColor: colors.border,
    borderRadius: ATTENDEE_CARD_RADIUS,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  message: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  timestamp: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  prominentContainer: {
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  prominentTitle: {
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
  },
  prominentMessage: {
    fontSize: 16,
    lineHeight: 23,
    marginTop: 7,
  },
  prominentTimestamp: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
});
