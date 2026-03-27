// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Alert, Platform, View } from 'react-native';
import colors from '../src/theme/colors';
import { 
  registerForPushNotificationsAsync, 
  addNotificationListeners 
} from '../src/utils/notificationService';
import { AdProvider } from '../src/context/AdContext';
import PWAInstallPrompt from '../src/components/PWAInstallPrompt';
import SplashScreen from '../src/components/SplashScreen';

// Initialize Webpushr for web platform (active on all pages including Coming Soon)
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
    
    // Setup webpushr after script loads - default setup (looks for /webpushr-sw.js)
    script.onload = () => {
      // @ts-ignore
      window.webpushr('setup', {
        'key': 'BCIwNZy_j_9nCjf9Fln0Z8F-1gARSMEPFcQns5htCMaLsHL2FGKgtNxHmmhwxgM5nV8ovgoYigmSbdQ00IPYNzg'
      });
    };
  }
};

export default function RootLayout() {
  // Splash screen state
  const [showSplash, setShowSplash] = useState(true);
  
  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  useEffect(() => {
    // Initialize Webpushr for web platform
    initWebpushr();
    
    // Register for push notifications on app start
    const initNotifications = async () => {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        console.log('Push notification token:', token);
      }
    };

    initNotifications();

    // Set up notification listeners
    const cleanup = addNotificationListeners(
      (notification) => {
        // Handle notification received while app is in foreground
        console.log('Notification received:', notification);
      },
      (response) => {
        // Handle notification tapped
        console.log('Notification tapped:', response);
        const data = response.notification.request.content.data;
        // You can navigate to specific screens based on notification data here
        if (data?.eventId) {
          // Navigate to event details or schedule
          console.log('Should navigate to event:', data.eventId);
        }
      }
    );

    return cleanup;
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <AdProvider>
          <StatusBar style="dark" backgroundColor={colors.background} />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="coming-soon" options={{ headerShown: false }} />
            <Stack.Screen name="preview-2026" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
          
          {/* Splash Screen - Shows for 2 seconds on app launch */}
          {showSplash && (
            <SplashScreen 
              onFinish={handleSplashFinish} 
              duration={2000} 
            />
          )}
          
          {/* PWA Install Prompt - Shows on web only after splash */}
          {!showSplash && <PWAInstallPrompt />}
        </AdProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
