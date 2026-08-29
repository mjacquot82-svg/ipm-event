import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSubscribedInstallationId } from './wonderPushService.web';

const CAPABILITY_KEY = '@ipm_notification_capability_v1';
const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

async function capability(): Promise<string> {
  const stored = await AsyncStorage.getItem(CAPABILITY_KEY);
  if (stored) return stored;
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure random generation is unavailable.');
  const created = base64Url(globalThis.crypto.getRandomValues(new Uint8Array(32)));
  await AsyncStorage.setItem(CAPABILITY_KEY, created);
  return created;
}

async function request(path: string, method = 'GET', includeInstallation = true) {
  const deviceCapability = await capability();
  const installationId = includeInstallation ? await getSubscribedInstallationId() : null;
  if (includeInstallation && !installationId) throw new Error('A subscribed installation is required.');
  const response = await fetch(`${API_BASE_URL}/api/notification-registrations${path}`, {
    method,
    headers: {
      'X-Notification-Device-Capability': deviceCapability,
      ...(installationId ? { 'X-WonderPush-Installation-Id': installationId } : {}),
    },
  });
  if (!response.ok) {
    const error = new Error(`Notification registration failed (${response.status}).`);
    Object.assign(error, { status: response.status });
    throw error;
  }
  return response.json();
}

export async function ensureNotificationRegistration() {
  let existing = null;
  try {
    existing = await request('/status-by-capability', 'GET', false);
  } catch (error) {
    if ((error as { status?: number }).status !== 404) throw error;
  }
  // Preserve the staging-proven lifecycle: only a conclusive absence can create.
  if (!existing) await request('/register', 'POST');
  await request('/status');
  return request('/readiness/verify', 'POST');
}
