import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  getNotificationState,
  getWonderPushDiagnostics,
  NotificationState,
  subscribeToNotifications,
  unsubscribeFromNotifications,
} from '../services/wonderPushService';
import type { WonderPushDiagnostics } from '../services/wonderPushService';
import { colors } from '../theme/colors';

const STATE_COPY: Record<NotificationState, string> = {
  loading: 'Checking notification status…',
  default: 'Get important IPM announcements on this device.',
  subscribed: 'Notifications are enabled on this device.',
  unsubscribed: 'Notifications are currently disabled on this device.',
  denied: 'Notifications are blocked in your browser settings.',
  unsupported: 'Notifications are not supported in this browser.',
  error: 'Notifications are temporarily unavailable. The IPM app will continue to work.',
};

export default function NotificationOptIn() {
  const [state, setState] = useState<NotificationState>('loading');
  const [working, setWorking] = useState(false);
  const [diagnostics, setDiagnostics] = useState<WonderPushDiagnostics | null>(null);
  const stagingDiagnostics = process.env.EXPO_PUBLIC_EVENT_ID === 'ipm-staging';

  const refresh = useCallback(async () => {
    setState(await getNotificationState());
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') void refresh();
  }, [refresh]);

  const updateSubscription = useCallback(async () => {
    setWorking(true);
    try {
      setState(state === 'subscribed'
        ? await unsubscribeFromNotifications()
        : await subscribeToNotifications());
    } finally {
      setWorking(false);
    }
  }, [state]);

  if (Platform.OS !== 'web') return null;
  const canAct = state === 'default' || state === 'unsubscribed' || state === 'subscribed';

  return (
    <View style={[styles.card, diagnostics && styles.cardWithDiagnostics]} accessibilityLabel="IPM notification settings">
      <View style={styles.icon}><Feather name="bell" size={22} color="#FFFFFF" /></View>
      <View style={styles.copy}>
        <Text style={styles.title}>IPM Notifications</Text>
        <Text style={styles.message}>{STATE_COPY[state]}</Text>
        {state === 'denied' ? <Text style={styles.hint}>Allow notifications for this site in browser settings to enable them.</Text> : null}
      </View>
      {stagingDiagnostics && diagnostics ? (
        <View style={styles.diagnostics} accessibilityLabel="WonderPush staging diagnostics">
          <Text style={styles.diagnosticText}>Permission: {diagnostics.permission}</Text>
          <Text style={styles.diagnosticText}>SDK subscribed: {String(diagnostics.sdkSubscribed)}</Text>
          <Text style={styles.diagnosticText}>Installation ID: {diagnostics.installationId || 'none'}</Text>
          <Text style={styles.diagnosticText}>Worker scope: {diagnostics.workerScopePath || 'none'}</Text>
          <Text style={styles.diagnosticText}>Worker script: {diagnostics.workerScriptPath || 'none'}</Text>
          <Text style={styles.diagnosticText}>Controller: {diagnostics.controllerPath || 'none'}</Text>
          <Text style={styles.diagnosticText}>PushSubscription: {String(diagnostics.hasPushSubscription)}</Text>
          <Text style={styles.diagnosticText}>Errors: {diagnostics.errors.join(', ') || 'none'}</Text>
        </View>
      ) : null}
      {state === 'loading' || working ? <ActivityIndicator color={colors.primary} /> : null}
      {canAct && !working ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={state === 'subscribed' ? 'Disable IPM notifications' : 'Enable IPM notifications'}
          onPress={updateSubscription}
          style={[styles.button, state === 'subscribed' && styles.disableButton]}
        >
          <Text style={[styles.buttonText, state === 'subscribed' && styles.disableButtonText]}>
            {state === 'subscribed' ? 'Disable' : 'Enable'}
          </Text>
        </TouchableOpacity>
      ) : null}
      {stagingDiagnostics && !working ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Show WonderPush staging diagnostics"
          onPress={async () => setDiagnostics(await getWonderPushDiagnostics())}
          style={styles.diagnosticButton}
        >
          <Text style={styles.diagnosticButtonText}>Diagnostics</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 14 },
  cardWithDiagnostics: { flexWrap: 'wrap' },
  icon: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  copy: { flex: 1, minWidth: 0 },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
  message: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 3 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 16, marginTop: 4 },
  button: { backgroundColor: colors.primary, borderRadius: 10, minWidth: 76, paddingHorizontal: 13, paddingVertical: 11 },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  disableButton: { backgroundColor: '#FFFFFF', borderColor: colors.primary, borderWidth: 1 },
  disableButtonText: { color: colors.primary },
  diagnostics: { flexBasis: '100%', gap: 2 },
  diagnosticText: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
  diagnosticButton: { paddingHorizontal: 8, paddingVertical: 8 },
  diagnosticButtonText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
});
