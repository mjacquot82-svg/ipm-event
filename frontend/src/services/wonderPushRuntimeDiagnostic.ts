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
};

export function startWonderPushRuntimeObservation() {}

export function recordNotificationWorkflowDiagnostic(
  _state: 'IDLE' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'UNKNOWN',
  _classification: string | null = null,
) {}

export async function readWonderPushRuntimeDiagnostic(): Promise<WonderPushRuntimeDiagnostic> {
  return {
    sdkLoaded: 'NO', sdkReady: 'UNKNOWN', sessionRawState: 'UNKNOWN',
    sessionInterpretedState: 'UNKNOWN', observedAt: new Date().toISOString(),
    installationAvailable: 'UNKNOWN', subscribed: 'UNKNOWN',
    pushSubscriptionPresent: 'UNKNOWN', notificationPermission: 'unavailable',
    registrationWorkflowState: 'UNKNOWN', homeClassification: 'none', transitionHistory: [],
  };
}
