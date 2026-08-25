// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { openTrackedLink } from '../../src/analytics/trackedLinks';
import { usePageAnalytics } from '../../src/analytics/usePageAnalytics';
import colors from '../../src/theme/colors';
import { attendeePageContent, useAttendeeLayout } from '../../src/theme/attendeePageLayout';

const ARTWORK_ASPECT_RATIO = 1365 / 1706;

export default function WorshipServiceScreen() {
  usePageAnalytics('worship_service', 'home_link', 'worship_service_opened');
  const router = useRouter();
  const { sectionStyle } = useAttendeeLayout();

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
        <View style={[sectionStyle, styles.content]}>
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

          <View style={styles.artwork} accessibilityLabel="Interdenominational Worship Service event poster">
            <Image
              source={require('../../assets/images/worship-service-cross.jpg')}
              style={styles.posterImage}
              resizeMode="contain"
              accessible
              accessibilityLabel="Worship Service poster featuring a cross at sunrise and Sunday September 20, 2026"
            />
            <Image
              source={require('../../assets/images/worship-service-join-us.jpg')}
              style={styles.posterImage}
              resizeMode="contain"
              accessible
              accessibilityLabel="Worship Service invitation with event time, speaker, and attendance details"
            />
          </View>

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
  scrollContent: { paddingHorizontal: 20, paddingTop: 12 },
  content: { alignItems: 'center' },
  backButton: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  backButtonText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  artwork: { width: '100%', maxWidth: 720, overflow: 'hidden' },
  posterImage: { width: '100%', aspectRatio: ARTWORK_ASPECT_RATIO, margin: 0, padding: 0 },
  pdfButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: colors.field, borderRadius: 12, paddingHorizontal: 18, marginTop: 18, marginBottom: 12 },
  pdfButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
