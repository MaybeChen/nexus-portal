export const XMLNS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
export const XMLNS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
export const XMLNS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const EMU_PER_INCH = 914400;
export const DEFAULT_WIDTH = 13.333;
export const DEFAULT_HEIGHT = 7.5;

const encoder = new TextEncoder();

export function encodeText(value) {
  return encoder.encode(value);
}

export function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    bytes.set(part, offset);
    offset += part.length;
  });
  return bytes;
}

export function uint16(value) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

export function uint32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

export function inlineComputedStyles(source, clone) {
  if (source.nodeType !== Node.ELEMENT_NODE || clone.nodeType !== Node.ELEMENT_NODE) return;

  const computed = window.getComputedStyle(source);
  const inlineStyle = Array.from(computed)
    .map((property) => `${property}:${computed.getPropertyValue(property)};`)
    .join('');
  clone.setAttribute('style', inlineStyle);

  Array.from(source.children).forEach((child, index) => {
    if (clone.children[index]) inlineComputedStyles(child, clone.children[index]);
  });
}

export function elementToSvgData(target, width, height) {
  const clone = target.cloneNode(true);
  inlineComputedStyles(target, clone);
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');

  const html = new XMLSerializer().serializeToString(clone);
  const safeWidth = Math.ceil(width);
  const safeHeight = Math.ceil(height);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}"><foreignObject width="100%" height="100%">${html}</foreignObject></svg>`;
  return encodeText(svg);
}

export function resolveTargets(target) {
  const items = Array.isArray(target) ? target : [target];
  return items
    .map((item) => (typeof item === 'string' ? document.querySelector(item) : item))
    .filter(Boolean);
}

export function download(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
