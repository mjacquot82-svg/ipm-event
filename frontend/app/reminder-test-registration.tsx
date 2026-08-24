import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  getControlledTestDeviceStatus,
  diagnoseControlledTestRegistration,
  getItineraryReminderReadiness,
  enableItineraryRemindersForTesting,
  disableItineraryRemindersForTesting,
  setSyntheticReminderFixtureStarred,
  TestDeviceLabel,
} from '../src/services/itineraryReminderSync.web';
import { getFavorites } from '../src/utils/favoritesStorage';

type Status = { registered: boolean; label: TestDeviceLabel; fingerprint: string };
const IS_STAGING = (process.env.EXPO_PUBLIC_BACKEND_URL || '').includes('staging');

export default function ReminderTestRegistration() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Checking this subscribed phone…');
  const [diagnostic, setDiagnostic] = useState<Record<string, unknown> | null>(null);

  const showReadiness = (result: Awaited<ReturnType<typeof getItineraryReminderReadiness>>) => {
    setDiagnostic({ ...result.client,
      backendRegistration: result.registration?.registered ? 'exists' : 'none',
      remindersEnabled: Boolean(result.registration?.reminders_enabled),
      starredCount: result.registration?.starred_count ?? 'unknown',
      installationMatch: result.currentInstallationMatch,
      providerReachability: result.registration?.provider_reachability || 'unknown',
      providerDeliverable: Boolean(result.registration?.provider_deliverable),
      providerCheckedAt: result.registration?.provider_checked_at || 'unknown',
      reminderReady: result.reminderReady });
  };

  useEffect(() => {
    if (!IS_STAGING) return;
    getItineraryReminderReadiness().then((result) => {
      showReadiness(result);
      getControlledTestDeviceStatus().then(setStatus).catch(() => undefined);
      if (!result.reminderReady && result.registration?.registered) {
        setMessage('An earlier registration exists, but this device is stale or not reminder-ready. No notification was sent.');
      } else {
        getControlledTestDeviceStatus().then(setStatus).catch(() => setMessage('Choose the correct phone below to register it.'));
      }
    }).catch(() => setMessage('Safe readiness diagnostics are temporarily unavailable.'));
  }, []);

  if (!IS_STAGING) {
    return <View style={styles.page}><Text style={styles.title}>Not available</Text>
      <Pressable style={styles.back} onPress={() => router.replace('/')} accessibilityRole="button"><Text>Back to IPM</Text></Pressable>
    </View>;
  }

  const register = async (label: TestDeviceLabel) => {
    setBusy(true);
    setMessage('Registering this phone securely…');
    try {
      const result = await diagnoseControlledTestRegistration(label);
      setDiagnostic(result);
      if (result.failureStage) {
        setMessage(`Registration stopped at: ${String(result.failureStage).replaceAll('_', ' ')}.`);
      } else {
        setStatus(await getControlledTestDeviceStatus());
        setMessage('Registration verified. No notification was sent.');
      }
    } catch {
      setMessage('Registration failed. Confirm notifications are enabled on this phone and try again.');
    } finally {
      setBusy(false);
    }
  };


  const changeReminders = async (enabled: boolean) => {
    setBusy(true);
    setMessage(enabled ? 'Verifying and enabling reminders…' : 'Disabling reminders…');
    try {
      const result = enabled
        ? await enableItineraryRemindersForTesting(await getFavorites())
        : await disableItineraryRemindersForTesting();
      showReadiness(result);
      setMessage(enabled
        ? `Reminder synchronization enabled for ${result.registration?.starred_count ?? 0} starred event(s). No notification was sent.`
        : 'Event reminders disabled. Your local itinerary was preserved. No notification was sent.');
    } catch {
      setMessage('Reminder setting was not changed because a readiness or synchronization check failed.');
      getItineraryReminderReadiness().then(showReadiness).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const prepareSyntheticFixture = async (starred: boolean) => {
    setBusy(true);
    try {
      await setSyntheticReminderFixtureStarred(starred);
      setMessage(starred
        ? 'Synthetic demo event associated with Device A. The delivery kill switch remains on; no notification was sent.'
        : 'Synthetic demo event removed from Device A. No notification was sent.');
    } catch {
      setMessage('Synthetic fixture could not be updated. No notification was sent.');
    } finally { setBusy(false); }
  };

  return <ScrollView
    style={styles.scroll}
    contentContainerStyle={styles.page}
    keyboardShouldPersistTaps="handled"
    showsVerticalScrollIndicator
  >
    <Text style={styles.title}>Staging Reminder Test Registration</Text>
    <Text style={styles.copy}>This registers this subscribed phone for the controlled two-device test. Installation IDs and device credentials are never displayed.</Text>
    {status ? <View style={styles.success} accessibilityLiveRegion="polite">
      <Text style={styles.successTitle}>Device {status.label} registered</Text>
      <Text style={styles.copy}>Verification code: {status.fingerprint}</Text>
      <Text style={styles.copy}>No notification has been sent.</Text>
    </View> : <>
      <Pressable disabled={busy} style={styles.button} onPress={() => register('A')} accessibilityRole="button">
        <Text style={styles.buttonText}>Register Marc’s Phone as Device A</Text>
      </Pressable>
      <Pressable disabled={busy} style={styles.secondary} onPress={() => register('B')} accessibilityRole="button">
        <Text style={styles.secondaryText}>Register Jen’s Phone as Device B</Text>
      </Pressable>
    </>}
    {busy ? <ActivityIndicator /> : null}<Text style={styles.message}>{message}</Text>
    {status?.label === 'A' && diagnostic ? <View style={styles.controls}>
      <Text style={styles.diagnosticTitle}>Device A reminder synchronization</Text>
      <Text style={styles.copy}>This enables reminders for the complete itinerary stored on this device. Enabling or disabling does not send a notification.</Text>
      {diagnostic.reminderReady ? (
        <Pressable disabled={busy} style={styles.secondary} onPress={() => changeReminders(false)} accessibilityRole="button">
          <Text style={styles.secondaryText}>Disable Event Reminders</Text>
        </Pressable>
      ) : (
        <Pressable disabled={busy} style={styles.button} onPress={() => changeReminders(true)} accessibilityRole="button">
          <Text style={styles.buttonText}>Enable 30-Minute Event Reminders</Text>
        </Pressable>
      )}
      <Pressable disabled={busy} style={styles.secondary} onPress={() => prepareSyntheticFixture(true)} accessibilityRole="button">
        <Text style={styles.secondaryText}>Associate T-30 Demo Event with Device A</Text>
      </Pressable>
      <Pressable disabled={busy} style={styles.fixtureRemove} onPress={() => prepareSyntheticFixture(false)} accessibilityRole="button">
        <Text style={styles.fixtureRemoveText}>Remove Demo Event</Text>
      </Pressable>
    </View> : null}
    {diagnostic ? <View style={styles.diagnostics} accessibilityLiveRegion="polite">
      <Text style={styles.diagnosticTitle}>Safe diagnostics</Text>
      <Text>Browser permission: {String(diagnostic.browserPermission)}</Text>
      <Text>WonderPush SDK: {String(diagnostic.sdk)}</Text>
      <Text>WonderPush subscription: {String(diagnostic.subscription)}</Text>
      <Text>Installation ID: {String(diagnostic.installation)}</Text>
      <Text>Backend registration: {String(diagnostic.backendRegistration || 'not checked')}</Text>
      <Text>Reminders enabled: {String(diagnostic.remindersEnabled ?? false)}</Text>
      <Text>Synced starred events: {String(diagnostic.starredCount ?? 'unknown')}</Text>
      <Text>Current installation match: {String(diagnostic.installationMatch || 'not checked')}</Text>
      <Text>Provider reachability: {String(diagnostic.providerReachability || 'unknown')}</Text>
      <Text>Provider deliverable: {String(diagnostic.providerDeliverable ?? false)}</Text>
      <Text>Provider verification: {String(diagnostic.providerCheckedAt || 'unknown')}</Text>
      <Text>Reminder readiness: {String(diagnostic.reminderReady ?? false)}</Text>
      <Text>Capability: {String(diagnostic.capability)}</Text>
      <Text>Registration API: {String(diagnostic.registrationApi)}</Text>
      <Text>Device label API: {String(diagnostic.labelApi)}</Text>
      <Text>Backend response: {diagnostic.backendStatus ? `HTTP ${diagnostic.backendStatus}` : 'not reached / none'}</Text>
    </View> : null}
    <Pressable style={styles.back} onPress={() => router.replace('/')} accessibilityRole="button"><Text>Back to IPM</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, width: '100%', backgroundColor: '#FFF' },
  page: { flexGrow: 1, width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48, gap: 16 },
  title: { fontSize: 26, fontWeight: '700', color: '#1F2937' }, copy: { fontSize: 16, lineHeight: 24, color: '#374151' },
  button: { minHeight: 52, borderRadius: 12, backgroundColor: '#8B1538', alignItems: 'center', justifyContent: 'center', padding: 14 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  secondary: { minHeight: 52, borderRadius: 12, borderWidth: 2, borderColor: '#8B1538', alignItems: 'center', justifyContent: 'center', padding: 14 },
  secondaryText: { color: '#8B1538', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  success: { borderRadius: 12, padding: 18, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#047857' },
  successTitle: { fontSize: 20, fontWeight: '700', color: '#065F46' }, message: { minHeight: 24, color: '#374151' },
  back: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  diagnostics: { borderRadius: 12, padding: 16, gap: 6, backgroundColor: '#F3F4F6' },
  diagnosticTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  controls: { borderRadius: 12, padding: 16, gap: 12, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#C2410C' },
  fixtureRemove: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  fixtureRemoveText: { color: '#6B7280', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
});
