// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { StyleSheet, View, Platform, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../../src/theme/colors';
import AdBanner from '../../src/components/AdBanner';
import adCampaignsConfig from '../../src/config/AdCampaignsConfig';

// Fixed dimensions
const ICON_SIZE = 24;
const NAV_BAR_HEIGHT = 60;
const TOP_BANNER_HEIGHT = 88; // 80px banner + 8px padding

// Helper function to get icon names
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

// Helper function to get display labels
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

// Empty tab bar - we render our own
function EmptyTabBar() {
  return null;
}

// Separate component for tab bar content
function TabBarContent() {
  return (
    <View style={styles.navBarInner}>
      <TabItem routeName="index" />
      <TabItem routeName="map" />
      <TabItem routeName="schedule" />
      <TabItem routeName="leaderboard" />
      <TabItem routeName="about" />
    </View>
  );
}

// Individual tab item with navigation
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
      <View style={styles.iconContainer}>
        <Feather
          name={iconName}
          size={ICON_SIZE}
          color={isFocused ? colors.tabActive : colors.tabInactive}
        />
      </View>
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

  return (
    // ROOT CONTAINER
    <View style={styles.rootContainer}>
      
      {/* FIXED TOP BANNER - SafeAreaView keeps it below status bar */}
      {adCampaignsConfig.topBanner.enabled && (
        <SafeAreaView edges={['top']} style={styles.topSafeArea}>
          <View style={styles.fixedTopBanner}>
            <AdBanner adUnit={adCampaignsConfig.topBanner} position="top" />
          </View>
        </SafeAreaView>
      )}

      {/* TABS NAVIGATOR - This is the main content area */}
      <Tabs
        tabBar={() => <EmptyTabBar />}
        screenOptions={{
          headerShown: false,
        }}
        sceneContainerStyle={{
          flex: 1,
          paddingTop: TOP_BANNER_HEIGHT + topInset,
          backgroundColor: colors.background,
        }}
        initialRouteName="map"
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="map" options={{ title: 'Map' }} />
        <Tabs.Screen name="schedule" options={{ title: 'Schedule' }} />
        <Tabs.Screen name="leaderboard" options={{ title: 'Leaderboard' }} />
        <Tabs.Screen name="about" options={{ title: 'About' }} />
      </Tabs>

      {/* FIXED BOTTOM NAV BAR - Absolute positioned at bottom: 0 */}
      <View style={[
        styles.fixedNavBar,
        { 
          height: NAV_BAR_HEIGHT + bottomInset,
          paddingBottom: bottomInset,
        }
      ]}>
        <TabBarContent />
      </View>

      {/* FLOATING BOTTOM AD - OVERLAY (not sibling) - Outside Tabs, absolute positioned */}
      {adCampaignsConfig.bottomBanner.enabled && (
        <View style={styles.floatingBottomAdOverlay}>
          <AdBanner adUnit={adCampaignsConfig.bottomBanner} position="bottom" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ROOT CONTAINER
  rootContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  // TOP SAFE AREA
  topSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: colors.background,
  },
  
  // FIXED TOP BANNER
  fixedTopBanner: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  
  // FIXED NAV BAR - position: absolute, bottom: 0, height: 60
  fixedNavBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    zIndex: 100,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  
  // Nav bar inner container
  navBarInner: {
    flex: 1,
    flexDirection: 'row',
    paddingTop: 8,
  },
  
  // FLOATING BOTTOM AD - TRUE OVERLAY with exact styles
  // position: absolute, bottom: 90, left: 0, right: 0, zIndex: 9999, alignItems: center
  // backgroundColor: transparent so user sees content behind the gaps
  floatingBottomAdOverlay: {
    position: 'absolute',
    bottom: 90, // Safely above 60px nav bar
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  
  // Tab item
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  
  // Icon container
  iconContainer: {
    width: ICON_SIZE + 8,
    height: ICON_SIZE + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Tab label
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
});
