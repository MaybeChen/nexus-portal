import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getRenderedPseudoContent,
  isIconFontStyle,
} from './element-capture.js';

test('decodes quoted Font Awesome private-use glyphs', () => {
  assert.equal(getRenderedPseudoContent('"\\f140"'), '\uf140');
  assert.equal(getRenderedPseudoContent("'\\e005'"), '\ue005');
});

test('preserves browser-resolved pseudo-element glyphs', () => {
  assert.equal(getRenderedPseudoContent('"\uf140"'), '\uf140');
});

test('ignores pseudo-elements without rendered content', () => {
  assert.equal(getRenderedPseudoContent('none'), '');
  assert.equal(getRenderedPseudoContent('normal'), '');
  assert.equal(getRenderedPseudoContent('""'), '');
});

test('recognizes common icon font family names', () => {
  assert.equal(isIconFontStyle({ fontFamily: '"Font Awesome 6 Free"' }), true);
  assert.equal(isIconFontStyle({ fontFamily: 'FontAwesome' }), true);
  assert.equal(isIconFontStyle({ fontFamily: 'Bootstrap Icons' }), true);
  assert.equal(isIconFontStyle({ fontFamily: 'Noto Sans SC' }), false);
});
