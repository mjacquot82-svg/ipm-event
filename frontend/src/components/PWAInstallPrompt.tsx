// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import colors from '../theme/colors';
import { detectInstallEnvironment, detectStandaloneSignals, getInstallGuidance, InstallEnvironment, InstallStepCue, shouldShowInstallGateway } from '../utils/installEnvironment';

const DISMISS_KEY = 'pwa_install_dismissed_at';
const INSTALLED_KEY = 'pwa_install_installed';
const ENTRY_COMPLETED_KEY = 'pwa_install_entry_completed';

type InstallOutcome = 'accepted' | 'dismissed';
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: InstallOutcome }> };

declare global {
  interface Window { deferredPWAPrompt?: BeforeInstallPromptEvent | null; deferredPWAPromptCapturedAt?: number }
  interface Navigator { standalone?: boolean }
}

export function isStandalonePWA() {
  if (typeof window === 'undefined') return false;
  return detectStandaloneSignals({
    displayModeStandalone: Boolean(window.matchMedia?.('(display-mode: standalone)').matches),
    navigatorStandalone: window.navigator.standalone === true,
    referrer: document.referrer,
  });
}

function currentEnvironment(): InstallEnvironment {
  const standalone = isStandalonePWA();
  return detectInstallEnvironment({
    userAgent: navigator.userAgent, platformHint: navigator.platform, maxTouchPoints: navigator.maxTouchPoints,
    standalone, nativePromptAvailable: !standalone && Boolean(window.deferredPWAPrompt),
  });
}

export default function PWAInstallPrompt({ onDismiss }: { onDismiss?: () => void }) {
  const [visible, setVisible] = useState(false);
  const [environment, setEnvironment] = useState<InstallEnvironment>(() => ({ platform: 'unknown', browser: 'other', installState: 'unsupported_or_unknown', deviceFamily: null }));
  const [installing, setInstalling] = useState(false);
  const shownRef = useRef(false);
  const dismissedThisSessionRef = useRef(false);
  const entryCompletedThisSessionRef = useRef(false);
  const initialPathRef = useRef(
    typeof window === 'undefined' ? '/' : window.location.pathname
  );

  const recordShown = useCallback((next: InstallEnvironment) => {
    if (shownRef.current) return;
    shownRef.current = true;
  }, []);

  const rememberEntryCompleted = useCallback(async () => {
    entryCompletedThisSessionRef.current = true;
    try { await AsyncStorage.setItem(ENTRY_COMPLETED_KEY, 'true'); }
    catch (error) { console.warn('Unable to save PWA entry preference:', error); }
  }, []);

  const evaluate = useCallback(async () => {
    if (Platform.OS !== 'web') return;
    const next = currentEnvironment();
    setEnvironment(next);
    if (next.installState === 'installed') {
      setVisible(false);
      void AsyncStorage.setItem(INSTALLED_KEY, 'true');
      void rememberEntryCompleted();
      return;
    }
    if (dismissedThisSessionRef.current || entryCompletedThisSessionRef.current) {
      setVisible(false);
      return;
    }
    try {
      const [installed, dismissedAt, entryCompleted] = await Promise.all([
        AsyncStorage.getItem(INSTALLED_KEY),
        AsyncStorage.getItem(DISMISS_KEY),
        AsyncStorage.getItem(ENTRY_COMPLETED_KEY),
      ]);
      const visibleForEntry = shouldShowInstallGateway({
        environment: next,
        initialPath: initialPathRef.current,
        installedHint: installed === 'true',
        returningVisitor: entryCompleted === 'true',
        dismissedAt,
        now: Date.now(),
        storageReadable: true,
      });
      setVisible(visibleForEntry);
      if (!visibleForEntry) void rememberEntryCompleted();
      if (!visibleForEntry) return;
    } catch (error) {
      console.warn('Unable to load PWA install preference:', error);
      setVisible(false);
      return;
    }
    setVisible(true);
    recordShown(next);
  }, [recordShown, rememberEntryCompleted]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handlePromptReady = (event: Event) => {
      event.preventDefault();
      window.deferredPWAPrompt = event as BeforeInstallPromptEvent;
      window.deferredPWAPromptCapturedAt = Date.now();
      void evaluate();
    };
    const handleInstalled = () => {
      window.deferredPWAPrompt = null;
      setVisible(false);
      void AsyncStorage.setItem(INSTALLED_KEY, 'true');
      void rememberEntryCompleted();
    };
    window.addEventListener('beforeinstallprompt', handlePromptReady);
    window.addEventListener('appinstalled', handleInstalled);
    void evaluate();
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePromptReady);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [evaluate, rememberEntryCompleted]);

  const dismiss = useCallback(async () => {
    dismissedThisSessionRef.current = true;
    setVisible(false);
    onDismiss?.();
    try {
      await Promise.all([
        AsyncStorage.setItem(DISMISS_KEY, String(Date.now())),
        AsyncStorage.setItem(ENTRY_COMPLETED_KEY, 'true'),
      ]);
      entryCompletedThisSessionRef.current = true;
    }
    catch (error) { console.warn('Unable to save PWA install dismissal:', error); }
  }, [onDismiss]);

  const install = useCallback(async () => {
    const prompt = window.deferredPWAPrompt;
    if (!prompt) { void evaluate(); return; }
    setInstalling(true);
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      window.deferredPWAPrompt = null;
      if (outcome === 'dismissed') await dismiss();
      else {
        setVisible(false);
        void rememberEntryCompleted();
      }
    } catch (error) {
      console.warn('Unable to open the browser install prompt:', error);
      window.deferredPWAPrompt = null;
      await evaluate();
    } finally { setInstalling(false); }
  }, [dismiss, evaluate, rememberEntryCompleted]);

  if (Platform.OS !== 'web' || !visible || environment.installState === 'installed') return null;
  const guidance = getInstallGuidance(environment);
  const manual = environment.installState !== 'install_prompt_available';

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled" accessibilityLabel="Install the official IPM app">
      <View style={styles.panel}>
        <View style={styles.brand}><Feather name="smartphone" size={24} color="#FFFFFF" /><Text style={styles.brandText}>Official IPM 2026 App</Text></View>
        <Text accessibilityRole="header" style={styles.heading}>{guidance.heading}</Text>
        <Text style={styles.intro}>{guidance.intro}</Text>
        {manual ? <View style={styles.steps}>{guidance.steps.map((step, index) => (
          <View key={`${step.title}-${index}`} style={styles.step} accessibilityLabel={`Step ${index + 1}. ${step.title}. ${step.hint}`}>
            <View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View>
            <InstructionCue cue={step.cue} />
            <View style={styles.stepCopy}><Text style={styles.stepTitle}>{step.title}</Text><Text style={styles.stepHint}>{step.hint}</Text></View>
          </View>
        ))}</View> : null}
        {guidance.primaryLabel ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Install App" disabled={installing} onPress={install} style={[styles.installButton, installing && styles.disabled]}><Feather name="download" size={24} color="#FFFFFF" /><Text style={styles.installText}>{installing ? 'Opening…' : guidance.primaryLabel}</Text></TouchableOpacity> : null}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Continue without installing" onPress={dismiss} style={styles.continueButton}><Text style={styles.continueText}>{environment.platform === 'unknown' ? 'Continue to the app' : 'Maybe later — continue to the app'}</Text></TouchableOpacity>
        <Text style={styles.optional}>Installation is optional. The app works in your browser.</Text>
      </View>
    </ScrollView>
  );
}

function InstructionCue({ cue }: { cue: InstallStepCue }) {
  const iconNames: Partial<Record<InstallStepCue, keyof typeof Feather.glyphMap>> = {
    share: 'share', add_home: 'plus-square', install: 'download', safari: 'compass', address_bar: 'link',
  };
  const icon = iconNames[cue];
  const text = cue === 'more_vertical' ? '⋮' : cue === 'menu' ? '☰' : null;
  const label = cue === 'more_vertical' ? 'three-dot menu symbol' : cue === 'menu' ? 'menu symbol' : `${cue.replace('_', ' ')} symbol`;
  return <View style={styles.cue} accessible accessibilityRole="image" accessibilityLabel={label}>
    {text ? <Text style={styles.cueText}>{text}</Text> : icon ? <Feather name={icon} size={31} color={colors.primary} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  page: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FFFDF7', zIndex: 2000 },
  pageContent: { alignItems: 'center', flexGrow: 1, justifyContent: 'center', padding: 16 },
  panel: { backgroundColor: '#FFFFFF', borderColor: '#B9B3A3', borderRadius: 24, borderWidth: 2, maxWidth: 650, paddingHorizontal: 22, paddingVertical: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12, width: '100%' },
  brand: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.primary, borderRadius: 24, flexDirection: 'row', gap: 9, paddingHorizontal: 18, paddingVertical: 11 },
  brandText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  heading: { color: colors.textPrimary, fontSize: 28, fontWeight: '900', lineHeight: 34, marginTop: 20, textAlign: 'center' },
  intro: { color: colors.textSecondary, fontSize: 17, fontWeight: '600', lineHeight: 24, marginTop: 10, textAlign: 'center' },
  steps: { gap: 10, marginTop: 20 },
  step: { alignItems: 'center', backgroundColor: '#FFF9E8', borderColor: '#D8B866', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 82, paddingHorizontal: 11, paddingVertical: 10 },
  number: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 15, height: 30, justifyContent: 'center', width: 30 },
  numberText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  cue: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E0C982', borderRadius: 12, borderWidth: 1, height: 54, justifyContent: 'center', width: 54 },
  cueText: { color: colors.primary, fontSize: 42, fontWeight: '900', lineHeight: 46, marginTop: -5 },
  stepCopy: { flex: 1 },
  stepTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '900', lineHeight: 22 },
  stepHint: { color: colors.textSecondary, fontSize: 14, fontWeight: '600', lineHeight: 19, marginTop: 3 },
  installButton: { alignItems: 'center', backgroundColor: '#8A1F25', borderColor: '#5F1116', borderRadius: 15, borderWidth: 2, flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 24, minHeight: 66, paddingHorizontal: 20 },
  installText: { color: '#FFFFFF', fontSize: 21, fontWeight: '900' }, disabled: { opacity: 0.65 },
  continueButton: { alignItems: 'center', justifyContent: 'center', marginTop: 10, minHeight: 50, paddingHorizontal: 10 },
  continueText: { color: colors.primary, fontSize: 16, fontWeight: '800', textAlign: 'center', textDecorationLine: 'underline' },
  optional: { color: colors.textMuted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
