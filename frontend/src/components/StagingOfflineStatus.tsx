import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import colors from '../theme/colors';
import {
  applyWaitingOfflineShellUpdate,
  checkForOfflineShellUpdate,
  getOfflineShellStatus,
  OfflineShellStatus,
} from '../services/offlineShellStatus';

const isStagingWeb = Platform.OS === 'web'
  && process.env.EXPO_PUBLIC_BACKEND_URL?.includes('staging');

export default function StagingOfflineStatus() {
  const [status, setStatus] = useState<OfflineShellStatus | null>(null);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async (check = false) => {
    setChecking(check);
    try {
      setStatus(check ? await checkForOfflineShellUpdate() : await getOfflineShellStatus());
    } catch {
      setStatus(await getOfflineShellStatus());
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (isStagingWeb) void refresh(false);
  }, [refresh]);

  if (!isStagingWeb || !status) return null;
  const cached = status.cachedShellVersions.join(', ') || 'none';

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Staging offline status</Text>
      <Text style={styles.value}>Controlling shell: {status.controllingShellVersion}</Text>
      <Text style={styles.value}>Cached shell: {cached}</Text>
      <Text style={styles.value}>Bundle: {status.bundleIdentity}</Text>
      <Text style={styles.value}>Update waiting: {status.updateWaiting ? 'yes' : 'no'}</Text>
      {status.startupTimings.map((timing) => (
        <Text key={timing.name} style={styles.value}>Startup {timing.name}: {timing.milliseconds} ms</Text>
      ))}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.button} onPress={() => void refresh(true)} disabled={checking}>
          <Text style={styles.buttonText}>{checking ? 'Checking…' : 'Check for update'}</Text>
        </TouchableOpacity>
        {status.updateWaiting && (
          <TouchableOpacity style={styles.button} onPress={() => void applyWaitingOfflineShellUpdate()}>
            <Text style={styles.buttonText}>Apply ready update</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.hint}>Applying a ready update reloads IPM once. Saved Schedule and Vendor information is retained.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'center', backgroundColor: colors.surfaceHighlight, borderColor: colors.border,
    borderRadius: 14, borderWidth: 1, marginBottom: 20, marginTop: 20, maxWidth: 760, padding: 16, width: '90%' },
  title: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  value: { color: colors.textSecondary, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    fontSize: 12, marginTop: 3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  button: { backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  buttonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 10 },
});
