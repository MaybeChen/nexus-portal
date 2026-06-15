import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getPublicAssetRootUrl,
  resolvePublicAssetUrl,
} from './fileWorkspace.js';

test('maps public files directly under Vite BASE_URL', () => {
  assert.equal(getPublicAssetRootUrl('/wiseoffice/portal/'), '/wiseoffice/portal/');
});

test('preserves an explicit assets segment when it is actually part of BASE_URL', () => {
  assert.equal(getPublicAssetRootUrl('/wiseoffice/portal/assets/'), '/wiseoffice/portal/assets/');
});

test('canonicalizes known CDN and duplicated paths to the public root', () => {
  const baseUrl = '/wiseoffice/portal/';
  assert.equal(
    resolvePublicAssetUrl(
      'https://cdn.digitalhumanai.top/slidagent/pptx-craft/assets/css/fonts.css',
      baseUrl
    ),
    '/wiseoffice/portal/fonts.css'
  );
  assert.equal(
    resolvePublicAssetUrl('/wiseoffice/portal/assets/assets/NotoSansSC-Regular.ttf', baseUrl),
    '/wiseoffice/portal/NotoSansSC-Regular.ttf'
  );
  assert.equal(
    resolvePublicAssetUrl('/wiseoffice/portal/webfonts/fa-regular-400.woff2', baseUrl),
    '/wiseoffice/portal/fa-regular-400.woff2'
  );
});
