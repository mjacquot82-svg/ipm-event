// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { usePageAnalytics } from '../../src/analytics/usePageAnalytics';
import colors from '../../src/theme/colors';
import { attendeePageContent, useAttendeeLayout } from '../../src/theme/attendeePageLayout';

type Coords = { latitude: number; longitude: number };

type What3WordsResult = {
  words: string;
  nearestPlace?: string | null;
  coordinates?: { lat?: number; lng?: number };
};

type LocationErrorCode = 'permission' | 'timeout' | 'unavailable' | 'api' | 'clipboard';

const LOCATION_TIMEOUT_MS = 20000;

function errorMessage(code: LocationErrorCode, detail?: string) {
  if (code === 'permission') {
    return 'Location permission was denied. Allow location access, then try again.';
  }
  if (code === 'timeout') {
    return 'Location request timed out. Move to a clearer GPS signal and try again.';
  }
  if (code === 'unavailable') {
    return 'Your device could not provide a location. Turn on location services and try again.';
  }
  if (code === 'clipboard') {
    return 'Could not copy the 3-word location. You can still read it to the dispatcher.';
  }
  return detail || 'Unable to get a 3-word location. Try again.';
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error('timeout') as Error & { code: LocationErrorCode };
      error.code = 'timeout';
      reject(error);
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function getBrowserPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const error = new Error('unavailable') as Error & { code: LocationErrorCode };
      error.code = 'unavailable';
      reject(error);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (geoError) => {
        const error = new Error('geolocation') as Error & { code: LocationErrorCode };
        if (geoError.code === 1) error.code = 'permission';
        else if (geoError.code === 3) error.code = 'timeout';
        else error.code = 'unavailable';
        reject(error);
      },
      { enableHighAccuracy: true, timeout: LOCATION_TIMEOUT_MS, maximumAge: 0 }
    );
  });
}

async function getDeviceCoordinates(): Promise<Coords> {
  try {
    if (typeof Location.requestForegroundPermissionsAsync === 'function'
      && typeof Location.getCurrentPositionAsync === 'function') {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        const error = new Error('permission') as Error & { code: LocationErrorCode };
        error.code = 'permission';
        throw error;
      }
      const position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        LOCATION_TIMEOUT_MS
      );
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    }
  } catch (error) {
    const code = (error as { code?: LocationErrorCode }).code;
    if (code === 'permission' || code === 'timeout') {
      throw error;
    }
  }

  return getBrowserPosition();
}

function formatWords(words: string) {
  const cleaned = words.replace(/^\/+/, '').trim();
  return `///${cleaned}`;
}

async function copyToClipboard(text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const error = new Error('clipboard') as Error & { code: LocationErrorCode };
  error.code = 'clipboard';
  throw error;
}

function apiErrorMessage(status: number) {
  if (status === 400) return 'The location coordinates were invalid. Try again.';
  if (status === 503) return 'Location lookup is not available right now.';
  if (status === 502) return 'Location lookup failed. Try again.';
  return 'Unable to get a 3-word location. Try again.';
}

export default function EmergencyServicesScreen() {
  usePageAnalytics('emergency_services', 'home_quick_action');
  const router = useRouter();
  const { sectionStyle } = useAttendeeLayout();

  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('Getting your location…');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<What3WordsResult | null>(null);
  const [copied, setCopied] = useState(false);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const fetchWhat3Words = async () => {
    setError(null);
    setCopied(false);
    setResult(null);
    setLoading(true);
    setLoadingLabel('Getting your location…');

    try {
      const coords = await getDeviceCoordinates();
      setLoadingLabel('Getting your 3-word location…');
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      const response = await fetch(
        `${baseUrl}/api/what3words?lat=${encodeURIComponent(String(coords.latitude))}&lng=${encodeURIComponent(String(coords.longitude))}`
      );
      if (!response.ok) {
        throw Object.assign(new Error(apiErrorMessage(response.status)), { code: 'api' });
      }
      const payload = await response.json() as What3WordsResult;
      if (!payload?.words || typeof payload.words !== 'string') {
        throw Object.assign(new Error(apiErrorMessage(502)), { code: 'api' });
      }
      setResult(payload);
    } catch (caught) {
      const code = (caught as { code?: LocationErrorCode }).code;
      if (code === 'permission' || code === 'timeout' || code === 'unavailable' || code === 'clipboard' || code === 'api') {
        setError(errorMessage(code, (caught as Error).message));
      } else {
        setError(errorMessage('api'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result?.words) return;
    try {
      await copyToClipboard(formatWords(result.words));
      setCopied(true);
      setError(null);
    } catch {
      setCopied(false);
      setError(errorMessage('clipboard'));
    }
  };

  const wordsDisplay = result?.words ? formatWords(result.words) : null;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[attendeePageContent, styles.scrollContent]}
        showsVerticalScrollIndicator={false}
      >
        <View style={sectionStyle}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={goBack}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Back to attendee Home"
          >
            <Feather name="arrow-left" size={20} color={colors.primary} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Feather name="alert-triangle" size={30} color="#FFFFFF" />
            </View>
            <Text style={styles.pageTitle} accessibilityRole="header">Emergency Services</Text>
          </View>

          <View style={styles.emergencyCard} accessibilityRole="summary">
            <View style={styles.emergencyHeading}>
              <Feather name="phone" size={24} color={colors.primaryDark} />
              <Text style={styles.emergencyTitle}>Call 911 first</Text>
            </View>
            <Text style={styles.body}>
              If this is an emergency, call 911 now. Then use your 3-word location below so the dispatcher can find you on site.
            </Text>
            <Text style={styles.label}>Site 911 address</Text>
            <Text style={styles.emergencyValue}>95 Durham Road</Text>
            <Text style={styles.emergencyValue}>Entrances 9 &amp; 10</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Need help finding your location?</Text>
            <Text style={styles.body}>
              Tap “Get my 3-word location” below. If prompted, allow location access so we can determine your 3-word location to share with the 911 dispatcher.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={() => { void fetchWhat3Words(); }}
              activeOpacity={0.8}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Get my 3-word location"
              accessibilityHint="Uses your device GPS. Does not send an SOS report."
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Feather name="map-pin" size={20} color="#FFFFFF" />
              )}
              <Text style={styles.primaryButtonText}>
                {loading ? loadingLabel : 'Get my 3-word location'}
              </Text>
            </TouchableOpacity>
            {Platform.OS === 'web' ? (
              <Text style={styles.hint}>Your browser may ask for location permission.</Text>
            ) : null}

            {error ? (
              <View style={styles.errorBox} accessibilityRole="alert">
                <Feather name="alert-circle" size={20} color={colors.primaryDark} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {wordsDisplay ? (
              <View style={styles.wordsCard}>
                <Text style={styles.wordsLabel}>Read this to 911</Text>
                <Text style={styles.wordsValue} selectable>
                  {wordsDisplay}
                </Text>
                {result?.nearestPlace ? (
                  <Text style={styles.nearest}>Near {result.nearestPlace}</Text>
                ) : null}
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={() => { void handleCopy(); }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Copy 3-word location"
                >
                  <Feather name={copied ? 'check' : 'copy'} size={18} color="#FFFFFF" />
                  <Text style={styles.copyButtonText}>{copied ? 'Copied' : 'Copy'}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12 },
  backButton: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  backButtonText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  headerIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { flex: 1, color: colors.textPrimary, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 18, marginBottom: 14 },
  emergencyCard: { backgroundColor: '#FFF4F1', borderRadius: 16, borderWidth: 2, borderColor: colors.primary, padding: 18, marginBottom: 14 },
  emergencyHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  emergencyTitle: { flex: 1, color: colors.primaryDark, fontSize: 20, lineHeight: 25, fontWeight: '800' },
  sectionTitle: { color: colors.textPrimary, fontSize: 21, lineHeight: 27, fontWeight: '800', marginBottom: 12 },
  label: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 6, marginBottom: 4 },
  body: { color: colors.textPrimary, fontSize: 16, lineHeight: 24, marginBottom: 10 },
  emergencyValue: { color: colors.textPrimary, fontSize: 19, lineHeight: 26, fontWeight: '700' },
  hint: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 10 },
  primaryButton: { minHeight: 52, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.error, borderRadius: 12, paddingHorizontal: 16, marginTop: 8 },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FFF4F1', borderLeftWidth: 4, borderLeftColor: colors.error, borderRadius: 10, padding: 14, marginTop: 14 },
  errorText: { flex: 1, color: colors.primaryDark, fontSize: 16, lineHeight: 23, fontWeight: '700' },
  wordsCard: { marginTop: 16, backgroundColor: colors.surfaceHighlight, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, alignItems: 'center' },
  wordsLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  wordsValue: { color: colors.textPrimary, fontSize: 28, lineHeight: 34, fontWeight: '800', textAlign: 'center' },
  nearest: { color: colors.textSecondary, fontSize: 14, marginTop: 8, textAlign: 'center' },
  copyButton: { minHeight: 44, marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 16, alignSelf: 'stretch' },
  copyButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
