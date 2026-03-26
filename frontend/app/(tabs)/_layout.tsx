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
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const topInset = insets.top || 0;
  const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom || 0;
  
  // Calculate top banner height
  const topBannerHeight = adCampaignsConfig.topBanner.enabled ? 108 : 0;

  return (
    // ROOT CONTAINER - Standard View (NOT SafeAreaView) for manual control
    <View style={styles.rootContainer}>
      
      {/* CONTENT UNDERLAY - 100% height, NO overflow:hidden, NO padding/margin bottom */}
      <View style={styles.contentUnderlay}>
        
        {/* Tab Navigator - NO paddingBottom, NO marginBottom */}
        <Tabs
          tabBar={() => <EmptyTabBar />}
          screenOptions={{
            headerShown: false,
          }}
          sceneContainerStyle={{
            // ONLY top padding for the banner - NO bottom padding
            paddingTop: topBannerHeight + topInset,
            backgroundColor: colors.background,
            // Ensure no hidden overflow
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

      {/* FIXED TOP BANNER */}
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

      {/* FLOATING BOTTOM AD - TRANSPARENT background, position: absolute, bottom: 65 */}
      {adCampaignsConfig.bottomBanner.enabled && (
        <View style={[
          styles.floatingBottomAd,
          { bottom: NAV_BAR_HEIGHT + bottomInset + 5 }
        ]}>
          <AdBanner adUnit={adCampaignsConfig.bottomBanner} position="bottom" />
        </View>
      )}
    </View>
  );
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
  // ROOT CONTAINER - Standard View, NOT SafeAreaView
  rootContainer: {
    flex: 1,
    backgroundColor: colors.background,
    // NO overflow: hidden here
  },
  
  // CONTENT UNDERLAY - 100% height, slides behind nav bar
  contentUnderlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0, // Extends to absolute bottom of screen
    // NO overflow: hidden - content can slide behind nav bar
    // NO padding or margin
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
  
  // FLOATING BOTTOM AD - TRANSPARENT background
  floatingBottomAd: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 90,
    alignItems: 'center',
    backgroundColor: 'transparent', // TRANSPARENT - not a solid block
    // NO padding, NO margin - just the ad itself
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
