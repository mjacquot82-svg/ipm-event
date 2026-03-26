// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Linking,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import colors from '../../src/theme/colors';
import { eventInfo, locations, sessions } from '../../src/data/mockData';

export default function AboutScreen() {
  const openMaps = () => {
    const { lat, lng } = eventInfo.coordinates;
    const url = Platform.select({
      ios: `maps://app?daddr=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(IPM 2026)`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
    Linking.openURL(url as string);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Logo Header */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <View style={styles.logoInner}>
              <Text style={styles.logoCounty}>Bruce County</Text>
              <Text style={styles.logoYear}>2026</Text>
              <View style={styles.tractorIconContainer}>
                <Feather name="truck" size={28} color={colors.textPrimary} />
              </View>
            </View>
          </View>
          <Text style={styles.eventTitle}>International Plowing Match</Text>
          <Text style={styles.eventSubtitle}>& Rural Expo</Text>
        </View>

        {/* 50 Years Strong Heritage Banner */}
        <View style={styles.heritageBanner}>
          <View style={styles.heritageDecor}>
            <View style={styles.heritageLine} />
            <Feather name="award" size={24} color={colors.accent} />
            <View style={styles.heritageLine} />
          </View>
          <Text style={styles.heritageTagline}>50 Years Strong</Text>
          <Text style={styles.heritageYear}>Celebrating Half a Century of Agricultural Excellence</Text>
        </View>

        {/* Event Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event Details</Text>
          
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: colors.primary }]}>
                <Feather name="calendar" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Dates</Text>
                <Text style={styles.detailValue}>{eventInfo.dates}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: colors.accent }]}>
                <Feather name="map-pin" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Location</Text>
                <Text style={styles.detailValue}>{eventInfo.location}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: colors.field }]}>
                <Feather name="navigation" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Coordinates</Text>
                <Text style={styles.detailCoords}>
                  {eventInfo.coordinates.lat}, {eventInfo.coordinates.lng}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.directionsButton}
            onPress={openMaps}
            activeOpacity={0.8}
          >
            <Feather name="navigation" size={20} color="#FFFFFF" />
            <Text style={styles.directionsButtonText}>Get Directions</Text>
          </TouchableOpacity>
        </View>

        {/* About the Event */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About the Event</Text>
          <View style={styles.descriptionCard}>
            <Text style={styles.description}>{eventInfo.description}</Text>
          </View>
        </View>

        {/* Heritage Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Heritage</Text>
          <View style={styles.heritageCard}>
            <Feather name="book-open" size={32} color={colors.accent} />
            <Text style={styles.heritageTitle}>A Proud Tradition</Text>
            <Text style={styles.heritageText}>
              For 50 years, the International Plowing Match has brought together farmers, 
              families, and communities to celebrate Ontario's rich agricultural heritage. 
              From horse-drawn plows to modern machinery, we honor the past while 
              embracing the future of farming.
            </Text>
          </View>
        </View>

        {/* Copyright Footer */}
        <View style={styles.copyrightSection}>
          <Text style={styles.copyrightText}>© 2026 1001538341 ONTARIO INC.</Text>
          <Text style={styles.copyrightText}>All Rights Reserved.</Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
  },
  logoCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoInner: {
    alignItems: 'center',
  },
  logoCounty: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  logoYear: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.textPrimary,
    marginVertical: 2,
  },
  tractorIconContainer: {
    marginTop: 4,
  },
  eventTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 16,
    textAlign: 'center',
  },
  eventSubtitle: {
    fontSize: 16,
    color: colors.accent,
    fontWeight: '500',
    marginTop: 2,
  },
  heritageBanner: {
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  heritageDecor: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  heritageLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.accent,
    marginHorizontal: 12,
  },
  heritageTagline: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.accent,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontStyle: 'italic',
  },
  heritageYear: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  detailCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailText: {
    marginLeft: 14,
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 2,
  },
  detailCoords: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.textSecondary,
    marginTop: 2,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 50,
    marginTop: 16,
  },
  directionsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  descriptionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  description: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.accent,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  heritageCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  heritageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 12,
    marginBottom: 8,
  },
  heritageText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  footerBadge: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  footerText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  footerTagline: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent,
    marginTop: 4,
    fontStyle: 'italic',
  },
  copyrightSection: {
    marginTop: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  copyrightText: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  bottomPadding: {
    height: 200, // THE SPACER - Critical for scrolling content above floating ad
  },
});
