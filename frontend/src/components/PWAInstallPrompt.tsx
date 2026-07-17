// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import colors from '../theme/colors';

const DISMISS_KEY = 'pwa_install_dismissed_at';
const INSTALLED_KEY = 'pwa_install_installed';
const DISMISS_COOLDOWN_MS = 5 * 24 * 60 * 60 * 1000;

type InstallOutcome = 'accepted' | 'dismissed';
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: InstallOutcome }>;
};

type PlatformKind = 'android' | 'ios-safari' | 'ios-in-app' | 'in-app' | 'desktop' | 'unsupported';

declare global {
  interface Window {
    deferredPWAPrompt?: BeforeInstallPromptEvent | null;
    deferredPWAPromptCapturedAt?: number;
  }
  interface Navigator {
    standalone?: boolean;
  }
}

export function isStandalonePWA() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function detectInstallPlatform(userAgent: string, platform = '', maxTouchPoints = 0): PlatformKind {
  const ua = userAgent.toLowerCase();
  const isIPadDesktopMode = platform === 'MacIntel' && maxTouchPoints > 1;
  const isIOS = /iphone|ipad|ipod/.test(ua) || isIPadDesktopMode;
  const isFacebook = /fban|fbav/.test(ua);
  const isInstagram = /instagram/.test(ua);
  const isMessenger = /messenger|fb_iab|fb4a/.test(ua);
  const isInApp = isFacebook || isInstagram || isMessenger;

  if (isInApp) return isIOS ? 'ios-in-app' : 'in-app';
  if (isIOS) return /safari/.test(ua) && !/crios|fxios|edgios/.test(ua) ? 'ios-safari' : 'unsupported';
  if (/android/.test(ua)) return /chrome|crios/.test(ua) ? 'android' : 'unsupported';
  if (/edg\//.test(ua) || (/chrome\//.test(ua) && !/opr\//.test(ua))) return 'desktop';
  return 'unsupported';
}

interface PWAInstallPromptProps {
  onDismiss?: () => void;
}

export default function PWAInstallPrompt({ onDismiss }: PWAInstallPromptProps) {
  const [visible, setVisible] = useState(false);
  const [platformKind, setPlatformKind] = useState<PlatformKind>('unsupported');
  const [hasNativePrompt, setHasNativePrompt] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [awaitingInstallation, setAwaitingInstallation] = useState(false);
  const [installationComplete, setInstallationComplete] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const installationHandledRef = useRef(false);

  const hideAsInstalled = useCallback(() => {
    setVisible(false);
    setHasNativePrompt(false);
    void AsyncStorage.setItem(INSTALLED_KEY, 'true');
  }, []);

  const showInstalledConfirmation = useCallback(() => {
    if (installationHandledRef.current) return;
    installationHandledRef.current = true;
    window.deferredPWAPrompt = null;
    setHasNativePrompt(false);
    setInstalling(false);
    setAwaitingInstallation(false);
    setInstallationComplete(true);
    setVisible(true);
    void AsyncStorage.setItem(INSTALLED_KEY, 'true');
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let active = true;
    let showTimer: ReturnType<typeof setTimeout> | undefined;

    const evaluate = async (nativePromptJustArrived = false) => {
      if (installationHandledRef.current) return;
      if (isStandalonePWA()) {
        hideAsInstalled();
        return;
      }

      const kind = detectInstallPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
      const supportsNativePrompt = kind === 'android' || kind === 'desktop';
      const nativeAvailable = supportsNativePrompt && !!window.deferredPWAPrompt;
      setPlatformKind(kind);
      setHasNativePrompt(nativeAvailable);

      if (kind === 'unsupported' && !nativeAvailable) return;

      try {
        const [installed, dismissedAt] = await Promise.all([
          AsyncStorage.getItem(INSTALLED_KEY),
          AsyncStorage.getItem(DISMISS_KEY),
        ]);
        if (!active || installed === 'true') return;
        const dismissedTime = dismissedAt === null ? 0 : Number(dismissedAt);
        const dismissedRecently = dismissedTime > 0 && Date.now() - dismissedTime < DISMISS_COOLDOWN_MS;
        const promptIsNewerThanDismissal = nativeAvailable && (window.deferredPWAPromptCapturedAt || 0) > dismissedTime;
        if (dismissedRecently && !(promptIsNewerThanDismissal || (nativePromptJustArrived && nativeAvailable))) return;
      } catch (error) {
        console.warn('Unable to load PWA install preference:', error);
      }

      showTimer = setTimeout(() => {
        if (active && !isStandalonePWA()) setVisible(true);
      }, 0);
    };

    const handlePromptReady = (event: Event) => {
      event.preventDefault();
      window.deferredPWAPrompt = event as BeforeInstallPromptEvent;
      window.deferredPWAPromptCapturedAt = Date.now();
      void evaluate(true);
    };
    const handleInstalled = () => showInstalledConfirmation();
    window.addEventListener('beforeinstallprompt', handlePromptReady);
    window.addEventListener('appinstalled', handleInstalled);
    void evaluate();

    return () => {
      active = false;
      if (showTimer) clearTimeout(showTimer);
      window.removeEventListener('beforeinstallprompt', handlePromptReady);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [hideAsInstalled, showInstalledConfirmation]);

  const dismiss = useCallback(async () => {
    setVisible(false);
    onDismiss?.();
    try {
      await AsyncStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch (error) {
      console.warn('Unable to save PWA install dismissal:', error);
    }
  }, [onDismiss]);

  const install = useCallback(async () => {
    const promptEvent = window.deferredPWAPrompt;
    if (!promptEvent) {
      setHasNativePrompt(false);
      return;
    }

    setInstalling(true);
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      window.deferredPWAPrompt = null;
      setHasNativePrompt(false);
      if (outcome === 'accepted') {
        if (!installationHandledRef.current) setAwaitingInstallation(true);
      } else {
        setAwaitingInstallation(false);
        await dismiss();
      }
    } catch (error) {
      console.warn('Unable to open the browser install prompt:', error);
      window.deferredPWAPrompt = null;
      setHasNativePrompt(false);
      setAwaitingInstallation(false);
    } finally {
      setInstalling(false);
    }
  }, [dismiss]);

  const continueToApp = useCallback(() => {
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  if (Platform.OS !== 'web' || !visible || (isStandalonePWA() && !installationComplete)) return null;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled" accessibilityLabel={installationComplete ? 'Installation complete' : 'Install the official IPM app'}>
      <View style={styles.panel}>
        {installationComplete ? (
          <InstalledScreen onContinue={continueToApp} />
        ) : platformKind === 'ios-safari' && !showIOSGuide ? (
          <>
            <IOSInstallReady onShowGuide={() => setShowIOSGuide(true)} />
            <TouchableOpacity style={styles.notNowButton} onPress={dismiss} accessibilityRole="button" accessibilityLabel="Continue without installing">
              <Text style={styles.notNowText}>Maybe later — continue to the app</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {platformKind === 'ios-safari' ? <GuideHeading /> : <Welcome />}
            <InstallAction
              platformKind={platformKind}
              hasNativePrompt={hasNativePrompt}
              installing={installing}
              awaitingInstallation={awaitingInstallation}
              onInstall={install}
            />
            <TouchableOpacity style={styles.notNowButton} onPress={dismiss} accessibilityRole="button" accessibilityLabel="Continue without installing">
              <Text style={styles.notNowText}>Maybe later — continue to the app</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function IOSInstallReady({ onShowGuide }: { onShowGuide: () => void }) {
  return <View style={styles.installReady}>
    <View style={styles.installTitleRow}>
      <Text style={styles.installEmoji} accessibilityElementsHidden>📱</Text>
      <Text style={styles.installTitle}>Install IPM 2026</Text>
    </View>
    <Text style={styles.installLead}>You&apos;re ready to install:</Text>
    <View style={styles.detectedList} accessibilityLabel="iPhone and Safari detected">
      <View style={styles.detectedItem}><View style={styles.detectedCheck}><Feather name="check" size={20} color="#FFFFFF" /></View><Text style={styles.detectedText}>iPhone</Text></View>
      <View style={styles.detectedItem}><View style={styles.detectedCheck}><Feather name="check" size={20} color="#FFFFFF" /></View><Text style={styles.detectedText}>Safari</Text></View>
    </View>
    <Text style={styles.installTime}>It only takes about 10 seconds.</Text>
    <TouchableOpacity style={styles.installButton} onPress={onShowGuide} accessibilityRole="button" accessibilityLabel="Show installation guide">
      <Text style={styles.installButtonText}>Show Me How</Text>
      <Feather name="arrow-right" size={27} color="#FFFFFF" />
    </TouchableOpacity>
  </View>;
}

function GuideHeading() {
  return <View style={styles.guideHeading}>
    <Text style={styles.guideTitle}>Add IPM 2026</Text>
    <Text style={styles.guideSubtitle}>Two quick steps</Text>
  </View>;
}

function Welcome() {
  const features: { icon: keyof typeof Feather.glyphMap; label: string }[] = [
    { icon: 'calendar', label: 'Schedule' },
    { icon: 'map', label: 'Interactive Map' },
    { icon: 'bell', label: 'Live Announcements' },
    { icon: 'shopping-bag', label: 'Vendors' },
    { icon: 'info', label: 'Event Information' },
  ];
  return <>
    <View style={styles.officialBadge}><Feather name="smartphone" size={27} color="#FFFFFF" /><Text style={styles.officialBadgeText}>Official IPM App</Text></View>
    <Text style={styles.noStore}>No App Store download required.</Text>
    <Text style={styles.headline}>Everything you need during the event.</Text>
    <View style={styles.featureGrid}>
      {features.map((feature) => <View key={feature.label} style={styles.feature}><View style={styles.check}><Feather name="check" size={17} color="#FFFFFF" /></View><Feather name={feature.icon} size={21} color={colors.primary} /><Text style={styles.featureText}>{feature.label}</Text></View>)}
    </View>
    <Text style={styles.fiveSeconds}>Installation takes about 5 seconds.</Text>
  </>;
}

function InstallAction({ platformKind, hasNativePrompt, installing, awaitingInstallation, onInstall }: {
  platformKind: PlatformKind;
  hasNativePrompt: boolean;
  installing: boolean;
  awaitingInstallation: boolean;
  onInstall: () => void;
}) {
  if (awaitingInstallation) {
    return <View style={[styles.installButton, styles.disabledButton]} accessibilityRole="progressbar" accessibilityLabel="Finishing app installation">
      <Feather name="download" size={27} color="#FFFFFF" />
      <Text style={styles.installButtonText}>Finishing installation…</Text>
    </View>;
  }
  if (hasNativePrompt) {
    return <TouchableOpacity style={[styles.installButton, installing && styles.disabledButton]} onPress={onInstall} disabled={installing} accessibilityRole="button" accessibilityLabel="Install App">
      <Feather name="download" size={27} color="#FFFFFF" />
      <Text style={styles.installButtonText}>{installing ? 'Opening…' : 'Install App'}</Text>
    </TouchableOpacity>;
  }
  if (platformKind === 'ios-in-app' || platformKind === 'in-app') {
    const browser = platformKind === 'ios-in-app' ? 'Safari' : 'Chrome';
    return <View style={styles.embeddedBox} accessibilityLabel={`Open this page in ${browser} before installing`}>
      <View style={styles.bigIcon}><Feather name={platformKind === 'ios-in-app' ? 'compass' : 'chrome'} size={45} color={colors.primary} /></View>
      <Text style={styles.embeddedTitle}>Next: Open in {browser}</Text>
      <Text style={styles.embeddedText}>Tap this browser’s menu, then choose</Text>
      <Text style={styles.embeddedChoice}>Open in {browser}</Text>
    </View>;
  }
  if (platformKind === 'ios-safari') {
    return <VisualSteps firstIcon="share" firstLabel="Tap the Share button" secondIcon="plus-square" secondLabel="Add to Home Screen" />;
  }
  if (platformKind === 'desktop') {
    return <VisualSteps firstIcon="more-vertical" firstLabel="Open the browser menu" secondIcon="download" secondLabel="Install IPM App" />;
  }
  return <VisualSteps firstIcon="more-vertical" firstLabel="Tap the three-dot menu" secondIcon="download" secondLabel="Install App or Add to Home Screen" />;
}

function VisualSteps({ firstIcon, firstLabel, secondIcon, secondLabel }: {
  firstIcon: keyof typeof Feather.glyphMap;
  firstLabel: string;
  secondIcon: keyof typeof Feather.glyphMap;
  secondLabel: string;
}) {
  return <View style={styles.steps}>
    <View style={styles.step}><Text style={styles.stepNumber}>STEP 1</Text><View style={styles.stepGraphic}><Feather name={firstIcon} size={64} color={colors.primary} /></View><Text style={styles.stepLabel}>{firstLabel}</Text></View>
    <Feather name="arrow-down" size={34} color={colors.accentDark} accessibilityElementsHidden />
    <View style={styles.step}><Text style={styles.stepNumber}>STEP 2</Text><View style={styles.stepGraphic}><Feather name={secondIcon} size={64} color={colors.primary} /></View><Text style={styles.stepLabel}>{secondLabel}</Text></View>
  </View>;
}

function InstalledScreen({ onContinue }: { onContinue: () => void }) {
  return <View style={styles.ready}>
    <Text style={styles.celebrationEmoji} accessibilityElementsHidden>🎉</Text>
    <Text style={styles.readyTitle}>You&apos;re All Set!</Text>
    <Text style={styles.readyText}>IPM 2026 has been installed.</Text>
    <Text style={styles.benefitsTitle}>You&apos;ll now receive:</Text>
    <View style={styles.benefits}>
      <View style={styles.benefit}><Feather name="bell" size={22} color={colors.primary} /><Text style={styles.benefitText}>Live event announcements</Text></View>
      <View style={styles.benefit}><Feather name="calendar" size={22} color={colors.primary} /><Text style={styles.benefitText}>Schedule updates</Text></View>
      <View style={styles.benefit}><Feather name="home" size={22} color={colors.primary} /><Text style={styles.benefitText}>Quick access from your Home Screen</Text></View>
    </View>
    <TouchableOpacity style={styles.installButton} onPress={onContinue} accessibilityRole="button" accessibilityLabel="Open IPM 2026">
      <Text style={styles.installButtonText}>Open App</Text><Feather name="arrow-right" size={27} color="#FFFFFF" />
    </TouchableOpacity>
  </View>;
}

const styles = StyleSheet.create({
  page: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FFFDF7', zIndex: 2000 },
  pageContent: { alignItems: 'center', flexGrow: 1, justifyContent: 'center', padding: 16 },
  panel: { backgroundColor: '#FFFFFF', borderColor: '#B9B3A3', borderRadius: 24, borderWidth: 2, elevation: 8, maxWidth: 620, paddingHorizontal: 22, paddingVertical: 26, shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, width: '100%' },
  installReady: { alignItems: 'center', paddingVertical: 10 },
  installTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'center' },
  installEmoji: { fontSize: 34, lineHeight: 42 },
  installTitle: { color: colors.textPrimary, fontSize: 30, fontWeight: '900', lineHeight: 38 },
  installLead: { color: colors.textSecondary, fontSize: 18, fontWeight: '700', marginTop: 26, textAlign: 'center' },
  detectedList: { gap: 12, marginTop: 18, width: '100%' },
  detectedItem: { alignItems: 'center', backgroundColor: '#F8F6EF', borderRadius: 14, flexDirection: 'row', gap: 13, minHeight: 58, paddingHorizontal: 16 },
  detectedCheck: { alignItems: 'center', backgroundColor: colors.success, borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
  detectedText: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  installTime: { color: colors.textSecondary, fontSize: 17, fontWeight: '700', marginTop: 24, textAlign: 'center' },
  guideHeading: { alignItems: 'center', marginBottom: 4 },
  guideTitle: { color: colors.textPrimary, fontSize: 30, fontWeight: '900' },
  guideSubtitle: { color: colors.textSecondary, fontSize: 17, fontWeight: '700', marginTop: 5 },
  officialBadge: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.primary, borderRadius: 28, flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 12 },
  officialBadgeText: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  noStore: { color: colors.textSecondary, fontSize: 15, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  headline: { color: colors.textPrimary, fontSize: 27, fontWeight: '900', lineHeight: 34, marginTop: 15, textAlign: 'center' },
  featureGrid: { gap: 9, marginTop: 20 },
  feature: { alignItems: 'center', backgroundColor: '#F8F6EF', borderRadius: 12, flexDirection: 'row', gap: 10, minHeight: 48, paddingHorizontal: 13 },
  check: { alignItems: 'center', backgroundColor: colors.success, borderRadius: 13, height: 26, justifyContent: 'center', width: 26 },
  featureText: { color: colors.textPrimary, flex: 1, fontSize: 17, fontWeight: '800' },
  fiveSeconds: { color: colors.textSecondary, fontSize: 16, fontWeight: '700', marginTop: 18, textAlign: 'center' },
  installButton: { alignItems: 'center', backgroundColor: '#8A1F25', borderColor: '#5F1116', borderRadius: 15, borderWidth: 2, flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 22, minHeight: 68, paddingHorizontal: 22, width: '100%' },
  disabledButton: { opacity: 0.65 },
  installButtonText: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  notNowButton: { alignItems: 'center', justifyContent: 'center', marginTop: 9, minHeight: 52, paddingHorizontal: 16 },
  notNowText: { color: colors.textSecondary, fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
  steps: { alignItems: 'center', marginTop: 22 },
  step: { alignItems: 'center', backgroundColor: '#FFF9E8', borderColor: '#D8B866', borderRadius: 18, borderWidth: 2, padding: 14, width: '100%' },
  stepNumber: { color: '#735B1B', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  stepGraphic: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 24, height: 104, justifyContent: 'center', marginVertical: 10, width: 104 },
  stepLabel: { color: colors.textPrimary, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  embeddedBox: { alignItems: 'center', backgroundColor: '#FFF9E8', borderColor: '#D8B866', borderRadius: 18, borderWidth: 2, marginTop: 22, padding: 18 },
  bigIcon: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 42, height: 84, justifyContent: 'center', width: 84 },
  embeddedTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: '900', marginTop: 12 },
  embeddedText: { color: colors.textSecondary, fontSize: 16, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  embeddedChoice: { color: colors.primary, fontSize: 20, fontWeight: '900', marginTop: 5 },
  ready: { alignItems: 'center', paddingVertical: 24 },
  celebrationEmoji: { fontSize: 68, lineHeight: 82 },
  readyTitle: { color: colors.textPrimary, fontSize: 34, fontWeight: '900', marginTop: 24 },
  readyText: { color: colors.textSecondary, fontSize: 19, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  benefitsTitle: { alignSelf: 'flex-start', color: colors.textPrimary, fontSize: 18, fontWeight: '900', marginTop: 28 },
  benefits: { gap: 11, marginTop: 14, width: '100%' },
  benefit: { alignItems: 'center', backgroundColor: '#F8F6EF', borderRadius: 12, flexDirection: 'row', gap: 12, minHeight: 50, paddingHorizontal: 14 },
  benefitText: { color: colors.textPrimary, flex: 1, fontSize: 16, fontWeight: '700' },
});
