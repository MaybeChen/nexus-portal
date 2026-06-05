// src/font-utils.js
import { Font, woff2 } from 'fonteditor-core';
import pako from 'pako';

/**
 * Converts various font formats to EOT (Embedded OpenType),
 * which is highly compatible with PowerPoint embedding.
 * @param {string} type - 'ttf', 'woff', or 'otf'
 * @param {ArrayBuffer} fontBuffer - The raw font data
 */
export async function fontToEot(type, fontBuffer) {
  if (type === 'woff2' && !woff2.isInited()) {
    await woff2.init();
  }

  const options = {
    type,
    hinting: true,
    // inflate is required for WOFF decoding
    inflate: type === 'woff' ? pako.inflate : undefined,
  };

  const font = Font.create(fontBuffer, options);

  const eotBuffer = font.write({
    type: 'eot',
    toBuffer: true,
  });

  if (eotBuffer instanceof ArrayBuffer) {
    return eotBuffer;
  }

  // Ensure we return an ArrayBuffer
  return eotBuffer.buffer.slice(eotBuffer.byteOffset, eotBuffer.byteOffset + eotBuffer.byteLength);
}
