const { spawnSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');

const BUILD_EPOCH = Date.UTC(2026, 0, 1);
const buildNumber = String(Math.floor((Date.now() - BUILD_EPOCH) / 60000));
const appLabel = process.env.CONTEXT === 'production' ? 'production' : 'staging';
const env = {
  ...process.env,
  EXPO_PUBLIC_IPM_BUILD_NUMBER: buildNumber,
  EXPO_PUBLIC_IPM_APP_LABEL: appLabel,
};

for (const [command, args] of [
  [process.execPath, ['./scripts/validate-build-env.js']],
  [process.platform === 'win32' ? 'npx.cmd' : 'npx', ['expo', 'export', '--platform', 'web']],
  [process.execPath, ['./scripts/generate-offline-worker.js']],
]) {
  const result = spawnSync(command, args, { env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

// Netlify proxy destinations must use the same validated backend as the bundle.
// In particular, a staging export must not inherit legacy production proxies.
const backend = env.EXPO_PUBLIC_BACKEND_URL.replace(/\/$/, '');
const redirectsPath = './dist/_redirects';
const redirects = readFileSync(redirectsPath, 'utf8').replace(
  /^(\/api\/(?:admin\/\*|vendors)\s+)https?:\/\/[^/\s]+(\/api\/\S+)/gm,
  (_match, route, destination) => route + backend + destination,
);
writeFileSync(redirectsPath, redirects);

console.log(`Embedded ${appLabel} frontend build ${env.EXPO_PUBLIC_IPM_BUILD_NUMBER}`);
