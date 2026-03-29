// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import colors from '../../src/theme/colors';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header / Logo Area */}
      <View style={styles.header}>
        <Text style={styles.title}>International Plowing Match</Text>
        <Text style={styles.subtitle}>Rural Expo 2026 - Ontario</Text>
      </View>

      {/* Main Content Placeholder */}
      <View style={styles.card}>
        <Text style={styles.cardText}>Welcome to the Official IPM 2026 App.</Text>
        <Text style={styles.bodyText}>
          Your interactive map, schedules, and vendor lists will appear here.
        </Text>
      </View>

      {/* This is where your Ads and Features will live */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2026 1001538341 ONTARIO INC.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 5,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 10,
  },
  bodyText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  footer: {
    marginTop: 40,
    opacity: 0.5,
  },
  footerText: {
    fontSize: 12,
    color: colors.text,
  },
});
