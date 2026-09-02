import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const home = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const page = await readFile(new URL('../app/(tabs)/emergency-services.tsx', import.meta.url), 'utf8');
const layout = await readFile(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
const backend = await readFile(new URL('../../backend/server.py', import.meta.url), 'utf8');
const w3w = await readFile(new URL('../../backend/what3words.py', import.meta.url), 'utf8');
const backendSources = backend + '\n' + w3w;

test('Emergency Services is a hidden internal route from Home', () => {
  assert.match(layout, /<Tabs\.Screen name="emergency-services" options=\{\{ title: 'Emergency Services', href: null \}\} \/>/);
  assert.match(home, /quickAction\('emergency_services', 'internal', \(\) => router\.push\('\/emergency-services' as never\)\)/);
  assert.match(home, />Emergency Services<\/Text>/);
  assert.match(page, /if \(router\.canGoBack\(\)\) router\.back\(\)/);
  assert.match(page, /else router\.replace\('\/'\)/);
});

test('page asks for a 3-word location on tap and does not auto-fetch', () => {
  assert.match(page, /Need help finding your location\?/);
  assert.match(page, /Tap “Get my 3-word location” below\. If prompted, allow location access so we can determine your 3-word location to share with the 911 dispatcher\./);
  assert.doesNotMatch(page, /Allow location access, then tap the button\./);
  assert.match(page, /Get my 3-word location/);
  assert.match(page, /usePageAnalytics\('emergency_services', 'home_quick_action'\)/);
  assert.match(page, /\/api\/what3words\?lat=/);
  assert.match(page, /process\.env\.EXPO_PUBLIC_BACKEND_URL/);
  assert.doesNotMatch(page, /useEffect\([\s\S]*fetchWhat3Words/);
  assert.doesNotMatch(page, /submitSOSReport|\/api\/sos\/report/);
});

test('frontend never embeds a What3Words API key', () => {
  assert.doesNotMatch(page, /WHAT3WORDS_API_KEY|X-Api-Key|api\.what3words\.com/);
  assert.doesNotMatch(home, /WHAT3WORDS_API_KEY|X-Api-Key/);
});

test('backend proxies What3Words from env and never echoes the key', () => {
  assert.match(backend, /api_router\.include_router\(what3words_router\)/);
  assert.match(w3w, /@what3words_router\.get\("\/what3words"/);
  assert.match(backendSources, /os\.environ\.get\("WHAT3WORDS_API_KEY"\)/);
  assert.match(backendSources, /status_code=400, detail=f"Invalid \{name\}"/);
  assert.match(backendSources, /status_code=503, detail="Location service is not configured"/);
  assert.match(backendSources, /status_code=502, detail="Unable to convert location"/);
  assert.match(backendSources, /https:\/\/api\.what3words\.com\/v3\/convert-to-3wa/);
  assert.doesNotMatch(backendSources, /WHAT3WORDS_API_KEY\s*=\s*['"][^'"]+['"]/);
  assert.doesNotMatch(backendSources, /detail=.*WHAT3WORDS_API_KEY|detail=.*X-Api-Key/);
});
