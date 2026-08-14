import type { AnalyticsDiagnostic, AnalyticsDiagnosticCode } from './analyticsCore';

const MAX_DIAGNOSTICS = 12;
const diagnostics: AnalyticsDiagnostic[] = [];

export function recordAnalyticsDiagnostic(code: AnalyticsDiagnosticCode, detail?: string): void {
  diagnostics.push({ code, at: new Date().toISOString(), ...(detail ? { detail } : {}) });
  if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.splice(0, diagnostics.length - MAX_DIAGNOSTICS);
}

export function getAnalyticsDiagnostics(): readonly AnalyticsDiagnostic[] {
  return diagnostics.map((entry) => ({ ...entry }));
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, '__IPM_ANALYTICS_DIAGNOSTICS__', {
    configurable: true,
    value: getAnalyticsDiagnostics,
  });
}
