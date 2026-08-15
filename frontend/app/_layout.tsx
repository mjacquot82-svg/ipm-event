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

// Initialize Webpushr for web platform
const initWebpushr = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // @ts-ignore
    if (typeof window.webpushr !== 'undefined') return;
    
    // @ts-ignore
    window.webpushr = window.webpushr || function() {
      // @ts-ignore
      (window.webpushr.q = window.webpushr.q || []).push(arguments);
    };
    
    const script = document.createElement('script');
    script.id = 'webpushr-jssdk';
    script.async = true;
    script.src = 'https://cdn.webpushr.com/app.min.js';
    
    const firstScript = document.getElementsByTagName('script')[0];
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }
    
    script.onload = () => {
      // @ts-ignore
      window.webpushr('setup', {
        'key': 'BHu0qiKGpRuMKicoL7MFSj-Oe58Dio-M9vYxksU4IIoY3hHXYU6TE9yigTRSu2Ws0AbuWnOwFglijaBsajGbPKk'
      });
    };
  }
};

// Install the same root worker Webpushr uses so the offline shell is available
// before an attendee chooses whether to subscribe to notifications.
const initOfflineWorker = () => {
  if (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator
  ) {
    const registrationUrl = '/webpushr-sw.js';
    const requestedScope = '/';
    const isDeployPreview = typeof window !== 'undefined'
      && /^deploy-preview-\d+--/.test(window.location.hostname);
    const isWebpushrInitialized = () => {
      if (typeof window === 'undefined') return false;
      // Webpushr's bootstrap queue has a `q` property; the loaded SDK replaces it.
      const webpushr = (window as typeof window & { webpushr?: { q?: unknown[] } }).webpushr;
      return typeof webpushr === 'function' && !('q' in webpushr);
    };
    const diagnostic = isDeployPreview ? {
      attempted: true,
      attemptTimestamp: new Date().toISOString(),
      registrationUrl,
      requestedScope,
      outcome: 'pending',
      errorName: 'absent',
      errorMessage: 'absent',
      webpushrInitializedAtAttempt: isWebpushrInitialized(),
      webpushrInitializedAtCompletion: false,
    } : undefined;

    if (diagnostic) {
      // @ts-ignore Temporary Deploy Preview diagnostic read by /offline-diagnostics.
      window.__IPM_SW_REGISTRATION_DIAGNOSTIC__ = diagnostic;
    }

    try {
      navigator.serviceWorker.register('/webpushr-sw.js', { scope: '/' }).then(() => {
        if (!diagnostic) return;
        diagnostic.outcome = 'success';
        diagnostic.webpushrInitializedAtCompletion = isWebpushrInitialized();
      }).catch((error) => {
        if (diagnostic) {
          diagnostic.outcome = 'failure';
          diagnostic.errorName = error instanceof Error ? error.name : typeof error;
          diagnostic.errorMessage = error instanceof Error ? error.message : String(error);
          diagnostic.webpushrInitializedAtCompletion = isWebpushrInitialized();
        }
        console.warn('Offline worker registration failed:', error);
      });
    } catch (error) {
      if (diagnostic) {
        diagnostic.outcome = 'failure (synchronous)';
        diagnostic.errorName = error instanceof Error ? error.name : typeof error;
        diagnostic.errorMessage = error instanceof Error ? error.message : String(error);
        diagnostic.webpushrInitializedAtCompletion = isWebpushrInitialized();
      }
      console.warn('Offline worker registration failed:', error);
    }
  }
};

export default function RootLayout() {
  const [isInitializing, setIsInitializing] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    void setAnalyticsRoute(pathname);
  }, [pathname]);

  useEffect(() => {
    initOfflineWorker();
    initWebpushr();

    let cleanupNotifications: () => void = () => undefined;
    if (Platform.OS !== 'web') {
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
    }

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
