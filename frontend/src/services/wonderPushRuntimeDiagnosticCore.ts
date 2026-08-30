export type WonderPushSessionName =
  | 'INIT_FAILED'
  | 'INIT_UNSTARTED'
  | 'INIT_INPROGRESS'
  | 'INIT_SUCCESS'
  | 'UNKNOWN';

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
