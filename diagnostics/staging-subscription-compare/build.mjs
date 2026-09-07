import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const source = dirname(fileURLToPath(import.meta.url));
if (!process.argv[2]) throw new Error('Provide an isolated staging artifact directory.');
const target = resolve(process.argv[2], 'api');
mkdirSync(target, { recursive: true });
for (const [from, to] of [['index.html', 'subscription-compare.html'], ['compare.mjs', 'subscription-compare.mjs'], ['page.mjs', 'subscription-compare-page.mjs']]) {
  copyFileSync(resolve(source, from), resolve(target, to));
}
console.log('Built three standalone staging assets; app and service worker preserved.');
