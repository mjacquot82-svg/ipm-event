import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const publicDirectory = new URL('../public/', import.meta.url);

function pngDimensions(contents) {
  assert.equal(contents.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(contents.subarray(12, 16).toString('ascii'), 'IHDR');
  return `${contents.readUInt32BE(16)}x${contents.readUInt32BE(20)}`;
}

test('manifest declares distinct, correctly sized any and maskable install icons', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', publicDirectory), 'utf8'));
  const expected = new Map([
    ['/ipm-icon-any-192.png', { sizes: '192x192', purpose: 'any' }],
    ['/ipm-icon-any-512.png', { sizes: '512x512', purpose: 'any' }],
    ['/ipm-icon-maskable-192.png', { sizes: '192x192', purpose: 'maskable' }],
    ['/ipm-icon-maskable-512.png', { sizes: '512x512', purpose: 'maskable' }],
  ]);

  assert.equal(manifest.icons.length, expected.size);
  for (const icon of manifest.icons) {
    const declaration = expected.get(icon.src);
    assert.ok(declaration, `unexpected manifest icon: ${icon.src}`);
    assert.deepEqual({ sizes: icon.sizes, purpose: icon.purpose }, declaration);
    assert.equal(icon.type, 'image/png');
    const contents = await readFile(new URL(icon.src.slice(1), publicDirectory));
    assert.equal(pngDimensions(contents), icon.sizes, icon.src);
  }
});
