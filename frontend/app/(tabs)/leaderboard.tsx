// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import colors from '../../src/theme/colors';

export default function LeaderboardScreen() {
  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Leaderboard</Text>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Placeholder Content */}
          <View style={styles.placeholderContainer}>
            <View style={styles.iconContainer}>
              <Feather name="bar-chart-2" size={64} color={colors.accent} />
            </View>
            <Text style={styles.placeholderTitle}>Coming Soon</Text>
            <Text style={styles.placeholderText}>
              The leaderboard feature is being developed. Check back during the event to see competition standings and results!
            </Text>
          </View>

          {/* Example structure for future leaderboard */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What to Expect</Text>
            <View style={styles.featureCard}>
              <Feather name="trophy" size={24} color={colors.accent} />
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Competition Rankings</Text>
                <Text style={styles.featureText}>Live standings for plowing competitions</Text>
              </View>
            </View>
            <View style={styles.featureCard}>
              <Feather name="users" size={24} color={colors.field} />
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Competitor Profiles</Text>
                <Text style={styles.featureText}>Learn about the competitors</Text>
              </View>
            </View>
            <View style={styles.featureCard}>
              <Feather name="award" size={24} color={colors.primary} />
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Awards & Results</Text>
                <Text style={styles.featureText}>Final results and award winners</Text>
              </View>
            </View>
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  placeholderContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: colors.surface,
    borderRadius: 20,
    marginBottom: 24,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 30,
    lineHeight: 22,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    gap: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  featureText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  bottomPadding: {
    height: 180, // THE SPACER FIX - allows scrolling content above floating ad
  },
});
