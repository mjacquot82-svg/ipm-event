import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
test('diagnostics is bounded and excludes sensitive attendee fields', () => {
  const source = fs.readFileSync(`${root}src/utils/diagnostics.ts`, 'utf8');
  assert.match(source, /MAX_EVENTS = 25/);
  assert.match(source, /selectedEvent:'present'\|'absent'\|'unknown'/);
  assert.doesNotMatch(source, /localStorage|installationId|pushEndpoint|authorization|email|favorites/);
});
test('About exposes diagnostics copy and clear controls', () => {
  const source = fs.readFileSync(`${root}app/(tabs)/about.tsx`, 'utf8');
  assert.match(source, /Copy diagnostics/); assert.match(source, /Clear diagnostics/); assert.match(source, /getDiagnostics/);
});
test('production build guard requires production context', () => {
  const source = fs.readFileSync(`${root}scripts/build-web.js`, 'utf8');
  assert.match(source, /IPM_RELEASE_TARGET === 'production'/); assert.match(source, /CONTEXT !== 'production'/); assert.match(source, /IPM Staging/);
  const guard = fs.readFileSync(`${root}scripts/verify-production-build.js`, 'utf8'); assert.match(guard, /CONTEXT !== 'production'/);
});
