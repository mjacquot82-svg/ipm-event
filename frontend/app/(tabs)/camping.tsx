// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { openTrackedLink } from '../../src/analytics/trackedLinks';
import { usePageAnalytics } from '../../src/analytics/usePageAnalytics';
import colors from '../../src/theme/colors';
import { attendeePageContent, useAttendeeLayout } from '../../src/theme/attendeePageLayout';

const EMERGENCY_PHONE = '226-972-6785';
const TRAILER_SERVICE_PHONE = '519-889-2016';

function Section({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function PhoneLink({ number, label }: { number: string; label: string }) {
  return (
    <TouchableOpacity
      style={styles.phoneButton}
      onPress={() => void Linking.openURL(`tel:${number}`)}
      activeOpacity={0.8}
      accessibilityRole="link"
      accessibilityLabel={`${label}: call ${number}`}
      accessibilityHint="Opens your phone app"
    >
      <Feather name="phone" size={20} color="#FFFFFF" />
      <Text style={styles.phoneButtonText}>{number}</Text>
    </TouchableOpacity>
  );
}

export default function CampingScreen() {
  usePageAnalytics('camping_information', 'home_quick_action', 'camping_information_opened');
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
              <Feather name="sun" size={30} color="#FFFFFF" />
            </View>
            <Text style={styles.pageTitle} accessibilityRole="header">RV Park &amp; Camping Information</Text>
          </View>

          <View style={styles.emergencyCard} accessibilityRole="summary">
            <View style={styles.emergencyHeading}>
              <Feather name="alert-triangle" size={24} color={colors.primaryDark} />
              <Text style={styles.emergencyTitle}>Important &amp; Emergency Information</Text>
            </View>
            <Text style={styles.label}>911 Address</Text>
            <Text style={styles.emergencyValue}>95 Durham Road</Text>
            <Text style={styles.emergencyValue}>Entrances 9 &amp; 10</Text>
            <View style={styles.divider} />
            <Text style={styles.label}>RV After-Hours Emergency Contact</Text>
            <Text style={styles.body}>For urgent RV Park related assistance, please call:</Text>
            <PhoneLink number={EMERGENCY_PHONE} label="RV After-Hours Emergency Contact" />
          </View>

          <Section title="RV Park Office">
            <Text style={styles.body}>Saturday September 19 through Friday September 25</Text>
            <Text style={styles.emphasis}>9:00 AM - 6:00 PM</Text>
          </Section>

          <Section title="RV Pump-Out Service">
            <Text style={styles.body}>On-site pump-out service will be available Tuesday September 22 through Saturday September 26.</Text>
            <Text style={styles.body}>All campers are asked to arrange their RV pump-out at the RV Office the day prior to service.</Text>
            <Text style={styles.label}>Pump-out booking times</Text>
            <Text style={styles.body}>Monday, September 21 through Friday September 25</Text>
            <Text style={styles.emphasis}>7:30 AM - 9:30 AM</Text>
            <Text style={styles.andText}>and</Text>
            <Text style={styles.emphasis}>3:30 PM - 5:30 PM</Text>
            <View style={styles.notice}>
              <Feather name="info" size={21} color={colors.primaryDark} />
              <Text style={styles.noticeText}>Pump-out service must be paid for at the time of booking.</Text>
            </View>
          </Section>

          <Section title="Water">
            <Text style={styles.comingSoon}>Water service hours coming soon.</Text>
          </Section>

          <Section title="Garbage Pickup">
            <Text style={styles.body}>Garbage must be out by 9:00 AM to be picked up.</Text>
            <Text style={styles.body}>Place your garbage at the edge of the roadway on your site for collection.</Text>
            <View style={styles.warning}>
              <Feather name="alert-circle" size={21} color={colors.primaryDark} />
              <Text style={styles.warningText}>Please DO NOT put garbage out the night before - let&apos;s keep unwanted critters out of the campground.</Text>
            </View>
          </Section>

          <Section title="Empties">
            <Text style={styles.body}>Please place all refundable cans and bottles in the blue collection barrels located throughout the RV Park.</Text>
            <Text style={styles.body}>The 2026 IPM has partnered with the Shriners, with all proceeds from returned empties supporting the incredible work they do in our community.</Text>
            <Text style={styles.body}>Thank you for helping make a difference.</Text>
          </Section>

          <Section title="Trailer Service">
            <Text style={styles.body}>Having mechanical issues with your trailer?</Text>
            <Text style={styles.body}>Hardcore Camper Inc. are on site to help.</Text>
            <Text style={styles.label}>Jerry can be found at:</Text>
            <Text style={styles.emphasis}>Site S1</Text>
            <Text style={styles.label}>Phone</Text>
            <PhoneLink number={TRAILER_SERVICE_PHONE} label="Call Jerry at Hardcore Camper Inc." />
          </Section>

          <Section title="Quiet Time">
            <Text style={styles.emphasis}>11:00 PM - 7:00 AM</Text>
            <Text style={styles.body}>Please be respectful of your fellow campers and help keep the campground peaceful during quiet hours.</Text>
          </Section>

          <TouchableOpacity
            style={styles.externalButton}
            onPress={() => void openTrackedLink('camping', 'camping_information')}
            activeOpacity={0.8}
            accessibilityRole="link"
            accessibilityLabel="Book or manage camping on the external Let's Camp website"
            accessibilityHint="Opens an external website"
          >
            <Text style={styles.externalButtonText}>Book or Manage Camping</Text>
            <Feather name="external-link" size={20} color="#FFFFFF" />
          </TouchableOpacity>
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
  headerIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { flex: 1, color: colors.textPrimary, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 18, marginBottom: 14 },
  emergencyCard: { backgroundColor: '#FFF4F1', borderRadius: 16, borderWidth: 2, borderColor: colors.primary, padding: 18, marginBottom: 14 },
  emergencyHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  emergencyTitle: { flex: 1, color: colors.primaryDark, fontSize: 20, lineHeight: 25, fontWeight: '800' },
  sectionTitle: { color: colors.textPrimary, fontSize: 21, lineHeight: 27, fontWeight: '800', marginBottom: 12 },
  label: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 6, marginBottom: 4 },
  body: { color: colors.textPrimary, fontSize: 16, lineHeight: 24, marginBottom: 10 },
  emergencyValue: { color: colors.textPrimary, fontSize: 19, lineHeight: 26, fontWeight: '700' },
  emphasis: { color: colors.textPrimary, fontSize: 18, lineHeight: 25, fontWeight: '800', marginBottom: 8 },
  andText: { color: colors.textSecondary, fontSize: 15, marginBottom: 8 },
  divider: { height: 1, backgroundColor: '#E7C5BF', marginVertical: 16 },
  phoneButton: { minHeight: 48, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 16, marginTop: 6 },
  phoneButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FFF4F1', borderLeftWidth: 4, borderLeftColor: colors.primary, borderRadius: 10, padding: 14, marginTop: 8 },
  noticeText: { flex: 1, color: colors.primaryDark, fontSize: 16, lineHeight: 23, fontWeight: '800' },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FFF8E8', borderLeftWidth: 4, borderLeftColor: colors.accentDark, borderRadius: 10, padding: 14, marginTop: 4 },
  warningText: { flex: 1, color: colors.textPrimary, fontSize: 16, lineHeight: 23, fontWeight: '700' },
  comingSoon: { color: colors.textPrimary, fontSize: 17, lineHeight: 24, fontWeight: '700' },
  externalButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.field, borderRadius: 14, paddingHorizontal: 18, marginTop: 4, marginBottom: 12 },
  externalButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
});
