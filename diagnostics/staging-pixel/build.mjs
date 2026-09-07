import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const source = dirname(fileURLToPath(import.meta.url));
const destination = process.argv[2];
if (!destination) throw new Error('Provide an isolated staging artifact directory.');
const target = resolve(destination, 'api');
mkdirSync(target, { recursive: true });
for (const [from, to] of [['index.html', 'pixel-diagnostic.html'], ['diagnostic.mjs', 'pixel-diagnostic.mjs'], ['page.mjs', 'pixel-diagnostic-page.mjs']]) {
  copyFileSync(resolve(source, from), resolve(target, to));
}
console.log('Built three isolated staging diagnostic assets; app and worker are not rebuilt.');
