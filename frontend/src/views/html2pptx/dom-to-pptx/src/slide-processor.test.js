import assert from 'node:assert/strict';
import test from 'node:test';

import { compareKeys } from './slide-processor.js';

test('sorts background layers below foreground layers with the same stacking key', () => {
  assert.ok(compareKeys([0, -Infinity], [0, 0, -1]) < 0);
});
