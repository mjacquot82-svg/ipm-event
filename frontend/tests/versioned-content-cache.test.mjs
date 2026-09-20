import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const service = await readFile(new URL('../src/services/spreadsheetDataService.ts', import.meta.url), 'utf8');
const netlify = await readFile(new URL('../../netlify.toml', import.meta.url), 'utf8');
const redirects = await readFile(new URL('../public/_redirects', import.meta.url), 'utf8');
const manifest = await readFile(new URL('../public/content-manifest.json', import.meta.url), 'utf8');
const migration = await readFile(new URL('../../supabase/migrations/20260920000100_staging_content_revisions.sql', import.meta.url), 'utf8');
const leaseMigration = await readFile(new URL('../../supabase/migrations/20260920000200_content_manifest_publisher_lease.sql', import.meta.url), 'utf8');
const publisher = await readFile(new URL('../../backend/publish_content_manifest.py', import.meta.url), 'utf8');

test('staging content cache gates full reads on a validated manifest revision', () => {
  assert.match(service, /fetch\('\/content-manifest\.json'/);
  assert.match(service, /manifest\.environment !== getContentEnvironment\(\)/);
  assert.match(service, /cachedData\.contentRevision === remoteRevision/);
  assert.match(service, /API response is missing content revision/);
  assert.match(service, /refreshPromises/);
});

test('cache namespace separates staging from the preserved production v2 identity', () => {
  assert.match(service, /ipm_supabase_cache:ipm-2026-production/);
  assert.match(service, /ipm_supabase_cache:ipm-2026-staging/);
});

test('staging vendor and manifest routing are static assets', () => {
  assert.match(netlify, /from = "\/api\/vendors"[\s\S]*to = "\/api\/vendors\.json"/);
  assert.match(netlify, /for = "\/content-manifest\.json"/);
  assert.doesNotMatch(netlify, /functions\/v1\/content-manifest/);
  assert.match(redirects, /\/api\/vendors\s+\/api\/vendors\.json\s+200!/);
  assert.doesNotMatch(redirects, /content-manifest/);
  assert.match(manifest, /"environment": "staging"/);
  assert.match(manifest, /"event": "ipm-staging"/);
});

test('database revisions are transactionally triggered for both public content types', () => {
  assert.match(migration, /create table if not exists public\.content_revisions/);
  assert.match(migration, /bump_schedule_content_revision/);
  assert.match(migration, /bump_announcement_content_revision/);
  assert.match(migration, /after insert or update or delete on public\.schedule_items/);
  assert.match(migration, /after insert or update or delete on public\.alerts/);
  assert.match(migration, /content_type in \('schedule', 'announcements'\)/);
});

test('publisher is staging-only, leased, and monotonic', () => {
  assert.match(publisher, /EXPECTED_ENV = "staging"/);
  assert.match(publisher, /EXPECTED_EVENT = "ipm-staging"/);
  assert.match(publisher, /refusing revision rollback/);
  assert.match(publisher, /content_manifest_publish_leases/);
  assert.match(leaseMigration, /create table if not exists public\.content_manifest_publish_leases/);
});
