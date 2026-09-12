import { PWA_RESUME_TEST_VERSION } from '../config/pwaResumeTestVersion';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';

// Read-only, explicit support snapshot. Never serialize worker URLs, push
// subscriptions, provider data, storage contents or private identifiers.
export default function AppStatus() {
  const [status, setStatus] = useState('');
  const readStatus = async () => {
    const build = process.env.EXPO_PUBLIC_IPM_BUILD_NUMBER || 'development';
    if (!navigator.serviceWorker) {
      setStatus(`Build ${build}\nOffline app support: unavailable`);
      return;
    }
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      setStatus([
        `Build ${build}`,
        `Offline worker controls this page: ${navigator.serviceWorker.controller ? 'yes' : 'no'}`,
        `Active worker: ${registration?.active ? 'yes' : 'no'}`,
        `Update waiting: ${registration?.waiting ? 'yes' : 'no'}`,
        `Worker installing: ${registration?.installing ? 'yes' : 'no'}`,
        'This snapshot cannot tell whether a newer version is available on the server.',
      ].join('\n'));
    } catch {
      setStatus(`Build ${build}\nApp status could not be read. Try again.`);
    }
  };
  return <View>
    {typeof window !== 'undefined' && window.location.hostname === 'staging.theipm.ca' ? <Text>Resume update test: {PWA_RESUME_TEST_VERSION}</Text> : null}
    <TouchableOpacity accessibilityRole="button" onPress={() => { void readStatus(); }} style={styles.button}>
      <Text style={styles.label}>Read app status</Text>
    </TouchableOpacity>
    {status ? <Text selectable accessibilityLiveRegion="polite" style={styles.status}>{status}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  button: { minHeight: 44, justifyContent: 'center' },
  label: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  status: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
});
