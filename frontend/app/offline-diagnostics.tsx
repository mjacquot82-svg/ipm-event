// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// Temporary preview-only diagnostics. Do not merge this route into production.

import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type DiagnosticRow = { label: string; value: string };
type RegistrationDiagnostic = {
  attempted: boolean;
  attemptTimestamp: string;
  registrationUrl: string;
  requestedScope: string;
  outcome: string;
  errorName: string;
  errorMessage: string;
  webpushrInitializedAtAttempt: boolean;
  webpushrInitializedAtCompletion: boolean;
};

const READY_TIMEOUT_MS = 5000;
const SHELL_PREFIX = 'ipm-app-shell-';
const RUNTIME_PREFIX = 'ipm-public-runtime-';

function workerSummary(worker: ServiceWorker | null | undefined) {
  return worker ? `${worker.scriptURL} (${worker.state})` : 'absent';
}

async function readyWithTimeout(): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`timed out after ${READY_TIMEOUT_MS / 1000}s`)), READY_TIMEOUT_MS);
    }),
  ]);
}

async function generatedWorkerInfo() {
  try {
    const response = await fetch('/webpushr-sw.js', { cache: 'no-store' });
    if (!response.ok) return { version: `worker fetch returned HTTP ${response.status}`, assets: [] as string[] };
    const source = await response.text();
    const match = source.match(/^self\.__IPM_OFFLINE_CONFIG__=(.*);$/m);
    if (!match) return { version: 'generated configuration not found', assets: [] as string[] };
    const configuration = JSON.parse(match[1]) as { version?: string; precacheAssets?: string[] };
    return {
      version: configuration.version || 'missing',
      assets: Array.isArray(configuration.precacheAssets) ? configuration.precacheAssets : [],
    };
  } catch (error) {
    return { version: `worker fetch failed: ${String(error)}`, assets: [] as string[] };
  }
}

async function collectDiagnostics(): Promise<DiagnosticRow[]> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return [{ label: 'Diagnostic availability', value: 'Web only' }];
  }

  const rows: DiagnosticRow[] = [
    { label: 'Current origin', value: window.location.origin },
    { label: 'Current pathname', value: window.location.pathname },
    { label: 'display-mode: standalone', value: String(window.matchMedia('(display-mode: standalone)').matches) },
    { label: 'navigator.onLine', value: String(navigator.onLine) },
  ];

  const supportsServiceWorker = 'serviceWorker' in navigator;
  rows.push({ label: 'Service Worker API exists', value: String(supportsServiceWorker) });
  if (!supportsServiceWorker) return rows;

  const registrationDiagnostic = (
    window as typeof window & { __IPM_SW_REGISTRATION_DIAGNOSTIC__?: RegistrationDiagnostic }
  ).__IPM_SW_REGISTRATION_DIAGNOSTIC__;
  rows.push(
    { label: 'Registration attempted', value: String(registrationDiagnostic?.attempted ?? false) },
    { label: 'Registration attempt timestamp', value: registrationDiagnostic?.attemptTimestamp || 'absent' },
    { label: 'Registration URL', value: registrationDiagnostic?.registrationUrl || 'absent' },
    { label: 'Requested scope', value: registrationDiagnostic?.requestedScope || 'absent' },
    { label: 'Registration outcome', value: registrationDiagnostic?.outcome || 'absent' },
    { label: 'Registration error.name', value: registrationDiagnostic?.errorName || 'absent' },
    { label: 'Registration error.message', value: registrationDiagnostic?.errorMessage || 'absent' },
    {
      label: 'Webpushr SDK initialized at registration attempt',
      value: String(registrationDiagnostic?.webpushrInitializedAtAttempt ?? false),
    },
    {
      label: 'Webpushr SDK initialized at registration completion',
      value: String(registrationDiagnostic?.webpushrInitializedAtCompletion ?? false),
    },
  );

  const controller = navigator.serviceWorker.controller;
  rows.push(
    { label: 'Service Worker controller exists', value: String(Boolean(controller)) },
    { label: 'Controller scriptURL', value: controller?.scriptURL || 'absent' },
    { label: 'Controller state', value: controller?.state || 'absent' },
  );

  try {
    const ready = await readyWithTimeout();
    rows.push({ label: 'navigator.serviceWorker.ready', value: `resolved: ${ready.scope}` });
  } catch (error) {
    rows.push({ label: 'navigator.serviceWorker.ready', value: String(error) });
  }

  let registration: ServiceWorkerRegistration | undefined;
  try {
    registration = await navigator.serviceWorker.getRegistration('/');
    rows.push({ label: "getRegistration('/')", value: registration ? 'found' : 'absent' });
  } catch (error) {
    rows.push({ label: "getRegistration('/')", value: `failed: ${String(error)}` });
  }

  rows.push(
    { label: 'Registration scope', value: registration?.scope || 'absent' },
    { label: 'registration.active', value: workerSummary(registration?.active) },
    { label: 'registration.waiting', value: workerSummary(registration?.waiting) },
    { label: 'registration.installing', value: workerSummary(registration?.installing) },
  );

  if (!('caches' in window)) {
    rows.push({ label: 'Cache Storage API exists', value: 'false' });
    return rows;
  }
  rows.push({ label: 'Cache Storage API exists', value: 'true' });

  const generated = await generatedWorkerInfo();
  rows.push({ label: 'Generated offline-worker version', value: generated.version });

  try {
    const cacheNames = await caches.keys();
    const ipmCacheNames = cacheNames.filter(
      (name) => name.startsWith(SHELL_PREFIX) || name.startsWith(RUNTIME_PREFIX),
    );
    rows.push(
      { label: 'caches.keys()', value: cacheNames.length ? cacheNames.join('\n') : 'none' },
      { label: 'IPM-owned caches', value: ipmCacheNames.length ? ipmCacheNames.join('\n') : 'none' },
    );

    const expectedShellName = `${SHELL_PREFIX}${generated.version}`;
    const shellName = cacheNames.includes(expectedShellName)
      ? expectedShellName
      : cacheNames.filter((name) => name.startsWith(SHELL_PREFIX)).sort().at(-1);
    rows.push({ label: 'Current shell cache', value: shellName || 'absent' });

    if (!shellName) {
      rows.push(
        { label: 'Shell cache entry count', value: '0' },
        { label: 'Shell cache request URLs', value: 'none' },
        { label: "cache.match('/index.html')", value: 'false' },
        { label: "cache.match('/')", value: 'false' },
        { label: 'Generated Expo JS bundle cached', value: 'false' },
        { label: 'Map image cached', value: 'false' },
      );
      return rows;
    }

    const shell = await caches.open(shellName);
    const requests = await shell.keys();
    const requestUrls = requests.map((request) => request.url);
    const indexMatch = await shell.match('/index.html');
    const rootMatch = await shell.match('/');
    const expectedBundle = generated.assets.find((asset) => /entry-[a-f0-9]+\.js$/.test(asset));
    const expectedMap = generated.assets.find((asset) => /event-map\.[a-f0-9]+\.png$/.test(asset));
    const bundleMatch = expectedBundle ? await shell.match(expectedBundle) : undefined;
    const mapMatch = expectedMap ? await shell.match(expectedMap) : undefined;

    rows.push(
      { label: 'Shell cache entry count', value: String(requests.length) },
      { label: 'Shell cache request URLs', value: requestUrls.length ? requestUrls.join('\n') : 'none' },
      { label: "cache.match('/index.html')", value: String(Boolean(indexMatch)) },
      { label: "cache.match('/')", value: String(Boolean(rootMatch)) },
      { label: 'Generated Expo JS bundle cached', value: `${Boolean(bundleMatch)}${expectedBundle ? ` — ${expectedBundle}` : ' — asset not found in generated config'}` },
      { label: 'Map image cached', value: `${Boolean(mapMatch)}${expectedMap ? ` — ${expectedMap}` : ' — asset not found in generated config'}` },
    );
  } catch (error) {
    rows.push({ label: 'Cache Storage inspection', value: `failed: ${String(error)}` });
  }

  return rows;
}

export default function OfflineDiagnostics() {
  const [rows, setRows] = useState<DiagnosticRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState('not yet');

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setRows(await collectDiagnostics());
    setUpdatedAt(new Date().toISOString());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Offline Diagnostics</Text>
      <Text style={styles.warning}>Temporary Deploy Preview instrumentation only. No credentials or application storage are inspected.</Text>
      <Pressable
        accessibilityRole="button"
        disabled={refreshing}
        onPress={() => void refresh()}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, refreshing && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>{refreshing ? 'Refreshing…' : 'Refresh diagnostics'}</Text>
      </Pressable>
      <Text style={styles.updated}>Updated: {updatedAt}</Text>
      <View style={styles.rows}>
        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text selectable style={styles.label}>{row.label}</Text>
            <Text selectable style={styles.value}>{row.value}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f5f0' },
  content: { padding: 20, paddingBottom: 48, maxWidth: 900, width: '100%', alignSelf: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: '#132b1f', marginBottom: 8 },
  warning: { fontSize: 14, lineHeight: 20, color: '#4b5563', marginBottom: 16 },
  button: { alignSelf: 'flex-start', backgroundColor: '#176b43', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 12 },
  buttonPressed: { opacity: 0.8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  updated: { marginTop: 12, marginBottom: 16, color: '#4b5563', fontSize: 13 },
  rows: { gap: 10 },
  row: { backgroundColor: '#ffffff', borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', padding: 12 },
  label: { color: '#132b1f', fontSize: 14, fontWeight: '700', marginBottom: 5 },
  value: { color: '#111827', fontSize: 13, lineHeight: 19, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
});
