import { PWA_RESUME_TEST_VERSION } from '../config/pwaResumeTestVersion';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';

// Read-only, explicit support snapshot. Never serialize worker URLs, push
// subscriptions, provider data, storage contents or private identifiers.
export default function AppStatus() {
  const [status, setStatus] = useState('');
  const [installDiagnostic, setInstallDiagnostic] = useState<any>(() => typeof window !== 'undefined' ? (window as any).ipmInstallDiagnostic || null : null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setInstallDiagnostic((window as any).ipmInstallDiagnostic || null);
    update(); window.addEventListener('ipm-install-diagnostic', update);
    return () => window.removeEventListener('ipm-install-diagnostic', update);
  }, []);
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
    {typeof window !== 'undefined' && window.location.hostname === 'staging.theipm.ca' && (window.location.search.includes('installDebug=1') || (window as any).__IPM_INSTALL_DEBUG__) ? (
      <View accessibilityLabel="Install guidance diagnostic" style={styles.debug}>
        <Text style={styles.debugHeading}>Install guidance diagnostic</Text>
        {installDiagnostic ? Object.entries(installDiagnostic).map(([key, value]) => <Text key={key} style={styles.debugRow}><Text style={styles.debugLabel}>{key.replace(/[A-Z]/g, m => ` ${m}`).toUpperCase()}: </Text>{String(value ?? '(none)')}</Text>) : <Text style={styles.debugRow}>COMPONENT MOUNTED: NO DECISION SNAPSHOT RECEIVED</Text>}
      </View>
    ) : null}
  </View>;
}
const styles = StyleSheet.create({
  button: { minHeight: 44, justifyContent: 'center' },
  label: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  status: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  debug: { backgroundColor: '#111827', borderRadius: 10, marginTop: 12, padding: 10 },
  debugHeading: { color: '#FDE68A', fontSize: 14, fontWeight: '900', marginBottom: 4 },
  debugRow: { color: '#FFFFFF', fontSize: 11, lineHeight: 16 },
  debugLabel: { color: '#93C5FD', fontWeight: '800' },
});
