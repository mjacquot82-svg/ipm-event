// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
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
        'key': 'BCIwNZy_j_9nCjf9Fln0Z8F-1gARSMEPFcQns5htCMaLsHL2FGKgtNxHmmhwxgM5nV8ovgoYigmSbdQ00IPYNzg'
      });
    };
  }
};

export default function RootLayout() {
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    initWebpushr();

    const cleanupNotifications = addNotificationListeners(
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
          <ErrorBoundary>
            <StatusBar style="dark" backgroundColor={colors.background} />
            
            {isInitializing ? (
              <SplashScreen />
            ) : (
              <>
                <Stack screenOptions={{ headerShown: false }}>
                  {/* 'index' must be here to match your app/index.tsx redirect */}
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="preview-2026" options={{ headerShown: false }} />
                  <Stack.Screen name="admin" options={{ headerShown: false }} />
                  <Stack.Screen name="coming-soon" options={{ headerShown: false }} />
                </Stack>
                <PWAInstallPrompt />
              </>
            )}
          </ErrorBoundary>
        </AdProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
