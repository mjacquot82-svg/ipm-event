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
const NAV_ICONS_HEIGHT = 60; // Height for the navigation icons
const AD_HEIGHT = 58; // Height for the ad (50px + 8px padding)

function getIconName(routeName: string): keyof typeof Feather.glyphMap {
  switch (routeName) {
    case 'index': return 'home';
    case 'map': return 'map';
    case 'schedule': return 'calendar';
    case 'leaderboard': return 'bar-chart-2';
    case 'about': return 'award';
    default: return 'circle';
  }
}

function getLabel(routeName: string): string {
  switch (routeName) {
    case 'index': return 'Home';
    case 'map': return 'Map';
    case 'schedule': return 'Schedule';
    case 'leaderboard': return 'Leaderboard';
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
  const topInset = insets.top || 0;
  const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom || 0;
  
  // Top ad height
  const topAdHeight = adCampaignsConfig.topBanner.enabled ? 88 : 0;
  
  // Total nav bar height = ad + icons + bottom safe area
  const bottomAdEnabled = adCampaignsConfig.bottomBanner.enabled;
  const totalNavBarHeight = (bottomAdEnabled ? AD_HEIGHT : 0) + NAV_ICONS_HEIGHT + bottomInset;

  return (
    <View style={styles.root}>
      
      {/* TOP AD */}
      {adCampaignsConfig.topBanner.enabled && (
        <View style={[styles.topAdWrapper, { paddingTop: topInset }]}>
          <AdBanner adUnit={adCampaignsConfig.topBanner} position="top" />
        </View>
      )}

      {/* MAIN CONTENT - Tabs */}
      <View style={[styles.contentArea, { marginTop: topAdHeight + topInset }]}>
        <Tabs
          tabBar={() => <EmptyTabBar />}
          screenOptions={{ headerShown: false }}
          sceneContainerStyle={styles.scene}
          initialRouteName="map"
        >
          <Tabs.Screen name="index" options={{ title: 'Home' }} />
          <Tabs.Screen name="map" options={{ title: 'Map' }} />
          <Tabs.Screen name="schedule" options={{ title: 'Schedule' }} />
          <Tabs.Screen name="leaderboard" options={{ title: 'Leaderboard' }} />
          <Tabs.Screen name="about" options={{ title: 'About' }} />
        </Tabs>
      </View>

      {/* COMBINED NAV BAR - Contains Ad + Icons */}
      <View style={[
        styles.combinedNavBar,
        { height: totalNavBarHeight, paddingBottom: bottomInset }
      ]}>
        {/* Ad Section - Below the border line, above icons */}
        {bottomAdEnabled && (
          <View style={styles.adSection}>
            <AdBanner adUnit={adCampaignsConfig.bottomBanner} position="bottom" />
          </View>
        )}
        
        {/* Icons Section - At the bottom */}
        <View style={styles.iconsSection}>
          <TabItem routeName="index" />
          <TabItem routeName="map" />
          <TabItem routeName="schedule" />
          <TabItem routeName="leaderboard" />
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: colors.background,
  },
  
  // CONTENT AREA - needs margin bottom for taller nav bar
  contentArea: {
    flex: 1,
    marginBottom: 118, // Ad (58) + Icons (60) = 118
  },
  
  scene: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  // Combined nav bar - contains both ad and icons
  combinedNavBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    zIndex: 100,
  },
  
  // Ad section - at the top of the combined nav bar
  adSection: {
    alignItems: 'center',
    paddingVertical: 4,
    backgroundColor: colors.surface,
  },
  
  // Icons section - at the bottom of the combined nav bar
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
