export type WonderPushSessionName =
  | 'INIT_FAILED'
  | 'INIT_UNSTARTED'
  | 'INIT_INPROGRESS'
  | 'INIT_SUCCESS'
  | 'UNKNOWN';

export type WonderPushInitFailureClassification =
  | 'STORAGE_READ_FAILURE'
  | 'STORAGE_WRITE_FAILURE'
  | 'INDEXEDDB_UNAVAILABLE'
  | 'AUTH_NETWORK_FAILURE'
  | 'AUTH_HTTP_4XX'
  | 'AUTH_HTTP_5XX'
  | 'AUTH_RESPONSE_INVALID'
  | 'AUTH_RESPONSE_MISSING_TOKEN'
  | 'AUTH_RESPONSE_MISSING_INSTALLATION_ID'
  | 'SESSION_PERSIST_FAILURE'
  | 'DOMAIN_PROJECT_REJECTION'
  | 'UNKNOWN_INIT_FAILURE'
  | 'NONE';

export type WonderPushAuthNetworkClassification =
  | 'XHR_ABORT'
  | 'XHR_TIMEOUT'
  | 'OFFLINE_DURING_AUTH'
  | 'CSP_CONNECT_BLOCK'
  | 'XHR_NETWORK_ERROR_WITH_RESOURCE_TIMING'
  | 'XHR_NETWORK_ERROR_NO_RESOURCE_TIMING'
  | 'XHR_LOAD_STATUS_ZERO'
  | 'UNKNOWN_NETWORK_FAILURE'
  | 'NONE';

export type WonderPushAuthTerminalEvent = 'ERROR' | 'ABORT' | 'TIMEOUT' | 'LOAD' | 'NONE';

export function classifyWonderPushAuthNetworkFailure({
  status,
  terminalEvent,
  onlineAtStart,
  onlineAtTerminal,
  offlineDuringRequest,
  cspConnectBlocked,
  resourceTimingPresent,
}: {
  status: number | null;
  terminalEvent: WonderPushAuthTerminalEvent;
  onlineAtStart: boolean | null;
  onlineAtTerminal: boolean | null;
  offlineDuringRequest: boolean;
  cspConnectBlocked: boolean;
  resourceTimingPresent: boolean;
}): WonderPushAuthNetworkClassification {
  if (terminalEvent === 'ABORT') return 'XHR_ABORT';
  if (terminalEvent === 'TIMEOUT') return 'XHR_TIMEOUT';
  if (cspConnectBlocked) return 'CSP_CONNECT_BLOCK';
  if (offlineDuringRequest || onlineAtStart === false || onlineAtTerminal === false) {
    return 'OFFLINE_DURING_AUTH';
  }
  if (terminalEvent === 'ERROR') {
    return resourceTimingPresent
      ? 'XHR_NETWORK_ERROR_WITH_RESOURCE_TIMING'
      : 'XHR_NETWORK_ERROR_NO_RESOURCE_TIMING';
  }
  if (terminalEvent === 'LOAD' && status === 0) return 'XHR_LOAD_STATUS_ZERO';
  if (status === 0) return 'UNKNOWN_NETWORK_FAILURE';
  return 'NONE';
}

export function classifyWonderPushAuthenticationResult({
  status,
  validJson,
  tokenPresent,
  installationIdPresent,
}: {
  status: number;
  validJson?: boolean;
  tokenPresent?: boolean;
  installationIdPresent?: boolean;
}): WonderPushInitFailureClassification {
  if (status === 0) return 'AUTH_NETWORK_FAILURE';
  if (status === 401 || status === 403) return 'DOMAIN_PROJECT_REJECTION';
  if (status >= 400 && status < 500) return 'AUTH_HTTP_4XX';
  if (status >= 500) return 'AUTH_HTTP_5XX';
  if (status < 200 || status >= 300) return 'UNKNOWN_INIT_FAILURE';
  if (!validJson) return 'AUTH_RESPONSE_INVALID';
  if (!tokenPresent) return 'AUTH_RESPONSE_MISSING_TOKEN';
  if (!installationIdPresent) return 'AUTH_RESPONSE_MISSING_INSTALLATION_ID';
  return 'NONE';
}

const STAGING_BACKEND_ORIGIN = 'https://ipm-staging-backend.onrender.com';

export function isStagingNotificationDiagnosticEnabled(backendUrl: string | undefined): boolean {
  if (!backendUrl) return false;
  try {
    return new URL(backendUrl).origin === STAGING_BACKEND_ORIGIN;
  } catch {
    return false;
  }
}

export function interpretWonderPushSessionState(
  rawState: unknown,
  sessionStates: Record<string, unknown> | null | undefined,
): WonderPushSessionName {
  if (!sessionStates) return 'UNKNOWN';
  for (const name of ['INIT_FAILED', 'INIT_UNSTARTED', 'INIT_INPROGRESS', 'INIT_SUCCESS'] as const) {
    if (rawState === sessionStates[name]) return name;
  }
  return 'UNKNOWN';
}

export function safeWonderPushRawState(rawState: unknown): string {
  return typeof rawState === 'number' || typeof rawState === 'string'
    ? String(rawState)
    : 'UNKNOWN';
}
