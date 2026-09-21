import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import type { NotificationSummaryResponse, ReminderSummaryResponse } from '../../services/adminAnalyticsService';
import { notificationDefinitions } from '../../analytics/notificationMetrics';
import { colors } from '../../theme/colors';

function Count({ label, value, help }: { label: string; value: number | null; help?: string }) {
  return <View style={styles.card} accessibilityLabel={label}>
    <Text style={styles.value}>{value == null ? 'Unavailable' : value.toLocaleString()}</Text>
    <Text style={styles.label}>{label}</Text>
    {help && <Text style={styles.help}>{help}</Text>}
  </View>;
}
const metricLabels = {
  targeted_devices: 'Devices targeted', receipts: 'Confirmed receipts', opens: 'Notification taps',
  visits: 'Opened from notification', failures: 'Provider-reported delivery failures',
} as const;
const torontoTime = (value: string) => new Date(value).toLocaleString('en-CA', { timeZone: 'America/Toronto', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function NotificationOverview({ announcements, reminders, loading, onOpenAnnouncements }: {
  announcements: NotificationSummaryResponse | null; reminders: ReminderSummaryResponse | null; loading: boolean;
  onOpenAnnouncements?: () => void;
}) {
  return <View style={styles.root} accessibilityLabel="Notification performance overview">
    <View style={styles.group} accessibilityLabel="Announcement notification summary">
      <Text style={styles.title}>Announcement notifications</Text>
      <Text style={styles.help}>All-time sends to everyone in this event. Test sends are excluded.</Text>
      {!announcements ? <Text style={styles.help}>{loading ? 'Loading notification summary…' : 'Notification summary is temporarily unavailable.'}</Text> : <>
        {announcements.accepted_sends === 0 ? <Text style={styles.empty}>No announcement requests sent to WonderPush yet.</Text> : <View style={styles.grid}>
          <Count label="Sent to WonderPush" value={announcements.accepted_sends} help={notificationDefinitions['Sent to WonderPush']} />
          {Object.entries(metricLabels).map(([key, label]) => {
            const metric = announcements.metrics[key as keyof typeof metricLabels];
            if (key === 'targeted_devices' && metric.value == null) return null;
            return <Count key={key} label={label} value={metric.value} help={`${notificationDefinitions[label]} Data available for ${metric.covered_sends} of ${metric.total_sends} sends`} />;
          })}
        </View>}
        <View style={styles.grid}>
          <Count label="Failed send requests" value={announcements.failed_requests} help={notificationDefinitions['Failed send requests']} />
          {announcements.pending_requests > 0 && <Count label="Pending / unknown requests" value={announcements.pending_requests} />}
        </View>
        {announcements.accepted_sends > 0 && <>
          {announcements.detailed_sends != null && <Text style={styles.label}>Detailed delivery data available for {announcements.detailed_sends} of {announcements.accepted_sends} sends</Text>}
          <Text style={styles.help}>Each metric shows its own coverage. Counts add known values across sends; the same device may appear more than once.</Text>
          {!!announcements.historical_unattributed_sends && <Text style={styles.help}>Detailed provider statistics were not uniquely attributable for {announcements.historical_unattributed_sends === announcements.accepted_sends ? 'these earlier sends' : 'some earlier sends'}.</Text>}
          <Text style={styles.help}>Unknown / unavailable: {notificationDefinitions['Unknown / unavailable']}</Text>
          <Text style={styles.help}>{announcements.latest_statistics_check ? `Latest stored provider check: ${torontoTime(announcements.latest_statistics_check)}. Other sends may have older statistics.` : 'No provider check time is recorded for these sends.'} Refresh reads saved statistics; it does not contact the provider.</Text>
        </>}
        {announcements.recent.length > 0 && <View style={styles.recent}>
          <Text style={styles.label}>Recent announcement sends</Text>
          <Text style={styles.help}>Opened from notification means recorded app visits through each notification’s tracked link. Repeat opens may be counted; these are not unique people.</Text>
          <Text style={styles.help}>Sent to WonderPush means the provider accepted the request; it does not prove the device displayed it.</Text>
          {announcements.recent.map((send, index) => <View key={index} style={styles.recentRow}>
            <Text style={styles.recentTitle} numberOfLines={2}>{send.title}</Text>
            <Text style={styles.help}>{send.sent_at ? `Sent ${torontoTime(send.sent_at)}` : 'Sent time unavailable'} · {typeof send.notification_origin_visit_count === 'number' && Number.isSafeInteger(send.notification_origin_visit_count) && send.notification_origin_visit_count >= 0 ? `${send.notification_origin_visit_count.toLocaleString()} opened` : 'Opens unavailable'}</Text>
            {!send.sent_at && send.requested_at && <Text style={styles.help}>Requested {torontoTime(send.requested_at)}</Text>}
          </View>)}
        </View>}
      </>}
      {onOpenAnnouncements && <Pressable accessibilityRole="button" onPress={onOpenAnnouncements} style={styles.link}><Text style={styles.linkText}>View announcement details →</Text></Pressable>}
    </View>
    <View style={[styles.group, styles.reminders]} accessibilityLabel="T-30 reminder analytics">
      <Text style={styles.title}>Event reminders / T-30</Text>
      <Text style={styles.help}>Automatic reminders for starred events. Current interests and all-time normal reminder outcomes.</Text>
      {!reminders ? <Text style={styles.help}>{loading ? 'Loading reminders…' : 'Reminder summary is temporarily unavailable.'}</Text> : <View style={styles.grid}>
        <Count label="Active reminder interests" value={reminders.active_interests} />
        <Count label="Reminders sent to WonderPush" value={reminders.provider_accepted} />
        <Count label="Reminder provider failures" value={reminders.provider_failed} />
        <Count label="Reminder delivery unknown" value={reminders.delivery_unknown} />
      </View>}
      <Text style={styles.help}>Sent to WonderPush means the provider accepted the request; it does not prove the device displayed it. Reminder totals are separate from announcement sends.</Text>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  root: { gap: 20 }, group: { gap: 10 }, title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { flexGrow: 1, flexBasis: 150, minWidth: 130, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated },
  value: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  help: { fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  empty: { fontSize: 14, color: colors.textSecondary, paddingVertical: 8 },
  reminders: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 18 },
  recent: { gap: 8 }, recentRow: { gap: 2, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.divider },
  recentTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  linkText: { fontSize: 13, fontWeight: '600', color: colors.primary, textDecorationLine: 'underline' },
});
