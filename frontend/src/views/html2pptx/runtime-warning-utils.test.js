import assert from 'node:assert/strict';
import test from 'node:test';

import {
  injectIframeWarningFilter,
  isIgnoredIframeWarning,
} from './runtime-warning-utils.js';

test('ignores only the Tailwind CDN production warning', () => {
  assert.equal(
    isIgnoredIframeWarning(['cdn.tailwindcss.com should not be used in production.']),
    true
  );
  assert.equal(isIgnoredIframeWarning(['Failed to decode downloaded font']), false);
});

test('injects the warning filter before existing head scripts', () => {
  const html = '<html><head><script src="tailwind.js"></script></head><body></body></html>';
  const filteredHtml = injectIframeWarningFilter(html);

  assert.ok(
    filteredHtml.indexOf('data-html2pptx-warning-filter') <
      filteredHtml.indexOf('src="tailwind.js"')
  );
});
