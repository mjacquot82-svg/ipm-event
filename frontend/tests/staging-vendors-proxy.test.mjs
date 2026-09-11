import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const buildScript = readFileSync(new URL('../scripts/build-web.js', import.meta.url), 'utf8');
const publicRedirects = readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8');
const netlifyToml = readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8');

test('public redirects keep vendors on production and admin on staging', () => {
  assert.match(
    publicRedirects,
    /^\/api\/admin\/\*  https:\/\/ipm-staging-backend\.onrender\.com\/api\/admin\/:splat  200!/m,
  );
  assert.match(
    publicRedirects,
    /^\/api\/vendors  https:\/\/ipm-backend-eoiw\.onrender\.com\/api\/vendors  200!/m,
  );
});

test('netlify.toml keeps the same intentional vendor proxy split', () => {
  assert.match(
    netlifyToml,
    /from = "\/api\/vendors"\s+to = "https:\/\/ipm-backend-eoiw\.onrender\.com\/api\/vendors"/,
  );
  assert.match(
    netlifyToml,
    /from = "\/api\/admin\/\*"\s+to = "https:\/\/ipm-staging-backend\.onrender\.com\/api\/admin\/:splat"/,
  );
});

test('build-web rewrite targets admin only, not vendors', () => {
  assert.match(buildScript, /\/api\\\/admin\\\/\\\*/);
  assert.equal(buildScript.includes('admin\\/\\*|vendors'), false);
  assert.equal(buildScript.includes('(?:admin\\/\\*|vendors)'), false);
  assert.doesNotMatch(buildScript, /ipm-backend-eoiw/);
});

test('redirect rewrite keeps production vendors proxy while retargeting admin', () => {
  const sample = [
    '/api/admin/*  https://ipm-staging-backend.onrender.com/api/admin/:splat  200!',
    '/api/vendors  https://ipm-backend-eoiw.onrender.com/api/vendors  200!',
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
  assert.match(
    rewritten,
    /\/api\/vendors  https:\/\/ipm-backend-eoiw\.onrender\.com\/api\/vendors  200!/,
  );
});
