// src/utils.js
export function getOwnerWindow(node) {
  return node?.ownerDocument?.defaultView || window;
}

export function getComputedStyleForNode(node) {
  return getOwnerWindow(node).getComputedStyle(node);
}

export function parseColor(color) {
  if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  const normalized = ctx.fillStyle;
  const rgba = normalized.match(/rgba?\(([^)]+)\)/);
  if (rgba) {
    const parts = rgba[1].split(',').map((p) => p.trim());
    const [r, g, b] = parts.map(Number);
    const a = parts[3] === undefined ? 1 : parseFloat(parts[3]);
    return {
      hex: [r, g, b].map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('').toUpperCase(),
      transparency: Math.round((1 - a) * 100),
    };
  }
  if (normalized.startsWith('#')) return { hex: normalized.slice(1).toUpperCase(), transparency: 0 };
  return null;
}

export function getTextStyle(style) {
  const color = parseColor(style.color);
  const fontSize = parseFloat(style.fontSize || '16') * 0.75;
  return {
    color: color?.hex || '000000',
    transparency: color?.transparency || 0,
    fontFace: (style.fontFamily || 'Arial').split(',')[0].replace(/["']/g, '').trim(),
    fontSize: Math.max(0.1, Math.floor(fontSize * 10) / 10),
    bold: style.fontWeight === 'bold' || parseInt(style.fontWeight, 10) >= 600,
    italic: style.fontStyle === 'italic',
    underline: style.textDecorationLine?.includes('underline'),
    align: style.textAlign === 'start' ? 'left' : style.textAlign,
    valign: 'mid',
    breakLine: false,
  };
}

export function isTextContainer(el) {
  if (!el || !el.childNodes) return false;
  return Array.from(el.childNodes).some((child) => child.nodeType === 3 && child.textContent.trim());
}

export function getVisibleShadow(style) {
  const shadow = style.boxShadow || style.textShadow;
  if (!shadow || shadow === 'none') return null;
  return { type: 'outer', color: '000000', opacity: 0.2, blur: 1, angle: 45, distance: 1 };
}

export function generateGradientSVG(gradient, width, height) {
  const firstColor = gradient.match(/#[0-9a-f]{3,8}|rgba?\([^)]+\)|\b[a-z]+\b/i)?.[0] || '#ffffff';
  const color = parseColor(firstColor) || { hex: 'FFFFFF' };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#${color.hex}"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export function getRotation(style) {
  const transform = style.transform;
  if (!transform || transform === 'none') return 0;
  const matrix = transform.match(/matrix\(([^)]+)\)/);
  if (!matrix) return 0;
  const [a, b] = matrix[1].split(',').map(Number);
  return Math.round(Math.atan2(b, a) * (180 / Math.PI));
}

export function getWritingModeVert(style) {
  return (style.writingMode || '').startsWith('vertical');
}

export async function svgToPng(svgElement) {
  const data = await svgToSvg(svgElement);
  return data;
}

export async function svgToSvg(svgElement) {
  const xml = new XMLSerializer().serializeToString(svgElement);
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(xml)))}`;
}

export function getPadding(style) {
  return {
    top: parseFloat(style.paddingTop) || 0,
    right: parseFloat(style.paddingRight) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
  };
}

export function getSoftEdges() {
  return null;
}

export function generateBlurredSVG() {
  return null;
}

export function getBorderInfo(style) {
  const width = parseFloat(style.borderWidth || style.borderTopWidth || '0') || 0;
  const color = parseColor(style.borderColor || style.borderTopColor);
  const radiusValue = parseFloat(style.borderRadius || style.borderTopLeftRadius || '0') || 0;
  const radius = { tl: radiusValue, tr: radiusValue, br: radiusValue, bl: radiusValue };
  return width > 0
    ? { radius, line: { color: color?.hex || '000000', transparency: color?.transparency || 0, width: width * 0.75 } }
    : { radius, line: null };
}

export function generateCompositeBorderSVG() {
  return null;
}

export function isClippedByParent(el, root) {
  let current = el.parentElement;
  while (current && current !== root) {
    const style = getComputedStyleForNode(current);
    if (['hidden', 'clip', 'scroll', 'auto'].includes(style.overflow)) return true;
    current = current.parentElement;
  }
  return false;
}

export function generateCustomShapeSVG() {
  return null;
}

export function getUsedFontFamilies(targets) {
  const families = new Set();
  targets.forEach((target) => {
    const root = typeof target === 'string' ? document.querySelector(target) : target;
    if (!root) return;
    [root, ...Array.from(root.querySelectorAll('*'))].forEach((element) => {
      const family = getComputedStyleForNode(element).fontFamily;
      if (family) families.add(family);
    });
  });
  return Array.from(families);
}

export async function getAutoDetectedFonts(usedFamilies = []) {
  const fonts = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules || [])) {
      if (rule.type !== CSSRule.FONT_FACE_RULE) continue;
      const family = rule.style.getPropertyValue('font-family').replace(/["']/g, '').trim();
      const src = rule.style.getPropertyValue('src');
      const url = src.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
      if (url && (!usedFamilies.length || usedFamilies.some((used) => used.includes(family)))) fonts.push({ name: family, url });
    }
  }
  return fonts;
}

export function extractTableData(table, scale = 1) {
  const rows = Array.from(table.rows).map((row) => Array.from(row.cells).map((cell) => ({ text: cell.textContent.trim(), options: getTextStyle(getComputedStyleForNode(cell)) })));
  const colCount = Math.max(...rows.map((row) => row.length), 1);
  const rect = table.getBoundingClientRect();
  return { rows, colWidths: Array.from({ length: colCount }, () => (rect.width / colCount / 96) * scale) };
}

export function collectTextParts(el) {
  const style = getComputedStyleForNode(el);
  const text = el.textContent || '';
  const options = getTextStyle(style);
  const href = el.closest?.('a')?.href;
  return [{ text, options: href ? { ...options, hyperlink: { url: href } } : options }];
}
