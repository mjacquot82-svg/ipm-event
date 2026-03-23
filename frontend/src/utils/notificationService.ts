// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const PUSH_TOKEN_KEY = '@ipm_push_token';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  // Check if running on a physical device
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push notification permission');
    return null;
  }

  // Get the Expo push token
  try {
    const pushToken = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID, // Set this in your .env if needed
    });
    token = pushToken.data;

    // Store token locally
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

    // Register token with backend
    await registerTokenWithBackend(token);
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }

  // Android-specific notification channel setup
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#A6262D',
    });

    await Notifications.setNotificationChannelAsync('event-updates', {
      name: 'Event Updates',
      description: 'Notifications about changes to your starred events',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#A6262D',
    });
  }

  return token;
}

async function registerTokenWithBackend(token: string): Promise<void> {
  try {
    const deviceId = Device.modelId || Device.deviceName || 'unknown';
    
    const response = await fetch(`${API_BASE_URL}/api/register-push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        push_token: token,
        device_id: deviceId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to register push token');
    }

    console.log('Push token registered with backend');
  } catch (error) {
    console.error('Error registering push token with backend:', error);
  }
}

export async function syncStarredEventsWithBackend(starredEventIds: string[]): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (!token) {
      console.log('No push token available, skipping sync');
      return;
    }

    const response = await fetch(`${API_BASE_URL}/api/update-starred-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        push_token: token,
        starred_event_ids: starredEventIds,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to sync starred events');
    }

    console.log('Starred events synced with backend');
  } catch (error) {
    console.error('Error syncing starred events:', error);
  }
}

export async function getStoredPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  } catch (error) {
    console.error('Error getting stored push token:', error);
    return null;
  }
}

// Add notification listeners
export function addNotificationListeners(
  onReceived: (notification: Notifications.Notification) => void,
  onResponse: (response: Notifications.NotificationResponse) => void
) {
  const receivedSubscription = Notifications.addNotificationReceivedListener(onReceived);
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(onResponse);

  return () => {
    Notifications.removeNotificationSubscription(receivedSubscription);
    Notifications.removeNotificationSubscription(responseSubscription);
  };
}

// Schedule a local notification (for testing)
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: null, // Immediate
  });
}
