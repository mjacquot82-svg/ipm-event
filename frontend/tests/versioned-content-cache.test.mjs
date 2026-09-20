import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const service = await readFile(new URL('../src/services/spreadsheetDataService.ts', import.meta.url), 'utf8');
const netlify = await readFile(new URL('../../netlify.toml', import.meta.url), 'utf8');
const redirects = await readFile(new URL('../public/_redirects', import.meta.url), 'utf8');
const migration = await readFile(new URL('../../supabase/migrations/20260920000100_staging_content_revisions.sql', import.meta.url), 'utf8');

test('staging content cache gates full reads on a validated manifest revision', () => {
  assert.match(service, /fetch\('\/content-manifest\.json'/);
  assert.match(service, /manifest\.environment !== getContentEnvironment\(\)/);
  assert.match(service, /cachedData\.contentRevision === remoteRevision/);
  assert.match(service, /Full content response is missing content revision/);
  assert.match(service, /refreshPromises/);
});

test('cache namespace separates staging from the preserved production v2 identity', () => {
  assert.match(service, /ipm_supabase_cache:ipm-2026-production/);
  assert.match(service, /ipm_supabase_cache:ipm-2026-staging/);
});

test('staging vendor routing remains static and manifest routing is CDN-compatible', () => {
  assert.match(netlify, /from = "\/api\/vendors"[\s\S]*to = "\/api\/vendors\.json"/);
  assert.match(netlify, /from = "\/content-manifest\.json"[\s\S]*content-manifest/);
  assert.match(redirects, /\/api\/vendors\s+\/api\/vendors\.json\s+200!/);
  assert.match(redirects, /\/content-manifest\.json\s+https:\/\/hooiqjcbcbwzjjvnwyxf\.supabase\.co/);
});

test('database revisions are transactionally triggered for both public content types', () => {
  assert.match(migration, /create table if not exists public\.content_revisions/);
  assert.match(migration, /bump_schedule_content_revision/);
  assert.match(migration, /bump_announcement_content_revision/);
  assert.match(migration, /after insert or update or delete on public\.schedule_items/);
  assert.match(migration, /after insert or update or delete on public\.alerts/);
  assert.match(migration, /content_type in \('schedule', 'announcements'\)/);
});
