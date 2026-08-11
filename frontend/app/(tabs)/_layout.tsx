// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { StyleSheet, View, Platform, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../../src/theme/colors';

const ICON_SIZE = 24;
const NAV_ICONS_HEIGHT = 60;

function getIconName(routeName: string): keyof typeof Feather.glyphMap {
  switch (routeName) {
    case 'index': return 'home';
    case 'map': return 'map';
    case 'schedule': return 'calendar';
    case 'about': return 'info';
    default: return 'circle';
  }
}

function getLabel(routeName: string): string {
  switch (routeName) {
    case 'index': return 'Home';
    case 'map': return 'Map';
    case 'schedule': return 'Schedule';
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
    switch (routeName) {
      case 'index':
        router.push('/');
        break;
      case 'map':
        router.push('/map');
        break;
      case 'schedule':
        router.push('/schedule');
        break;
      case 'about':
        router.push('/about');
        break;
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
  const topInset = Platform.OS === 'web' ? 0 : insets.top || 0;
  const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom || 0;
  const totalBottomBarHeight = NAV_ICONS_HEIGHT + bottomInset;

  return (
    <View style={styles.root}>
      <View style={[styles.contentArea, { paddingTop: topInset }]}>
        <Tabs
          tabBar={() => <EmptyTabBar />}
          screenOptions={{ headerShown: false, sceneStyle: styles.scene }}
        >
          <Tabs.Screen name="index" options={{ title: 'Home', href: '/' }} />
          <Tabs.Screen name="map" options={{ title: 'Map' }} />
          <Tabs.Screen name="schedule" options={{ title: 'Schedule' }} />
          <Tabs.Screen name="about" options={{ title: 'About' }} />
          <Tabs.Screen name="itinerary" options={{ title: 'Itinerary', href: null }} />
          <Tabs.Screen name="vendors" options={{ title: 'Vendors', href: null }} />
          <Tabs.Screen name="announcements" options={{ title: 'Announcements', href: null }} />
          <Tabs.Screen name="queen-of-the-furrow" options={{ title: 'Queen of the Furrow', href: null }} />
        </Tabs>
      </View>

      <View style={[
        styles.combinedBottomBar,
        { height: totalBottomBarHeight, paddingBottom: bottomInset }
      ]}>
        <View style={styles.iconsSection}>
          <TabItem routeName="index" />
          <TabItem routeName="map" />
          <TabItem routeName="schedule" />
          <TabItem routeName="about" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  contentArea: { flex: 1, overflow: 'hidden' },
  scene: { flex: 1, backgroundColor: colors.background },
  combinedBottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, zIndex: 100 },
  iconsSection: { flexDirection: 'row', height: 60, paddingTop: 8 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 10, fontWeight: '600', marginTop: 4 },
});
