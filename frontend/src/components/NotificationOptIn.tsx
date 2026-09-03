import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { colors } from '../theme/colors';
import {
  isNotificationPromptEligible,
  nextNotificationPromptDailyState,
  NOTIFICATION_PROMPT_DAILY_STATE_KEY,
  NOTIFICATION_PROMPT_DISMISSED_AT_KEY,
  parseNotificationPromptDailyState,
} from '../utils/notificationPromptEligibility';

const STATE_COPY: Record<NotificationState, string> = {
  loading: 'Checking notification status…',
  default: 'Get important IPM announcements on this device.',
  subscribed: 'Notifications are enabled on this device.',
  unsubscribed: 'Notifications are currently disabled on this device.',
  denied: 'Notifications are blocked in your browser settings.',
  unsupported: 'Notifications require a supported browser or installed app.',
  error: 'Notifications are temporarily unavailable. The IPM app will continue to work.',
};

export default function NotificationOptIn({ containerStyle }: { containerStyle?: StyleProp<ViewStyle> }) {
  const [state, setState] = useState<NotificationState>('loading');
  const [working, setWorking] = useState(false);
  const [verificationDeferred, setVerificationDeferred] = useState(false);
  const [setupState, setSetupState] = useState<'idle' | 'pending' | 'ready' | 'failed'>('idle');
  const [failureStage, setFailureStage] = useState<NotificationRegistrationStage | null>(null);
  const [failureClassification, setFailureClassification] = useState<NotificationRegistrationFailure | null>(null);
  const [optionalPromptVisible, setOptionalPromptVisible] = useState(false);
  const promptRecordedRef = useRef(false);
  const promptDailyStateRef = useRef<ReturnType<typeof parseNotificationPromptDailyState>>(null);
  const hasFocusedRef = useRef(false);
  const statusCheckInFlightRef = useRef(false);
  const notificationStateRef = useRef<NotificationState>('loading');

  const evaluateOptionalPrompt = useCallback(async (nextState: NotificationState) => {
    if (nextState !== 'default' && nextState !== 'unsubscribed') {
      setOptionalPromptVisible(false);
      if (nextState === 'subscribed') {
        void AsyncStorage.multiRemove([
          NOTIFICATION_PROMPT_DISMISSED_AT_KEY,
          NOTIFICATION_PROMPT_DAILY_STATE_KEY,
        ]).catch(() => undefined);
      }
      return;
    }
    try {
      const [dismissedAt, storedDailyState] = await Promise.all([
        AsyncStorage.getItem(NOTIFICATION_PROMPT_DISMISSED_AT_KEY),
        AsyncStorage.getItem(NOTIFICATION_PROMPT_DAILY_STATE_KEY),
      ]);
      const dailyState = parseNotificationPromptDailyState(storedDailyState);
      const eligible = isNotificationPromptEligible({ now: Date.now(), dismissedAt, dailyState });
      promptDailyStateRef.current = dailyState;
      setOptionalPromptVisible(eligible);
    } catch (error) {
      console.warn('Unable to load notification prompt preference:', error);
      setOptionalPromptVisible(false);
    }
  }, []);

  useEffect(() => {
    if (!optionalPromptVisible || promptRecordedRef.current) return;
    promptRecordedRef.current = true;
    void AsyncStorage.setItem(
      NOTIFICATION_PROMPT_DAILY_STATE_KEY,
      JSON.stringify(nextNotificationPromptDailyState(Date.now(), promptDailyStateRef.current)),
    ).catch((error) => console.warn('Unable to save notification prompt frequency:', error));
  }, [optionalPromptVisible]);

  const dismissOptionalPrompt = useCallback(async () => {
    setOptionalPromptVisible(false);
    promptRecordedRef.current = false;
    try {
      await AsyncStorage.setItem(NOTIFICATION_PROMPT_DISMISSED_AT_KEY, String(Date.now()));
    } catch (error) {
      console.warn('Unable to save notification prompt preference:', error);
    }
  }, []);

  const completeSetup = useCallback(async () => {
    recordNotificationWorkflowDiagnostic('PENDING');
    setSetupState('pending');
    setFailureStage(null);
    setFailureClassification(null);
    try {
      await ensureNotificationRegistration();
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
          await ensureNotificationRegistration();
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
    if (notificationStateRef.current === 'error') {
      // An error retained by the mounted Home screen must not remain visible
      // while a lifecycle retry is checking whether it was only transient.
      notificationStateRef.current = 'loading';
      setState('loading');
    }
    try {
      const nextState = await getNotificationState();
      notificationStateRef.current = nextState;
      setState(nextState);
      await evaluateOptionalPrompt(nextState);
      if (nextState === 'subscribed') {
        await completeSetup();
      } else if (nextState !== 'loading') {
        recordNotificationWorkflowDiagnostic('IDLE');
        setSetupState('idle');
        setFailureStage(null);
        setFailureClassification(null);
      }
    } finally {
      statusCheckInFlightRef.current = false;
    }
  }, [completeSetup, evaluateOptionalPrompt]);

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
        setOptionalPromptVisible(false);
        return;
      }
      if (notificationStateRef.current === 'loading' || notificationStateRef.current === 'error') {
        void refresh();
      } else {
        void getNotificationState()
          .then(evaluateOptionalPrompt)
          .catch(() => setOptionalPromptVisible(false));
      }
    }, [evaluateOptionalPrompt, refresh]),
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const resume = () => {
      setVerificationDeferred(false);
      void refresh();
    };
    window.addEventListener('online', resume);
    if (navigator.onLine === false) setVerificationDeferred(true);
    else void refresh();
    return () => window.removeEventListener('online', resume);
  }, [refresh]);

  const updateSubscription = useCallback(async () => {
    setWorking(true);
    try {
      const nextState = state === 'subscribed'
        ? await unsubscribeFromNotifications()
        : await subscribeToNotifications();
      notificationStateRef.current = nextState;
      setState(nextState);
      await evaluateOptionalPrompt(nextState);
      if (nextState === 'subscribed') await completeSetup();
      else {
        recordNotificationWorkflowDiagnostic('IDLE');
        setSetupState('idle');
      }
    } finally {
      setWorking(false);
    }
  }, [completeSetup, evaluateOptionalPrompt, state]);

  if (Platform.OS !== 'web') return null;
  // The healthy and transient returning-subscriber states require no Home
  // action. Keep setup running, but avoid a persistent card or startup flash.
  if (state === 'loading' || (state === 'subscribed' && setupState !== 'failed')) return null;
  if ((state === 'default' || state === 'unsubscribed') && !optionalPromptVisible) return null;
  const canAct = state === 'default' || state === 'unsubscribed' || state === 'subscribed';
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIphoneSafari = /iPhone|iPad|iPod/.test(window.navigator.userAgent || '') && !standalone;
  const stateMessage = verificationDeferred
    ? 'Notification status will refresh when your connection improves.'
    : state === 'subscribed' && setupState === 'pending'
    ? 'Notifications are enabled. Finishing setup…'
    : state === 'subscribed' && setupState === 'failed'
    ? 'Notifications are enabled, but setup could not be completed. Tap to try again.'
    : state === 'subscribed' && setupState !== 'ready'
    ? 'Notifications are enabled. Finishing setup…'
    : state === 'unsupported' && isIphoneSafari
    ? 'On iPhone, notifications are available from the installed IPM app.'
    : STATE_COPY[state];

  return (
    <View
      style={[styles.card, containerStyle]}
      accessibilityLabel="IPM notification settings"
      testID={`notification-setup-${setupState === 'failed'
        ? `${failureStage}-${failureClassification}` : setupState}`}
    >
      <View style={styles.icon}><Feather name="bell" size={22} color="#FFFFFF" /></View>
      <View style={styles.copy}>
        <Text style={styles.title}>IPM Notifications</Text>
        <Text style={styles.message}>{stateMessage}</Text>
        {state === 'subscribed' && setupState === 'failed' ? (
          <Text style={styles.diagnostic}>Setup reference: {failureClassification || 'other'}</Text>
        ) : null}
        {state === 'subscribed' && setupState === 'failed' ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Try notification setup again"
            onPress={() => { void completeSetup(); }}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        ) : null}
        {state === 'denied' ? <Text style={styles.hint}>Allow notifications for this site in browser settings to enable them.</Text> : null}
        {state === 'unsupported' && isIphoneSafari ? <Text style={styles.hint}>Install IPM to your Home Screen, then open the installed IPM app to enable notifications.</Text> : null}
      </View>
      {!verificationDeferred && working ? <ActivityIndicator color={colors.primary} /> : null}
      {!verificationDeferred && canAct && !working && setupState !== 'pending' ? (
        <View style={styles.actions}>
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
          {(state === 'default' || state === 'unsubscribed') ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Not now"
              onPress={() => { void dismissOptionalPrompt(); }}
              style={styles.notNowButton}
            >
              <Text style={styles.notNowButtonText}>Not now</Text>
            </TouchableOpacity>
          ) : null}
        </View>
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
  diagnostic: { color: colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 4 },
  button: { backgroundColor: colors.primary, borderRadius: 10, minWidth: 76, paddingHorizontal: 13, paddingVertical: 11 },
  actions: { alignItems: 'center', gap: 2 },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  disableButton: { backgroundColor: '#FFFFFF', borderColor: colors.primary, borderWidth: 1 },
  disableButtonText: { color: colors.primary },
  notNowButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 76, paddingHorizontal: 8 },
  notNowButtonText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  retryButton: { alignSelf: 'flex-start', marginTop: 6, minHeight: 44, justifyContent: 'center' },
  retryButtonText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
});
