import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { AnnouncementDeliveryStats } from '../../services/adminAuthService';
import { notificationMetricRows } from '../../analytics/notificationMetrics';

export function NotificationMetrics({ stats, image }: { stats?: AnnouncementDeliveryStats; image: boolean }) {
  return <View style={styles.box} accessibilityLabel="Announcement notification analytics">
    <Text style={styles.title}>Notification analytics</Text>
    <Text>Image: {image ? 'Yes' : 'No'}</Text>
    {notificationMetricRows(stats).map(([label, value]) => <Text key={label}>{label}: {value}</Text>)}
    <Text style={styles.note}>Provider acceptance and receipts do not confirm visible display. Counts describe devices or events, not people. App visits are separate from provider notification opens.</Text>
  </View>;
}
const styles = StyleSheet.create({ box: { marginTop: 10, gap: 3 }, title: { fontWeight: '600' }, note: { fontSize: 12, color: '#56616d', marginTop: 5 } });
