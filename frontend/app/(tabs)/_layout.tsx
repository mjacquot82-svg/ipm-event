// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { StyleSheet, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../../src/theme/colors';
import AdBanner from '../../src/components/AdBanner';
import adCampaignsConfig from '../../src/config/AdCampaignsConfig';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  
  // Calculate heights for proper spacing
  const topBannerHeight = adCampaignsConfig.topBanner.enabled ? 108 : 0; // 100 + padding
  const bottomBannerHeight = adCampaignsConfig.bottomBanner.enabled ? 58 : 0; // 50 + padding
  const bottomInset = Platform.OS === 'web' ? 20 : Math.max(insets.bottom, 34);
  const tabBarHeight = 70 + bottomInset;

  return (
    <View style={styles.container}>
      {/* Top Masthead Banner (320x100) */}
      <View style={[styles.topBannerContainer, { paddingTop: insets.top }]}>
        <AdBanner adUnit={adCampaignsConfig.topBanner} position="top" />
      </View>

      {/* Main Tab Content - Positioned between banners */}
      <View style={[
        styles.tabsContainer, 
        { 
          marginTop: topBannerHeight + insets.top,
          marginBottom: tabBarHeight + bottomBannerHeight,
        }
      ]}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopWidth: 0,
              height: tabBarHeight,
              paddingBottom: bottomInset,
              paddingTop: 10,
              position: 'absolute',
              bottom: bottomBannerHeight,
              left: 0,
              right: 0,
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
            },
            tabBarActiveTintColor: colors.tabActive,
            tabBarInactiveTintColor: colors.tabInactive,
            tabBarLabelStyle: styles.tabLabel,
            tabBarItemStyle: styles.tabItem,
          }}
          initialRouteName="map"
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Home',
              tabBarIcon: ({ color, size }) => (
                <Feather name="home" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="map"
            options={{
              title: 'Map',
              tabBarIcon: ({ color, size }) => (
                <Feather name="map" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="schedule"
            options={{
              title: 'Schedule',
              tabBarIcon: ({ color, size }) => (
                <Feather name="calendar" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="leaderboard"
            options={{
              title: 'Leaderboard',
              tabBarIcon: ({ color, size }) => (
                <Feather name="bar-chart-2" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="about"
            options={{
              title: 'About',
              tabBarIcon: ({ color, size }) => (
                <Feather name="award" size={size} color={color} />
              ),
            }}
          />
        </Tabs>
      </View>

      {/* Bottom Banner (320x50) - Above tab navigation */}
      <View style={[styles.bottomBannerContainer, { bottom: tabBarHeight }]}>
        <AdBanner adUnit={adCampaignsConfig.bottomBanner} position="bottom" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBannerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: colors.background,
  },
  tabsContainer: {
    flex: 1,
  },
  bottomBannerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: colors.background,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  tabItem: {
    paddingTop: 4,
  },
});
