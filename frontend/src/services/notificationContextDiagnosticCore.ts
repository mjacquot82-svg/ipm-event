export type TriState = 'YES' | 'NO' | 'UNKNOWN';

export type NotificationContextDiagnostic = {
  raw: {
    iosDetected: TriState;
    userAgentFamily: string;
    displayModeStandalone: 'TRUE' | 'FALSE' | 'UNAVAILABLE';
    navigatorStandalone: 'TRUE' | 'FALSE' | 'UNAVAILABLE';
    notificationAvailable: TriState;
    notificationPermission: 'granted' | 'denied' | 'default' | 'unavailable';
    serviceWorkerAvailable: TriState;
    pushManagerAvailable: TriState;
    serviceWorkerRegistrationAvailable: TriState;
    controllingServiceWorker: TriState;
    wonderPushSdkLoaded: TriState;
  };
  derived: {
    installedContext: 'INSTALLED' | 'NOT INSTALLED' | 'UNKNOWN';
    wonderPushSdkReady: TriState;
    wonderPushSubscribed: TriState;
    currentInstallationAvailable: TriState;
    backendRegistrationExists: TriState;
    installationMatchesRegistration: TriState;
    providerReadiness: 'READY' | 'NOT READY' | 'UNAVAILABLE' | 'UNKNOWN';
    failureStage: string;
    backendFailure: string;
  };
};

export function summarizeUserAgent(userAgent = '', platform = '', maxTouchPoints = 0) {
  const ua = userAgent.toLowerCase();
  const ios = /iphone|ipad|ipod/.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
  const android = /android/.test(ua);
  const device = ios ? 'iOS' : android ? 'Android' : ua ? 'Desktop' : 'Unknown';
  const browser = /crios|chrome\//.test(ua) ? 'Chrome-family'
    : /fxios|firefox\//.test(ua) ? 'Firefox-family'
      : /edgios|edga|edg\//.test(ua) ? 'Edge-family'
        : /safari\//.test(ua) ? 'Safari-family' : 'Other-family';
  return `${device} / ${browser}`;
}

export function interpretInstalledContext(displayMode: boolean | null,
  navigatorStandalone: boolean | null): 'INSTALLED' | 'NOT INSTALLED' | 'UNKNOWN' {
  if (displayMode === true || navigatorStandalone === true) return 'INSTALLED';
  if (displayMode === false && navigatorStandalone === false) return 'NOT INSTALLED';
  return 'UNKNOWN';
}

export function buildRawNotificationObservations(input: {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  displayModeStandalone: boolean | null;
  navigatorStandalone: boolean | null;
  notificationAvailable: boolean;
  notificationPermission?: 'granted' | 'denied' | 'default';
  serviceWorkerAvailable: boolean;
  pushManagerAvailable: boolean;
  serviceWorkerRegistrationAvailable: boolean | null;
  controllingServiceWorker: boolean;
  wonderPushSdkLoaded: boolean;
}): NotificationContextDiagnostic['raw'] {
  const tri = (value: boolean | null): TriState => value === null ? 'UNKNOWN' : value ? 'YES' : 'NO';
  const standalone = (value: boolean | null) => value === null ? 'UNAVAILABLE' as const
    : value ? 'TRUE' as const : 'FALSE' as const;
  const family = summarizeUserAgent(input.userAgent, input.platform, input.maxTouchPoints);
  return {
    iosDetected: family.startsWith('iOS /') ? 'YES' : 'NO',
    userAgentFamily: family,
    displayModeStandalone: standalone(input.displayModeStandalone),
    navigatorStandalone: standalone(input.navigatorStandalone),
    notificationAvailable: tri(input.notificationAvailable),
    notificationPermission: input.notificationAvailable
      ? input.notificationPermission || 'default' : 'unavailable',
    serviceWorkerAvailable: tri(input.serviceWorkerAvailable),
    pushManagerAvailable: tri(input.pushManagerAvailable),
    serviceWorkerRegistrationAvailable: tri(input.serviceWorkerRegistrationAvailable),
    controllingServiceWorker: tri(input.controllingServiceWorker),
    wonderPushSdkLoaded: tri(input.wonderPushSdkLoaded),
  };
}

export function classifyDiagnosticFailure(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error
    && typeof (error as { status?: unknown }).status === 'number') {
    return `HTTP ${(error as { status: number }).status}`;
  }
  if (error instanceof SyntaxError) return 'MALFORMED RESPONSE';
  if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') {
    return 'TIMEOUT';
  }
  if (error instanceof Error && /timeout|timed out/i.test(`${error.name} ${error.message}`)) return 'TIMEOUT';
  if (error instanceof TypeError) return 'NETWORK FAILURE';
  return 'UNKNOWN ERROR';
}

export function formatNotificationContextReport(diagnostic: NotificationContextDiagnostic, capturedAt: string) {
  const raw = [
    ['Platform / iOS detected', diagnostic.raw.iosDetected],
    ['User agent family', diagnostic.raw.userAgentFamily],
    ['display-mode standalone', diagnostic.raw.displayModeStandalone],
    ['navigator.standalone', diagnostic.raw.navigatorStandalone],
    ['window.Notification available', diagnostic.raw.notificationAvailable],
    ['Notification.permission', diagnostic.raw.notificationPermission],
    ['navigator.serviceWorker available', diagnostic.raw.serviceWorkerAvailable],
    ['window.PushManager available', diagnostic.raw.pushManagerAvailable],
    ['Service-worker registration available', diagnostic.raw.serviceWorkerRegistrationAvailable],
    ['Current controlling service worker', diagnostic.raw.controllingServiceWorker],
    ['WonderPush SDK loaded', diagnostic.raw.wonderPushSdkLoaded],
  ];
  const derived = [
    ['Installed-context interpretation', diagnostic.derived.installedContext],
    ['WonderPush SDK ready', diagnostic.derived.wonderPushSdkReady],
    ['WonderPush subscribed', diagnostic.derived.wonderPushSubscribed],
    ['Current WonderPush installation available', diagnostic.derived.currentInstallationAvailable],
    ['IPM backend registration exists', diagnostic.derived.backendRegistrationExists],
    ['Current installation matches registration', diagnostic.derived.installationMatchesRegistration],
    ['Provider readiness verification', diagnostic.derived.providerReadiness],
    ['Failure stage', diagnostic.derived.failureStage],
    ['Backend authoritative verification', diagnostic.derived.backendFailure],
  ];
  return ['iPhone notification context', `Captured: ${capturedAt}`, 'RAW browser/runtime observations',
    ...raw.map(([label, value]) => `${label}: ${value}`), 'DERIVED IPM interpretations',
    ...derived.map(([label, value]) => `${label}: ${value}`)].join('\n');
}
