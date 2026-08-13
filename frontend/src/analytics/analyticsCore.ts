export const ANALYTICS_SESSION_TIMEOUT_MS = 30 * 60 * 1000;
export const ANALYTICS_MAX_BUFFERED_REQUESTS = 100;
export const ANALYTICS_MAX_BATCH_EVENTS = 50;

export type AnalyticsStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type AnalyticsFetch = (url: string, init: RequestInit) => Promise<{ ok: boolean; status?: number }>;

export type BufferedRequest = {
  endpoint: string;
  body: Record<string, unknown>;
};

const VISITOR_KEY = '@ipm_analytics_visitor_v1';
const SESSION_KEY = '@ipm_analytics_session_v1';
const BUFFER_KEY = '@ipm_analytics_buffer_v1';

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
    normalized === '/coming-soon'
  );
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

  constructor(
    storage: AnalyticsStorage,
    fetcher: AnalyticsFetch,
    apiBaseUrl: string,
    development = false,
  ) {
    this.storage = storage;
    this.fetcher = fetcher;
    this.apiBaseUrl = apiBaseUrl;
    this.development = development;
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
    try {
      const response = await this.fetcher(`${this.apiBaseUrl}${request.endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request.body), keepalive: true,
      });
      if (response.ok) return true;
      if (response.status && response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status)) {
        if (this.development) console.debug(`[Analytics] Dropped rejected payload (${response.status})`);
        return false;
      }
    } catch (error) {
      if (this.development) console.debug('[Analytics] Request deferred', error);
    }
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
        try {
          const response = await this.fetcher(`${this.apiBaseUrl}${request.endpoint}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request.body), keepalive: true,
          });
          if (!response.ok) {
            if (response.status && response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status)) {
              this.queue.shift();
              await this.persist();
              continue;
            }
            break;
          }
          this.queue.shift();
          await this.persist();
        } catch {
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
