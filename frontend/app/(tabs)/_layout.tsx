// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// 3-LAYER SANDWICH ARCHITECTURE

import React from 'react';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { StyleSheet, View, Platform, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../../src/theme/colors';
import AdBanner from '../../src/components/AdBanner';
import adCampaignsConfig from '../../src/config/AdCampaignsConfig';

const ICON_SIZE = 24;
const NAV_BAR_HEIGHT = 60; // Layer 2 fixed height
const TOP_BANNER_HEIGHT = 80; // Top ad fixed height

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

  return (
    <View style={styles.root}>
      
      {/* TOP SPONSOR AD - Fixed height: 80 */}
      {adCampaignsConfig.topBanner.enabled && (
        <SafeAreaView edges={['top']} style={styles.topAdContainer}>
          <AdBanner adUnit={adCampaignsConfig.topBanner} position="top" />
        </SafeAreaView>
      )}

      {/* LAYER 1: CONTENT - flex: 1, height: 100% */}
      <Tabs
        tabBar={() => <EmptyTabBar />}
        screenOptions={{ headerShown: false }}
        sceneContainerStyle={styles.sceneContainer}
        initialRouteName="map"
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="map" options={{ title: 'Map' }} />
        <Tabs.Screen name="schedule" options={{ title: 'Schedule' }} />
        <Tabs.Screen name="leaderboard" options={{ title: 'Leaderboard' }} />
        <Tabs.Screen name="about" options={{ title: 'About' }} />
      </Tabs>

      {/* LAYER 2: NAVIGATION - bottom: 0, height: 60, zIndex: 100 */}
      <View style={[
        styles.navBar,
        { height: NAV_BAR_HEIGHT + bottomInset, paddingBottom: bottomInset }
      ]}>
        <TabItem routeName="index" />
        <TabItem routeName="map" />
        <TabItem routeName="schedule" />
        <TabItem routeName="leaderboard" />
        <TabItem routeName="about" />
      </View>

      {/* LAYER 3: FLOATING AD - position: absolute, bottom: 80, zIndex: 999 */}
      {adCampaignsConfig.bottomBanner.enabled && (
        <View 
          style={styles.floatingAd}
          pointerEvents="box-none"
        >
          <AdBanner adUnit={adCampaignsConfig.bottomBanner} position="bottom" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ROOT CONTAINER
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  // TOP AD CONTAINER
  topAdContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: colors.background,
  },
  
  // LAYER 1: CONTENT - flex: 1, height: 100%
  sceneContainer: {
    flex: 1,
    height: '100%',
    backgroundColor: colors.background,
  },
  
  // LAYER 2: NAVIGATION - bottom: 0, height: 60, zIndex: 100
  navBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    zIndex: 100,
    paddingTop: 8,
  },
  
  // LAYER 3: FLOATING AD - position: absolute, bottom: 80, zIndex: 999
  floatingAd: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    zIndex: 999,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  
  // TAB ITEM
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // TAB LABEL
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
});
