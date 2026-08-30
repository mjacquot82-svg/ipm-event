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
  };
}
