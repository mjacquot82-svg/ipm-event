export const ANALYTICS_SESSION_TIMEOUT_MS = 30 * 60 * 1000;
export const ANALYTICS_MAX_BUFFERED_REQUESTS = 100;
export const ANALYTICS_MAX_BATCH_EVENTS = 50;

export type AnalyticsStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type AnalyticsDiagnosticCode =
  | 'initializer_invoked'
  | 'initializer_skipped_excluded'
  | 'initializer_skipped_unconfigured'
  | 'storage_fallback'
  | 'initialization_failed'
  | 'transport_confirmed'
  | 'transport_deferred'
  | 'transport_rejected';

export type AnalyticsDiagnostic = {
  code: AnalyticsDiagnosticCode;
  at: string;
  detail?: string;
};

export type AnalyticsDiagnosticReporter = (code: AnalyticsDiagnosticCode, detail?: string) => void;

export class MemoryAnalyticsStorage implements AnalyticsStorage {
  private values = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }
}

export class ResilientAnalyticsStorage implements AnalyticsStorage {
  private persistent: AnalyticsStorage;
  private fallback = new MemoryAnalyticsStorage();
  private persistentAvailable = true;
  private report?: AnalyticsDiagnosticReporter;

  constructor(persistent: AnalyticsStorage, report?: AnalyticsDiagnosticReporter) {
    this.persistent = persistent;
    this.report = report;
  }

  private async run<T>(persistentOperation: () => Promise<T>, fallbackOperation: () => Promise<T>): Promise<T> {
    if (!this.persistentAvailable) return fallbackOperation();
    try {
      return await persistentOperation();
    } catch {
      this.persistentAvailable = false;
      this.report?.('storage_fallback');
      return fallbackOperation();
    }
  }

  getItem(key: string): Promise<string | null> {
    return this.run(() => this.persistent.getItem(key), () => this.fallback.getItem(key));
  }

  setItem(key: string, value: string): Promise<void> {
    return this.run(() => this.persistent.setItem(key, value), () => this.fallback.setItem(key, value));
  }

  removeItem(key: string): Promise<void> {
    return this.run(() => this.persistent.removeItem(key), () => this.fallback.removeItem(key));
  }

  isUsingFallback(): boolean {
    return !this.persistentAvailable;
  }
}

export type AnalyticsFetchResponse = {
  ok: boolean;
  status?: number;
  json?: () => Promise<unknown>;
};

export type AnalyticsFetch = (url: string, init: RequestInit) => Promise<AnalyticsFetchResponse>;

export function bindAnalyticsFetch(fetcher: AnalyticsFetch): AnalyticsFetch {
  return fetcher.bind(globalThis);
}

export type BufferedRequest = {
  endpoint: string;
  body: Record<string, unknown>;
};

const VISITOR_KEY = '@ipm_analytics_visitor_v1';
const SESSION_KEY = '@ipm_analytics_session_v1';
const BUFFER_KEY = '@ipm_analytics_buffer_v1';
const INVALID_SESSION_DETAIL = 'session is missing, ended, or inactive';

export class AnalyticsSessionRecovery {
  private inFlight: Promise<void> | null = null;

  run(recover: () => Promise<void>): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = recover().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }
}

export class AnalyticsRuntimeSessionStart {
  private attempted = false;

  claim(): boolean {
    if (this.attempted) return false;
    this.attempted = true;
    return true;
  }

  reset(): void {
    this.attempted = false;
  }
}

export function generateAnalyticsUuid(randomUuid?: () => string): string {
  if (randomUuid) return randomUuid();
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export async function getOrCreateVisitorId(storage: AnalyticsStorage, randomUuid?: () => string): Promise<string> {
  const existing = await storage.getItem(VISITOR_KEY);
  if (existing) return existing;
  const visitorId = generateAnalyticsUuid(randomUuid);
  await storage.setItem(VISITOR_KEY, visitorId);
  return visitorId;
}

export type StoredSession = { id: string; lastActivityAt: number; startedAt: number };

export async function getOrCreateSession(
  storage: AnalyticsStorage,
  now: number,
  randomUuid?: () => string,
): Promise<{ session: StoredSession; created: boolean }> {
  const raw = await storage.getItem(SESSION_KEY);
  if (raw) {
    try {
      const session = JSON.parse(raw) as StoredSession;
      if (session.id && now - session.lastActivityAt < ANALYTICS_SESSION_TIMEOUT_MS) {
        session.lastActivityAt = now;
        await storage.setItem(SESSION_KEY, JSON.stringify(session));
        return { session, created: false };
      }
    } catch {
      // Replace corrupt state with a fresh anonymous session.
    }
  }
  const session = { id: generateAnalyticsUuid(randomUuid), startedAt: now, lastActivityAt: now };
  await storage.setItem(SESSION_KEY, JSON.stringify(session));
  return { session, created: true };
}

export async function clearSession(storage: AnalyticsStorage): Promise<void> {
  await storage.removeItem(SESSION_KEY);
}

export function isAttendeeAnalyticsPath(pathname: string): boolean {
  const normalized = pathname.toLowerCase();
  return !(
    normalized === '/admin' || normalized.startsWith('/admin/') ||
    normalized === '/preview' || normalized.startsWith('/preview-') ||
    normalized === '/offline-diagnostics' ||
    normalized === '/coming-soon'
  );
}

export function shouldInitializeAttendeeAnalytics(pathname: string, apiBaseUrl: string): boolean {
  return Boolean(apiBaseUrl) && isAttendeeAnalyticsPath(pathname || '/');
}

export class PageFocusDeduplicator {
  private focused = new Set<string>();

  begin(pageId: string): boolean {
    if (this.focused.has(pageId)) return false;
    this.focused.add(pageId);
    return true;
  }

  end(pageId: string): void {
    this.focused.delete(pageId);
  }
}

export function buildSearchAnalyticsProperties(query: string, resultCount: number) {
  return {
    query_length: query.trim().length,
    result_count: resultCount,
    zero_results: resultCount === 0,
  };
}

export function buildOutboundAnalyticsProperties(destinationId: string, destinationType: string, source: string) {
  return { destination_id: destinationId, destination_type: destinationType, source };
}

export function takeAnalyticsBatch<T>(events: T[], maximum = ANALYTICS_MAX_BATCH_EVENTS): T[] {
  return events.splice(0, maximum);
}

export class AnalyticsRequestBuffer {
  private queue: BufferedRequest[] = [];
  private loaded = false;
  private flushing = false;
  private storage: AnalyticsStorage;
  private fetcher: AnalyticsFetch;
  private apiBaseUrl: string;
  private development: boolean;
  private onSessionInvalid?: (sessionId: string) => void | Promise<void>;
  private report?: AnalyticsDiagnosticReporter;

  private requestOperation(request: BufferedRequest): string {
    switch (request.endpoint) {
      case '/api/activity/session/start': return 'session_start';
      case '/api/analytics/session/start': return 'session_start';
      case '/api/activity/session/heartbeat': return 'session_heartbeat';
      case '/api/analytics/session/heartbeat': return 'session_heartbeat';
      case '/api/activity/session/end': return 'session_end';
      case '/api/analytics/session/end': return 'session_end';
      case '/api/activity/events': return 'events';
      case '/api/analytics/events': return 'events';
      default: return 'unknown';
    }
  }

  private reportDeferred(request: BufferedRequest, stage: string): void {
    this.report?.('transport_deferred', `${this.requestOperation(request)}:${stage}`);
  }

  constructor(
    storage: AnalyticsStorage,
    fetcher: AnalyticsFetch,
    apiBaseUrl: string,
    development = false,
    onSessionInvalid?: (sessionId: string) => void | Promise<void>,
    report?: AnalyticsDiagnosticReporter,
  ) {
    this.storage = storage;
    this.fetcher = fetcher;
    this.apiBaseUrl = apiBaseUrl;
    this.development = development;
    this.onSessionInvalid = onSessionInvalid;
    this.report = report;
  }

  private requestSessionId(request: BufferedRequest): string | null {
    return typeof request.body.sessionId === 'string' ? request.body.sessionId : null;
  }

  private async invalidSessionId(response: AnalyticsFetchResponse, request: BufferedRequest): Promise<string | null> {
    if (response.status !== 422 || !response.json) return null;
    try {
      const body = await response.json();
      const detail = body && typeof body === 'object' && 'detail' in body ? body.detail : null;
      return detail === INVALID_SESSION_DETAIL ? this.requestSessionId(request) : null;
    } catch {
      return null;
    }
  }

  private async retireInvalidSession(sessionId: string): Promise<void> {
    await this.load();
    // Requests retain their original session ID for semantic correctness. Once
    // that server session is invalid, discard them instead of rewriting history
    // onto the replacement session.
    this.queue = this.queue.filter((request) => this.requestSessionId(request) !== sessionId);
    await this.persist();
    await this.onSessionInvalid?.(sessionId);
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await this.storage.getItem(BUFFER_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      this.queue = Array.isArray(parsed) ? parsed.slice(-ANALYTICS_MAX_BUFFERED_REQUESTS) : [];
    } catch {
      this.queue = [];
    }
  }

  private async persist(): Promise<void> {
    try {
      await this.storage.setItem(BUFFER_KEY, JSON.stringify(this.queue));
    } catch (error) {
      if (this.development) console.debug('[Analytics] Unable to persist buffer', error);
    }
  }

  async enqueue(request: BufferedRequest): Promise<void> {
    await this.load();
    this.queue.push(request);
    if (this.queue.length > ANALYTICS_MAX_BUFFERED_REQUESTS) {
      this.queue.splice(0, this.queue.length - ANALYTICS_MAX_BUFFERED_REQUESTS);
    }
    await this.persist();
  }

  async sendOrBuffer(request: BufferedRequest): Promise<boolean> {
    let body: string;
    try {
      body = JSON.stringify(request.body);
    } catch {
      this.reportDeferred(request, 'serialize_failed');
      await this.enqueue(request);
      return false;
    }

    let responsePromise: Promise<AnalyticsFetchResponse>;
    try {
      responsePromise = this.fetcher(`${this.apiBaseUrl}${request.endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
        keepalive: request.endpoint === '/api/activity/session/end',
      });
    } catch (error) {
      if (this.development) console.debug('[Analytics] Request deferred', error);
      this.reportDeferred(request, 'fetch_invocation_failed');
      await this.enqueue(request);
      return false;
    }

    let response: AnalyticsFetchResponse;
    try {
      response = await responsePromise;
    } catch (error) {
      if (this.development) console.debug('[Analytics] Request deferred', error);
      this.reportDeferred(request, 'fetch_rejected');
      await this.enqueue(request);
      return false;
    }

    try {
      if (response.ok) {
        this.report?.('transport_confirmed', `${this.requestOperation(request)}:direct`);
        return true;
      }
      const invalidSessionId = await this.invalidSessionId(response, request);
      if (invalidSessionId) {
        await this.retireInvalidSession(invalidSessionId);
        return false;
      }
      if (response.status && response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status)) {
        this.report?.('transport_rejected', String(response.status));
        if (this.development) console.debug(`[Analytics] Dropped rejected payload (${response.status})`);
        return false;
      }
    } catch (error) {
      if (this.development) console.debug('[Analytics] Request deferred', error);
      this.reportDeferred(request, 'response_processing_failed');
      await this.enqueue(request);
      return false;
    }
    this.reportDeferred(request, 'http_retryable_response');
    await this.enqueue(request);
    return false;
  }

  async flush(): Promise<void> {
    await this.load();
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;
    try {
      while (this.queue.length > 0) {
        const request = this.queue[0];
        let body: string;
        try {
          body = JSON.stringify(request.body);
        } catch {
          this.reportDeferred(request, 'queue_serialize_failed');
          break;
        }

        let responsePromise: Promise<AnalyticsFetchResponse>;
        try {
          responsePromise = this.fetcher(`${this.apiBaseUrl}${request.endpoint}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
          });
        } catch {
          this.reportDeferred(request, 'queue_fetch_invocation_failed');
          break;
        }

        let response: AnalyticsFetchResponse;
        try {
          response = await responsePromise;
        } catch {
          this.reportDeferred(request, 'queue_fetch_rejected');
          break;
        }

        try {
          if (!response.ok) {
            const invalidSessionId = await this.invalidSessionId(response, request);
            if (invalidSessionId) {
              await this.retireInvalidSession(invalidSessionId);
              continue;
            }
            if (response.status && response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status)) {
              this.report?.('transport_rejected', String(response.status));
              this.queue.shift();
              await this.persist();
              continue;
            }
            this.reportDeferred(request, 'queue_http_retryable_response');
            break;
          }
          this.queue.shift();
          await this.persist();
          this.report?.('transport_confirmed', `${this.requestOperation(request)}:queue`);
        } catch {
          this.reportDeferred(request, 'queue_response_processing_failed');
          break;
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  async size(): Promise<number> {
    await this.load();
    return this.queue.length;
  }
}
