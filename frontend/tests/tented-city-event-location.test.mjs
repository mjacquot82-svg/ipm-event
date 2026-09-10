import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const semantic = fs.readFileSync(new URL('../src/config/tentedCitySemanticMap.ts', import.meta.url), 'utf8');
const venues = fs.readFileSync(new URL('../src/config/tentedCityVenues.ts', import.meta.url), 'utf8');
const map = fs.readFileSync(new URL('../src/components/TentedCityMap.tsx', import.meta.url), 'utf8');
const schedule = fs.readFileSync(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8');

test('schedule event map locations resolve audited Foxton and Davishill labels', () => {
  assert.match(schedule, /showOnly:\s*['"]true['"]/);
  assert.match(schedule, /source:\s*['"]schedule['"]/);
  assert.match(semantic, /'EVENT CENTRE 1 WEST 2':\s*'dancing-tractors-combine-derby-west-2'/);
  assert.match(venues, /'Quality Homes - Stage'/);
  assert.match(venues, /'The Beyond Wireless Stage'/);
});

test('initial location selection activates a semantic region and focuses its camera', () => {
  assert.match(map, /findSemanticAreaForLocation\(initialQuery\)/);
  assert.match(map, /selectSemanticArea\(semanticArea\)/);
  assert.match(map, /applyFocus\(semanticAreaRect\(area\)/);
  assert.match(map, /semanticHitboxActive/);
});

test('unmapped initial locations show a safe attendee message without a highlight', () => {
  assert.match(map, /setUnmappedInitialLocation\(true\)/);
  assert.match(map, /This location isn’t mapped yet\./);
  assert.match(map, /accessibilityRole="alert"/);
  assert.match(map, /unmappedInitialLocation \? \(/);
  assert.match(map, /place\.kind === 'stage' && !place\.venue\.rect/);
});
