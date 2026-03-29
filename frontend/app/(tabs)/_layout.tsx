// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { StyleSheet, View, Platform, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../../src/theme/colors';
import AdBanner from '../../src/components/AdBanner';
import adCampaignsConfig from '../../src/config/AdCampaignsConfig';

const ICON_SIZE = 24;
const NAV_ICONS_HEIGHT = 60;
const AD_SECTION_HEIGHT = 58;

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
  const router = useRouter();
  const pathname = usePathname();
  
  const iconName = getIconName(routeName);
  const label = getLabel(routeName);
  
  const isFocused = (pathname === '/' && routeName === 'index') || 
                    pathname === `/${routeName}` || 
                    pathname.startsWith(`/${routeName}/`);

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
  
  const topAdHeight = adCampaignsConfig.topBanner.enabled ? 98 : 0;
  const bottomAdEnabled = adCampaignsConfig.bottomBanner.enabled;
  const totalBottomBarHeight = (bottomAdEnabled ? AD_SECTION_HEIGHT : 0) + NAV_ICONS_HEIGHT + bottomInset;

  return (
    <View style={styles.root}>
      {adCampaignsConfig.topBanner.enabled && (
        <View style={[styles.topAdWrapper, { paddingTop: topInset }]}>
          <AdBanner adUnit={adCampaignsConfig.topBanner} position="top" />
        </View>
      )}

      <View style={[styles.contentArea, { marginTop: topAdHeight + topInset }]}>
        <Tabs
          tabBar={() => <EmptyTabBar />}
          screenOptions={{ headerShown: false }}
          sceneContainerStyle={styles.scene}
        >
          <Tabs.Screen name="index" options={{ title: 'Home' }} />
          <Tabs.Screen name="map" options={{ title: 'Map' }} />
          <Tabs.Screen name="schedule" options={{ title: 'Schedule' }} />
          <Tabs.Screen name="leaderboard" options={{ title: 'Leaderboard' }} />
          <Tabs.Screen name="about" options={{ title: 'About' }} />
        </Tabs>
      </View>

      <View style={[
        styles.combinedBottomBar,
        { height: totalBottomBarHeight, paddingBottom: bottomInset }
      ]}>
        {bottomAdEnabled && (
          <View style={styles.adSection}>
            <AdBanner adUnit={adCampaignsConfig.bottomBanner} position="bottom" />
          </View>
        )}
        
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
  root: { flex: 1, backgroundColor: colors.background },
  topAdWrapper: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, backgroundColor: colors.background },
  contentArea: { flex: 1 },
  scene: { flex: 1, backgroundColor: colors.background },
  combinedBottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, zIndex: 100 },
  adSection: { alignItems: 'center', paddingVertical: 4 },
  iconsSection: { flexDirection: 'row', height: 60, paddingTop: 8 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 10, fontWeight: '600', marginTop: 4 },
});
