// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../src/theme/colors';

const KNOWN_IFRAME_BLOCKED_HOSTS = new Set(['plowingmatch.org', 'www.plowingmatch.org']);

function getSafeUrl(value: string | string[] | undefined) {
  const rawUrl = Array.isArray(value) ? value[0] : value;
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' ? parsed : null;
  } catch {
    return null;
  }
}

export default function ExternalPageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ url?: string; title?: string }>();
  const parsedUrl = useMemo(() => getSafeUrl(params.url), [params.url]);
  const title = (Array.isArray(params.title) ? params.title[0] : params.title) || 'External Website';
  const domain = parsedUrl?.hostname.replace(/^www\./, '') || 'External Website';
  const embeddingBlocked = Boolean(parsedUrl && KNOWN_IFRAME_BLOCKED_HOSTS.has(parsedUrl.hostname));
  const [openingNativeBrowser, setOpeningNativeBrowser] = useState(false);
  const [frameLoaded, setFrameLoaded] = useState(false);

  const returnHome = useCallback(() => router.replace('/'), [router]);
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else returnHome();
  }, [returnHome, router]);

  const openInBrowser = useCallback(async () => {
    if (!parsedUrl) return;

    if (Platform.OS === 'web') {
      await Linking.openURL(parsedUrl.toString());
      return;
    }

    setOpeningNativeBrowser(true);
    try {
      await WebBrowser.openBrowserAsync(parsedUrl.toString(), {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        controlsColor: colors.primary,
        toolbarColor: colors.surface,
      });
    } finally {
      setOpeningNativeBrowser(false);
    }
  }, [parsedUrl]);

  useEffect(() => {
    if (Platform.OS !== 'web' && parsedUrl) void openInBrowser();
  }, [openInBrowser, parsedUrl]);

  const renderContent = () => {
    if (!parsedUrl) {
      return <FallbackMessage message="This external link is invalid or unavailable." />;
    }

    if (Platform.OS !== 'web') {
      return (
        <View style={styles.messageContainer}>
          {openingNativeBrowser ? <ActivityIndicator color={colors.primary} size="large" /> : <Feather name="globe" size={42} color={colors.primary} />}
          <Text style={styles.messageTitle}>{openingNativeBrowser ? 'Opening website…' : 'Website closed'}</Text>
          <Text style={styles.messageText}>
            {openingNativeBrowser
              ? 'The website is opening in a secure in-app browser.'
              : 'You are still in the IPM app. Reopen the website or return Home.'}
          </Text>
          <ActionButton label="Open Website" icon="external-link" onPress={() => void openInBrowser()} />
        </View>
      );
    }

    if (embeddingBlocked) {
      return <FallbackMessage message="This website does not allow pages to be displayed inside the IPM app." />;
    }

    return (
      <View style={styles.frameContainer}>
        {!frameLoaded && (
          <View style={styles.frameLoading}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loadingText}>Loading external website…</Text>
          </View>
        )}
        {React.createElement('iframe', {
          src: parsedUrl.toString(),
          title,
          onLoad: () => setFrameLoaded(true),
          sandbox: 'allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts',
          style: { border: 0, width: '100%', height: '100%', backgroundColor: '#fff' },
        })}
      </View>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: Platform.OS === 'web' ? 0 : insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={goBack} accessibilityRole="button" accessibilityLabel="Back">
          <Feather name="arrow-left" size={21} color={colors.primary} />
          <Text style={styles.headerButtonText}>Back</Text>
        </TouchableOpacity>
        <Image source={require('../assets/images/ipm-logo-small.png')} style={styles.logo} resizeMode="contain" />
        <TouchableOpacity style={styles.headerButton} onPress={returnHome} accessibilityRole="button" accessibilityLabel="Close and return to app Home">
          <Text style={styles.headerButtonText}>Close</Text>
          <Feather name="x" size={21} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.pageIdentity}>
        <View style={styles.pageText}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <View style={styles.domainRow}>
            <Feather name="globe" size={13} color={colors.textMuted} />
            <Text style={styles.domain} numberOfLines={1}>{domain} · External Website</Text>
          </View>
        </View>
        {Platform.OS === 'web' && parsedUrl && (
          <TouchableOpacity style={styles.openSmallButton} onPress={() => void openInBrowser()} accessibilityRole="link">
            <Feather name="external-link" size={16} color={colors.primary} />
            <Text style={styles.openSmallText}>Open in Browser</Text>
          </TouchableOpacity>
        )}
      </View>

      {renderContent()}

      <TouchableOpacity style={[styles.homeBar, { paddingBottom: Math.max(insets.bottom, 10) }]} onPress={returnHome} accessibilityRole="button">
        <Feather name="home" size={19} color="#FFFFFF" />
        <Text style={styles.homeBarText}>Return to IPM Home</Text>
      </TouchableOpacity>
    </View>
  );

  function FallbackMessage({ message }: { message: string }) {
    return (
      <View style={styles.messageContainer}>
        <View style={styles.messageIcon}><Feather name="external-link" size={30} color={colors.primary} /></View>
        <Text style={styles.messageTitle}>Open this page in your browser</Text>
        <Text style={styles.messageText}>{message} A new browser tab will open, and this IPM screen will remain available.</Text>
        {parsedUrl && <ActionButton label="Open in Browser" icon="external-link" onPress={() => void openInBrowser()} />}
      </View>
    );
  }
}

function ActionButton({ label, icon, onPress }: { label: string; icon: keyof typeof Feather.glyphMap; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress} accessibilityRole="button">
      <Feather name={icon} size={18} color="#FFFFFF" />
      <Text style={styles.actionButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { height: 62, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerButton: { minWidth: 82, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  headerButtonText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  logo: { width: 58, height: 44 },
  pageIdentity: { minHeight: 72, paddingHorizontal: 18, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: colors.surfaceElevated, borderBottomWidth: 1, borderBottomColor: colors.border },
  pageText: { flex: 1 },
  title: { color: colors.textPrimary, fontSize: 19, fontWeight: '800' },
  domainRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 5 },
  domain: { flex: 1, color: colors.textMuted, fontSize: 12 },
  openSmallButton: { minHeight: 40, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.primary, borderRadius: 8 },
  openSmallText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  frameContainer: { flex: 1, backgroundColor: colors.surface },
  frameLoading: { ...StyleSheet.absoluteFillObject, zIndex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.background },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  messageContainer: { flex: 1, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
  messageIcon: { width: 68, height: 68, marginBottom: 18, borderRadius: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHighlight },
  messageTitle: { marginTop: 16, color: colors.textPrimary, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  messageText: { maxWidth: 520, marginTop: 10, marginBottom: 22, color: colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  actionButton: { minHeight: 48, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 10, backgroundColor: colors.primary },
  actionButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  homeBar: { minHeight: 56, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary },
  homeBarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
