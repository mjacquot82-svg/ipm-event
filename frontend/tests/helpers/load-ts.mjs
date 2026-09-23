import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
export function createTsLoader() {
  const cache = new Map();
  function load(url) {
    if (cache.has(url.href)) return cache.get(url.href).exports;
    const mod = { exports: {} };
    cache.set(url.href, mod);
    const source = ts.transpileModule(fs.readFileSync(url, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2019 },
    }).outputText;
    const require = (name) => name.endsWith('.json')
      ? JSON.parse(fs.readFileSync(new URL(name, url), 'utf8'))
      : name.startsWith('.') ? load(new URL(name.endsWith('.ts') ? name : name + '.ts', url)) : createRequire(url)(name);
    new Function('require', 'module', 'exports', source)(require, mod, mod.exports);
    return mod.exports;
  }
  return load;
}
