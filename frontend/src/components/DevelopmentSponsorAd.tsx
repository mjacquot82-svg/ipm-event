import { Feather } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getVendorsData, Vendor } from '../services/spreadsheetDataService';

type DevelopmentSponsorAdProps = {
  position: 'top' | 'bottom';
  pathname: string;
};

type AttendeePage = 'home' | 'schedule' | 'map' | 'vendors' | 'about' | 'itinerary';

type Palette = {
  background: string;
  accent: string;
  detail: string;
  foreground: string;
};

const ROTATION_INTERVAL_MS = 5000;

const PALETTES: Palette[] = [
  { background: '#8A1F25', accent: '#F2A900', detail: '#FFF1CC', foreground: '#FFFFFF' },
  { background: '#315A3B', accent: '#F2A900', detail: '#E6F0E7', foreground: '#FFFFFF' },
  { background: '#174D59', accent: '#F4C45E', detail: '#D9EEF1', foreground: '#FFFFFF' },
];

const HEADLINES = [
  'Proud to be part of IPM 2026',
  'Discover something special at the match',
  'Local service. Friendly faces. Great finds.',
];

const SPONSOR_ASSIGNMENTS: Record<AttendeePage, Record<'top' | 'bottom', string>> = {
  home: {
    top: 'Golden Kernel Kettle Corn',
    bottom: 'Hilltop Honey Farm',
  },
  schedule: {
    top: 'Maple Ridge Mini Donuts',
    bottom: 'Silver Creek Cheese',
  },
  map: {
    top: 'County Tourism Booth',
    bottom: 'Orchard Lane Cider',
  },
  vendors: {
    top: 'Prairie Paper Co',
    bottom: 'Green Acres Equipment',
  },
  about: {
    top: 'County 4-H Association',
    bottom: 'Agricultural Museum Friends',
  },
  itinerary: {
    top: 'Harvest County Library',
    bottom: 'County Tourism Booth',
  },
};

function getAttendeePage(pathname: string): AttendeePage {
  if (pathname.includes('/schedule')) return 'schedule';
  if (pathname.includes('/vendors')) return 'vendors';
  if (pathname.includes('/map')) return 'map';
  if (pathname.includes('/about')) return 'about';
  if (pathname.includes('/itinerary')) return 'itinerary';
  return 'home';
}

function getCategoryIcon(category: string): keyof typeof Feather.glyphMap {
  const normalized = category.toLowerCase();

  if (normalized.includes('food') || normalized.includes('beverage')) return 'coffee';
  if (normalized.includes('farm') || normalized.includes('agri')) return 'sun';
  if (normalized.includes('retail') || normalized.includes('market')) return 'shopping-bag';
  if (normalized.includes('health') || normalized.includes('wellness')) return 'heart';
  if (normalized.includes('service') || normalized.includes('professional')) return 'briefcase';
  if (normalized.includes('community') || normalized.includes('non-profit')) return 'users';
  if (normalized.includes('equipment') || normalized.includes('automotive')) return 'tool';
  if (normalized.includes('craft') || normalized.includes('artisan')) return 'gift';
  return 'star';
}

function VendorDetails({ vendor, color }: { vendor: Vendor; color: string }) {
  return (
    <Text style={[styles.details, { color }]} numberOfLines={1}>
      {[vendor.type, vendor.location].filter(Boolean).join('  •  ')}
    </Text>
  );
}

export default function DevelopmentSponsorAd({ position, pathname }: DevelopmentSponsorAdProps) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [rotationIndex, setRotationIndex] = useState(position === 'top' ? 0 : 1);
  const page = getAttendeePage(pathname);
  const assignedSponsor = SPONSOR_ASSIGNMENTS[page][position];

  useEffect(() => {
    let active = true;
    const applyVendors = (nextVendors: Vendor[]) => {
      if (active && nextVendors.length > 0) setVendors(nextVendors);
    };

    void getVendorsData({
      preferCache: true,
      onBackgroundRefresh: (result) => applyVendors(result.data.vendors),
    })
      .then((result) => applyVendors(result.data.vendors))
      .catch((error) => console.warn('Generated sponsor creative unavailable:', error));

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (vendors.length === 0) return;

    const timer = setInterval(() => {
      setRotationIndex((current) => current + 1);
    }, ROTATION_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [vendors.length]);

  useEffect(() => {
    setRotationIndex(0);
  }, [assignedSponsor]);

  const vendor = vendors.find((candidate) => candidate.name === assignedSponsor) || null;
  const layoutIndex = rotationIndex % PALETTES.length;
  const palette = PALETTES[layoutIndex];
  const iconName = useMemo(
    () => getCategoryIcon(vendor?.type || ''),
    [vendor?.type]
  );

  if (!vendor) return null;

  if (position === 'bottom') {
    if (layoutIndex === 1) {
      return (
        <View style={[styles.bottomCard, styles.bottomCentered, { backgroundColor: palette.background }]}>
          <View style={styles.bottomCenteredCopy}>
            <Text style={[styles.bottomEyebrow, { color: palette.accent }]}>SPONSOR SPOTLIGHT</Text>
            <Text style={[styles.bottomNameCentered, { color: palette.foreground }]} numberOfLines={1}>
              {vendor.name}
            </Text>
          </View>
          <View style={[styles.bottomIconRight, { borderColor: palette.accent }]}>
            <Feather name={iconName} size={17} color={palette.accent} />
          </View>
        </View>
      );
    }

    if (layoutIndex === 2) {
      return (
        <View style={[styles.bottomCard, { backgroundColor: palette.background }]}>
          <View style={[styles.accentRail, { backgroundColor: palette.accent }]} />
          <View style={styles.bottomCopy}>
            <Text style={[styles.bottomName, { color: palette.foreground }]} numberOfLines={1}>
              {vendor.name}
            </Text>
            <VendorDetails vendor={vendor} color={palette.detail} />
          </View>
          <View style={[styles.ctaPillCompact, { backgroundColor: palette.accent }]}>
            <Text style={[styles.ctaTextDark, { color: palette.background }]}>VISIT</Text>
            <Feather name="arrow-right" size={11} color={palette.background} />
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.bottomCard, { backgroundColor: palette.background }]}>
        <View style={[styles.bottomIcon, { backgroundColor: palette.accent }]}>
          <Feather name={iconName} size={18} color={palette.background} />
        </View>
        <View style={styles.bottomCopy}>
          <Text style={[styles.bottomName, { color: palette.foreground }]} numberOfLines={1}>
            {vendor.name}
          </Text>
          <VendorDetails vendor={vendor} color={palette.detail} />
        </View>
        <Text style={[styles.ipmBadgeCompact, { color: palette.accent }]}>FIND US AT IPM 2026</Text>
      </View>
    );
  }

  if (layoutIndex === 1) {
    return (
      <View style={[styles.topCard, styles.centeredCard, { backgroundColor: palette.background }]}>
        <Text style={[styles.sponsorLabel, { color: palette.accent }]}>IPM 2026 • VENDOR SPOTLIGHT</Text>
        <Text style={[styles.centeredName, { color: palette.foreground }]} numberOfLines={1}>
          {vendor.name}
        </Text>
        <VendorDetails vendor={vendor} color={palette.detail} />
        <Text style={[styles.centeredCta, { color: palette.accent }]}>COME SAY HELLO</Text>
      </View>
    );
  }

  if (layoutIndex === 2) {
    return (
      <View style={[styles.topCard, { backgroundColor: palette.background }]}>
        <View style={styles.topCopy}>
          <Text style={[styles.headline, { color: palette.accent }]} numberOfLines={1}>
            {HEADLINES[layoutIndex]}
          </Text>
          <Text style={[styles.vendorName, { color: palette.foreground }]} numberOfLines={1}>
            {vendor.name}
          </Text>
          <VendorDetails vendor={vendor} color={palette.detail} />
          <Text style={[styles.inlineCta, { color: palette.foreground }]}>Explore this IPM vendor →</Text>
        </View>
        <View style={[styles.roundIcon, { backgroundColor: palette.accent }]}>
          <Feather name={iconName} size={25} color={palette.background} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.topCard, { backgroundColor: palette.background }]}>
      <View style={[styles.squareIcon, { backgroundColor: palette.accent }]}>
        <Feather name={iconName} size={25} color={palette.background} />
      </View>
      <View style={styles.topCopy}>
        <Text style={[styles.vendorName, { color: palette.foreground }]} numberOfLines={1}>
          {vendor.name}
        </Text>
        <Text style={[styles.headline, { color: palette.detail }]} numberOfLines={1}>
          {HEADLINES[layoutIndex]}
        </Text>
        <VendorDetails vendor={vendor} color={palette.detail} />
      </View>
      <View style={styles.rightCallout}>
        <Text style={[styles.ipmBadge, { color: palette.accent }]}>IPM{`\n`}2026</Text>
        <Text style={[styles.visitText, { color: palette.detail }]}>VISIT US</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topCard: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  centeredCard: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  squareIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  roundIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  topCopy: { flex: 1, minWidth: 0 },
  vendorName: { fontSize: 18, fontWeight: '800', letterSpacing: 0.2 },
  centeredName: { fontSize: 19, fontWeight: '800', letterSpacing: 0.3, marginVertical: 2 },
  headline: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  sponsorLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  details: { fontSize: 10, fontWeight: '500', marginTop: 2 },
  centeredCta: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1, marginTop: 2 },
  inlineCta: { fontSize: 8, fontWeight: '800', marginTop: 2 },
  rightCallout: { alignItems: 'center', marginLeft: 10 },
  ipmBadge: { fontSize: 11, fontWeight: '900', lineHeight: 12, textAlign: 'center' },
  visitText: { fontSize: 7, fontWeight: '800', marginTop: 2 },
  bottomCard: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  bottomIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  bottomCopy: { flex: 1, minWidth: 0 },
  bottomName: { fontSize: 13, fontWeight: '800' },
  ipmBadgeCompact: { fontSize: 8, fontWeight: '900', marginLeft: 8 },
  bottomCentered: { justifyContent: 'center' },
  bottomCenteredCopy: { flex: 1, alignItems: 'center', minWidth: 0 },
  bottomEyebrow: { fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  bottomNameCentered: { fontSize: 14, fontWeight: '700' },
  bottomIconRight: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  accentRail: { width: 5, alignSelf: 'stretch', marginLeft: -10, marginRight: 10 },
  ctaPillCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginLeft: 8,
  },
  ctaTextDark: { fontSize: 8, fontWeight: '900' },
});
