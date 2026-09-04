export type WonderPushRuntimeDiagnostic = {
  sdkLoaded: 'YES' | 'NO';
  sdkReady: 'YES' | 'NO' | 'UNKNOWN';
  sessionRawState: string;
  sessionInterpretedState: string;
  observedAt: string;
  installationAvailable: 'YES' | 'NO' | 'UNKNOWN';
  subscribed: 'YES' | 'NO' | 'UNKNOWN';
  pushSubscriptionPresent: 'YES' | 'NO' | 'UNKNOWN';
  notificationPermission: 'granted' | 'denied' | 'default' | 'unavailable';
  registrationWorkflowState: 'IDLE' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'UNKNOWN';
  homeClassification: string;
  transitionHistory: { observedAt: string; rawState: string; interpretedState: string }[];
  registrationWorkflow: NotificationRegistrationWorkflowDiagnostic;
  sdkLoader: 'SUCCESS' | 'FAILURE' | 'PENDING' | 'UNSTARTED';
  sessionApiAvailable: boolean;
  initializationStage: 'support_check' | 'configuration_check' | 'worker_ready'
    | 'sdk_loader' | 'sdk_readiness' | 'complete' | 'unknown';
  initializationTimedOut: boolean;
  sdkErrorName: string | null;
  serviceWorkerControlled: boolean;
  serviceWorkerScript: 'WONDERPUSH_ROOT' | 'OTHER' | 'NONE';
  serviceWorkerVersion: string;
  initFailureClassification: import('./wonderPushRuntimeDiagnosticCore').WonderPushInitFailureClassification;
  authenticationRequestAttempted: boolean;
  authenticationHttpStatus: number | null;
  authenticationHttpStatusClass: 'NONE' | 'NETWORK' | '2XX' | '4XX' | '5XX' | 'OTHER';
  indexedDbAvailable: boolean;
  initFailureErrorName: string | null;
  authenticationNetworkClassification: import('./wonderPushRuntimeDiagnosticCore').WonderPushAuthNetworkClassification;
  authenticationXhrTerminalEvent: import('./wonderPushRuntimeDiagnosticCore').WonderPushAuthTerminalEvent;
  authenticationOnlineAtStart: boolean | null;
  authenticationOnlineAtTerminal: boolean | null;
  authenticationOfflineDuringRequest: boolean;
  authenticationCspConnectBlocked: boolean;
  authenticationResourceTimingPresent: boolean;
  authenticationDnsPhaseObserved: boolean;
  authenticationConnectPhaseObserved: boolean;
  authenticationTlsPhaseObserved: boolean;
};

export type NotificationRegistrationDiagnosticStage =
  | 'capability' | 'status_by_capability' | 'register' | 'status'
  | 'readiness_verify' | 'final_validation' | 'complete' | 'none';
export type NotificationRegistrationDiagnosticOutcome =
  | 'pending' | 'success' | 'failure' | 'timeout' | 'network_failure'
  | 'malformed_response' | 'none';
export type NotificationRegistrationWorkflowDiagnostic = {
  currentStage: NotificationRegistrationDiagnosticStage;
  attemptNumber: 1 | 2 | 3 | null;
  stageStartedAt: string | null;
  stageCompletedAt: string | null;
  lastHttpStatus: number | null;
  lastOperationOutcome: NotificationRegistrationDiagnosticOutcome;
  lastCompletedStage: NotificationRegistrationDiagnosticStage;
  elapsedTimeMs: number | null;
  headersReceivedAt: string | null;
  responseParseStartedAt: string | null;
  responseParseCompletedAt: string | null;
};

export function startWonderPushRuntimeObservation() {}
export function startWonderPushInitFailureObservation(_enabled: boolean) {}
export function recordWonderPushInitializationStage(
  _stage: WonderPushRuntimeDiagnostic['initializationStage'],
) {}
export function recordWonderPushLoaderResult(_result: 'SUCCESS' | 'FAILURE') {}
export function recordWonderPushInitializationFailure(_error: unknown) {}

export function recordNotificationWorkflowDiagnostic(
  _state: 'IDLE' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'UNKNOWN',
  _classification: string | null = null,
) {}

export function beginNotificationRegistrationStage(
  _stage: NotificationRegistrationDiagnosticStage,
  _attemptNumber: 1 | 2 | 3,
) {}
export function recordNotificationRegistrationHeaders(_status: number) {}
export function recordNotificationRegistrationParseStarted() {}
export function recordNotificationRegistrationParseCompleted() {}
export function completeNotificationRegistrationStage() {}
export function failNotificationRegistrationStage(_outcome: NotificationRegistrationDiagnosticOutcome) {}

export async function readWonderPushRuntimeDiagnostic(): Promise<WonderPushRuntimeDiagnostic> {
  return {
    sdkLoaded: 'NO', sdkReady: 'UNKNOWN', sessionRawState: 'UNKNOWN',
    sessionInterpretedState: 'UNKNOWN', observedAt: new Date().toISOString(),
    installationAvailable: 'UNKNOWN', subscribed: 'UNKNOWN',
    pushSubscriptionPresent: 'UNKNOWN', notificationPermission: 'unavailable',
    registrationWorkflowState: 'UNKNOWN', homeClassification: 'none', transitionHistory: [],
    registrationWorkflow: {
      currentStage: 'none', attemptNumber: null, stageStartedAt: null, stageCompletedAt: null,
      lastHttpStatus: null, lastOperationOutcome: 'none', lastCompletedStage: 'none',
      elapsedTimeMs: null, headersReceivedAt: null, responseParseStartedAt: null,
      responseParseCompletedAt: null,
    },
    sdkLoader: 'UNSTARTED', sessionApiAvailable: false, initializationStage: 'unknown',
    initializationTimedOut: false, sdkErrorName: null, serviceWorkerControlled: false,
    serviceWorkerScript: 'NONE', serviceWorkerVersion: 'unknown',
    initFailureClassification: 'NONE', authenticationRequestAttempted: false,
    authenticationHttpStatus: null, authenticationHttpStatusClass: 'NONE',
    indexedDbAvailable: false, initFailureErrorName: null,
    authenticationNetworkClassification: 'NONE', authenticationXhrTerminalEvent: 'NONE',
    authenticationOnlineAtStart: null, authenticationOnlineAtTerminal: null,
    authenticationOfflineDuringRequest: false, authenticationCspConnectBlocked: false,
    authenticationResourceTimingPresent: false, authenticationDnsPhaseObserved: false,
    authenticationConnectPhaseObserved: false, authenticationTlsPhaseObserved: false,
  };
}
