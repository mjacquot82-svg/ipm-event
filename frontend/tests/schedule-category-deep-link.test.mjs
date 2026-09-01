import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const utilitySource = await readFile(new URL('../src/utils/scheduleCategoryDeepLink.ts', import.meta.url), 'utf8');
const scheduleSource = await readFile(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(
  new URL('../../backend/import_manifests/mnp_lifestyles_2026.json', import.meta.url),
  'utf8',
));

const transpiled = ts.transpileModule(utilitySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const module = { exports: {} };
new Function('module', 'exports', transpiled)(module, module.exports);

const {
  MNP_LIFESTYLES_CATEGORY,
  MNP_LIFESTYLES_CATEGORY_SLUG,
  getScheduleCategorySlug,
  resolveScheduleCategory,
} = module.exports;
const categories = [...new Set(manifest.events.map((event) => event.category))];

test('permanent MNP slug resolves to the authoritative production category', () => {
  assert.equal(MNP_LIFESTYLES_CATEGORY, 'MNP Lifestyles Tent Events');
  assert.equal(MNP_LIFESTYLES_CATEGORY_SLUG, 'mnp-lifestyles');
  assert.deepEqual(categories, [MNP_LIFESTYLES_CATEGORY]);
  assert.equal(resolveScheduleCategory(MNP_LIFESTYLES_CATEGORY_SLUG, categories), MNP_LIFESTYLES_CATEGORY);
  assert.equal(manifest.events.filter((event) => event.category === MNP_LIFESTYLES_CATEGORY).length, manifest.events.length);
});

test('unknown and ambiguous query values fail closed without selecting a category', () => {
  assert.equal(resolveScheduleCategory('not-a-real-category', categories), null);
  assert.equal(resolveScheduleCategory('', categories), null);
  assert.equal(resolveScheduleCategory(['mnp-lifestyles'], categories), null);
});

test('the same mechanism supports stable slugs for other schedule categories', () => {
  const futureCategories = [...categories, '4-H Ontario Events'];
  assert.equal(getScheduleCategorySlug('4-H Ontario Events'), '4-h-ontario-events');
  assert.equal(resolveScheduleCategory('4-h-ontario-events', futureCategories), '4-H Ontario Events');
});

test('Schedule composes category with source and applies it through existing filter state', () => {
  assert.match(scheduleSource, /useLocalSearchParams<\{ source\?: string; category\?: string \| string\[\] \}>/);
  assert.match(scheduleSource, /usePageAnalytics\('schedule', source \|\| 'other'/);
  assert.match(scheduleSource, /setSelectedCategory\(resolveScheduleCategory\(category, categoryOptions\)\)/);
  assert.match(scheduleSource, /appliedCategoryQueryRef\.current === category/);
  assert.match(scheduleSource, /event\.category !== selectedCategory/);
  assert.match(scheduleSource, /setSelectedCategory\(null\)/);
  assert.match(scheduleSource, /const selectCategory = \(category: string \| null\)/);
});
