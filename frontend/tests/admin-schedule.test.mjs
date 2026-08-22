import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../app/admin/index.tsx', import.meta.url), 'utf8');

test('Organizer Portal treats schedule end time as optional', () => {
  assert.match(source, /\{ key: 'end_time', label: 'End Time', required: false \}/);
  assert.doesNotMatch(source, /errors\.push\('End Time is required'\)/);
  assert.match(source, /label="End time" value=\{form\.end_time\} placeholder="End time \(optional\)"/);
});

test('Organizer schedule lists retain normal start-to-end rendering when both values exist', () => {
  assert.match(source, /\[event\.start_time, event\.end_time\]\.filter\(Boolean\)\.join\(' - '\)/);
});
