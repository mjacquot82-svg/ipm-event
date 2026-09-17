import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync(new URL('../src/services/adminAuthService.ts', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../app/admin/index.tsx', import.meta.url), 'utf8');
const card = readFileSync(new URL('../src/components/AnnouncementCard.tsx', import.meta.url), 'utf8');

test('deploy previews block admin writes before fetch and production stays enabled', () => {
  assert.match(service, /isDeployPreviewRuntime/);
  assert.match(service, /hostname\.endsWith\('\.netlify\.app'\)/);
  assert.match(service, /path\.startsWith\('\/api\/admin\/'\)/);
  assert.match(service, /throw new Error\(PREVIEW_ONLY_MESSAGE\)/);
  assert.match(service, /theipm\.ca/);
});

test('preview image selection uses browser-local object URLs and never uploads', () => {
  assert.match(admin, /URL\.createObjectURL\(file\)/);
  assert.match(admin, /URL\.revokeObjectURL/);
  assert.match(admin, /preview-local\//);
});

test('preview actions expose the harmless safety message', () => {
  assert.match(service, /Preview only — nothing was sent or published\./);
  assert.match(admin, /isDeployPreviewRuntime\(\)/);
});

test('notification preview preserves image proportions instead of forcing a crop', () => {
  assert.match(admin, /maxWidth: '100%', maxHeight: 180/);
  assert.match(admin, /width: 'auto', height: 'auto'/);
  assert.match(admin, /objectFit: 'contain'/);
  assert.doesNotMatch(admin, /width: '100%', maxHeight: 150, objectFit: 'cover'/);
});

test('in-app preview uses the attendee AnnouncementCard image presentation for local images', () => {
  assert.match(admin, /<AnnouncementCard preview announcement=\{\{/);
  assert.match(admin, /image: form\.image \|\| null/);
  assert.match(card, /allowLocal && image\.url\.startsWith\('blob:'\)/);
  assert.match(card, /AnnouncementImageView image=\{announcement\.image\} allowLocal=\{preview\}/);
  assert.match(card, /resizeMode="contain"/);
});
