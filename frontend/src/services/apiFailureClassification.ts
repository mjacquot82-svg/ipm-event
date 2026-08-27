export type ApiFailureKind = 'connectivity' | 'server' | 'malformed-response' | 'application';

export class ApiDataError extends Error {
  readonly kind: ApiFailureKind;

  constructor(kind: ApiFailureKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ApiDataError';
    this.kind = kind;
  }
}

export function classifyApiFailure(error: unknown): ApiFailureKind {
  if (error instanceof ApiDataError) return error.kind;
  if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') {
    return 'connectivity';
  }
  if (error instanceof TypeError) return 'connectivity';
  return 'application';
}

export function isConnectivityFailure(error: unknown) {
  return classifyApiFailure(error) === 'connectivity';
}
