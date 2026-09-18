import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { AnnouncementDeliveryStats } from '../../services/adminAuthService';
import { notificationMetricRows, notificationMissingDetail } from '../../analytics/notificationMetrics';
import { colors } from '../../theme/colors';

export function NotificationAnalyticsDetails() {
  const [expanded, setExpanded] = useState(false);
  return <View style={styles.details}>
    <Pressable accessibilityRole="button" aria-expanded={expanded} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.detailsButton}>
      <Text style={styles.detailsLabel}>Analytics details {expanded ? '−' : '+'}</Text>
    </Pressable>
    {expanded && <Text style={styles.note}>Provider acceptance and receipts do not confirm visible display. Counts describe devices or events, not people. App visits are separate from provider notification opens. Known deliverable devices are a snapshot, not the provider’s exact target count. Missing statistics are unavailable, not zero.</Text>}
  </View>;
}

export function NotificationMetrics({ stats, available = true }: { stats?: AnnouncementDeliveryStats; available?: boolean }) {
  const missing = stats ? notificationMissingDetail(stats) : null;
  const time = stats?.requested_at || stats?.sent_at;
  return <View style={styles.box} accessibilityLabel="Announcement notification analytics">
    <View style={styles.heading}>
      <Text style={styles.title}>{stats ? 'Notification analytics' : 'Notification'}</Text>
      {!stats ? <Text style={styles.secondary}>{available ? 'No notification sent' : 'Notification analytics temporarily unavailable'}</Text>
        : <Text style={styles.secondary}>Provider accepted: {stats.provider_accepted ? 'Yes' : stats.status === 'failed' ? 'No' : 'Pending / unknown'}</Text>}
    </View>
    {stats && <>
      {stats.status === 'failed' && <Text style={styles.failure}>Provider request failed</Text>}
      {time && <Text style={styles.note}>{stats.requested_at ? 'Requested' : 'Provider accepted'}: {new Date(time).toLocaleString()}</Text>}
      {notificationMetricRows(stats).length > 0 && <View style={styles.grid}>
        {notificationMetricRows(stats).map(([label, value]) => <View key={label} style={styles.metric} accessibilityLabel={`${label}: ${value}`}>
          <Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text>
        </View>)}
      </View>}
      {missing && <Text style={styles.note}>{missing}</Text>}
      {stats.provider_statistics_refreshed_at && <Text style={styles.note}>Statistics last checked: {new Date(stats.provider_statistics_refreshed_at).toLocaleString()}</Text>}
    </>}
  </View>;
}
const styles = StyleSheet.create({
  box: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.divider, gap: 5 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 4 },
  title: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  secondary: { fontSize: 13, color: colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 3 },
  metric: { flexBasis: 140, flexGrow: 1, maxWidth: 200, padding: 10, backgroundColor: colors.surfaceElevated, borderRadius: 6 },
  metricValue: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  metricLabel: { fontSize: 12, lineHeight: 17, color: colors.textSecondary },
  note: { fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  failure: { fontSize: 13, color: colors.error },
  details: { marginBottom: 12, alignItems: 'flex-start', gap: 4 },
  detailsButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  detailsLabel: { fontSize: 13, color: colors.textSecondary, textDecorationLine: 'underline' },
});
