import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { checkSystemHealth, HealthSnapshot } from '../../services/systemHealthService';
import { colors } from '../../theme/colors';

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
    {snapshot ? snapshot.rows.map((row) => <View key={row.name} style={styles.row}>
      <View style={styles.heading}><Text style={styles.name}>{row.name}</Text><Text style={row.status === 'Healthy' ? styles.healthy : styles.other}>{row.status}</Text></View>
      <Text style={styles.detail}>{row.detail}</Text>
    </View>) : <Text style={styles.detail}>Checking read-only service status…</Text>}
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
  healthy: { color: colors.primary, fontWeight: '700' }, other: { color: colors.textSecondary, fontWeight: '700' },
  detail: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
});
