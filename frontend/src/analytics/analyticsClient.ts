import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
import {
  ANALYTICS_MAX_BATCH_EVENTS,
  AnalyticsRequestBuffer,
  AnalyticsRuntimeSessionStart,
  ResilientAnalyticsStorage,
  AnalyticsSessionRecovery,
  clearSession,
  generateAnalyticsUuid,
  getOrCreateSession,
  getOrCreateVisitorId,
  isAttendeeAnalyticsPath,
  shouldInitializeAttendeeAnalytics,
  takeAnalyticsBatch,
} from './analyticsCore';
import { recordAnalyticsDiagnostic } from './analyticsDiagnostics';

export type AnalyticsValue = string | number | boolean | null;
export type AnalyticsProperties = Record<string, AnalyticsValue>;

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const HEARTBEAT_MS = 60_000;
const EVENT_FLUSH_MS = 2_000;
const analyticsStorage = new ResilientAnalyticsStorage(AsyncStorage, recordAnalyticsDiagnostic);
const sessionRecovery = new AnalyticsSessionRecovery();
const runtimeSessionStart = new AnalyticsRuntimeSessionStart();
const transport = new AnalyticsRequestBuffer(
  analyticsStorage, fetch, API_BASE_URL, __DEV__,
  (rejectedSessionId) => recoverInvalidSession(rejectedSessionId),
  recordAnalyticsDiagnostic,
);

let visitorId: string | null = null;
let sessionId: string | null = null;
let routePath = '/';
let initialized = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingEvents: { clientEventId: string; eventName: string; properties: AnalyticsProperties; occurredAt: string }[] = [];
let previousPage: string | null = null;
let ensureSessionPromise: Promise<boolean> | null = null;
let invalidSessionRecoveryPromise: Promise<void> | null = null;

async function recoverInvalidSession(rejectedSessionId: string): Promise<void> {
  if (rejectedSessionId !== sessionId) return;
  if (invalidSessionRecoveryPromise) return invalidSessionRecoveryPromise;
  const recovery = sessionRecovery.run(async () => {
    if (rejectedSessionId !== sessionId) return;
    stopHeartbeat();
    sessionId = null;
    pendingEvents = [];
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    try { await clearSession(analyticsStorage); } catch { /* recovery remains best-effort and non-blocking */ }
    runtimeSessionStart.reset();
    await createOrResumeSession();
    startHeartbeat();
    void transport.flush();
  });
  invalidSessionRecoveryPromise = recovery.finally(() => {
    invalidSessionRecoveryPromise = null;
  });
  await invalidSessionRecoveryPromise;
}

export function detectInstalledPwa(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches || navigatorWithStandalone.standalone || document.referrer.startsWith('android-app://'));
}

export function getLaunchMode(): 'browser' | 'installed_pwa' | 'native' {
  if (Platform.OS !== 'web') return 'native';
  return detectInstalledPwa() ? 'installed_pwa' : 'browser';
}

function lifecycleBody(clientEventId: string) {
  return {
    visitorId, sessionId, clientEventId,
    occurredAt: new Date().toISOString(), launchMode: getLaunchMode(),
    appVersion: Constants.expoConfig?.version ?? 'unknown',
  };
}

async function createOrResumeSession(): Promise<boolean> {
  if (!API_BASE_URL) {
    recordAnalyticsDiagnostic('initializer_skipped_unconfigured');
    return false;
  }
  if (!shouldInitializeAttendeeAnalytics(routePath, API_BASE_URL)) return false;
  try {
    visitorId = await getOrCreateVisitorId(analyticsStorage);
    const result = await getOrCreateSession(analyticsStorage, Date.now());
    sessionId = result.session.id;
    if (runtimeSessionStart.claim()) {
      await transport.sendOrBuffer({ endpoint: '/api/activity/session/start', body: lifecycleBody(generateAnalyticsUuid()) });
    }
    if (result.created) {
      appendPendingEvent('app_launched', {
        launch_mode: getLaunchMode(), app_version: Constants.expoConfig?.version ?? 'unknown',
      });
    }
    return true;
  } catch (error) {
    recordAnalyticsDiagnostic('initialization_failed');
    if (__DEV__) console.debug('[Analytics] Session unavailable', error);
    return false;
  }
}

async function ensureSession(): Promise<boolean> {
  if (invalidSessionRecoveryPromise) {
    await invalidSessionRecoveryPromise;
    return Boolean(visitorId && sessionId);
  }
  if (ensureSessionPromise) return ensureSessionPromise;
  ensureSessionPromise = createOrResumeSession();
  try {
    return await ensureSessionPromise;
  } finally {
    ensureSessionPromise = null;
  }
}

async function heartbeat(): Promise<void> {
  if (!(await ensureSession()) || !visitorId || !sessionId) return;
  await transport.sendOrBuffer({ endpoint: '/api/activity/session/heartbeat', body: lifecycleBody(generateAnalyticsUuid()) });
  void transport.flush();
}

function startHeartbeat(): void {
  if (heartbeatTimer || !isAttendeeAnalyticsPath(routePath)) return;
  heartbeatTimer = setInterval(() => void heartbeat(), HEARTBEAT_MS);
}

function stopHeartbeat(): void {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

export async function initializeAttendeeAnalytics(pathname: string): Promise<void> {
  routePath = pathname;
  if (!isAttendeeAnalyticsPath(pathname)) {
    recordAnalyticsDiagnostic('initializer_skipped_excluded');
    return;
  }
  recordAnalyticsDiagnostic('initializer_invoked');
  if (!initialized) {
    initialized = true;
    AppState.addEventListener('change', (state) => {
      if (state === 'active' && isAttendeeAnalyticsPath(routePath)) {
        void ensureSession().then(() => transport.flush());
        startHeartbeat();
      } else {
        stopHeartbeat();
        void flushAnalyticsEvents();
      }
    });
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => void endAttendeeSession('pagehide'));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void ensureSession();
        else void flushAnalyticsEvents();
      });
    }
  }
  await ensureSession();
  startHeartbeat();
  void transport.flush();
}

export async function setAnalyticsRoute(pathname: string): Promise<void> {
  routePath = pathname;
  if (!isAttendeeAnalyticsPath(pathname)) {
    recordAnalyticsDiagnostic('initializer_skipped_excluded');
    stopHeartbeat();
    await flushAnalyticsEvents();
    return;
  }
  await initializeAttendeeAnalytics(pathname);
}

export async function endAttendeeSession(reason: 'pagehide' | 'background' | 'explicit' = 'explicit'): Promise<void> {
  stopHeartbeat();
  await flushAnalyticsEvents();
  if (visitorId && sessionId && isAttendeeAnalyticsPath(routePath)) {
    await transport.sendOrBuffer({ endpoint: '/api/activity/session/end', body: { ...lifecycleBody(generateAnalyticsUuid()), reason } });
  }
  sessionId = null;
  try { await clearSession(analyticsStorage); } catch { /* analytics must remain non-blocking */ }
  runtimeSessionStart.reset();
}

export async function queueAnalyticsEvent(eventName: string, properties: AnalyticsProperties = {}): Promise<void> {
  if (!(await ensureSession()) || !visitorId || !sessionId) return;
  appendPendingEvent(eventName, properties);
}

function appendPendingEvent(eventName: string, properties: AnalyticsProperties): void {
  pendingEvents.push({ clientEventId: generateAnalyticsUuid(), eventName, properties, occurredAt: new Date().toISOString() });
  if (pendingEvents.length >= ANALYTICS_MAX_BATCH_EVENTS) {
    void flushAnalyticsEvents();
  } else if (!flushTimer) {
    flushTimer = setTimeout(() => void flushAnalyticsEvents(), EVENT_FLUSH_MS);
  }
}

export async function flushAnalyticsEvents(): Promise<void> {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  if (!visitorId || !sessionId || pendingEvents.length === 0) return;
  const events = takeAnalyticsBatch(pendingEvents);
  await transport.sendOrBuffer({ endpoint: '/api/activity/events', body: { visitorId, sessionId, events } });
  if (pendingEvents.length > 0) await flushAnalyticsEvents();
}

export function pageNavigationProperties(pageId: string, source?: string): AnalyticsProperties {
  const properties: AnalyticsProperties = { page_id: pageId };
  if (source) properties.source = source;
  if (previousPage && previousPage !== pageId) properties.previous_page_id = previousPage;
  previousPage = pageId;
  return properties;
}

export function resetAnalyticsForTests(): void {
  stopHeartbeat();
  runtimeSessionStart.reset();
  visitorId = null; sessionId = null; initialized = false; pendingEvents = []; previousPage = null; routePath = '/'; ensureSessionPromise = null; invalidSessionRecoveryPromise = null;
}
