import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSubscribedInstallationId, getWonderPushClientReadiness } from './wonderPushService.web';

const CAPABILITY_KEY = '@ipm_itinerary_reminder_capability_v1';
const ENABLED_KEY = '@ipm_itinerary_reminders_enabled_v1';
const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

class ApiSyncError extends Error {
  constructor(public status: number) { super(`Itinerary reminder synchronization failed (${status}).`); }
}

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
  if (!response.ok) throw new ApiSyncError(response.status);
  return response.json();
}

async function statusByCapability() {
  const capability = await AsyncStorage.getItem(CAPABILITY_KEY);
  if (!capability) return null;
  const response = await fetch(`${API_BASE_URL}/api/itinerary-reminders/status-by-capability`, {
    headers: { 'X-Itinerary-Device-Capability': capability },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new ApiSyncError(response.status);
  return response.json();
}

export async function getItineraryReminderReadiness() {
  const client = await getWonderPushClientReadiness();
  const existing = await statusByCapability().catch(() => null);
  if (!client.clientReady) {
    return { client, registration: existing, currentInstallationMatch: 'unavailable', reminderReady: false,
      staleReason: existing?.registered ? 'current_installation_unavailable' : null };
  }
  const current = await request('/status', 'GET');
  const match = existing
    ? existing.registration_fingerprint === current.registration_fingerprint
    : true;
  return { client, registration: current, currentInstallationMatch: match ? 'match' : 'mismatch',
    reminderReady: Boolean(match && current.reminders_enabled && current.provider_deliverable),
    staleReason: match ? (current.provider_deliverable ? null : 'provider_unreachable') : 'installation_mismatch' };
}

export type TestDeviceLabel = 'A' | 'B';

export async function registerControlledTestDevice(label: TestDeviceLabel) {
  await request('/register', 'POST');
  return request('/test-device', 'PUT', { label });
}

export async function getControlledTestDeviceStatus() {
  return request('/test-device', 'GET');
}

export async function diagnoseControlledTestRegistration(label: TestDeviceLabel) {
  const wonderPush = await getWonderPushClientReadiness();
  const diagnostic = { ...wonderPush, capability: 'unavailable', registrationApi: 'not-attempted',
    labelApi: 'not-attempted', backendStatus: null as number | null, failureStage: wonderPush.failureStage };
  if (wonderPush.installation !== 'available') return diagnostic;
  try { await getOrCreateDeviceCapability(); diagnostic.capability = 'available'; }
  catch { diagnostic.failureStage = 'device_capability_storage'; return diagnostic; }
  try { await request('/register', 'POST'); diagnostic.registrationApi = 'success'; }
  catch (error) {
    diagnostic.registrationApi = 'failure'; diagnostic.failureStage = 'registration_api';
    diagnostic.backendStatus = error instanceof ApiSyncError ? error.status : null; return diagnostic;
  }
  try { await request('/test-device', 'PUT', { label }); diagnostic.labelApi = 'success'; diagnostic.failureStage = null; }
  catch (error) {
    diagnostic.labelApi = 'failure'; diagnostic.failureStage = 'test_device_label_api';
    diagnostic.backendStatus = error instanceof ApiSyncError ? error.status : null;
  }
  return diagnostic;
}

export async function configureItineraryReminderSync(starredScheduleIds: string[]): Promise<void> {
  const client = await getWonderPushClientReadiness();
  if (!client.clientReady) throw new Error('The current browser is not notification-ready.');
  const existing = await statusByCapability();
  if (!existing) await request('/register', 'POST');
  const readiness = await getItineraryReminderReadiness();
  if (readiness.currentInstallationMatch !== 'match') throw new Error('The current installation does not match its registration.');
  if (!readiness.registration?.provider_deliverable) throw new Error('The current installation is not provider-reachable.');
  const completeSet = [...new Set(starredScheduleIds)];
  await request('/enabled', 'PUT', { enabled: true });
  try {
    await request('/stars', 'PUT', { schedule_ids: completeSet });
    await AsyncStorage.setItem(ENABLED_KEY, 'true');
  } catch (error) {
    await request('/enabled', 'PUT', { enabled: false }).catch(() => undefined);
    await AsyncStorage.setItem(ENABLED_KEY, 'false');
    throw error;
  }
}

export async function enableItineraryRemindersForTesting(starredScheduleIds: string[]) {
  await configureItineraryReminderSync(starredScheduleIds);
  return getItineraryReminderReadiness();
}

export async function disableItineraryReminderSync(): Promise<void> {
  await request('/enabled', 'PUT', { enabled: false });
  await AsyncStorage.setItem(ENABLED_KEY, 'false');
}

export async function disableItineraryRemindersForTesting() {
  await disableItineraryReminderSync();
  return getItineraryReminderReadiness();
}

export async function setSyntheticReminderFixtureStarred(starred: boolean) {
  return request('/synthetic-fixture', 'PUT', { starred });
}

export async function reconcileItineraryReminderStars(starredScheduleIds: string[]): Promise<void> {
  if (await AsyncStorage.getItem(ENABLED_KEY) !== 'true') return;
  try {
    await request('/stars', 'PUT', { schedule_ids: [...new Set(starredScheduleIds)] });
  } catch {
    // Local favorites remain authoritative for UX; the next focus/toggle retries the full set.
  }
}
