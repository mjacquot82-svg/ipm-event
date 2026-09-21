import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PopularReminderEvent } from '../../services/adminAnalyticsService';
import { colors } from '../../theme/colors';

const torontoTime = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Toronto', month: 'short', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
});

export function PopularReminderEvents({ items, loading }: {
  items: PopularReminderEvent[] | null; loading: boolean;
}) {
  if (!items) return <Text style={styles.detail}>{loading ? 'Loading reminder popularity…' : 'Reminder popularity is temporarily unavailable.'}</Text>;
  if (!items.length) return <Text style={styles.detail}>No reminder stars for published schedule timeslots.</Text>;
  return <View>
    <Text style={styles.detail}>Current stars · all event dates · America/Toronto</Text>
    <ScrollView style={styles.list} nestedScrollEnabled accessibilityLabel="Top 10 reminder events">
      {items.slice(0, 10).map((item, index) => <View key={item.schedule_item_id} style={styles.row}>
        <View style={styles.heading}>
          <Text style={styles.title}>{index + 1}. {item.title}</Text>
          <Text style={styles.count}>{item.reminder_count.toLocaleString()} {item.reminder_count === 1 ? 'reminder' : 'reminders'}</Text>
        </View>
        <Text style={styles.detail}>{torontoTime.format(new Date(item.starts_at))} · {item.location_name || 'Location not listed'}</Text>
      </View>)}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  list: { maxHeight: 320 },
  row: { paddingVertical: 10, gap: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  heading: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  title: { flexGrow: 1, flexBasis: 180, fontWeight: '600', color: colors.textPrimary },
  count: { fontWeight: '700', color: colors.primary },
  detail: { fontSize: 12, lineHeight: 18, color: colors.textSecondary },
});
