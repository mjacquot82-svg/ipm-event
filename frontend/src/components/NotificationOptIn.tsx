import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  getNotificationState,
  NotificationState,
  subscribeToNotifications,
  unsubscribeFromNotifications,
} from '../services/wonderPushService';
import { colors } from '../theme/colors';

const STATE_COPY: Record<NotificationState, string> = {
  loading: 'Checking notification status…',
  default: 'Get important IPM announcements on this device.',
  subscribed: 'Notifications are enabled on this device.',
  unsubscribed: 'Notifications are currently disabled on this device.',
  denied: 'Notifications are blocked in your browser settings.',
  unsupported: 'Notifications require a supported browser or installed app.',
  error: 'Notifications are temporarily unavailable. The IPM app will continue to work.',
};

export default function NotificationOptIn() {
  const [state, setState] = useState<NotificationState>('loading');
  const [working, setWorking] = useState(false);
  const [verificationDeferred, setVerificationDeferred] = useState(false);

  const refresh = useCallback(async () => {
    setState(await getNotificationState());
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    if (navigator.onLine === false) {
      setVerificationDeferred(true);
      const resume = () => {
        setVerificationDeferred(false);
        void refresh();
      };
      window.addEventListener('online', resume, { once: true });
      return () => window.removeEventListener('online', resume);
    }
    void refresh();
    return undefined;
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
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIphoneSafari = /iPhone|iPad|iPod/.test(window.navigator.userAgent || '') && !standalone;
  const stateMessage = verificationDeferred
    ? 'Notification status will refresh when your connection improves.'
    : state === 'unsupported' && isIphoneSafari
    ? 'On iPhone, notifications are available from the installed IPM app.'
    : STATE_COPY[state];

  return (
    <View style={styles.card} accessibilityLabel="IPM notification settings">
      <View style={styles.icon}><Feather name="bell" size={22} color="#FFFFFF" /></View>
      <View style={styles.copy}>
        <Text style={styles.title}>IPM Notifications</Text>
        <Text style={styles.message}>{stateMessage}</Text>
        {state === 'denied' ? <Text style={styles.hint}>Allow notifications for this site in browser settings to enable them.</Text> : null}
        {state === 'unsupported' && isIphoneSafari ? <Text style={styles.hint}>Install IPM to your Home Screen, then open the installed IPM app to enable notifications.</Text> : null}
      </View>
      {!verificationDeferred && (state === 'loading' || working) ? <ActivityIndicator color={colors.primary} /> : null}
      {!verificationDeferred && canAct && !working ? (
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 14 },
  icon: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  copy: { flex: 1, minWidth: 0 },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
  message: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 3 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 16, marginTop: 4 },
  button: { backgroundColor: colors.primary, borderRadius: 10, minWidth: 76, paddingHorizontal: 13, paddingVertical: 11 },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  disableButton: { backgroundColor: '#FFFFFF', borderColor: colors.primary, borderWidth: 1 },
  disableButtonText: { color: colors.primary },
});
