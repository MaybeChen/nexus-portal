import assert from 'node:assert/strict';
import test from 'node:test';

import { getPublicAssetRootUrl } from './fileWorkspace.js';

test('adds the public assets segment once', () => {
  assert.equal(getPublicAssetRootUrl('/wiseoffice/portal/'), '/wiseoffice/portal/assets/');
});

test('does not duplicate an assets segment already present in BASE_URL', () => {
  assert.equal(getPublicAssetRootUrl('/wiseoffice/portal/assets/'), '/wiseoffice/portal/assets/');
});
