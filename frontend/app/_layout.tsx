// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useEffect, useState } from 'react';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import colors from '../src/theme/colors';
import { 
  registerForPushNotificationsAsync, 
  addNotificationListeners 
} from '../src/utils/notificationService';
import { AdProvider } from '../src/context/AdContext';
import ErrorBoundary from '../src/components/ErrorBoundary';
import PWAInstallPrompt from '../src/components/PWAInstallPrompt';
import SplashScreen from '../src/components/SplashScreen';
import { AnnouncementReadProvider } from '../src/context/AnnouncementReadContext';
import { setAnalyticsRoute } from '../src/analytics/analyticsClient';
import { initializeOfflineShell, initializeWonderPush } from '../src/services/wonderPushService';
import { markStartupStage, runOnlineAfterFirstPaint } from '../src/services/startupPerformance';

markStartupStage('react_root_module_initialized');

export default function RootLayout() {
  const [isInitializing, setIsInitializing] = useState(Platform.OS !== 'web');
  const pathname = usePathname();

  useEffect(() => {
    return runOnlineAfterFirstPaint(() => {
      markStartupStage('analytics_initialization_started');
      void setAnalyticsRoute(pathname);
    });
  }, [pathname]);

  useEffect(() => {
    markStartupStage('root_layout_mounted');
    if (Platform.OS === 'web') {
      return runOnlineAfterFirstPaint(() => {
        markStartupStage('deferred_services_started');
        void initializeOfflineShell().catch((error) => {
          console.warn('Offline shell service worker unavailable:', error);
        });
        void initializeWonderPush().catch((error) => {
          console.warn('WonderPush initialization unavailable:', error);
        });
      });
    }

    let cleanupNotifications: () => void = () => undefined;
    cleanupNotifications = addNotificationListeners(
      (notification) => {
        console.log('Notification received:', notification);
      },
      (response) => {
        console.log('Notification tapped:', response);
      }
    );

    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        console.log('Push notification token:', token);
      }
    }).catch((error) => {
      console.warn('Push notification registration failed:', error);
    });

    setIsInitializing(false);

    return () => {
      cleanupNotifications();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <AdProvider>
          <AnnouncementReadProvider>
            <ErrorBoundary>
              <StatusBar style="dark" backgroundColor={colors.background} />
            
            {isInitializing ? (
              <SplashScreen />
            ) : (
              <Stack screenOptions={{ headerShown: false }}>
                {/* 'index' must be here to match your app/index.tsx redirect */}
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="preview-2026" options={{ headerShown: false }} />
                <Stack.Screen name="admin" options={{ headerShown: false }} />
                <Stack.Screen name="coming-soon" options={{ headerShown: false }} />
                <Stack.Screen name="reminder-test-registration" options={{ headerShown: false }} />
              </Stack>
            )}
            <PWAInstallPrompt />
            </ErrorBoundary>
          </AnnouncementReadProvider>
        </AdProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
