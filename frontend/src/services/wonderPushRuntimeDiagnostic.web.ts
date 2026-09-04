import {
  classifyWonderPushAuthNetworkFailure,
  classifyWonderPushAuthenticationResult,
  interpretWonderPushSessionState,
  safeWonderPushRawState,
  WonderPushSessionName,
} from './wonderPushRuntimeDiagnosticCore';
import type {
  NotificationRegistrationDiagnosticOutcome,
  NotificationRegistrationDiagnosticStage,
  NotificationRegistrationWorkflowDiagnostic,
  WonderPushRuntimeDiagnostic,
} from './wonderPushRuntimeDiagnostic';

type DiagnosticSdk = unknown[] & {
  getSessionState?: () => unknown;
  SessionState?: Record<string, unknown>;
  getInstallationId?: () => Promise<string | null>;
  isSubscribedToNotifications?: () => Promise<boolean>;
};

type WorkflowState = 'IDLE' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'UNKNOWN';
type Transition = { observedAt: string; rawState: string; interpretedState: WonderPushSessionName };

const MAX_TRANSITIONS = 10;
const transitions: Transition[] = [];
let observerStarted = false;
let workflowState: WorkflowState = 'UNKNOWN';
let homeClassification = 'none';
let sdkLoader: WonderPushRuntimeDiagnostic['sdkLoader'] = 'UNSTARTED';
let initializationStage: WonderPushRuntimeDiagnostic['initializationStage'] = 'unknown';
let initializationTimedOut = false;
let sdkErrorName: string | null = null;
let initFailureClassification: WonderPushRuntimeDiagnostic['initFailureClassification'] = 'NONE';
let authenticationRequestAttempted = false;
let authenticationHttpStatus: number | null = null;
let authenticationResponseWasComplete = false;
let initFailureErrorName: string | null = null;
let initFailureObserverStarted = false;
let activeAuthenticationRequests = 0;
let authenticationNetworkClassification: WonderPushRuntimeDiagnostic['authenticationNetworkClassification'] = 'NONE';
let authenticationXhrTerminalEvent: WonderPushRuntimeDiagnostic['authenticationXhrTerminalEvent'] = 'NONE';
let authenticationOnlineAtStart: boolean | null = null;
let authenticationOnlineAtTerminal: boolean | null = null;
let authenticationOfflineDuringRequest = false;
let authenticationCspConnectBlocked = false;
let authenticationResourceTimingPresent = false;
let authenticationDnsPhaseObserved = false;
let authenticationConnectPhaseObserved = false;
let authenticationTlsPhaseObserved = false;
let authenticationResourceEntryCountAtStart = 0;
let registrationWorkflow: NotificationRegistrationWorkflowDiagnostic = {
  currentStage: 'none', attemptNumber: null, stageStartedAt: null, stageCompletedAt: null,
  lastHttpStatus: null, lastOperationOutcome: 'none', lastCompletedStage: 'none',
  elapsedTimeMs: null, headersReceivedAt: null, responseParseStartedAt: null,
  responseParseCompletedAt: null,
};

function appendTransition(rawState: unknown, sessionStates?: Record<string, unknown>) {
  const transition = {
    observedAt: new Date().toISOString(),
    rawState: safeWonderPushRawState(rawState),
    interpretedState: interpretWonderPushSessionState(rawState, sessionStates),
  };
  const previous = transitions.at(-1);
  if (previous?.rawState === transition.rawState
    && previous.interpretedState === transition.interpretedState) return;
  transitions.push(transition);
  if (transitions.length > MAX_TRANSITIONS) transitions.splice(0, transitions.length - MAX_TRANSITIONS);
}

function safeErrorName(value: unknown): string | null {
  const name = value instanceof Error ? value.name : null;
  return name && /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(name) ? name : null;
}

function classifyStorageFailure(value: unknown) {
  if (!authenticationRequestAttempted || initFailureClassification !== 'NONE') return;
  const error = value instanceof Error ? value : null;
  const safeText = `${error?.name || ''} ${error?.message || ''}`;
  if (!/(indexeddb|idb|database|storage|transaction|quota)/i.test(safeText)) return;
  initFailureErrorName = safeErrorName(value);
  initFailureClassification = typeof indexedDB === 'undefined'
    ? 'INDEXEDDB_UNAVAILABLE'
    : /(write|put|commit|quota)/i.test(safeText) ? 'STORAGE_WRITE_FAILURE' : 'STORAGE_READ_FAILURE';
}

function httpStatusClass(status: number): WonderPushRuntimeDiagnostic['authenticationHttpStatusClass'] {
  if (status === 0) return 'NETWORK';
  if (status >= 200 && status < 300) return '2XX';
  if (status >= 400 && status < 500) return '4XX';
  if (status >= 500) return '5XX';
  return 'OTHER';
}

function isAuthenticationTarget(value: string): boolean {
  try {
    const target = new URL(value, window.location.href);
    return target.hostname.endsWith('.wonderpush.com')
      && target.pathname.endsWith('/authentication/accessToken');
  } catch {
    return false;
  }
}

function authenticationResourceEntries(): PerformanceResourceTiming[] {
  if (typeof performance?.getEntriesByType !== 'function') return [];
  return performance.getEntriesByType('resource').filter((candidate) =>
    isAuthenticationTarget(candidate.name)) as PerformanceResourceTiming[];
}

function observeAuthenticationResourceTiming() {
  authenticationResourceTimingPresent = false;
  authenticationDnsPhaseObserved = false;
  authenticationConnectPhaseObserved = false;
  authenticationTlsPhaseObserved = false;
  const entry = authenticationResourceEntries().slice(authenticationResourceEntryCountAtStart).at(-1);
  if (!entry) return;
  authenticationResourceTimingPresent = true;
  authenticationDnsPhaseObserved = entry.domainLookupEnd > entry.domainLookupStart;
  authenticationConnectPhaseObserved = entry.connectEnd > entry.connectStart;
  authenticationTlsPhaseObserved = entry.secureConnectionStart > 0
    && entry.connectEnd > entry.secureConnectionStart;
}

export function startWonderPushInitFailureObservation(enabled: boolean) {
  if (!enabled || initFailureObserverStarted || typeof XMLHttpRequest === 'undefined') return;
  initFailureObserverStarted = true;
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function diagnosticOpen(
    method: string,
    url: string,
    asyncFlag: boolean = true,
    username?: string | null,
    password?: string | null,
  ) {
    let observesAuthentication = false;
    try {
      observesAuthentication = method.toUpperCase() === 'POST'
        && isAuthenticationTarget(String(url));
    } catch {
      // Malformed and non-WonderPush URLs are passed through untouched.
    }
    if (observesAuthentication) {
      authenticationRequestAttempted = true;
      activeAuthenticationRequests += 1;
      authenticationXhrTerminalEvent = 'NONE';
      authenticationOnlineAtStart = navigator.onLine;
      authenticationOnlineAtTerminal = null;
      authenticationOfflineDuringRequest = false;
      authenticationCspConnectBlocked = false;
      authenticationNetworkClassification = 'NONE';
      authenticationResourceEntryCountAtStart = authenticationResourceEntries().length;
      const recordTerminalEvent = (value: WonderPushRuntimeDiagnostic['authenticationXhrTerminalEvent']) => {
        authenticationXhrTerminalEvent = value;
      };
      this.addEventListener('error', () => recordTerminalEvent('ERROR'), { once: true });
      this.addEventListener('abort', () => recordTerminalEvent('ABORT'), { once: true });
      this.addEventListener('timeout', () => recordTerminalEvent('TIMEOUT'), { once: true });
      this.addEventListener('load', () => recordTerminalEvent('LOAD'), { once: true });
      this.addEventListener('loadend', () => {
        activeAuthenticationRequests = Math.max(0, activeAuthenticationRequests - 1);
        authenticationOnlineAtTerminal = navigator.onLine;
        observeAuthenticationResourceTiming();
        authenticationHttpStatus = Number.isInteger(this.status) ? this.status : null;
        let validJson = false;
        let tokenPresent = false;
        let installationIdPresent = false;
        if (this.status >= 200 && this.status < 300) {
          try {
            const payload = JSON.parse(this.responseText) as {
              token?: unknown;
              data?: { installationId?: unknown };
            };
            validJson = Boolean(payload && typeof payload === 'object');
            tokenPresent = typeof payload.token === 'string' && payload.token.length > 0;
            installationIdPresent = typeof payload.data?.installationId === 'string'
              && payload.data.installationId.length > 0;
          } catch {
            // Only the parse outcome is retained; response content is discarded.
          }
        }
        initFailureClassification = classifyWonderPushAuthenticationResult({
          status: this.status, validJson, tokenPresent, installationIdPresent,
        });
        authenticationResponseWasComplete = initFailureClassification === 'NONE';
        authenticationNetworkClassification = classifyWonderPushAuthNetworkFailure({
          status: authenticationHttpStatus,
          terminalEvent: authenticationXhrTerminalEvent,
          onlineAtStart: authenticationOnlineAtStart,
          onlineAtTerminal: authenticationOnlineAtTerminal,
          offlineDuringRequest: authenticationOfflineDuringRequest,
          cspConnectBlocked: authenticationCspConnectBlocked,
          resourceTimingPresent: authenticationResourceTimingPresent,
        });
      }, { once: true });
    }
    if (arguments.length >= 5) return originalOpen.call(this, method, url, asyncFlag, username, password);
    if (arguments.length === 4) return originalOpen.call(this, method, url, asyncFlag, username);
    return originalOpen.call(this, method, url, asyncFlag);
  };
  window.addEventListener('error', (event) => classifyStorageFailure(event.error));
  window.addEventListener('unhandledrejection', (event) => classifyStorageFailure(event.reason));
  window.addEventListener('offline', () => {
    if (activeAuthenticationRequests > 0) authenticationOfflineDuringRequest = true;
  });
  window.addEventListener('securitypolicyviolation', (event) => {
    if (activeAuthenticationRequests < 1 || event.effectiveDirective !== 'connect-src') return;
    if (isAuthenticationTarget(event.blockedURI)) authenticationCspConnectBlocked = true;
  });
}

export function startWonderPushRuntimeObservation() {
  if (observerStarted || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  observerStarted = true;
  window.addEventListener('WonderPushEvent', (event: Event) => {
    const detail = (event as CustomEvent<{
      name?: string;
      state?: unknown;
      WonderPushSDK?: { SessionState?: Record<string, unknown> };
    }>).detail;
    if (detail?.name !== 'session') return;
    const sdk = (window as Window & { WonderPush?: DiagnosticSdk }).WonderPush;
    appendTransition(detail.state, detail.WonderPushSDK?.SessionState || sdk?.SessionState);
    if (interpretWonderPushSessionState(detail.state,
      detail.WonderPushSDK?.SessionState || sdk?.SessionState) === 'INIT_FAILED') {
      if (authenticationResponseWasComplete && initFailureClassification === 'NONE') {
        initFailureClassification = 'SESSION_PERSIST_FAILURE';
      } else if (initFailureClassification === 'NONE') {
        initFailureClassification = typeof indexedDB === 'undefined'
          ? 'INDEXEDDB_UNAVAILABLE' : 'UNKNOWN_INIT_FAILURE';
      }
    }
  });
}

export function recordWonderPushInitializationStage(
  stage: WonderPushRuntimeDiagnostic['initializationStage'],
) {
  initializationStage = stage;
  if (stage === 'sdk_loader' && sdkLoader === 'UNSTARTED') sdkLoader = 'PENDING';
}

export function recordWonderPushLoaderResult(result: 'SUCCESS' | 'FAILURE') {
  sdkLoader = result;
}

export function recordWonderPushInitializationFailure(error: unknown) {
  initializationTimedOut = error instanceof Error && /timed out/i.test(error.message);
  const name = error instanceof Error ? error.name : null;
  sdkErrorName = name && /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(name) ? name : null;
}

export function recordNotificationWorkflowDiagnostic(
  state: WorkflowState,
  classification: string | null = null,
) {
  workflowState = state;
  homeClassification = classification || 'none';
}

export function beginNotificationRegistrationStage(
  stage: NotificationRegistrationDiagnosticStage,
  attemptNumber: 1 | 2 | 3,
) {
  const preserveLastHttpObservation = stage === 'final_validation' || stage === 'complete';
  registrationWorkflow = {
    ...registrationWorkflow,
    currentStage: stage,
    attemptNumber,
    stageStartedAt: new Date().toISOString(),
    stageCompletedAt: null,
    lastHttpStatus: preserveLastHttpObservation ? registrationWorkflow.lastHttpStatus : null,
    lastOperationOutcome: 'pending',
    elapsedTimeMs: 0,
    headersReceivedAt: preserveLastHttpObservation ? registrationWorkflow.headersReceivedAt : null,
    responseParseStartedAt: preserveLastHttpObservation
      ? registrationWorkflow.responseParseStartedAt : null,
    responseParseCompletedAt: preserveLastHttpObservation
      ? registrationWorkflow.responseParseCompletedAt : null,
  };
}

export function recordNotificationRegistrationHeaders(status: number) {
  registrationWorkflow = {
    ...registrationWorkflow,
    lastHttpStatus: Number.isInteger(status) ? status : null,
    headersReceivedAt: new Date().toISOString(),
  };
}

export function recordNotificationRegistrationParseStarted() {
  registrationWorkflow = { ...registrationWorkflow, responseParseStartedAt: new Date().toISOString() };
}

export function recordNotificationRegistrationParseCompleted() {
  registrationWorkflow = { ...registrationWorkflow, responseParseCompletedAt: new Date().toISOString() };
}

export function completeNotificationRegistrationStage() {
  registrationWorkflow = {
    ...registrationWorkflow,
    stageCompletedAt: new Date().toISOString(),
    lastOperationOutcome: 'success',
    lastCompletedStage: registrationWorkflow.currentStage,
  };
}

export function failNotificationRegistrationStage(outcome: NotificationRegistrationDiagnosticOutcome) {
  registrationWorkflow = {
    ...registrationWorkflow,
    stageCompletedAt: new Date().toISOString(),
    lastOperationOutcome: outcome,
  };
}

function yesNoUnknown(result: PromiseSettledResult<unknown>): 'YES' | 'NO' | 'UNKNOWN' {
  if (result.status !== 'fulfilled') return 'UNKNOWN';
  return result.value ? 'YES' : 'NO';
}

export async function readWonderPushRuntimeDiagnostic(): Promise<WonderPushRuntimeDiagnostic> {
  startWonderPushRuntimeObservation();
  const observedAt = new Date().toISOString();
  const sdk = (window as Window & { WonderPush?: DiagnosticSdk }).WonderPush;
  const sdkLoaded = Boolean(sdk?.getSessionState || sdk?.getInstallationId
    || sdk?.isSubscribedToNotifications);
  const rawState = sdk?.getSessionState?.();
  const interpretedState = interpretWonderPushSessionState(rawState, sdk?.SessionState);
  if (sdk?.getSessionState) appendTransition(rawState, sdk.SessionState);

  const installation = sdk?.getInstallationId
    ? await Promise.allSettled([sdk.getInstallationId()]).then(([result]) => result)
    : { status: 'rejected', reason: null } as PromiseRejectedResult;
  const subscription = sdk?.isSubscribedToNotifications
    ? await Promise.allSettled([sdk.isSubscribedToNotifications()]).then(([result]) => result)
    : { status: 'rejected', reason: null } as PromiseRejectedResult;
  let pushSubscription: PromiseSettledResult<PushSubscription | null> = {
    status: 'rejected', reason: null,
  };
  try {
    const registration = await navigator.serviceWorker?.getRegistration('/');
    if (registration?.pushManager) {
      [pushSubscription] = await Promise.allSettled([registration.pushManager.getSubscription()]);
    }
  } catch {
    // UNKNOWN is the safe read-only result when browser state cannot be inspected.
  }
  const controller = navigator.serviceWorker?.controller;
  let serviceWorkerScript: WonderPushRuntimeDiagnostic['serviceWorkerScript'] = 'NONE';
  if (controller?.scriptURL) {
    try {
      serviceWorkerScript = new URL(controller.scriptURL).pathname === '/webpushr-sw.js'
        ? 'WONDERPUSH_ROOT' : 'OTHER';
    } catch {
      serviceWorkerScript = 'OTHER';
    }
  }

  return {
    sdkLoaded: sdkLoaded ? 'YES' : 'NO',
    sdkReady: interpretedState === 'INIT_SUCCESS' ? 'YES'
      : interpretedState === 'UNKNOWN' ? 'UNKNOWN' : 'NO',
    sessionRawState: safeWonderPushRawState(rawState),
    sessionInterpretedState: interpretedState,
    observedAt,
    installationAvailable: installation.status === 'fulfilled'
      ? installation.value ? 'YES' : 'NO' : 'UNKNOWN',
    subscribed: yesNoUnknown(subscription),
    pushSubscriptionPresent: yesNoUnknown(pushSubscription),
    notificationPermission: typeof Notification === 'undefined'
      ? 'unavailable' : Notification.permission,
    registrationWorkflowState: workflowState,
    homeClassification,
    transitionHistory: [...transitions],
    registrationWorkflow: {
      ...registrationWorkflow,
      elapsedTimeMs: registrationWorkflow.stageStartedAt && !registrationWorkflow.stageCompletedAt
        ? Math.max(0, Date.now() - Date.parse(registrationWorkflow.stageStartedAt))
        : registrationWorkflow.stageStartedAt && registrationWorkflow.stageCompletedAt
        ? Math.max(0, Date.parse(registrationWorkflow.stageCompletedAt)
          - Date.parse(registrationWorkflow.stageStartedAt))
        : null,
    },
    sdkLoader,
    sessionApiAvailable: typeof sdk?.getSessionState === 'function',
    initializationStage,
    initializationTimedOut,
    sdkErrorName,
    serviceWorkerControlled: Boolean(controller),
    serviceWorkerScript,
    serviceWorkerVersion: process.env.EXPO_PUBLIC_IPM_BUILD_NUMBER || 'unknown',
    initFailureClassification,
    authenticationRequestAttempted,
    authenticationHttpStatus,
    authenticationHttpStatusClass: authenticationHttpStatus === null
      ? 'NONE' : httpStatusClass(authenticationHttpStatus),
    indexedDbAvailable: typeof indexedDB !== 'undefined',
    initFailureErrorName,
    authenticationNetworkClassification,
    authenticationXhrTerminalEvent,
    authenticationOnlineAtStart,
    authenticationOnlineAtTerminal,
    authenticationOfflineDuringRequest,
    authenticationCspConnectBlocked,
    authenticationResourceTimingPresent,
    authenticationDnsPhaseObserved,
    authenticationConnectPhaseObserved,
    authenticationTlsPhaseObserved,
  };
}
