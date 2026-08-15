// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_ROOT_FILES = ['index.html', 'manifest.json', 'v2-icon.png', 'favicon.ico'];
const REQUIRED_EXPORTED_ASSETS = [
  { label: 'Expo JavaScript bundle', pattern: /(?:^|\/)entry-[a-f0-9]+\.js$/ },
  { label: 'Feather icon font', pattern: /(?:^|\/)Feather\.[a-f0-9]+\.ttf$/ },
  { label: 'Material Community icon font', pattern: /(?:^|\/)MaterialCommunityIcons\.[a-f0-9]+\.ttf$/ },
  { label: 'Home field image', pattern: /(?:^|\/)field\.[a-f0-9]+\.png$/ },
  { label: 'Home secondary image', pattern: /(?:^|\/)gemini4\.[a-f0-9]+\.png$/ },
  { label: 'attendee map image', pattern: /(?:^|\/)event-map\.[a-f0-9]+\.png$/ },
];

async function walkFiles(directory, relative = '') {
  const entries = await readdir(path.join(directory, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const next = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(directory, next));
    else files.push(next);
  }
  return files;
}

export async function buildOfflineWorker(exportDirectory) {
  const files = await walkFiles(exportDirectory);
  const selected = [...REQUIRED_ROOT_FILES];

  for (const required of REQUIRED_ROOT_FILES) {
    if (!files.includes(required)) throw new Error(`Missing required offline shell file: ${required}`);
  }

  for (const { label, pattern } of REQUIRED_EXPORTED_ASSETS) {
    const matches = files.filter((file) => pattern.test(file));
    if (matches.length !== 1) {
      throw new Error(`Expected exactly one ${label}; found ${matches.length}`);
    }
    selected.push(matches[0]);
  }

  const precacheAssets = selected.map((file) => `/${file}`).sort();
  const workerPath = path.join(exportDirectory, 'webpushr-sw.js');
  const workerSource = await readFile(workerPath);
  const hash = createHash('sha256').update(workerSource);
  let totalBytes = 0;
  for (const asset of precacheAssets) {
    const assetPath = path.join(exportDirectory, asset.slice(1));
    const contents = await readFile(assetPath);
    hash.update(asset).update(contents);
    totalBytes += (await stat(assetPath)).size;
  }

  const version = hash.digest('hex').slice(0, 16);
  const configuration = `self.__IPM_OFFLINE_CONFIG__=${JSON.stringify({ version, precacheAssets })};\n`;
  await writeFile(workerPath, Buffer.concat([Buffer.from(configuration), workerSource]));
  return { version, precacheAssets, totalBytes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const exportDirectory = path.resolve(process.argv[2] || 'dist');
  const result = await buildOfflineWorker(exportDirectory);
  console.log(`Offline shell ${result.version}: ${result.precacheAssets.length} files, ${result.totalBytes} bytes`);
  for (const asset of result.precacheAssets) console.log(`  ${asset}`);
}
