import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { activatePwaUpdate, dismissPwaUpdate, subscribePwaUpdate } from '../services/pwaUpdateService';
import colors from '../theme/colors';
export default function PWAUpdatePrompt() {
  const [state, setState] = useState({ visible: false, refreshing: false });
  useEffect(() => Platform.OS === 'web' ? subscribePwaUpdate(setState) : undefined, []);
  if (!state.visible) return null;
  return <View accessibilityRole="alert" style={styles.card}>
    <Text style={styles.title}>IPM app update available</Text>
    <Text>Refresh for the latest app improvements. Your saved choices will stay.</Text>
    <View style={styles.actions}>
      <TouchableOpacity accessibilityRole="button" disabled={state.refreshing} onPress={dismissPwaUpdate}><Text style={styles.button}>Later</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" disabled={state.refreshing} onPress={() => { void activatePwaUpdate(); }}><Text style={styles.button}>{state.refreshing ? 'Refreshing…' : 'Refresh'}</Text></TouchableOpacity>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  card: { position: 'absolute', bottom: 85, left: 16, right: 16, padding: 18, borderRadius: 12, backgroundColor: '#fff', borderColor: colors.primary, borderWidth: 2, zIndex: 9999 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24, marginTop: 12 },
  button: { color: colors.primary, fontWeight: '700', padding: 10 },
});
