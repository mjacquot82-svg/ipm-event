import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentInstallationFingerprint, getSubscribedInstallationId,
  getWonderPushClientReadiness } from './wonderPushService.web';
import { classifyDiagnosticFailure } from './notificationContextDiagnosticCore';

const CAPABILITY_KEY = '@ipm_itinerary_reminder_capability_v1';
const ENABLED_KEY = '@ipm_itinerary_reminders_enabled_v1';
const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export class ApiSyncError extends Error {
  constructor(public status: number) { super(`Itinerary reminder synchronization failed (${status}).`); }
}

export type ReadinessFailureStage = 'backend_registration_lookup'
  | 'backend_authoritative_verification' | 'provider_verification';

export class ItineraryReadinessError extends Error {
  constructor(public stage: ReadinessFailureStage, public classification: string,
    public client: Awaited<ReturnType<typeof getWonderPushClientReadiness>>,
    public registration: Record<string, unknown> | null = null,
    public registrationLookupCompleted = false) {
    super(`${stage}: ${classification}`);
  }
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

async function organizerRequest(path: string, body: unknown) {
  const response = await fetch(`${API_BASE_URL}/api/admin/itinerary-reminders/synthetic-one-shot/${path}`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
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

export async function getItineraryReminderReadiness({ verifyProvider = false } = {}) {
  const client = await getWonderPushClientReadiness();
  let existing = null;
  let registrationLookupFailure: string | null = null;
  let registrationLookupCompleted = false;
  try { existing = await statusByCapability(); registrationLookupCompleted = true; }
  catch (error) {
    registrationLookupFailure = classifyDiagnosticFailure(error);
  }
  if (!client.clientReady) {
    const currentFingerprint = client.installation === 'available'
      ? await getCurrentInstallationFingerprint().catch(() => null) : null;
    const currentInstallationMatch = existing?.registration_fingerprint && currentFingerprint
      ? (existing.registration_fingerprint === currentFingerprint ? 'match' : 'mismatch') : 'unavailable';
    const staleReason = currentInstallationMatch === 'mismatch' ? 'installation_mismatch'
      : client.subscription !== 'subscribed' ? 'wonderpush_subscription'
        : client.installation !== 'available' ? 'current_installation_unavailable'
          : 'current_installation_unverified';
    return { client, registration: existing, currentInstallationMatch, reminderReady: false,
      staleReason: existing?.registered ? staleReason : null,
      diagnosticFailure: registrationLookupFailure ? {
        stage: 'backend_registration_lookup', classification: registrationLookupFailure,
      } : null };
  }
  let current;
  try { current = await request('/status', 'GET'); }
  catch (error) {
    throw new ItineraryReadinessError('backend_authoritative_verification',
      classifyDiagnosticFailure(error), client, existing, registrationLookupCompleted);
  }
  const match = existing
    ? existing.registration_fingerprint === current.registration_fingerprint
    : true;
  let authoritative = current;
  if (verifyProvider && match) {
    try { authoritative = await request('/readiness/verify', 'POST'); }
    catch (error) {
      throw new ItineraryReadinessError('provider_verification', classifyDiagnosticFailure(error), client, current, true);
    }
  }
  const reminderReady = Boolean(match && (authoritative.final_reminder_ready
    ?? (authoritative.reminders_enabled && authoritative.provider_deliverable && authoritative.provider_fresh)));
  return { client, registration: { ...current, ...authoritative },
    currentInstallationMatch: match ? 'match' : 'mismatch', reminderReady,
    staleReason: match ? (reminderReady ? null : authoritative.recovery_reason || 'readiness_unconfirmed')
      : 'installation_mismatch' };
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

export async function configureItineraryReminderSync(starredScheduleIds: string[]) {
  const client = await getWonderPushClientReadiness();
  if (!client.clientReady) throw new Error('The current browser is not notification-ready.');
  await statusByCapability();
  // This is a deliberate attendee action. Registering is idempotent for a match and safely
  // replaces only this capability's stale installation association for a mismatch.
  await request('/register', 'POST');
  const readiness = await getItineraryReminderReadiness({ verifyProvider: true });
  if (readiness.currentInstallationMatch !== 'match') throw new Error('The current installation does not match its registration.');
  if (!readiness.registration?.provider_deliverable) throw new Error('The current installation is not provider-reachable.');
  const completeSet = [...new Set(starredScheduleIds)];
  await request('/enabled', 'PUT', { enabled: true });
  try {
    const synchronized = await request('/stars', 'PUT', { schedule_ids: completeSet });
    if (!synchronized.synced || Number(synchronized.starred_count) !== completeSet.length) {
      throw new Error('The complete itinerary could not be synchronized.');
    }
    await AsyncStorage.setItem(ENABLED_KEY, 'true');
  } catch (error) {
    await request('/enabled', 'PUT', { enabled: false }).catch(() => undefined);
    await AsyncStorage.setItem(ENABLED_KEY, 'false');
    throw error;
  }
  const finalReadiness = await getItineraryReminderReadiness({ verifyProvider: true });
  const synchronizedCount = Number(finalReadiness.registration?.synchronized_star_count
    ?? finalReadiness.registration?.starred_count ?? -1);
  if (!finalReadiness.reminderReady || synchronizedCount !== completeSet.length) {
    throw new Error('Final authoritative reminder readiness was not established.');
  }
  return finalReadiness;
}

export async function enableItineraryRemindersForTesting(starredScheduleIds: string[]) {
  return configureItineraryReminderSync(starredScheduleIds);
}

export async function disableItineraryReminderSync(): Promise<void> {
  await request('/enabled', 'PUT', { enabled: false });
  await AsyncStorage.setItem(ENABLED_KEY, 'false');
}

export async function disableItineraryRemindersForTesting() {
  await disableItineraryReminderSync();
  return getItineraryReminderReadiness();
}

export async function setSyntheticReminderFixtureStarred(starred: boolean, scenario: 't30' | 't30_retest_2' | 'late' = 't30') {
  return request('/synthetic-fixture', 'PUT', { starred, scenario });
}

export async function createOneShotSyntheticFixture() {
  return request('/synthetic-one-shot-fixture', 'POST');
}

export async function getOneShotSyntheticFixtureStatus(fixtureKey: string) {
  const response = await fetch(`${API_BASE_URL}/api/itinerary-reminders/synthetic-fixture-status?fixture_key=${encodeURIComponent(fixtureKey)}`);
  if (!response.ok) throw new ApiSyncError(response.status);
  return response.json();
}

export async function authorizeOneShotSyntheticFixture(fixtureKey: string) {
  return organizerRequest('authorize', { fixture_key: fixtureKey });
}

export async function runOneShotSyntheticFixture(fixtureKey: string) {
  return organizerRequest('run', { fixture_key: fixtureKey });
}

export async function reconcileItineraryReminderStars(starredScheduleIds: string[]): Promise<void> {
  if (await AsyncStorage.getItem(ENABLED_KEY) !== 'true') return;
  try {
    await request('/stars', 'PUT', { schedule_ids: [...new Set(starredScheduleIds)] });
  } catch {
    // Local favorites remain authoritative for UX; the next focus/toggle retries the full set.
  }
}
