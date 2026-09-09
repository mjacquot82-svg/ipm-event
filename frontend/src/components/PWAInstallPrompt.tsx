// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import colors from '../theme/colors';
import { detectInstallEnvironment, getInstallGuidance, InstallEnvironment, InstallStepCue } from '../utils/installEnvironment';

const DISMISS_KEY = 'pwa_install_dismissed_at';
const INSTALLED_KEY = 'pwa_install_installed';

// Capture once at the app root, including on deep-linked first visits.
export function startInstallPromptCapture() {
  if (Platform.OS !== 'web') return () => undefined;
  const ready = (event: Event) => {
    event.preventDefault();
    window.deferredPWAPrompt = event as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event('ipm-install-state'));
  };
  const installed = () => {
    window.deferredPWAPrompt = null;
    window.ipmInstalledThisSession = true;
    void AsyncStorage.setItem(INSTALLED_KEY, 'true').catch(() => undefined);
    window.dispatchEvent(new Event('ipm-install-state'));
  };
  window.addEventListener('beforeinstallprompt', ready);
  window.addEventListener('appinstalled', installed);
  return () => { window.removeEventListener('beforeinstallprompt', ready); window.removeEventListener('appinstalled', installed); };
}

type InstallOutcome = 'accepted' | 'dismissed';
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: InstallOutcome }> };

declare global {
  interface Window { ipmInstalledThisSession?: boolean; deferredPWAPrompt?: BeforeInstallPromptEvent | null; deferredPWAPromptCapturedAt?: number }
  interface Navigator { standalone?: boolean }
}

export function isStandalonePWA() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true || document.referrer.startsWith('android-app://');
}

function currentEnvironment(): InstallEnvironment {
  const standalone = isStandalonePWA() || window.ipmInstalledThisSession === true;
  return detectInstallEnvironment({
    userAgent: navigator.userAgent, platformHint: navigator.platform, maxTouchPoints: navigator.maxTouchPoints,
    standalone, nativePromptAvailable: !standalone && Boolean(window.deferredPWAPrompt),
  });
}

export default function PWAInstallPrompt({ onDismiss }: { onDismiss?: () => void }) {
  const [visible, setVisible] = useState(false);
  const [environment, setEnvironment] = useState<InstallEnvironment>(() => ({ platform: 'unknown', browser: 'other', installState: 'unsupported_or_unknown', deviceFamily: null }));
  const [installing, setInstalling] = useState(false);
  const triggerRef = useRef<any>(null);
  const headingRef = useRef<any>(null);
  const installInFlight = useRef(false);

  // Help is always explicit: no first-run overlay or recurring install prompt.
  const evaluate = useCallback(async () => {
    if (Platform.OS !== 'web') return;
    setEnvironment(currentEnvironment());
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const update = () => { void evaluate(); };
    window.addEventListener('ipm-install-state', update);
    void evaluate();
    return () => window.removeEventListener('ipm-install-state', update);
  }, [evaluate]);
  useEffect(() => {
    if (!visible) { triggerRef.current?.focus?.(); return; }
    headingRef.current?.focus?.();
  }, [visible]);

  const dismiss = useCallback(async () => {
    setVisible(false);
    triggerRef.current?.focus?.();
    onDismiss?.();
    try { await AsyncStorage.setItem(DISMISS_KEY, String(Date.now())); }
    catch (error) { console.warn('Unable to save PWA install dismissal:', error); }
  }, [onDismiss]);

  const install = useCallback(async () => {
    if (installInFlight.current) return;
    const prompt = window.deferredPWAPrompt;
    if (!prompt) { void evaluate(); return; }
    installInFlight.current = true;
    setInstalling(true);
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      window.deferredPWAPrompt = null;
      if (outcome === 'dismissed') await dismiss();
      else setVisible(false);
    } catch (error) {
      console.warn('Unable to open the browser install prompt:', error);
      window.deferredPWAPrompt = null;
      await evaluate();
    } finally { installInFlight.current = false; setInstalling(false); void evaluate(); }
  }, [dismiss, evaluate]);

  if (Platform.OS !== 'web') return null;
  const guidance = getInstallGuidance(environment);
  const manual = environment.installState !== 'install_prompt_available';

  if (!visible) return (
    <View style={styles.helpEntry}>
      <TouchableOpacity ref={triggerRef} accessibilityRole="button" accessibilityState={{ expanded: false }} onPress={() => { void evaluate(); setVisible(true); }} style={styles.continueButton}>
        <Text style={styles.continueText}>{environment.installState === 'installed' ? 'IPM is on your Home Screen · Help' : 'Add IPM to your Home Screen · Optional'}</Text>
      </TouchableOpacity>
    </View>
  );
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled" accessibilityLabel="Optional Home Screen help">
      <View style={styles.panel}>
        <View ref={headingRef} tabIndex={-1}><Text accessibilityRole="header" style={styles.heading}>Do I need to install IPM?</Text></View>
        <Text style={styles.intro}>No. You can use IPM directly in your browser. Adding it to your Home Screen makes it quicker to open.</Text>
        {environment.installState === 'installed' ? <Text accessibilityLiveRegion="polite" style={styles.intro}>IPM is available from your Home Screen or app launcher.</Text> : <Text style={styles.stepTitle}>{guidance.heading}</Text>}
        <Text style={styles.intro}>{guidance.intro}</Text>
        {manual ? <View style={styles.steps}>{guidance.steps.map((step, index) => (
          <View key={`${step.title}-${index}`} style={styles.step} accessibilityLabel={`Step ${index + 1}. ${step.title}. ${step.hint}`}>
            <View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View>
            <InstructionCue cue={step.cue} />
            <View style={styles.stepCopy}><Text style={styles.stepTitle}>{step.title}</Text><Text style={styles.stepHint}>{step.hint}</Text></View>
          </View>
        ))}</View> : null}
        {guidance.primaryLabel ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Add IPM to your Home Screen" disabled={installing} onPress={install} style={[styles.installButton, installing && styles.disabled]}><Feather name="download" size={24} color="#FFFFFF" /><Text style={styles.installText}>{installing ? 'Opening…' : guidance.primaryLabel}</Text></TouchableOpacity> : null}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Continue without installing" onPress={dismiss} style={styles.continueButton}><Text style={styles.continueText}>Close help — keep using IPM</Text></TouchableOpacity>
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
  helpEntry: { width: '100%' },
  page: { backgroundColor: '#FFFDF7', width: '100%' },
  pageContent: { alignItems: 'center', flexGrow: 1, padding: 0 },
  panel: { backgroundColor: '#FFFFFF', borderColor: '#B9B3A3', borderRadius: 24, borderWidth: 2, maxWidth: 650, paddingHorizontal: 14, paddingVertical: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12, width: '100%' },
  brand: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.primary, borderRadius: 24, flexDirection: 'row', gap: 9, paddingHorizontal: 18, paddingVertical: 11 },
  brandText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  heading: { color: colors.textPrimary, fontSize: 24, fontWeight: '900', lineHeight: 30, marginTop: 0, textAlign: 'center' },
  intro: { color: colors.textSecondary, fontSize: 17, fontWeight: '600', lineHeight: 24, marginTop: 10, textAlign: 'center' },
  steps: { gap: 10, marginTop: 20 },
  step: { alignItems: 'center', backgroundColor: '#FFF9E8', borderColor: '#D8B866', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 82, paddingHorizontal: 11, paddingVertical: 10 },
  number: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 15, height: 30, justifyContent: 'center', width: 30 },
  numberText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  cue: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E0C982', borderRadius: 12, borderWidth: 1, height: 44, justifyContent: 'center', width: 40 },
  cueText: { color: colors.primary, fontSize: 42, fontWeight: '900', lineHeight: 46, marginTop: -5 },
  stepCopy: { flex: 1 },
  stepTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '900', lineHeight: 22 },
  stepHint: { color: colors.textSecondary, fontSize: 16, fontWeight: '600', lineHeight: 23, marginTop: 3 },
  installButton: { alignItems: 'center', backgroundColor: '#8A1F25', borderColor: '#5F1116', borderRadius: 15, borderWidth: 2, flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 24, minHeight: 66, paddingHorizontal: 20 },
  installText: { color: '#FFFFFF', fontSize: 21, fontWeight: '900' }, disabled: { opacity: 0.65 },
  continueButton: { alignItems: 'center', justifyContent: 'center', marginTop: 10, minHeight: 50, paddingHorizontal: 10 },
  continueText: { color: colors.primary, fontSize: 16, fontWeight: '800', textAlign: 'center', textDecorationLine: 'underline' },
  optional: { color: colors.textMuted, fontSize: 16, lineHeight: 24, textAlign: 'center' },
});
