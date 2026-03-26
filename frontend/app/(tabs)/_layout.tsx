// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { StyleSheet, View, Platform, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../../src/theme/colors';
import AdBanner from '../../src/components/AdBanner';
import adCampaignsConfig from '../../src/config/AdCampaignsConfig';

const ICON_SIZE = 24;
const NAV_BAR_HEIGHT = 60;
const TOP_BANNER_HEIGHT = 88;

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
    <View style={styles.rootContainer}>
      
      {/* TOP BANNER */}
      {adCampaignsConfig.topBanner.enabled && (
        <SafeAreaView edges={['top']} style={styles.topSafeArea}>
          <View style={styles.fixedTopBanner}>
            <AdBanner adUnit={adCampaignsConfig.topBanner} position="top" />
          </View>
        </SafeAreaView>
      )}

      {/* TABS NAVIGATOR */}
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

      {/* BOTTOM NAV BAR */}
      <View style={[
        styles.fixedNavBar,
        { 
          height: NAV_BAR_HEIGHT + bottomInset,
          paddingBottom: bottomInset,
        }
      ]}>
        <TabBarContent />
      </View>

      {/* BOTTOM AD - HARD OVERLAY - VERY LAST ITEM - EXACT STYLES AS SPECIFIED */}
      {adCampaignsConfig.bottomBanner.enabled && (
        <View 
          style={{ 
            position: 'absolute', 
            bottom: 100, 
            left: 0, 
            right: 0, 
            zIndex: 9999, 
            alignItems: 'center', 
            backgroundColor: 'transparent' 
          }}
          pointerEvents="box-none"
        >
          <AdBanner adUnit={adCampaignsConfig.bottomBanner} position="bottom" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  topSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: colors.background,
  },
  
  fixedTopBanner: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  
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
  
  navBarInner: {
    flex: 1,
    flexDirection: 'row',
    paddingTop: 8,
  },
  
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  
  iconContainer: {
    width: ICON_SIZE + 8,
    height: ICON_SIZE + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
});
