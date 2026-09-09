import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = await readFile(new URL('../public/webpushr-sw.js', import.meta.url), 'utf8');
const html = '<script src="/_expo/static/js/web/entry-B.js" defer></script>';
function setup(prior) {
  const stores = new Map(Object.entries(prior));
  let downloads = 0;
  const key = x => new URL(typeof x === 'string' ? x : x.url, 'https://staging.theipm.ca').pathname;
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    open: async name => {
      if (!stores.has(name)) stores.set(name, new Map());
      const data = stores.get(name);
      return {
        match: async request => data.has(key(request)) ? new Response(data.get(key(request))) : undefined,
        keys: async () => [...data.keys()].map(path => ({ url: 'https://staging.theipm.ca' + path })),
        put: async (request, response) => data.set(key(request), await response.text()),
        addAll: async () => { downloads++; throw Error('update server unavailable'); },
      };
    },
  };
  const handlers = {};
  vm.runInNewContext(source, { URL, console: { error() {} }, caches,
    self: { location: { href: 'https://staging.theipm.ca/webpushr-sw.js' },
      clients: { claim: async () => {} }, addEventListener: (name, fn) => handlers[name] = fn } });
  const run = async name => { let promise; handlers[name]({ waitUntil: p => promise = p }); await promise; };
  return { stores, run, downloads: () => downloads };
}
test('upgrade installation inherits usable B without any network, then activation retains B', async () => {
  const h = setup({ 'ipm-offline-shell-B': new Map([
    ['/index.html', html], ['/_expo/static/js/web/entry-B.js', 'B'],
    ['/_expo/static/js/web/entry-A.js', 'obsolete'], ['/font.ttf', 'font'],
  ]) });
  await h.run('install');
  assert.equal(h.downloads(), 0);
  assert.equal(h.stores.get('ipm-offline-shell-B').size, 4, 'incumbent cache is not modified');
  await h.run('activate');
  assert.equal(h.stores.size, 1);
  const current = h.stores.get('ipm-offline-shell-development');
  assert.equal(current.get('/index.html'), html);
  assert.equal(current.get('/_expo/static/js/web/entry-B.js'), 'B');
  assert.equal(current.get('/font.ttf'), 'font');
  assert.equal(current.has('/_expo/static/js/web/entry-A.js'), false);
});
test('incomplete failed-install caches cannot replace the last-known-good shell', async () => {
  const h = setup({
    'ipm-offline-shell-B': new Map([['/index.html', html], ['/_expo/static/js/web/entry-B.js', 'B']]),
    'ipm-offline-shell-failed': new Map([['/index.html', '<script src="/_expo/static/js/web/entry-C.js"></script>']]),
  });
  await h.run('install');
  assert.equal(h.downloads(), 0);
  assert.equal(h.stores.get('ipm-offline-shell-development').get('/index.html'), html);
});
test('failed first install rejects instead of activating an empty offline shell', async () => {
  const h = setup({});
  await assert.rejects(h.run('install'), /update server unavailable/);
  assert.equal(h.downloads(), 1);
});
