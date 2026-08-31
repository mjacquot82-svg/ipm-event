import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const about = await readFile(new URL('../app/(tabs)/about.tsx', import.meta.url), 'utf8');
const buildScript = await readFile(new URL('../scripts/build-web.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('About shows a compact build-time value at the absolute bottom', () => {
  assert.match(about, /const BUILD_NUMBER = process\.env\.EXPO_PUBLIC_IPM_BUILD_NUMBER/);
  assert.match(about, /\{APP_LABEL\} • Build \{BUILD_NUMBER\}/);
  assert.ok(about.lastIndexOf('styles.buildNumber') > about.lastIndexOf('AttendeeAttribution'));
  assert.doesNotMatch(about, /fetch\(|axios|BACKEND_URL|DEPLOY_ID|COMMIT_REF/);
});

test('production and staging labels are distinct and embedded with the bundle', () => {
  assert.match(about, /'IPM Staging' : 'IPM App'/);
  assert.match(buildScript, /EXPO_PUBLIC_IPM_BUILD_NUMBER/);
  assert.match(buildScript, /EXPO_PUBLIC_IPM_APP_LABEL/);
  assert.match(buildScript, /process\.env\.CONTEXT === 'production'/);
  assert.equal(packageJson.scripts['build:web'], 'node ./scripts/build-web.js');
});

test('automatic build value is short, monotonic by build minute, and contains no credential', () => {
  assert.match(buildScript, /Date\.now\(\) - BUILD_EPOCH/);
  assert.match(buildScript, /\/ 60000/);
  assert.doesNotMatch(buildScript, /API_KEY|TOKEN|SECRET|PASSWORD|Math\.random/);
});
