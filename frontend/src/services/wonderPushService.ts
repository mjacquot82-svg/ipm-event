export type NotificationState =
  | 'loading'
  | 'default'
  | 'subscribed'
  | 'unsubscribed'
  | 'denied'
  | 'unsupported'
  | 'error';

export type WonderPushDiagnostics = {
  permission: 'unsupported';
  sdkSubscribed: null;
  installationId: null;
  workerScopePath: null;
  workerScriptPath: null;
  controllerPath: null;
  hasPushSubscription: null;
  installationRequestObserved: false;
  installationRequestStatusClass: null;
  installationRequestDurationMs: null;
  responseStatusSupported: false;
  sessionRequestOutcome: null;
  responseContainsToken: false;
  responseContainsInstallationId: false;
  sessionPersistenceSucceeded: false;
  sessionRequestErrorCode: null;
  errors: string[];
};

export async function initializeWonderPush(): Promise<void> {
  return undefined;
}

export async function getNotificationState(): Promise<NotificationState> {
  return 'unsupported';
}

export async function subscribeToNotifications(): Promise<NotificationState> {
  return 'unsupported';
}

export async function unsubscribeFromNotifications(): Promise<NotificationState> {
  return 'unsupported';
}

export async function getWonderPushInstallationId(): Promise<null> {
  return null;
}

export async function getWonderPushDiagnostics(): Promise<WonderPushDiagnostics> {
  return {
    permission: 'unsupported',
    sdkSubscribed: null,
    installationId: null,
    workerScopePath: null,
    workerScriptPath: null,
    controllerPath: null,
    hasPushSubscription: null,
    installationRequestObserved: false,
    installationRequestStatusClass: null,
    installationRequestDurationMs: null,
    responseStatusSupported: false,
    sessionRequestOutcome: null,
    responseContainsToken: false,
    responseContainsInstallationId: false,
    sessionPersistenceSucceeded: false,
    sessionRequestErrorCode: null,
    errors: [],
  };
}
