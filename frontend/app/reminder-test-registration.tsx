import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  getControlledTestDeviceStatus,
  diagnoseControlledTestRegistration,
  TestDeviceLabel,
} from '../src/services/itineraryReminderSync.web';

type Status = { registered: boolean; label: TestDeviceLabel; fingerprint: string };

export default function ReminderTestRegistration() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Checking this subscribed phone…');
  const [diagnostic, setDiagnostic] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    getControlledTestDeviceStatus().then(setStatus).catch(() => setMessage('Choose the correct phone below to register it.'));
  }, []);

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

  return <View style={styles.page}>
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
    {diagnostic ? <View style={styles.diagnostics} accessibilityLiveRegion="polite">
      <Text style={styles.diagnosticTitle}>Safe diagnostics</Text>
      <Text>Browser permission: {String(diagnostic.browserPermission)}</Text>
      <Text>WonderPush SDK: {String(diagnostic.sdk)}</Text>
      <Text>WonderPush subscription: {String(diagnostic.subscription)}</Text>
      <Text>Installation ID: {String(diagnostic.installation)}</Text>
      <Text>Capability: {String(diagnostic.capability)}</Text>
      <Text>Registration API: {String(diagnostic.registrationApi)}</Text>
      <Text>Device label API: {String(diagnostic.labelApi)}</Text>
      <Text>Backend response: {diagnostic.backendStatus ? `HTTP ${diagnostic.backendStatus}` : 'not reached / none'}</Text>
    </View> : null}
    <Pressable style={styles.back} onPress={() => router.replace('/')} accessibilityRole="button"><Text>Back to IPM</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center', padding: 24, gap: 16, backgroundColor: '#FFF' },
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
});
