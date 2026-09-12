import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(here, '..');
const repoRoot = join(frontendRoot, '..');

const buildScript = readFileSync(join(frontendRoot, 'scripts/build-web.js'), 'utf8');
const publicRedirects = readFileSync(join(frontendRoot, 'public/_redirects'), 'utf8');
const netlifyToml = readFileSync(join(repoRoot, 'netlify.toml'), 'utf8');
const catalogPath = join(frontendRoot, 'public/api/vendors.json');

test('public redirects serve static vendors.json and keep admin on staging', () => {
  assert.match(
    publicRedirects,
    /^\/api\/admin\/\*  https:\/\/ipm-staging-backend\.onrender\.com\/api\/admin\/:splat  200!/m,
  );
  assert.match(publicRedirects, /^\/api\/vendors  \/api\/vendors\.json  200!/m);
  assert.doesNotMatch(publicRedirects, /ipm-backend-eoiw\.onrender\.com\/api\/vendors/);
});

test('netlify.toml serves static vendors.json instead of production proxy', () => {
  assert.match(
    netlifyToml,
    /from = "\/api\/vendors"\s+to = "\/api\/vendors\.json"/,
  );
  assert.match(
    netlifyToml,
    /from = "\/api\/admin\/\*"\s+to = "https:\/\/ipm-staging-backend\.onrender\.com\/api\/admin\/:splat"/,
  );
  assert.doesNotMatch(netlifyToml, /ipm-backend-eoiw\.onrender\.com\/api\/vendors/);
});

test('build-web rewrite targets admin only, not vendors', () => {
  assert.match(buildScript, /\/api\\\/admin\\\/\\\*/);
  assert.equal(buildScript.includes('admin\\/\\*|vendors'), false);
  assert.equal(buildScript.includes('(?:admin\\/\\*|vendors)'), false);
  assert.doesNotMatch(buildScript, /ipm-backend-eoiw/);
});

test('baked staging vendors catalog exists with VendorsResponse shape', () => {
  assert.equal(existsSync(catalogPath), true, 'frontend/public/api/vendors.json missing');
  const data = JSON.parse(readFileSync(catalogPath, 'utf8'));
  assert.ok(Array.isArray(data.vendors));
  assert.equal(data.total_count, data.vendors.length);
  assert.ok(data.vendors.length > 150, `expected unique catalog >150, got ${data.vendors.length}`);
  assert.ok(data.vendors.every((v) => typeof v.id === 'string' && v.id.length > 10));
  // Must not be the old 127 blank-location production list
  assert.notEqual(data.vendors.length, 127);
  const blank = data.vendors.filter((v) => !(v.location || '').trim()).length;
  assert.ok(blank < data.vendors.length, 'all locations blank — still prod list?');
});

test('redirect rewrite keeps static vendors while retargeting admin', () => {
  const sample = [
    '/api/admin/*  https://ipm-staging-backend.onrender.com/api/admin/:splat  200!',
    '/api/vendors  /api/vendors.json  200!',
    '/*\t/index.html\t200',
  ].join('\n');
  const backend = 'https://example-staging-backend.onrender.com';
  const rewritten = sample.replace(
    /^(\/api\/admin\/\*\s+)https?:\/\/[^/\s]+(\/api\/\S+)/gm,
    (_match, route, destination) => route + backend + destination,
  );
  assert.match(
    rewritten,
    /\/api\/admin\/\*  https:\/\/example-staging-backend\.onrender\.com\/api\/admin\/:splat  200!/,
  );
  assert.match(rewritten, /\/api\/vendors  \/api\/vendors\.json  200!/);
});
