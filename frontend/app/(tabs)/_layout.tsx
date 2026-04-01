// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { StyleSheet, View, Platform, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../../src/theme/colors';
import AdBanner from '../../src/components/AdBanner';
import adCampaignsConfig from '../../src/config/AdCampaignsConfig';

const ICON_SIZE = 24;
const NAV_ICONS_HEIGHT = 60;
const AD_SECTION_HEIGHT = 58; // 50px ad + 8px padding

function getIconName(routeName: string): keyof typeof Feather.glyphMap {
  switch (routeName) {
    case 'index': return 'home';
    case 'map': return 'map';
    case 'schedule': return 'calendar';
    case 'vendors': return 'shopping-bag';
    case 'about': return 'award';
    default: return 'circle';
  }
}

function getLabel(routeName: string): string {
  switch (routeName) {
    case 'index': return 'Home';
    case 'map': return 'Map';
    case 'schedule': return 'Schedule';
    case 'vendors': return 'Vendors';
    case 'about': return 'About';
    default: return routeName;
  }
}

function EmptyTabBar() {
  return null;
}

function TabItem({ routeName }: { routeName: string }) {
  const { usePathname, useRouter } = require('expo-router');
  const router = useRouter();
  const pathname = usePathname();
  
  const iconName = getIconName(routeName);
  const label = getLabel(routeName);
  
  const currentPath = pathname === '/' ? 'index' : pathname.replace('/', '');
  const isFocused = currentPath === routeName || 
                    (routeName === 'index' && pathname === '/') ||
                    pathname.includes(routeName);
  
  const onPress = () => {
    if (routeName === 'index') {
      router.push('/');
    } else {
      router.push(`/${routeName}`);
    }
  };

  return (
    <TouchableOpacity
      style={styles.tabItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Feather
        name={iconName}
        size={ICON_SIZE}
        color={isFocused ? colors.tabActive : colors.tabInactive}
      />
      <Text style={[
        styles.tabLabel,
        { color: isFocused ? colors.tabActive : colors.tabInactive }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  // Force topInset to 0 on web to prevent gap issues
  const topInset = Platform.OS === 'web' ? 0 : (insets.top || 0);
  const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom || 0;
  
  // Combined bottom bar height = ad + icons + safe area
  const bottomAdEnabled = adCampaignsConfig.bottomBanner.enabled;
  const totalBottomBarHeight = (bottomAdEnabled ? AD_SECTION_HEIGHT : 0) + NAV_ICONS_HEIGHT + bottomInset;

  return (
    <View style={styles.root}>
      
      {/* TOP AD - Now in normal flow, not absolute positioned */}
      {adCampaignsConfig.topBanner.enabled && (
        <View style={[styles.topAdWrapper, { paddingTop: topInset }]}>
          <AdBanner adUnit={adCampaignsConfig.topBanner} position="top" />
        </View>
      )}

      {/* MAIN CONTENT - Tabs - fills remaining space */}
      <View style={styles.contentArea}>
        <Tabs
          tabBar={() => <EmptyTabBar />}
          screenOptions={{ headerShown: false }}
          sceneContainerStyle={styles.scene}
        >
          <Tabs.Screen name="index" options={{ title: 'Home', href: '/' }} />
          <Tabs.Screen name="map" options={{ title: 'Map' }} />
          <Tabs.Screen name="schedule" options={{ title: 'Schedule' }} />
          <Tabs.Screen name="vendors" options={{ title: 'Vendors' }} />
          <Tabs.Screen name="about" options={{ title: 'About' }} />
          <Tabs.Screen name="itinerary" options={{ title: 'Itinerary', href: null }} />
          <Tabs.Screen name="leaderboard" options={{ title: 'Leaderboard', href: null }} />
        </Tabs>
      </View>

      {/* COMBINED BOTTOM BAR - Ad above Icons */}
      <View style={[
        styles.combinedBottomBar,
        { height: totalBottomBarHeight, paddingBottom: bottomInset }
      ]}>
        {/* AD SECTION - Inside nav bar, above icons */}
        {bottomAdEnabled && (
          <View style={styles.adSection}>
            <AdBanner adUnit={adCampaignsConfig.bottomBanner} position="bottom" />
          </View>
        )}
        
        {/* ICONS SECTION - At the bottom */}
        <View style={styles.iconsSection}>
          <TabItem routeName="index" />
          <TabItem routeName="map" />
          <TabItem routeName="schedule" />
          <TabItem routeName="vendors" />
          <TabItem routeName="about" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  topAdWrapper: {
    // Normal flex flow - content stacks below this properly
    backgroundColor: colors.background,
    zIndex: 10, // Ensure ad stays on top during any animations
  },
  
  contentArea: {
    flex: 1,
    overflow: 'hidden', // Prevent content from overflowing into ad area
  },
  
  scene: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  // Combined bottom bar - ad + icons
  combinedBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    zIndex: 100,
  },
  
  // Ad section - inside nav bar, above icons
  adSection: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  
  // Icons section - at the bottom
  iconsSection: {
    flexDirection: 'row',
    height: 60,
    paddingTop: 8,
  },
  
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
});
