// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { StyleSheet, View, Platform, TouchableOpacity, Text, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../../src/theme/colors';
import AdBanner from '../../src/components/AdBanner';
import adCampaignsConfig from '../../src/config/AdCampaignsConfig';

// Fixed dimensions - NEVER auto-resize
const ICON_SIZE = 24;
const NAV_BAR_HEIGHT = 60; // Fixed height - no auto-resize
const SCREEN_HEIGHT = Dimensions.get('window').height;

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

// Fixed-height Tab Bar - returns null since we render our own
function EmptyTabBar() {
  return null;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const topInset = insets.top || 0;
  const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom || 0;
  
  // Calculate top banner height with safe area
  const topBannerHeight = adCampaignsConfig.topBanner.enabled ? 108 : 0;

  return (
    // ROOT CONTAINER - Takes full screen
    <View style={styles.rootContainer}>
      
      {/* CONTENT UNDERLAY - flex: 1, height: 100%, extends behind nav bar */}
      <View style={[styles.contentUnderlay, { height: SCREEN_HEIGHT }]}>
        
        {/* Tab Navigator - Content goes all the way down */}
        <Tabs
          tabBar={() => <EmptyTabBar />}
          screenOptions={{
            headerShown: false,
          }}
          sceneContainerStyle={{
            paddingTop: topBannerHeight + topInset,
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
      </View>

      {/* FIXED TOP BANNER - SafeAreaView for phone clock */}
      {adCampaignsConfig.topBanner.enabled && (
        <View style={[styles.fixedTopBanner, { paddingTop: topInset }]}>
          <AdBanner adUnit={adCampaignsConfig.topBanner} position="top" />
        </View>
      )}

      {/* FIXED BOTTOM NAV BAR - height: 60, position: absolute, bottom: 0 */}
      <View style={[
        styles.fixedNavBar,
        { 
          height: NAV_BAR_HEIGHT + bottomInset,
          paddingBottom: bottomInset,
        }
      ]}>
        <TabBarContent />
      </View>

      {/* DE-COUPLED BOTTOM AD - position: absolute, bottom: 65, LAST ITEM = on top */}
      {adCampaignsConfig.bottomBanner.enabled && (
        <View style={[
          styles.floatingBottomAd,
          { bottom: NAV_BAR_HEIGHT + bottomInset + 5 } // 65px above screen bottom (60 nav + 5 spacing)
        ]}>
          <AdBanner adUnit={adCampaignsConfig.bottomBanner} position="bottom" />
        </View>
      )}
    </View>
  );
}

// Separate component for tab bar content to access navigation
function TabBarContent() {
  // We need to use a workaround since we can't access navigation directly here
  // This is handled by the individual tab items
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
  
  // Check if this tab is active
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

const styles = StyleSheet.create({
  // ROOT CONTAINER - Full screen
  rootContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  // CONTENT UNDERLAY - Extends to bottom edge, behind nav bar
  contentUnderlay: {
    flex: 1,
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  
  // FIXED TOP BANNER - Absolute at top
  fixedTopBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  
  // FIXED NAV BAR - Absolute at bottom, FIXED height: 60
  fixedNavBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    zIndex: 100,
    // Shadow for depth
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
  
  // DE-COUPLED BOTTOM AD - Absolute, sits on top of everything
  floatingBottomAd: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 90,
    alignItems: 'center',
    // No background - truly floating
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
