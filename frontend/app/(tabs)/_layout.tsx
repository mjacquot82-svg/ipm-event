// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { StyleSheet, View, Platform, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../../src/theme/colors';
import AdBanner from '../../src/components/AdBanner';
import adCampaignsConfig from '../../src/config/AdCampaignsConfig';

// Fixed dimensions
const ICON_SIZE = 24;
const TAB_BAR_HEIGHT = 60;
const TOP_BANNER_HEIGHT = 108; // 100px banner + 8px padding

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

// Custom Tab Bar component that includes the ad banner above it
function CustomTabBar(props: any) {
  const { state, navigation } = props;
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom || 0;
  
  return (
    <View style={styles.customTabBarContainer}>
      {/* Bottom Ad Banner - sits exactly above tab bar */}
      {adCampaignsConfig.bottomBanner.enabled && (
        <View style={styles.bottomAdWrapper}>
          <AdBanner adUnit={adCampaignsConfig.bottomBanner} position="bottom" />
        </View>
      )}
      
      {/* Actual Tab Bar - pinned to bottom */}
      <View style={[
        styles.tabBar, 
        { paddingBottom: bottomInset, height: TAB_BAR_HEIGHT + bottomInset }
      ]}>
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;
          const iconName = getIconName(route.name);
          const label = getLabel(route.name);
          
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
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
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const topInset = insets.top || 0;
  
  // Calculate content padding
  const topPadding = adCampaignsConfig.topBanner.enabled ? TOP_BANNER_HEIGHT + topInset : topInset;
  
  return (
    <View style={styles.container}>
      {/* Top Masthead Banner (320x100) - Fixed at top */}
      {adCampaignsConfig.topBanner.enabled && (
        <View style={[styles.topBannerContainer, { paddingTop: topInset }]}>
          <AdBanner adUnit={adCampaignsConfig.topBanner} position="top" />
        </View>
      )}

      {/* Main Tab Navigator */}
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
        initialRouteName="map"
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Home' }}
        />
        <Tabs.Screen
          name="map"
          options={{ title: 'Map' }}
        />
        <Tabs.Screen
          name="schedule"
          options={{ title: 'Schedule' }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{ title: 'Leaderboard' }}
        />
        <Tabs.Screen
          name="about"
          options={{ title: 'About' }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Top banner - absolute positioned at top
  topBannerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: colors.background,
  },
  // Custom tab bar container - includes ad + tabs
  customTabBarContainer: {
    backgroundColor: colors.background,
  },
  // Bottom ad wrapper - exactly above tab bar
  bottomAdWrapper: {
    alignItems: 'center',
    paddingVertical: 4,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  // Tab bar styling - pinned to absolute bottom
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  // Individual tab item
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  // Icon container with fixed size
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
