const { spawnSync } = require('node:child_process');
const { copyFileSync, existsSync, readFileSync, writeFileSync } = require('node:fs');

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

// Keep the manifest an explicit published static asset. Expo currently copies
// files from public/, but making this copy explicit prevents a future exporter
// change from sending /content-manifest.json through the SPA fallback.
const manifestSource = 'public/content-manifest.json';
const manifestOutput = 'dist/content-manifest.json';
if (!existsSync(manifestSource)) {
  console.error(`Missing required static manifest source: ${manifestSource}`);
  process.exit(1);
}
copyFileSync(manifestSource, manifestOutput);
if (!existsSync(manifestOutput)) {
  console.error(`Static manifest was not written to ${manifestOutput}`);
  process.exit(1);
}

// Rewrite only /api/admin/* to the validated deployment backend.
// Keep /api/vendors on the baked static catalog from public/_redirects /
// netlify.toml (/api/vendors.json). Netlify checks published dist/_redirects
// before netlify.toml — do not rewrite vendors onto the thin staging backend.
const backend = env.EXPO_PUBLIC_BACKEND_URL.replace(/\/$/, '');
const redirectsPath = './dist/_redirects';
const redirects = readFileSync(redirectsPath, 'utf8').replace(
  /^(\/api\/admin\/\*\s+)https?:\/\/[^/\s]+(\/api\/\S+)/gm,
  (_match, route, destination) => route + backend + destination,
);
writeFileSync(redirectsPath, redirects);

console.log(`Embedded ${appLabel} frontend build ${env.EXPO_PUBLIC_IPM_BUILD_NUMBER}`);
