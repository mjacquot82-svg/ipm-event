// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import type React from 'react';

export function logError(error: Error, errorInfo?: React.ErrorInfo) {
  console.error('Unhandled application error:', error, errorInfo);
}
