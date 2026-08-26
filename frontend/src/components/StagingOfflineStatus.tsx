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
  const [copied, setCopied] = useState(false);

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
  const workerNavigation = status.workerStartupDiagnostic?.lastNavigation;
  const wonderPushImportDuration = status.workerStartupDiagnostic?.wonderPushImportStarted
    && status.workerStartupDiagnostic?.wonderPushImportFinished
    ? status.workerStartupDiagnostic.wonderPushImportFinished
      - status.workerStartupDiagnostic.wonderPushImportStarted
    : null;
  const copyDiagnostics = async () => {
    const worker = status.workerStartupDiagnostic;
    const navigation = worker?.lastNavigation;
    const report = [
      'IPM staging startup diagnostics',
      `Captured: ${new Date().toISOString()}`,
      'Tap-to-worker/document time: not observable by web code',
      `Controlling shell: ${status.controllingShellVersion}`,
      `Cached shell: ${cached}`,
      `Bundle: ${status.bundleIdentity}`,
      `Update waiting: ${status.updateWaiting ? 'yes' : 'no'}`,
      `Worker boot epoch: ${worker?.workerBootStarted ?? 'unavailable'}`,
      `WonderPush import duration: ${worker?.wonderPushImportStarted && worker?.wonderPushImportFinished
        ? `${worker.wonderPushImportFinished - worker.wonderPushImportStarted} ms` : 'unavailable'}`,
      `Navigation strategy: ${navigation?.strategy ?? 'unavailable'}`,
      `Navigation cache hit: ${navigation?.cacheHit === undefined ? 'unavailable' : navigation.cacheHit ? 'yes' : 'no'}`,
      `Worker fetch to cache selection: ${navigation ? `${navigation.selectedAt - navigation.receivedAt} ms` : 'unavailable'}`,
      ...status.startupTimings.map((timing) => `${timing.name}: ${timing.milliseconds} ms`),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Staging offline status</Text>
      <Text style={styles.value}>Controlling shell: {status.controllingShellVersion}</Text>
      <Text style={styles.value}>Cached shell: {cached}</Text>
      <Text style={styles.value}>Bundle: {status.bundleIdentity}</Text>
      <Text style={styles.value}>Update waiting: {status.updateWaiting ? 'yes' : 'no'}</Text>
      <Text style={styles.value}>Navigation strategy: {workerNavigation?.strategy ?? 'unavailable'}</Text>
      <Text style={styles.value}>Navigation cache hit: {workerNavigation?.cacheHit === undefined ? 'unavailable' : workerNavigation.cacheHit ? 'yes' : 'no'}</Text>
      <Text style={styles.value}>Worker fetch to cache: {workerNavigation ? `${workerNavigation.selectedAt - workerNavigation.receivedAt} ms` : 'unavailable'}</Text>
      <Text style={styles.value}>WonderPush worker import: {wonderPushImportDuration === null ? 'unavailable' : `${wonderPushImportDuration} ms`}</Text>
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
        <TouchableOpacity style={styles.button} onPress={() => void copyDiagnostics()}>
          <Text style={styles.buttonText}>{copied ? 'Copied' : 'Copy startup diagnostics'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>Android/WebAPK time before the worker or document starts cannot be observed here. Applying a ready update reloads IPM once. Saved Schedule and Vendor information is retained.</Text>
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
