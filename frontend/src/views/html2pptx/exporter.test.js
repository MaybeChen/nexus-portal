import assert from 'node:assert/strict';
import test from 'node:test';

import { getFontAwesomeFaceDefinitions } from './exporter.js';

test('registers Font Awesome families with the correct files and weights', () => {
  const definitions = getFontAwesomeFaceDefinitions();
  const byFamilyAndWeight = new Map(
    definitions.map((definition) => [
      `${definition.family}:${definition.weight}`,
      definition.file,
    ])
  );

  assert.equal(
    byFamilyAndWeight.get('Font Awesome 6 Free:400'),
    'fa-regular-400.woff2'
  );
  assert.equal(
    byFamilyAndWeight.get('Font Awesome 6 Free:900'),
    'fa-solid-900.woff2'
  );
  assert.equal(
    byFamilyAndWeight.get('Font Awesome 6 Brands:400'),
    'fa-brands-400.woff2'
  );
  assert.equal(byFamilyAndWeight.get('FontAwesome:900'), 'fa-solid-900.woff2');
});
