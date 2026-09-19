// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { holdPwaUpdate } from '../services/pwaUpdateService';
import colors from '../theme/colors';
import { detectInstallEnvironment, getInstallGuidance, InstallEnvironment, InstallStepCue, shouldOfferInstallGuidance } from '../utils/installEnvironment';

const DISMISS_KEY = 'pwa_install_dismissed_at';
const INSTALLED_KEY = 'pwa_install_installed';
const ENTRY_COMPLETED_KEY = 'pwa_install_entry_completed';
const SESSION_DISMISS_KEY = 'pwa_install_session_dismissed';
let dismissedInThisPage = false;

type InstallDiagnostic = {
  build: string; route: string; isHome: boolean; componentMounted: boolean;
  platform: string; browser: string; mobile: boolean; standalone: boolean;
  navigatorStandalone: boolean; beforeInstallPromptCaptured: boolean;
  storageReadStatus: string; dismissalValue: string | null; sessionFallbackValue: string | null;
  eligible: string; renderRequested: string; suppressionReason: string;
};

export function isInstallDebugMode() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  if (!(host === 'staging.theipm.ca' || host.startsWith('staging.'))) return false;
  if (new URLSearchParams(window.location.search).get('installDebug') === '1') {
    (window as any).__IPM_INSTALL_DEBUG__ = true;
    return true;
  }
  return (window as any).__IPM_INSTALL_DEBUG__ === true;
}

function dismissedInSession() {
  if (dismissedInThisPage) return true;
  try { return window.sessionStorage.getItem(SESSION_DISMISS_KEY) === 'true'; }
  catch { return false; }
}

function rememberSessionDismissal() {
  dismissedInThisPage = true;
  try { window.sessionStorage.setItem(SESSION_DISMISS_KEY, 'true'); }
  catch { /* With all storage blocked, retain the choice for this page's lifetime. */ }
}

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
  interface Window { ipmInstalledThisSession?: boolean; deferredPWAPrompt?: BeforeInstallPromptEvent | null; deferredPWAPromptCapturedAt?: number; __IPM_INSTALL_DEBUG__?: boolean; ipmInstallDiagnostic?: InstallDiagnostic }
  interface Navigator { standalone?: boolean }
}

export function isStandalonePWA() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true || window.matchMedia?.('(display-mode: minimal-ui)').matches;
}

function currentEnvironment(): InstallEnvironment {
  const standalone = isStandalonePWA() || window.ipmInstalledThisSession === true;
  return detectInstallEnvironment({
    userAgent: navigator.userAgent, platformHint: navigator.platform, maxTouchPoints: navigator.maxTouchPoints,
    standalone, nativePromptAvailable: !standalone && Boolean(window.deferredPWAPrompt),
  });
}

function publishDiagnostic(next: InstallDiagnostic) {
  if (typeof window !== 'undefined') {
    window.ipmInstallDiagnostic = next;
    window.dispatchEvent(new Event('ipm-install-diagnostic'));
  }
}

export default function PWAInstallPrompt({ onDismiss, automatic = false }: { onDismiss?: () => void; automatic?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [environment, setEnvironment] = useState<InstallEnvironment>(() => ({ platform: 'unknown', browser: 'other', installState: 'unsupported_or_unknown', deviceFamily: null }));
  const [installing, setInstalling] = useState(false);
  const [diagnostic, setDiagnostic] = useState<InstallDiagnostic | null>(null);
  const triggerRef = useRef<any>(null);
  const headingRef = useRef<any>(null);
  const installInFlight = useRef(false);

  const dismissedThisSession = useRef(false);
  const evaluation = useRef(0);

  // Home owns automatic presentation; About reuses the same guidance on request.
  const evaluate = useCallback(async () => {
    if (Platform.OS !== 'web') return;
    const version = ++evaluation.current;
    const next = currentEnvironment();
    setEnvironment(next);
    const debug = isInstallDebugMode();
    const route = typeof window !== 'undefined' ? window.location.pathname : 'unknown';
    const isHome = route === '/' || route === '';
    const baseDiagnostic = (patch: Partial<InstallDiagnostic> = {}): InstallDiagnostic => ({
      build: process.env.EXPO_PUBLIC_IPM_BUILD_NUMBER || 'unknown',
      route, isHome, componentMounted: true, platform: next.platform, browser: next.browser,
      mobile: next.platform === 'android' || next.platform === 'ios', standalone: next.installState === 'installed',
      navigatorStandalone: typeof navigator !== 'undefined' && navigator.standalone === true,
      beforeInstallPromptCaptured: typeof window !== 'undefined' && Boolean(window.deferredPWAPrompt),
      storageReadStatus: 'pending', dismissalValue: null, sessionFallbackValue: dismissedInSession() ? 'true' : 'false',
      eligible: 'pending', renderRequested: visible ? 'yes' : 'pending', suppressionReason: 'pending', ...patch,
    });
    if (debug) { const snapshot = baseDiagnostic(); setDiagnostic(snapshot); publishDiagnostic(snapshot); }
    if (next.installState === 'installed') {
      setVisible(false);
      if (debug) { const snapshot = baseDiagnostic({ eligible: 'no', renderRequested: 'no', suppressionReason: 'reliable standalone/installed state' }); setDiagnostic(snapshot); publishDiagnostic(snapshot); }
      return;
    }
    if (!automatic || dismissedThisSession.current || dismissedInSession()) {
      if (debug) { const snapshot = baseDiagnostic({ eligible: 'no', renderRequested: 'no', suppressionReason: !automatic ? 'automatic prop is false' : 'dismissed in this page/session' }); setDiagnostic(snapshot); publishDiagnostic(snapshot); }
      return;
    }
    // Storage is a preference source, not a prerequisite for educational guidance.
    // Read independently so a blocked key does not erase another known choice.
    let storageReadStatus = 'ok';
    const read = async (key: string) => { try { return await AsyncStorage.getItem(key); } catch { storageReadStatus = 'error'; return null; } };
    const [installed, completed, dismissedAt] = await Promise.all([INSTALLED_KEY, ENTRY_COMPLETED_KEY, DISMISS_KEY].map(read));
    if (version !== evaluation.current || dismissedThisSession.current || dismissedInSession()) {
      if (debug) { const snapshot = baseDiagnostic({ storageReadStatus, dismissalValue: dismissedAt, eligible: 'no', renderRequested: 'no', suppressionReason: 'evaluation became stale or session dismissed' }); setDiagnostic(snapshot); publishDiagnostic(snapshot); }
      return;
    }
    const eligible = shouldOfferInstallGuidance({ installed: currentEnvironment().installState === 'installed', installedHint: installed === 'true', completed: completed === 'true', dismissedAt });
    const suppressionReason = eligible ? 'none' : installed === 'true' ? 'stored installed flag' : completed === 'true' ? 'stored entry-completed flag' : dismissedAt ? 'stored dismissal timestamp' : 'eligibility returned false';
    if (debug) { const snapshot = baseDiagnostic({ storageReadStatus, dismissalValue: dismissedAt, eligible: eligible ? 'yes' : 'no', renderRequested: eligible ? 'yes' : 'no', suppressionReason }); setDiagnostic(snapshot); publishDiagnostic(snapshot); }
    setVisible(eligible);
  }, [automatic]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const update = () => { void evaluate(); };
    window.addEventListener('ipm-install-state', update);
    void evaluate();
    return () => { evaluation.current++; window.removeEventListener('ipm-install-state', update); };
  }, [evaluate]);
  useEffect(() => {
    if (!visible) { triggerRef.current?.focus?.(); return; }
    headingRef.current?.focus?.();
    return holdPwaUpdate();
  }, [visible]);

  const dismiss = useCallback(async () => {
    dismissedThisSession.current = true;
    rememberSessionDismissal();
    evaluation.current++;
    setVisible(false);
    triggerRef.current?.focus?.();
    onDismiss?.();
    try { await Promise.all([AsyncStorage.setItem(DISMISS_KEY, String(Date.now())), AsyncStorage.setItem(ENTRY_COMPLETED_KEY, 'true')]); }
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
      else {
        dismissedThisSession.current = true;
        rememberSessionDismissal();
        setVisible(false);
        await AsyncStorage.setItem(ENTRY_COMPLETED_KEY, 'true').catch(() => undefined);
      }
    } catch (error) {
      console.warn('Unable to open the browser install prompt:', error);
      window.deferredPWAPrompt = null;
      await evaluate();
    } finally { installInFlight.current = false; setInstalling(false); void evaluate(); }
  }, [dismiss, evaluate]);

  if (Platform.OS !== 'web') return null;
  const guidance = getInstallGuidance(environment);
  const manual = environment.installState !== 'install_prompt_available';
  const debugPanel = diagnostic && isInstallDebugMode() ? <InstallDiagnosticPanel diagnostic={diagnostic} /> : null;

  if (!visible && automatic) return debugPanel;
  if (!visible) return (
    <View style={styles.helpEntry}>
      <TouchableOpacity ref={triggerRef} accessibilityRole="button" accessibilityState={{ expanded: false }} onPress={() => { void evaluate(); setVisible(true); }} style={styles.continueButton}>
        <Text style={styles.continueText}>{environment.installState === 'installed' ? 'Installed app help' : 'Install App'}</Text>
      </TouchableOpacity>
    </View>
  );
  const content = (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled" accessibilityLabel="Install the IPM App guidance">
      <View style={styles.panel}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close install guidance" onPress={dismiss} style={styles.closeButton}><Text style={styles.continueText}>Close</Text></TouchableOpacity>
        <View ref={headingRef} tabIndex={-1}><Text accessibilityRole="header" style={styles.heading}>{environment.installState === 'installed' ? 'IPM is installed' : 'Install the IPM App'}</Text></View>
        <Text style={styles.intro}>{environment.installState === 'installed' ? 'Open IPM from your Home Screen or app list.' : 'Add IPM to your Home Screen for quick access during the event.'}</Text>
        {environment.installState === 'installed' ? <Text accessibilityLiveRegion="polite" style={styles.intro}>IPM is available from your Home Screen or app launcher.</Text> : <Text style={styles.stepTitle}>{guidance.heading}</Text>}
        <Text style={styles.intro}>{guidance.intro}</Text>
        {manual ? <View style={styles.steps}>{guidance.steps.map((step, index) => (
          <View key={`${step.title}-${index}`} style={styles.step} accessibilityLabel={`Step ${index + 1}. ${step.title}. ${step.hint}`}>
            <View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View>
            <InstructionCue cue={step.cue} />
            <View style={styles.stepCopy}><Text style={styles.stepTitle}>{step.title}</Text><Text style={styles.stepHint}>{step.hint}</Text></View>
          </View>
        ))}</View> : null}
        {guidance.primaryLabel ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Install App" disabled={installing} onPress={install} style={[styles.installButton, installing && styles.disabled]}><Feather name="download" size={24} color="#FFFFFF" /><Text style={styles.installText}>{installing ? 'Opening…' : guidance.primaryLabel}</Text></TouchableOpacity> : null}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Continue without installing" onPress={dismiss} style={styles.continueButton}><Text style={styles.continueText}>Continue using the website</Text></TouchableOpacity>
        <Text style={styles.optional}>Installation is optional. The app works in your browser.</Text>
      </View>
    </ScrollView>
  );
  if (!automatic) return <>{content}{debugPanel}</>;
  return <>{<Modal transparent visible accessibilityLabel="Install the IPM App" onRequestClose={() => { void dismiss(); }} animationType="none"
    onShow={() => headingRef.current?.focus?.()}>
    <SafeAreaView style={styles.overlay} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.dialog}>{content}</View>
    </SafeAreaView>
  </Modal>}{debugPanel}</>;
}

function InstallDiagnosticPanel({ diagnostic }: { diagnostic: InstallDiagnostic }) {
  const rows: Array<[string, string | number | boolean]> = [
    ['SUPPRESSION REASON', diagnostic.suppressionReason], ['INSTALL GUIDE ELIGIBLE', diagnostic.eligible], ['RENDER REQUESTED', diagnostic.renderRequested],
    ['BUILD', diagnostic.build], ['ROUTE', diagnostic.route], ['IS HOME', diagnostic.isHome ? 'YES' : 'NO'],
    ['COMPONENT MOUNTED', diagnostic.componentMounted ? 'YES' : 'NO'], ['PLATFORM', diagnostic.platform], ['BROWSER', diagnostic.browser],
    ['MOBILE', diagnostic.mobile ? 'YES' : 'NO'], ['DISPLAY-MODE STANDALONE', diagnostic.standalone ? 'YES' : 'NO'],
    ['NAVIGATOR.STANDALONE', diagnostic.navigatorStandalone ? 'YES' : 'NO'], ['BEFOREINSTALLPROMPT CAPTURED', diagnostic.beforeInstallPromptCaptured ? 'YES' : 'NO'],
    ['STORAGE READ STATUS', diagnostic.storageReadStatus], ['DISMISSAL VALUE', diagnostic.dismissalValue || '(none)'],
    ['SESSION FALLBACK VALUE', diagnostic.sessionFallbackValue || '(none)'],
  ];
  return <View accessible accessibilityLabel="Install guidance diagnostic" style={styles.diagnosticPanel}>
    <Text style={styles.diagnosticHeading}>Install guidance diagnostic</Text>
    <ScrollView style={styles.diagnosticScroll} nestedScrollEnabled showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
      {rows.map(([label, value]) => <Text key={label} style={styles.diagnosticRow}><Text style={styles.diagnosticLabel}>{label}: </Text>{String(value)}</Text>)}
    </ScrollView>
  </View>;
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  dialog: { width: '100%', maxWidth: 650, maxHeight: '100%', flexShrink: 1 },
  closeButton: { alignSelf: 'flex-end', minWidth: 48, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  helpEntry: { width: '100%' },
  page: { backgroundColor: '#FFFDF7', width: '100%', flexShrink: 1, borderRadius: 24 },
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
  diagnosticPanel: { position: 'absolute', left: 8, right: 8, bottom: 56, zIndex: 3000, backgroundColor: '#111827', borderRadius: 10, padding: 8, maxHeight: '46%', paddingBottom: 10 },
  diagnosticScroll: { maxHeight: 180 },
  diagnosticHeading: { color: '#FDE68A', fontSize: 14, fontWeight: '900', marginBottom: 4 },
  diagnosticRow: { color: '#FFFFFF', fontSize: 11, lineHeight: 16 },
  diagnosticLabel: { color: '#93C5FD', fontWeight: '800' },
});
