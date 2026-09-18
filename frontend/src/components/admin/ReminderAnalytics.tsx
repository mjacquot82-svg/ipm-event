import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { adminRequest } from '../../services/adminAuthService';
import { metricValue } from '../../analytics/notificationMetrics';
const labels: [string, string][] = [
  ['active_interests', 'Active reminder interests'], ['due_reminders', 'Due reminders'],
  ['normal_claims', 'Normal delivery claims'], ['provider_attempts', 'Recorded provider requests'],
  ['provider_accepted', 'Provider accepted'], ['provider_failed', 'Provider failed'],
  ['delivery_unknown', 'Delivery unknown'], ['duplicates_suppressed', 'Duplicate attempts suppressed'],
  ['removed_interests', 'Removed interests'], ['stale_interests', 'Stale or unavailable interests'],
];
export function ReminderAnalytics() {
  const [values, setValues] = useState<Record<string, number | null> | null>(null);
  useEffect(() => {
    let active = true;
    void adminRequest<Record<string, number | null>>('/api/admin/analytics/reminders').then(result => {
      if (active) setValues(result);
    }).catch(() => { /* Unknown stays unknown; no send/claim fallback. */ });
    return () => { active = false; };
  }, []);
  return <View style={{ padding: 16, gap: 5 }} accessibilityLabel="T-30 reminder analytics">
    <Text style={{ fontSize: 18, fontWeight: '600' }}>T-30 reminder analytics</Text>
    {labels.map(([key, label]) => <Text key={key}>{label}: {metricValue(values?.[key])}</Text>)}
    <Text>Current snapshot of normal reminder interests and delivery records. Due reminders meet the scheduler’s 25–30 minute window; staging gates may still prevent a send. Provider acceptance does not confirm visible display.</Text>
    <Text>Duplicate attempts are not historically recorded. Removed interests are cumulative; stale interests are a current snapshot.</Text>
  </View>;
}
