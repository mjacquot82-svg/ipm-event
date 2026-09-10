// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import type React from 'react';
import { recordDiagnosticException } from './diagnostics';

export function logError(error: Error, errorInfo?: React.ErrorInfo) {
  recordDiagnosticException(error, errorInfo);
  console.error('Unhandled application error:', error, errorInfo);
}
