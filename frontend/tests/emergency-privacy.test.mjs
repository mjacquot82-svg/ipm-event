import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../app/(tabs)/emergency-services.tsx',import.meta.url),'utf8');
const backend=readFileSync(new URL('../../backend/what3words.py',import.meta.url),'utf8');
const about=readFileSync(new URL('../app/(tabs)/about.tsx',import.meta.url),'utf8');
test('Emergency uses body-only POST to IPM with no storage, telemetry or provider secret',()=>{
 assert.match(page,/method: 'POST'/);assert.match(page,/body: JSON.stringify\(\{ lat: coords.latitude, lng: coords.longitude \}\)/);
 assert.match(page,/cache: 'no-store'/);assert.match(page,/referrerPolicy: 'no-referrer'/);
 assert.doesNotMatch(page,/what3words\?|api\.what3words\.com|WHAT3WORDS_API_KEY|X-Api-Key|console\.|localStorage|sessionStorage|AsyncStorage|queueAnalyticsEvent|usePageAnalytics|reportError|captureException|useEffect/);
});
test('Emergency remains user initiated and independent of maps/notifications',()=>{
 assert.match(page,/onPress=\{\(\) => \{ void fetchWhat3Words\(\); \}\}/);
 assert.doesNotMatch(page,/TentedCity|vendorMap|notification|submitSOSReport|\/api\/sos/);
 assert.match(about,/router.push\('\/emergency-services' as never\)/);
 assert.match(page,/Call 911 first/);assert.match(page,/95 Durham Road/);
});
test('backend has bounded body/rate control and no logging/persistence sinks',()=>{
 assert.match(backend,/MAX_BODY_BYTES = 256/);assert.match(backend,/len\(attempts\) >= 6/);assert.match(backend,/len\(self.total\) >= 60/);
 assert.match(backend,/Cache-Control.*no-store/);
 assert.doesNotMatch(backend.replace(/#.*$/gm,''),/logger\.|logging\.|print\(|httpx\.|supabase|mongo|\.insert\(|\.update\(/);
});
