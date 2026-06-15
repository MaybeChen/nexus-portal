import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getPublicAssetRootUrl,
  removeUnavailableFontFallbacks,
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

test('removes unavailable Font Awesome TTF fallbacks while retaining WOFF2', () => {
  const css = `
    @font-face {
      font-family: "Font Awesome 6 Brands";
      src: url("./fa-brands-400.woff2") format("woff2"),
           url("./fa-brands-400.ttf") format("truetype");
    }
  `;
  const rewritten = removeUnavailableFontFallbacks(css);

  assert.match(rewritten, /fa-brands-400\.woff2/);
  assert.doesNotMatch(rewritten, /fa-brands-400\.ttf/);
});

test('keeps a Font Awesome TTF fallback when it exists in the uploaded workspace', () => {
  const css = 'src: url("./fa-brands-400.ttf") format("truetype");';
  const fileMap = new Map([
    ['styles/fa-brands-400.ttf', { url: 'blob:font-awesome-ttf' }],
  ]);

  assert.equal(removeUnavailableFontFallbacks(css, 'styles/all.min.css', fileMap), css);
});
