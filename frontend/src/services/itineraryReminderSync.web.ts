import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSubscribedInstallationId } from './wonderPushService.web';

const CAPABILITY_KEY = '@ipm_itinerary_reminder_capability_v1';
const ENABLED_KEY = '@ipm_itinerary_reminders_enabled_v1';
const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export async function getOrCreateDeviceCapability(): Promise<string> {
  const stored = await AsyncStorage.getItem(CAPABILITY_KEY);
  if (stored) return stored;
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure random generation is unavailable.');
  const capability = base64Url(globalThis.crypto.getRandomValues(new Uint8Array(32)));
  await AsyncStorage.setItem(CAPABILITY_KEY, capability);
  return capability;
}

async function credentials(): Promise<{ installationId: string; capability: string } | null> {
  const installationId = await getSubscribedInstallationId();
  if (!installationId) return null;
  return { installationId, capability: await getOrCreateDeviceCapability() };
}

async function request(path: string, method: string, body?: unknown) {
  const auth = await credentials();
  if (!auth) throw new Error('A subscribed WonderPush installation is required.');
  const response = await fetch(`${API_BASE_URL}/api/itinerary-reminders${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-WonderPush-Installation-Id': auth.installationId,
      'X-Itinerary-Device-Capability': auth.capability,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Itinerary reminder synchronization failed (${response.status}).`);
  return response.json();
}

export async function configureItineraryReminderSync(starredScheduleIds: string[]): Promise<void> {
  const auth = await credentials();
  if (!auth) throw new Error('A subscribed WonderPush installation is required.');
  await request('/register', 'POST');
  await request('/enabled', 'PUT', { enabled: true });
  await AsyncStorage.setItem(ENABLED_KEY, 'true');
  await request('/stars', 'PUT', { schedule_ids: starredScheduleIds });
}

export async function disableItineraryReminderSync(): Promise<void> {
  await request('/enabled', 'PUT', { enabled: false });
  await AsyncStorage.setItem(ENABLED_KEY, 'false');
}

export async function reconcileItineraryReminderStars(starredScheduleIds: string[]): Promise<void> {
  if (await AsyncStorage.getItem(ENABLED_KEY) !== 'true') return;
  try {
    await request('/stars', 'PUT', { schedule_ids: [...new Set(starredScheduleIds)] });
  } catch {
    // Local favorites remain authoritative for UX; the next focus/toggle retries the full set.
  }
}
