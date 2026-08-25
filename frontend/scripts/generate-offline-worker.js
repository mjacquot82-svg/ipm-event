const { createHash } = require('node:crypto');
const { readdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join, relative, sep } = require('node:path');

const root = join(__dirname, '..');
const dist = join(root, 'dist');
const workerPath = join(dist, 'webpushr-sw.js');

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const coreImage = /\/(ipm-logo|field|event-map)\.[^/]+\.(png|jpe?g)$/i;
const coreFont = /\/(Feather|MaterialCommunityIcons)\.[^/]+\.ttf$/i;
const essential = walk(dist).filter((path) => {
  const url = `/${relative(dist, path).split(sep).join('/')}`;
  return path !== workerPath && (/\.(js|css|woff2?)$/i.test(url) || coreFont.test(url))
    || coreImage.test(url)
    || /^\/(manifest\.json|v2-icon\.png|ipm-icon-(any|maskable)-(192|512)\.png)$/.test(url);
});
const assets = ['/', '/index.html', ...essential.map((path) => `/${relative(dist, path).split(sep).join('/')}`)]
  .filter((value, index, all) => all.indexOf(value) === index)
  .sort();
const digest = createHash('sha256');
for (const asset of assets) {
  digest.update(asset);
  if (asset !== '/') digest.update(readFileSync(join(dist, asset.slice(1))));
}
const version = digest.digest('hex').slice(0, 16);
let worker = readFileSync(join(root, 'public', 'webpushr-sw.js'), 'utf8');
worker = worker.replace("const IPM_OFFLINE_VERSION = 'development';", `const IPM_OFFLINE_VERSION = '${version}';`)
  .replace("const IPM_SHELL_ASSETS = ['/', '/index.html', '/manifest.json'];",
    `const IPM_SHELL_ASSETS = ${JSON.stringify(assets, null, 2)};`);
writeFileSync(workerPath, worker);
console.log(`Generated ${relative(root, workerPath)} with ${assets.length} shell assets (${version}).`);
