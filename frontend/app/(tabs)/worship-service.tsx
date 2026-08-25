// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { openTrackedLink } from '../../src/analytics/trackedLinks';
import { usePageAnalytics } from '../../src/analytics/usePageAnalytics';
import colors from '../../src/theme/colors';
import { attendeePageContent } from '../../src/theme/attendeePageLayout';

const ARTWORK_ASPECT_RATIO = 1364 / 3404;
const MAX_ARTWORK_WIDTH = 720;

export default function WorshipServiceScreen() {
  usePageAnalytics('worship_service', 'home_link', 'worship_service_opened');
  const router = useRouter();
  const { width: viewportWidth } = useWindowDimensions();
  const artworkWidth = Math.min(viewportWidth, MAX_ARTWORK_WIDTH);
  const artworkHeight = artworkWidth / ARTWORK_ASPECT_RATIO;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[attendeePageContent, styles.scrollContent]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
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

          <Image
            source={require('../../assets/images/worship-service.jpg')}
            style={[styles.posterImage, { width: artworkWidth, height: artworkHeight }]}
            resizeMode="contain"
            accessible
            accessibilityLabel="Complete 2026 IPM Interdenominational Worship Service information"
          />

          <TouchableOpacity
            style={styles.pdfButton}
            onPress={() => void openTrackedLink('worship_service_pdf', 'worship_service')}
            activeOpacity={0.8}
            accessibilityRole="link"
            accessibilityLabel="View original Worship Service PDF"
            accessibilityHint="Opens an external PDF"
          >
            <Text style={styles.pdfButtonText}>View Original PDF</Text>
            <Feather name="external-link" size={19} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 0, paddingTop: 12 },
  content: { width: '100%', alignItems: 'center' },
  backButton: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginHorizontal: 20, marginBottom: 12 },
  backButtonText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  posterImage: { alignSelf: 'center', margin: 0, padding: 0 },
  pdfButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: colors.field, borderRadius: 12, paddingHorizontal: 18, marginHorizontal: 20, marginTop: 18, marginBottom: 12 },
  pdfButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
