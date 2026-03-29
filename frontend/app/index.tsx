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
  const [showSplash, setShowSplash] = useState(true);
  
  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  useEffect(() => {
    initWebpushr();
    
    const initNotifications = async () => {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        console.log('Push notification token:', token);
      }
    };

    initNotifications();

    const cleanup = addNotificationListeners(
      (notification) => {
        console.log('Notification received:', notification);
      },
      (response) => {
        console.log('Notification tapped:', response);
      }
    );

    return cleanup;
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <AdProvider>
          <StatusBar style="dark" backgroundColor={colors.background} />
          
          {/* LOGIC: Show ONLY Splash first. Once done, show the App Stack. */}
          {showSplash ? (
            <SplashScreen 
              onFinish={handleSplashFinish} 
              duration={2000} 
            />
          ) : (
            <>
              <Stack screenOptions={{ headerShown: false }}>
                {/* 'index' must be here to match your app/index.tsx redirect */}
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="preview-2026" options={{ headerShown: false }} />
                <Stack.Screen name="coming-soon" options={{ headerShown: false }} />
              </Stack>
              <PWAInstallPrompt />
            </>
          )}
        </AdProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
