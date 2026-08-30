import {
  interpretWonderPushSessionState,
  safeWonderPushRawState,
  WonderPushSessionName,
} from './wonderPushRuntimeDiagnosticCore';
import type { WonderPushRuntimeDiagnostic } from './wonderPushRuntimeDiagnostic';

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
  });
}

export function recordNotificationWorkflowDiagnostic(
  state: WorkflowState,
  classification: string | null = null,
) {
  workflowState = state;
  homeClassification = classification || 'none';
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
  };
}
