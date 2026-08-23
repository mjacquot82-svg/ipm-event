import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const schedule = await readFile(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8');
const categoryStyles = await readFile(new URL('../src/theme/scheduleCategoryStyles.ts', import.meta.url), 'utf8');

const approved = [
  ['MNP Lifestyles Tent Events', '#00573D', '#FFFFFF'],
  ['CKNX Centennial Pavilion (GFO Stage) Lounge', '#826D40', '#2D2926'],
  ['Ontario Mutuals Main Stage - In the Britespan Building', '#043969', '#FFFFFF'],
  ['Parade Week', '#BF202E', '#FFFFFF'],
  ['The Bruce RV Park - Nightly Entertainment', '#FAA31B', '#2D2926'],
];

test('approved Schedule category mapping is exact and centralized', () => {
  for (const [category, primary, foreground] of approved) {
    assert.match(categoryStyles, new RegExp(`'${category.replace(/[()]/g, '\\$&')}': \\{ primary: '${primary}', tint: '#[0-9A-F]{6}', tintForeground: '#[0-9A-F]{6}', strongForeground: '${foreground}' \\}`));
    assert.equal([...schedule.matchAll(new RegExp(primary, 'g'))].length, 0, `${primary} must not be scattered through the component`);
  }
  assert.match(schedule, /import \{ getScheduleCategoryStyle \} from/);
});

test('unknown and missing categories receive only the neutral fallback', () => {
  assert.match(categoryStyles, /NEUTRAL_SCHEDULE_CATEGORY_STYLE/);
  assert.match(categoryStyles, /primary: '#6B7280'/);
  assert.match(categoryStyles, /tint: '#F1F3F5'/);
  assert.match(categoryStyles, /tintForeground: '#4B5563'/);
  assert.match(categoryStyles, /return SCHEDULE_CATEGORY_STYLES\[category\] \|\| NEUTRAL_SCHEDULE_CATEGORY_STYLE/);
});

test('every rendered event card derives tint, edge, time, and location identity from its category', () => {
  assert.match(schedule, /const categoryStyle = getScheduleCategoryStyle\(event\.category\)/);
  assert.match(schedule, /styles\.eventCard, \{ backgroundColor: categoryStyle\.tint \}/);
  assert.match(schedule, /backgroundColor: categoryStyle\.primary/);
  assert.match(schedule, /styles\.eventTime, \{ color: categoryStyle\.tintForeground \}/);
  assert.match(schedule, /styles\.locationBadge, \{ borderColor: categoryStyle\.primary \}/);
});

test('desktop category filters use category tint, strong colour, and approved foreground', () => {
  assert.match(schedule, /categoryOptions\.length > 0 && isDesktop/);
  assert.match(schedule, /backgroundColor: categoryStyle\.tint, borderColor: categoryStyle\.primary/);
  assert.match(schedule, /isActive && \{ backgroundColor: categoryStyle\.primary \}/);
  assert.match(schedule, /categoryStyle\.strongForeground/);
});

test('mobile selector retains compact structure and exposes category colour indicators', () => {
  assert.match(schedule, /categoryOptions\.length > 0 && !isDesktop/);
  assert.match(schedule, /styles\.categorySelectorButton/);
  assert.match(schedule, /styles\.categoryColourIndicator/);
  assert.match(schedule, /category \? categoryStyle\.primary : colors\.surface/);
  assert.match(schedule, /\[null, \.\.\.categoryOptions\]\.map/);
});

test('event detail modal carries restrained category identity and still opens normally', () => {
  assert.match(schedule, /setSelectedEvent\(event\)/);
  assert.match(schedule, /setShowEventModal\(true\)/);
  assert.match(schedule, /borderTopColor: selectedEventCategoryStyle\.primary/);
  assert.match(schedule, /backgroundColor: selectedEventCategoryStyle\.tint/);
  assert.match(schedule, /styles\.modalCategoryBadge/);
});

test('Starred, time formatting, search, day, and category filtering behavior remains intact', () => {
  assert.match(schedule, /handleToggleFavorite\(event\.id\)/);
  assert.match(schedule, /accessibilityState=\{\{ selected: isFavorite \}\}/);
  assert.match(schedule, /showFavoritesOnly && !favorites\.includes\(event\.id\)/);
  assert.match(schedule, /formatScheduleTimeRange\(event\.start_time, event\.end_time\)/);
  assert.match(schedule, /selectedCategory && event\.category !== selectedCategory/);
  assert.match(schedule, /selectedDay && !getEventDayLabels\(event\)\.includes\(selectedDay\)/);
  assert.match(schedule, /normalizedSearch/);
  assert.doesNotMatch(schedule, /event\.(category|title|description|start_date|start_time|end_time|location_name)\s*=/);
});
