import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const schedule = await readFile(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8');
const categoryStyles = await readFile(new URL('../src/theme/scheduleCategoryStyles.ts', import.meta.url), 'utf8');

const approved = [
  ['MNP Lifestyles Tent Events', '#00573D', '#E5F1ED', '#00573D', '#FFFFFF', '#FFFFFF'],
  ['CKNX Centennial Pavilion (GFO Stage) Lounge', '#826D40', '#F2EEE5', '#5B4B2A', '#FFFFFF', '#FFFFFF'],
  ['Ontario Mutuals Main Stage - In the Britespan Building', '#043969', '#E6EDF4', '#043969', '#FFFFFF', '#FFFFFF'],
  ['Parade Week', '#BF202E', '#F9E8EA', '#9D1723', '#FFFFFF', '#FFFFFF'],
  ['The Bruce RV Park - Nightly Entertainment', '#FAA31B', '#FFF1D9', '#704000', '#2D2926', '#2D2926'],
];

function relativeLuminance(hex) {
  const channels = hex.slice(1).match(/../g).map((channel) => Number.parseInt(channel, 16) / 255);
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrastRatio(first, second) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

test('every approved Schedule category maps to the exact centralized colours', () => {
  for (const [category, primary, tint, tintForeground, strongForeground, selectedFilterForeground] of approved) {
    const escapedCategory = category.replace(/[()]/g, '\\$&');
    assert.match(categoryStyles, new RegExp(`'${escapedCategory}': \\{ primary: '${primary}', tint: '${tint}', tintForeground: '${tintForeground}', strongForeground: '${strongForeground}', selectedFilterForeground: '${selectedFilterForeground}' \\}`));
    assert.equal([...schedule.matchAll(new RegExp(primary, 'g'))].length, 0, `${primary} must remain centralized`);
  }
  assert.match(schedule, /import \{ getScheduleCategoryStyle \} from/);
});

test('unknown and missing categories use the exact neutral fallback', () => {
  for (const value of ["primary: '#6B7280'", "tint: '#F1F3F5'", "tintForeground: '#4B5563'", "strongForeground: '#FFFFFF'", "selectedFilterForeground: '#FFFFFF'"]) {
    assert.ok(categoryStyles.includes(value));
  }
  assert.match(categoryStyles, /if \(!category\) return NEUTRAL_SCHEDULE_CATEGORY_STYLE/);
  assert.match(categoryStyles, /return SCHEDULE_CATEGORY_STYLES\[category\] \|\| NEUTRAL_SCHEDULE_CATEGORY_STYLE/);
});

test('CKNX detail badge uses the authorized WCAG AA white foreground', () => {
  const cknx = approved.find(([category]) => category.startsWith('CKNX'));
  assert.equal(cknx[4], '#FFFFFF');
  assert.ok(contrastRatio(cknx[1], cknx[4]) >= 4.5);
  assert.ok(contrastRatio('#826D40', '#2D2926') < 4.5, 'the rejected staging combination must not return');
  assert.match(schedule, /modalCategoryBadgeText, \{ color: selectedEventCategoryStyle\.strongForeground \}/);
});

test('all approved text/background combinations retain WCAG AA contrast', () => {
  for (const [category, primary, tint, tintForeground, strongForeground, selectedFilterForeground] of approved) {
    assert.ok(contrastRatio(tint, tintForeground) >= 4.5, `${category} tint text contrast`);
    assert.ok(contrastRatio(primary, strongForeground) >= 4.5, `${category} detail badge contrast`);
    assert.ok(contrastRatio(primary, selectedFilterForeground) >= 4.5, `${category} selected filter contrast`);
  }
  assert.ok(contrastRatio('#F1F3F5', '#4B5563') >= 4.5);
  assert.ok(contrastRatio('#6B7280', '#FFFFFF') >= 4.5);
});

test('Schedule cards, filters, mobile sheet, and detail modal use category styles', () => {
  assert.match(schedule, /const categoryStyle = getScheduleCategoryStyle\(event\.category\)/);
  assert.match(schedule, /styles\.eventCard, \{ backgroundColor: categoryStyle\.tint \}/);
  assert.match(schedule, /styles\.eventColorBar,[\s\S]*backgroundColor: categoryStyle\.primary/);
  assert.match(schedule, /backgroundColor: categoryStyle\.tint, borderColor: categoryStyle\.primary/);
  assert.match(schedule, /backgroundColor: category \? categoryStyle\.tint : colors\.surfaceHighlight/);
  assert.match(schedule, /borderTopColor: selectedEventCategoryStyle\.primary/);
  assert.match(schedule, /backgroundColor: selectedEventCategoryStyle\.tint/);
});

test('category names and non-colour selected-state cues remain visible', () => {
  assert.match(schedule, /accessibilityLabel=\{`Filter by \$\{category\}`\}/);
  assert.match(schedule, /\{category\}[\s\S]*<\/Text>/);
  assert.match(schedule, /const label = category \|\| 'All categories'/);
  assert.match(schedule, /accessibilityState=\{\{ selected: isActive \}\}/);
  assert.match(schedule, /isActive && styles\.categoryOptionSelected/);
  assert.match(schedule, /isActive && <Feather name="check"/);
  assert.match(schedule, /isActive && \{ fontWeight: '700' \}/);
  assert.match(schedule, /\{selectedEvent\.category\}/);
});

test('mobile selected-category label keeps the existing category colour treatment', () => {
  assert.match(schedule, /selectedCategory && \{[\s\S]*?backgroundColor: selectedCategoryStyle\.primary,[\s\S]*?borderColor: selectedCategoryStyle\.primary/);
  assert.match(schedule, /\{selectedCategory \|\| 'Categories'\}/);
  assert.match(schedule, /selectedCategory && \{ color: selectedCategoryStyle\.selectedFilterForeground \}/);
});

test('Schedule category controls do not render decorative colour dots or a colour legend', () => {
  assert.doesNotMatch(schedule, /categoryColourIndicator/);
  assert.doesNotMatch(schedule, /category(?:Colour|Color)(?:Dot|Legend|Key)/);
});

test('production event fields and ordering remain read-only', () => {
  assert.doesNotMatch(schedule, /event\.(id|category|title|description|start_date|start_time|end_time|location_name|days_active)\s*=/);
  assert.match(schedule, /setEvents\(result\.data\.events\)/);
  assert.match(schedule, /renderItem=\{\(\{ item: event \}\) =>/);
  assert.doesNotMatch(categoryStyles, /ScheduleEvent|setEvents|getScheduleData|sort\(/);
});

test('backport does not introduce staging notification or reminder functionality', () => {
  assert.doesNotMatch(schedule, /WonderPush|Webpushr|reminderUx|itineraryReminder|T-30|Device A\/B|calendarService|showReminderPrompt/i);
  assert.doesNotMatch(categoryStyles, /notification|reminder|wonderpush|webpushr|calendar/i);
});
