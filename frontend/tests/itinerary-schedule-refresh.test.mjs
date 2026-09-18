import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const itinerary = await readFile(new URL('../app/(tabs)/itinerary.tsx', import.meta.url), 'utf8');

test('My Itinerary revalidates Schedule on focus without clearing cached events', () => {
  assert.match(itinerary, /const scheduleFetchInFlight = useRef\(false\)/);
  assert.match(itinerary, /const fetchSchedule = useCallback\(async \(forceNetwork = false\)/);
  assert.match(itinerary, /preferCache: !forceNetwork/);
  assert.match(itinerary, /if \(scheduleFetchInFlight\.current\) return/);
  assert.match(itinerary, /fetchSchedule\(true\)/);
  assert.match(itinerary, /if \(!forceNetwork\) setError\('Unable to load itinerary\.'\)/);
});

test('focus refresh runs alongside favorite reconciliation and reminder status', () => {
  const focus = itinerary.slice(itinerary.indexOf('useFocusEffect'), itinerary.indexOf('const changeReminderStatus'));
  assert.match(focus, /Promise\.all\(/);
  assert.match(focus, /loadFavorites\(\)/);
  assert.match(focus, /fetchSchedule\(true\)/);
});

test('revalidation remains bounded and does not require a manual refresh', () => {
  assert.doesNotMatch(itinerary, /setInterval\([^\n]*fetchSchedule/);
  assert.doesNotMatch(itinerary, /clearFavorites\(\)/);
  assert.doesNotMatch(itinerary, /toggleFavorite\([^\n]*\)\.then\([^\n]*fetchSchedule/);
});
