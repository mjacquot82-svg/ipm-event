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
const BOTTOM_AD_HEIGHT = 58; // 50px banner + 8px padding

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

// Floating Tab Bar component - absolute positioned at bottom
function FloatingTabBar(props: any) {
  const { state, navigation } = props;
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom || 0;
  
  return (
    <View style={[
      styles.floatingTabBar, 
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
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const topInset = insets.top || 0;
  const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom || 0;
  
  // Calculate top banner height with safe area
  const topBannerHeight = adCampaignsConfig.topBanner.enabled ? 108 : 0; // 100px + 8px padding
  
  return (
    <View style={styles.container}>
      {/* Full-Screen Tab Content - Goes behind everything */}
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
        sceneContainerStyle={{
          // Content takes full screen but has padding for top ad
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

      {/* Fixed Top Ad Banner - SafeAreaView for phone clock */}
      {adCampaignsConfig.topBanner.enabled && (
        <View style={[styles.fixedTopBanner, { paddingTop: topInset }]}>
          <AdBanner adUnit={adCampaignsConfig.topBanner} position="top" />
        </View>
      )}

      {/* Floating Bottom Ad - Absolute positioned above nav bar */}
      {adCampaignsConfig.bottomBanner.enabled && (
        <View style={[
          styles.floatingBottomAd, 
          { bottom: TAB_BAR_HEIGHT + bottomInset }
        ]}>
          <AdBanner adUnit={adCampaignsConfig.bottomBanner} position="bottom" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  // Fixed Top Ad Banner - absolute at top with SafeArea
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
  
  // Floating Tab Bar - absolute at bottom with solid background
  floatingTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    zIndex: 100,
    // Shadow for depth
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  
  // Floating Bottom Ad - absolute positioned above nav bar
  floatingBottomAd: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 90,
    alignItems: 'center',
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
