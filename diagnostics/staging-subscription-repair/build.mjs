import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const source = dirname(fileURLToPath(import.meta.url));
if (!process.argv[2]) throw new Error('Provide an isolated staging artifact directory.');
const target = resolve(process.argv[2], 'api');
mkdirSync(target, { recursive: true });
for (const [from, to] of [['index.html', 'subscription-repair.html'], ['repair.mjs', 'subscription-repair.mjs'], ['page.mjs', 'subscription-repair-page.mjs']]) {
  writeFileSync(resolve(target, to), readFileSync(resolve(source, from), 'utf8').replace('../staging-subscription-compare/compare.mjs', './subscription-compare.mjs'));
}
console.log('Built three standalone staging assets; app and service worker preserved.');
