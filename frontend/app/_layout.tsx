// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Alert, Platform } from 'react-native';
import colors from '../src/theme/colors';
import { 
  registerForPushNotificationsAsync, 
  addNotificationListeners 
} from '../src/utils/notificationService';

export default function RootLayout() {
  useEffect(() => {
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
        <StatusBar style="dark" backgroundColor={colors.background} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
