import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  getOrganizerEventConfiguration,
  MISSING_ORGANIZER_EVENT_MESSAGE,
} from '../src/services/organizerEventConfiguration.ts';

test('organizer login and bootstrap default to the deployment event', () => {
  process.env.EXPO_PUBLIC_EVENT_ID = '  ipm-staging  ';
  assert.deepEqual(getOrganizerEventConfiguration(), {
    eventId: 'ipm-staging',
    error: null,
  });
});

test('missing organizer event configuration fails clearly without a production fallback', () => {
  delete process.env.EXPO_PUBLIC_EVENT_ID;
  assert.deepEqual(getOrganizerEventConfiguration(), {
    eventId: '',
    error: MISSING_ORGANIZER_EVENT_MESSAGE,
  });
  assert.doesNotMatch(MISSING_ORGANIZER_EVENT_MESSAGE, /ipm-2026/);
});

test('organizer form uses the required configuration for both modes', async () => {
  const source = await readFile(new URL('../app/admin/login.tsx', import.meta.url), 'utf8');
  assert.match(source, /useState\(organizerEventConfiguration\.eventId\)/);
  assert.match(source, /bootstrapOrganizerOwner/);
  assert.match(source, /loginOrganizer/);
  assert.match(source, /disabled=\{submitting \|\| Boolean\(organizerEventConfiguration\.error\)\}/);
  assert.doesNotMatch(source, /['"]ipm-2026['"]/);
});
