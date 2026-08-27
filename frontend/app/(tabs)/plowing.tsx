// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { openTrackedLink } from '../../src/analytics/trackedLinks';
import { usePageAnalytics } from '../../src/analytics/usePageAnalytics';
import { attendeePageContent, useAttendeeLayout } from '../../src/theme/attendeePageLayout';
import colors from '../../src/theme/colors';

type ResourceCardProps = {
  description: string;
  destination: 'plowing_rules' | 'plowing_daily_results';
  icon: keyof typeof Feather.glyphMap;
  title: string;
};

function ResourceCard({ description, destination, icon, title }: ResourceCardProps) {
  return (
    <TouchableOpacity
      style={styles.resourceCard}
      onPress={() => void openTrackedLink(destination, 'plowing_information')}
      activeOpacity={0.8}
      accessibilityRole="link"
      accessibilityLabel={`${title}, opens the official Ontario Plowmen's Association website`}
      accessibilityHint="Requires an internet connection"
    >
      <View style={styles.resourceIcon}>
        <Feather name={icon} size={24} color="#FFFFFF" />
      </View>
      <View style={styles.resourceContent}>
        <Text style={styles.resourceTitle}>{title}</Text>
        <Text style={styles.resourceDescription}>{description}</Text>
      </View>
      <Feather name="external-link" size={21} color={colors.primary} />
    </TouchableOpacity>
  );
}

export default function PlowingScreen() {
  const router = useRouter();
  const { sectionStyle } = useAttendeeLayout();
  usePageAnalytics('plowing_information', 'home_link', 'plowing_information_opened');

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
              <Feather name="award" size={30} color="#FFFFFF" />
            </View>
            <Text style={styles.pageTitle} accessibilityRole="header">Plowing</Text>
          </View>

          <Text style={styles.introduction}>Official plowing information from the Ontario Plowmen&apos;s Association.</Text>

          <ResourceCard
            title="Plowing Rules & Regulations"
            description="View the official IPM plowing rules and access the virtual rule book."
            destination="plowing_rules"
            icon="book-open"
          />
          <ResourceCard
            title="Daily Plowing Results"
            description="View the latest official daily plowing results from the Ontario Plowmen's Association."
            destination="plowing_daily_results"
            icon="bar-chart-2"
          />
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  headerIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { flex: 1, color: colors.textPrimary, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  introduction: { color: colors.textSecondary, fontSize: 16, lineHeight: 24, marginBottom: 18 },
  resourceCard: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 14 },
  resourceIcon: { width: 48, height: 48, flexShrink: 0, borderRadius: 14, backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center' },
  resourceContent: { flex: 1, minWidth: 0 },
  resourceTitle: { color: colors.textPrimary, fontSize: 18, lineHeight: 23, fontWeight: '800', marginBottom: 5 },
  resourceDescription: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
});
