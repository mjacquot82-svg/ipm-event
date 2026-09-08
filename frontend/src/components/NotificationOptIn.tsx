import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

import {
  getNotificationState,
  NotificationState,
  subscribeToNotifications,
  unsubscribeFromNotifications,
  waitForWonderPushSessionReady,
} from '../services/wonderPushService';
import {
  ensureNotificationRegistration,
  NotificationRegistrationFailure,
  NotificationRegistrationStage,
} from '../services/notificationRegistration';
import { recordNotificationWorkflowDiagnostic } from '../services/wonderPushRuntimeDiagnostic';
import { holdPwaUpdate } from '../services/pwaUpdateService';
import { colors } from '../theme/colors';
import { detectInstallEnvironment } from '../utils/installEnvironment';
import { notificationHelp } from '../utils/notificationHelp';

const STATE_COPY: Record<NotificationState, string> = {
  loading: 'Checking notification status…',
  recovering: 'Checking notification status…',
  default: 'Notifications are optional. Choose whether to receive important IPM announcements.',
  subscribed: 'Notifications are enabled on this device.',
  unsubscribed: 'Notifications are currently disabled on this device.',
  denied: 'Notifications are blocked in your browser settings.',
  unsupported: 'Notifications require a supported browser or installed app.',
  error: 'Notifications are temporarily unavailable. The IPM app will continue to work.',
};

export default function NotificationOptIn({ containerStyle, initiallyExpanded = false }: { containerStyle?: StyleProp<ViewStyle>; initiallyExpanded?: boolean }) {
  const [state, setState] = useState<NotificationState>('loading');
  const [working, setWorking] = useState(false);
  const [verificationDeferred, setVerificationDeferred] = useState(false);
  const [setupState, setSetupState] = useState<'idle' | 'pending' | 'ready' | 'failed'>('idle');
  const [failureStage, setFailureStage] = useState<NotificationRegistrationStage | null>(null);
  const [failureClassification, setFailureClassification] = useState<NotificationRegistrationFailure | null>(null);
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const triggerRef = useRef<any>(null);
  const actionInFlightRef = useRef(false);
  const hasFocusedRef = useRef(false);
  const statusCheckInFlightRef = useRef(false);
  useEffect(() => {
    if (expanded || working || setupState === 'pending') return holdPwaUpdate();
  }, [expanded, working, setupState]);
  const closeHelp = () => { setExpanded(false); triggerRef.current?.focus?.(); };

  const completeSetup = useCallback(async (allowEnrollment = false) => {
    recordNotificationWorkflowDiagnostic('PENDING');
    setSetupState('pending');
    setFailureStage(null);
    setFailureClassification(null);
    try {
      await ensureNotificationRegistration({allowEnrollment});
      recordNotificationWorkflowDiagnostic('SUCCESS');
      setSetupState('ready');
    } catch (error) {
      let finalError = error;
      const classification = (error as { classification?: NotificationRegistrationFailure }).classification;
      if (classification === 'wonderpush_registration_in_progress_session_not_ready') {
        try {
          // RegistrationInProgress with a non-ready session is a startup state,
          // not a completed failure. Stay pending until the SDK reports that its
          // session is ready, then rerun the existing idempotent setup path.
          await waitForWonderPushSessionReady();
          await ensureNotificationRegistration({allowEnrollment});
          recordNotificationWorkflowDiagnostic('SUCCESS');
          setSetupState('ready');
          return;
        } catch (recoveryError) {
          // A later registration/backend/provider failure is authoritative. If
          // only the bounded session wait expired, preserve the original safe
          // classification for the recoverable failure UI.
          if ((recoveryError as { classification?: NotificationRegistrationFailure }).classification) {
            finalError = recoveryError;
          }
        }
      }
      const safeStage = (finalError as { stage?: NotificationRegistrationStage }).stage;
      const safeClassification = (finalError as { classification?: NotificationRegistrationFailure }).classification;
      setFailureStage(safeStage || 'installation_retrieval');
      setFailureClassification(safeClassification || 'other');
      recordNotificationWorkflowDiagnostic('FAILED', safeClassification || 'other');
      setSetupState('failed');

    }
  }, []);

  const refresh = useCallback(async () => {
    if (statusCheckInFlightRef.current || navigator.onLine === false) return;
    statusCheckInFlightRef.current = true;
    try {
      const nextState = await getNotificationState();
      setState(nextState === 'loading' || nextState === 'recovering' ? 'error' : nextState);
      if (nextState === 'subscribed') {
        await completeSetup();
      } else if (nextState !== 'loading') {
        recordNotificationWorkflowDiagnostic('IDLE');
        setSetupState('idle');
        setFailureStage(null);
        setFailureClassification(null);
      }
    } catch {
      setState('error');
    } finally {
      statusCheckInFlightRef.current = false;
    }
  }, [completeSetup]);

  useFocusEffect(
    useCallback(() => {
      // The mount refresh handles the first visit. A later Home visit is an
      // explicit lifecycle opportunity for another bounded initialization
      // check after a transient startup failure.
      if (!hasFocusedRef.current) {
        hasFocusedRef.current = true;
        return;
      }
      if (navigator.onLine === false) {
        setVerificationDeferred(true);
        return;
      }
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const resume = () => {
      setVerificationDeferred(false);
      void refresh();
    };
    const pause = () => setVerificationDeferred(true);
    window.addEventListener('offline', pause);
    window.addEventListener('online', resume);
    if (navigator.onLine === false) setVerificationDeferred(true);
    else void refresh();
    return () => { window.removeEventListener('online', resume); window.removeEventListener('offline', pause); };
  }, [refresh]);

  const updateSubscription = useCallback(async () => {
    if (actionInFlightRef.current || navigator.onLine === false || state === 'denied' || state === 'unsupported') return;
    const releaseUpdate = holdPwaUpdate();
    actionInFlightRef.current = true;
    setWorking(true);
    try {
      const nextState = state === 'subscribed'
        ? await unsubscribeFromNotifications()
        : await subscribeToNotifications();
      setState(nextState === 'loading' || nextState === 'recovering' ? 'error' : nextState);
      if (nextState === 'subscribed') await completeSetup(true);
      else {
        recordNotificationWorkflowDiagnostic('IDLE');
        setSetupState('idle');
      }
    } finally {
      actionInFlightRef.current = false;
      releaseUpdate();
      setWorking(false);
    }
  }, [completeSetup, state]);

  if (Platform.OS !== 'web') return null;
  const environment = detectInstallEnvironment({ userAgent: navigator.userAgent, platformHint: navigator.platform, maxTouchPoints: navigator.maxTouchPoints,
    standalone: window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true });
  const help = notificationHelp(environment, state);
  const canAct = state === 'default' || state === 'unsubscribed' || (state === 'subscribed' && setupState === 'ready');
  const stateMessage = verificationDeferred
    ? 'Notification status will refresh when your connection improves.'
    : state === 'subscribed' && setupState === 'pending'
    ? 'Checking notification delivery…'
    : state === 'subscribed' && setupState === 'failed'
    ? 'Notification delivery is not verified. The app will continue to work.'
    : state === 'subscribed' && setupState !== 'ready'
    ? 'Checking notification delivery…'
    : state === 'unsupported'
    ? (environment.platform === 'ios' && environment.installState !== 'installed' ? 'Optional notifications are available when you open IPM from your Home Screen.' : 'Notifications aren’t available in this browser. You can still use IPM.')
    : STATE_COPY[state];

  return (
    <View
      style={[containerStyle, styles.card]}
      accessibilityLabel="IPM notification settings"
      testID={`notification-setup-${setupState === 'failed'
        ? `${failureStage}-${failureClassification}` : setupState}`}
    >
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={styles.title}>Get important IPM updates</Text>
        <Text accessibilityLiveRegion="polite" style={styles.message}>{stateMessage}</Text>
        <TouchableOpacity ref={triggerRef} accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>{expanded ? 'Hide notification options' : 'Notification options'}</Text>
        </TouchableOpacity>
        {expanded ? <Text style={styles.hint}>Notifications are optional. Get important IPM announcements on this device. You can keep using IPM without them.</Text> : null}
        {expanded && state === 'subscribed' && setupState === 'failed' ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Try notification setup again"
            disabled={working || verificationDeferred} onPress={() => { void refresh(); }}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        ) : null}
        {expanded && !verificationDeferred && (state === 'denied' || state === 'error') ? <TouchableOpacity accessibilityRole="button" onPress={() => { void refresh(); }} style={styles.retryButton}><Text style={styles.retryButtonText}>Check notification status again</Text></TouchableOpacity> : null}
        {expanded && state === 'unsupported' ? <Text style={styles.hint}>{help}</Text> : null}
        {expanded && state === 'denied' ? <Text style={styles.hint}>{help}</Text> : null}

      </View>
      {!verificationDeferred && working ? <ActivityIndicator color={colors.primary} /> : null}
      {expanded && !verificationDeferred && canAct && !working && setupState !== 'pending' ? (
        <View style={styles.actions}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={state === 'subscribed' ? 'Disable IPM notifications' : 'Enable IPM notifications'}
            onPress={updateSubscription}
            style={[styles.button, state === 'subscribed' && styles.disableButton]}
          >
            <Text style={[styles.buttonText, state === 'subscribed' && styles.disableButtonText]}>
              {state === 'subscribed' ? 'Turn off notifications' : 'Enable notifications'}
            </Text>
          </TouchableOpacity>
          {(state === 'default' || state === 'unsubscribed') ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close notification options"
              onPress={closeHelp}
              style={styles.notNowButton}
            >
              <Text style={styles.notNowButtonText}>Close options</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 16, borderWidth: 1, flexDirection: 'column', alignItems: 'stretch', gap: 12, padding: 14, paddingHorizontal: 14 },
  icon: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  copy: { flex: 1, minWidth: 0 },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
  message: { color: colors.textSecondary, fontSize: 16, lineHeight: 24, marginTop: 3 },
  hint: { color: colors.textMuted, fontSize: 16, lineHeight: 24, marginTop: 4 },
  diagnostic: { color: colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 4 },
  button: { minHeight: 48, justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 10, minWidth: 76, paddingHorizontal: 13, paddingVertical: 11 },
  actions: { alignItems: 'center', gap: 2 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  disableButton: { backgroundColor: '#FFFFFF', borderColor: colors.primary, borderWidth: 1 },
  disableButtonText: { color: colors.primary },
  notNowButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 76, paddingHorizontal: 8 },
  notNowButtonText: { color: colors.textSecondary, fontSize: 16, fontWeight: '700' },
  retryButton: { alignSelf: 'flex-start', marginTop: 6, minHeight: 44, justifyContent: 'center' },
  retryButtonText: { color: colors.primary, fontSize: 16, fontWeight: '800' },
});
