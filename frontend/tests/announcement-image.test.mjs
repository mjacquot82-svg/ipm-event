import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function loadComponent(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => {
    if (name === 'react-native') return require('react-native-web');
    if (name === '@expo/vector-icons') return { Feather: () => null };
    if (name.endsWith('theme/colors') || name.endsWith('../theme/colors')) {
      return { default: { surface: '#fff', border: '#ddd', textPrimary: '#111', textSecondary: '#444', textMuted: '#888', surfaceHighlight: '#eee', error: '#c00', primary: '#080' } };
    }
    if (name.endsWith('theme/attendeePageLayout') || name.endsWith('../theme/attendeePageLayout')) {
      return { ATTENDEE_CARD_RADIUS: 12 };
    }
    if (name.endsWith('spreadsheetDataService') || name.endsWith('../services/spreadsheetDataService')) {
      return {};
    }
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}

const { default: AnnouncementCard } = loadComponent('../src/components/AnnouncementCard.tsx');

const base = {
  id: 'a1', event_id: 'e1', title: 'Gate update', message: 'North gate closed',
  priority: 'Important', expires_at: null, created_by: 'Comms',
  created_at: '2026-09-10T12:00:00Z', updated_at: '2026-09-10T12:00:00Z', status: 'published',
};

test('text-only announcement still renders title and message', () => {
  const html = renderToStaticMarkup(React.createElement(AnnouncementCard, { announcement: base }));
  assert.match(html, /Gate update/);
  assert.match(html, /North gate closed/);
  assert.doesNotMatch(html, /<img/i);
});

test('announcement with image renders img and keeps title/body', () => {
  const html = renderToStaticMarkup(React.createElement(AnnouncementCard, {
    announcement: {
      ...base,
      image: {
        url: 'https://example.supabase.co/storage/v1/object/public/announcement-images/e1/x.png',
        alt: 'Closed gate',
        width: 120,
        height: 80,
        storage_path: 'e1/x.png',
      },
    },
  }));
  assert.match(html, /Gate update/);
  assert.match(html, /North gate closed/);
  assert.match(html, /alt="Closed gate"/);
  assert.match(html, /announcement-images/);
});

test('invalid image url does not remove title/body', () => {
  const html = renderToStaticMarkup(React.createElement(AnnouncementCard, {
    announcement: {
      ...base,
      image: { url: 'javascript:alert(1)', alt: 'bad', width: 10, height: 10, storage_path: 'x' },
    },
  }));
  assert.match(html, /Gate update/);
  assert.match(html, /North gate closed/);
  assert.doesNotMatch(html, /javascript:/);
});
