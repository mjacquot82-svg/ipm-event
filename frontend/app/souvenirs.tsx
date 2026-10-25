// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// In-app Souvenirs page. The external Source for Sports store has closed; this page now hosts the Volunteer Glasses pre-order.

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import colors from '../src/theme/colors';
import { attendeePageContent, useAttendeeLayout } from '../src/theme/attendeePageLayout';

export default function SouvenirsScreen() {
  const router = useRouter();
  const { sectionStyle } = useAttendeeLayout();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[attendeePageContent, styles.scrollContent]}>
        <View style={sectionStyle}>
          <TouchableOpacity style={styles.backButton} onPress={goBack} accessibilityRole="button" accessibilityLabel="Back">
            <Feather name="arrow-left" size={20} color={colors.primary} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.pageTitle} accessibilityRole="header">Souvenirs</Text>

          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/volunteer-glasses' as never)}
            activeOpacity={0.8}
            accessibilityRole="link"
            accessibilityLabel="Volunteer Glasses pre-order (password required)"
          >
            <View style={styles.icon}>
              <Feather name="lock" size={22} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Volunteer Glasses</Text>
              <Text style={styles.cardBody}>Password required</Text>
            </View>
            <Feather name="chevron-right" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  backButton: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  backButtonText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  pageTitle: { color: colors.textPrimary, fontSize: 28, lineHeight: 34, fontWeight: '800', marginBottom: 16 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#9C27B0' },
  cardTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  cardBody: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },
});
