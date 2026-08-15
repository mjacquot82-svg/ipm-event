// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

export const CONTENT_REQUEST_TIMEOUT_MS = 5_000;
export const CONTENT_REQUEST_MAX_ATTEMPTS = 3;
export const CONTENT_RETRY_BASE_DELAY_MS = 300;
export const CONTENT_RETRY_MAX_DELAY_MS = 1_200;
export const MAX_IN_FLIGHT_CONTENT_REQUESTS = 32;

export class ContentHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Request failed with status ${status}`);
    this.name = 'ContentHttpError';
    this.status = status;
  }
}

export function isRetryableContentError(error: unknown) {
  if (error instanceof ContentHttpError) {
    return error.status === 408
      || error.status === 425
      || error.status === 429
      || error.status >= 500;
  }
  if (error instanceof TypeError) return true;
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

export function getContentRetryDelayMs(attempt: number, random: () => number = Math.random) {
  const progressiveDelay = CONTENT_RETRY_BASE_DELAY_MS * (2 ** Math.max(0, attempt - 1));
  return Math.min(
    CONTENT_RETRY_MAX_DELAY_MS,
    progressiveDelay + Math.floor(Math.max(0, Math.min(1, random())) * progressiveDelay),
  );
}

export type ContentRetryOptions = {
  timeoutMs?: number;
  maxAttempts?: number;
  random?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
};

export type CacheFirstCallbacks<T> = {
  onRefresh?: (value: T) => void;
  onRefreshError?: (error: unknown) => void;
};

export async function resolveCacheFirst<T>(
  cached: T | null,
  refresh: () => Promise<T>,
  { onRefresh, onRefreshError }: CacheFirstCallbacks<T> = {},
) {
  if (cached !== null) {
    void refresh().then(onRefresh).catch(onRefreshError);
    return cached;
  }
  return refresh();
}

export async function retryContentRequest<T>(
  operation: (timeoutMs: number) => Promise<T>,
  {
    timeoutMs = CONTENT_REQUEST_TIMEOUT_MS,
    maxAttempts = CONTENT_REQUEST_MAX_ATTEMPTS,
    random = Math.random,
    sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  }: ContentRetryOptions = {},
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isRetryableContentError(error)) break;
      await sleep(getContentRetryDelayMs(attempt, random));
    }
  }

  throw lastError;
}

export class ContentRequestCoalescer {
  private readonly inFlight = new Map<string, Promise<unknown>>();

  run<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    // The known resource set is small. This hard ceiling also prevents arbitrary
    // announcement IDs from turning in-flight state into an unbounded registry.
    if (this.inFlight.size >= MAX_IN_FLIGHT_CONTENT_REQUESTS) return operation();

    const request = operation();
    this.inFlight.set(key, request);
    void request.finally(() => {
      if (this.inFlight.get(key) === request) this.inFlight.delete(key);
    }).catch(() => undefined);
    return request;
  }

  get size() {
    return this.inFlight.size;
  }
}
