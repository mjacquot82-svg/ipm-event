import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const root = new URL('../../', import.meta.url);
const authority = '317ccd4faf72d5adcae086e84ee51bea5321892a';
const baseline = '1b63ce2e140015fb25ef6137143217e25c856c27';
const read = p => readFileSync(new URL(p, root), 'utf8');
const historical = (sha, p) => execFileSync('git', ['show', `${sha}:${p}`], {cwd:root, encoding:'utf8'});
const homePath='frontend/app/(tabs)/index.tsx';
const pagePath='frontend/app/(tabs)/emergency-services.tsx';
const home=read(homePath), staging=historical(authority,homePath);
const marker='          <View style={styles.quickActionsGrid}>\n';
const begin=staging.indexOf('            <TouchableOpacity\n',staging.indexOf(marker));
const card=staging.slice(begin,staging.indexOf('</TouchableOpacity>',begin)+'</TouchableOpacity>'.length);
test('the exact staging Emergency card is first, preserving every existing Home byte',()=>{
  assert.equal(home,historical(baseline,homePath).replace(marker,marker+card+'\n\n'));
  assert.match(card,/accessibilityLabel="Emergency Services"/);
  assert.match(card,/<Feather name="alert-triangle" size=\{22\} color="#FFFFFF"/);
  assert.match(card,/router.push\('\/emergency-services' as never\)/);
  assert(home.indexOf(card)<home.indexOf("quickAction('map'"));
});
test('Emergency JSX, copy, layout and location flow exactly match staging while retaining private POST',()=>{
  const page=read(pagePath), approved=historical(authority,pagePath);
  const jsx='  return (\n    <View';
  assert.equal(page.slice(page.indexOf(jsx)),approved.slice(approved.indexOf(jsx)));
  const flow=s=>s.slice(s.indexOf('function withTimeout'),s.indexOf('function apiErrorMessage'));
  assert.equal(flow(page),flow(approved));
  assert.equal(page,historical(baseline,pagePath));
  assert.match(page,/method: 'POST'/);
  assert.doesNotMatch(page,/what3words\?|localStorage|sessionStorage|console\.|WHAT3WORDS_API_KEY|usePageAnalytics/);
});
test('shared responsive styling, Share, map, notification and itinerary source remain production bytes',()=>{
  for(const p of ['frontend/src/theme/attendeePageLayout.ts','frontend/src/theme/colors.ts',
    'frontend/src/utils/shareIpm.ts','frontend/src/components/admin/AnalyticsDashboard.tsx',
    'frontend/app/(tabs)/map.tsx',
    'frontend/app/(tabs)/schedule.tsx','backend/what3words.py']) {
    assert.equal(read(p),historical(baseline,p),p);
  }
});
