// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// Owner-only order list for the Volunteer Glasses pre-order (password: VOLUNTEER_ORDER_ADMIN_PASSWORD).

import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import colors from '../src/theme/colors';
import { formatDollars, getVolunteerGlassesCsv, getVolunteerGlassesOrders } from '../src/services/volunteerGlassesService';

const NAMES: Record<string, string> = { colored_logo: 'Colored Logo', large_etched: 'Large Etched', short_etched: 'Short Etched' };

export default function VolunteerGlassesOrdersScreen() {
  const [password, setPassword] = useState('');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try { setData(await getVolunteerGlassesOrders(password)); } catch (e) { setError((e as Error).message); }
  };

  const download = async () => {
    try {
      const csv = await getVolunteerGlassesCsv(password);
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        const a = document.createElement('a');
        a.href = url; a.download = 'volunteer-glasses-orders.csv'; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>Volunteer Glasses Orders</Text>
      {!data ? (
        <View>
          <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} placeholder="Owner password" onSubmitEditing={load} />
          <TouchableOpacity style={styles.button} onPress={load}><Text style={styles.buttonText}>View orders</Text></TouchableOpacity>
        </View>
      ) : (
        <View>
          <Text style={styles.body}>{data.open ? 'Pre-order is open' : 'Pre-order closed'} · {data.orders.length} orders</Text>
          {Object.entries(data.summary.sets_by_style).map(([id, n]) => (
            <Text key={id} style={styles.body}>{NAMES[id] ?? id}: {String(n)} sets</Text>
          ))}
          <Text style={styles.total}>Total: {data.summary.total_sets} sets · {formatDollars(data.summary.total_cents)}</Text>
          <TouchableOpacity style={styles.button} onPress={download}><Text style={styles.buttonText}>Download CSV</Text></TouchableOpacity>
          {data.orders.map((o: any) => (
            <View key={o.id} style={styles.row}>
              <Text style={styles.name}>{o.name} — {o.contact}</Text>
              <Text style={styles.body}>{Object.entries(o.quantities).filter(([, q]) => Number(q) > 0).map(([id, q]) => `${NAMES[id]} ×${q}`).join(', ')} · {formatDollars(o.total_cents)}</Text>
            </View>
          ))}
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, marginBottom: 14 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, backgroundColor: '#fff', marginBottom: 10 },
  button: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 12, marginVertical: 10 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  body: { fontSize: 15, color: colors.textPrimary, marginBottom: 4 },
  total: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginTop: 6 },
  row: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 10 },
  name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  error: { color: '#B00020', fontWeight: '700', marginTop: 10 },
});
