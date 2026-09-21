import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { checkSystemHealth, HealthSnapshot } from '../../services/systemHealthService';
import { colors } from '../../theme/colors';

function statusVisual(status: HealthSnapshot['rows'][number]['status']) {
  switch (status) {
    case 'Healthy':
      return { text: styles.healthy, badge: styles.healthyBadge, dot: styles.healthyDot };
    case 'Degraded':
      return { text: styles.degraded, badge: styles.degradedBadge, dot: styles.degradedDot };
    case 'Unavailable':
      return { text: styles.unavailable, badge: styles.unavailableBadge, dot: styles.unavailableDot };
    default:
      return { text: styles.notTracked, badge: styles.notTrackedBadge, dot: styles.notTrackedDot };
  }
}

export function SystemHealthView({ snapshot, checking, onRefresh }: {
  snapshot: HealthSnapshot | null; checking: boolean; onRefresh: () => void;
}) {
  return <View style={styles.section}>
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={styles.title}>System Health</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Refresh system health" disabled={checking} onPress={onRefresh} style={styles.button}>
        <Text>{checking ? 'Checking…' : 'Refresh'}</Text>
      </Pressable>
    </View>
    <Text style={styles.detail}>Last checked: {snapshot ? new Date(snapshot.checkedAt).toLocaleString() : 'Not checked yet'}</Text>
    {snapshot ? snapshot.rows.map((row) => {
      const visual = statusVisual(row.status);
      return <View key={row.name} style={styles.row}>
        <View style={styles.heading}>
          <Text style={styles.name}>{row.name}</Text>
          <View style={[styles.statusBadge, visual.badge]} accessibilityLabel={`${row.name} ${row.status}`}>
            <View style={[styles.statusDot, visual.dot]} />
            <Text style={[styles.statusText, visual.text]}>{row.status}</Text>
          </View>
        </View>
        <Text style={styles.detail}>{row.detail}</Text>
      </View>;
    }) : <Text style={styles.detail}>Checking read-only service status…</Text>}
  </View>;
}

export function SystemHealth() {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [checking, setChecking] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  async function refresh() {
    if (inFlight.current) return;
    inFlight.current = true;
    setChecking(true);
    try {
      const result = await checkSystemHealth();
      if (mounted.current) setSnapshot(result);
    } finally {
      inFlight.current = false;
      if (mounted.current) setChecking(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => { mounted.current = false; };
  }, []);
  return <SystemHealthView snapshot={snapshot} checking={checking} onRefresh={() => void refresh()} />;
}

const styles = StyleSheet.create({
  section: { padding: 16, gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  title: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
  row: { gap: 4 }, name: { fontWeight: '600', color: colors.textPrimary },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '800' },
  healthy: { color: colors.success }, healthyBadge: { backgroundColor: '#F1F6E8', borderColor: '#CBD9AE' }, healthyDot: { backgroundColor: colors.success },
  degraded: { color: colors.warning }, degradedBadge: { backgroundColor: '#FFF7E3', borderColor: '#E8C777' }, degradedDot: { backgroundColor: colors.warning },
  unavailable: { color: colors.error }, unavailableBadge: { backgroundColor: '#FCECEE', borderColor: '#E3AEB2' }, unavailableDot: { backgroundColor: colors.error },
  notTracked: { color: colors.textMuted }, notTrackedBadge: { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }, notTrackedDot: { backgroundColor: colors.textMuted },
  detail: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
});
