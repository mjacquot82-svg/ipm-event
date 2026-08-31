import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const schedule = await readFile(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8');

test('desktop category rendering has labels and tints without decorative category icons', () => {
  const desktopStart = schedule.indexOf('{categoryOptions.length > 0 && isDesktop && (');
  const desktopEnd = schedule.indexOf('{categoryOptions.length > 0 && !isDesktop && (');
  assert.ok(desktopStart >= 0 && desktopEnd > desktopStart);

  const desktop = schedule.slice(desktopStart, desktopEnd);
  assert.match(desktop, /categoryOptions\.map\(\(category\) =>/);
  assert.match(desktop, /backgroundColor: categoryStyle\.tint/);
  assert.match(desktop, /isActive && \{ backgroundColor: categoryStyle\.primary \}/);
  assert.match(desktop, /accessibilityState=\{\{ selected: isActive \}\}/);
  assert.match(desktop, /\{category\}/);
  assert.doesNotMatch(desktop, /<Feather/);
  assert.doesNotMatch(desktop, /categoryColourIndicator|categoryColorIndicator/);
});

test('narrow-mobile category rendering keeps labels, tints, and checkmark without decorative category icons', () => {
  const mobileStart = schedule.indexOf('{categoryOptions.length > 0 && !isDesktop && (');
  const mobileEnd = schedule.indexOf('{dayOptions.length > 0 && (');
  const sheetStart = schedule.indexOf('{/* Compact category selector for mobile widths. */}');
  const sheetEnd = schedule.indexOf('{/* Event Details Modal */}');
  assert.ok(mobileStart >= 0 && mobileEnd > mobileStart);
  assert.ok(sheetStart >= 0 && sheetEnd > sheetStart);

  const mobileControl = schedule.slice(mobileStart, mobileEnd);
  const mobileSheet = schedule.slice(sheetStart, sheetEnd);
  assert.match(mobileControl, /selectedCategoryStyle\.primary/);
  assert.match(mobileControl, /\{selectedCategory \|\| 'Categories'\}/);
  assert.doesNotMatch(mobileControl, /name="tag"|categoryColourIndicator|categoryColorIndicator/);
  assert.match(mobileSheet, /backgroundColor: category \? categoryStyle\.tint/);
  assert.match(mobileSheet, /accessibilityState=\{\{ selected: isActive \}\}/);
  assert.match(mobileSheet, /\{label\}/);
  assert.match(mobileSheet, /isActive && <Feather name="check"/);
  assert.doesNotMatch(mobileSheet, /name="tag"|categoryColourIndicator|categoryColorIndicator/);
});

test('no Schedule category tag glyph or colour legend remains in any responsive path', () => {
  assert.doesNotMatch(schedule, /name="tag"/);
  assert.doesNotMatch(schedule, /category(?:Colour|Color)(?:Dot|Indicator|Legend|Key)/);
});

test('event cards and detail category styling retain category colour treatments and labels', () => {
  assert.match(schedule, /styles\.eventCard, \{ backgroundColor: categoryStyle\.tint \}/);
  assert.match(schedule, /styles\.eventColorBar,[\s\S]*backgroundColor: categoryStyle\.primary/);
  assert.match(schedule, /borderTopColor: selectedEventCategoryStyle\.primary/);
  assert.match(schedule, /borderLeftColor: selectedEventCategoryStyle\.primary/);
  assert.match(schedule, /\{selectedEvent\.category\}/);
});
