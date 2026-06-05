let _ctx;
function getCtx() {
  if (!_ctx) _ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  return _ctx;
}
export function getGradientFallbackColor(bgImage, style) {
  if (!bgImage || bgImage === 'none') return null;

  let resolvedBgImage = bgImage;
  if (style) {
    resolvedBgImage = resolveCssVariables(bgImage, style);
  }

  // 1. Extract content inside function(...)
  // Handles linear-gradient(...), radial-gradient(...), repeating-linear-gradient(...)
  const match = resolvedBgImage.match(/gradient\((.*)\)/);
  if (!match) return null;

  const content = match[1];

  // 2. Split by comma, respecting parentheses (to avoid splitting inside rgb(), oklch(), etc.)
  const parts = [];
  let current = '';
  let parenDepth = 0;

  for (const char of content) {
    if (char === '(') parenDepth++;
    if (char === ')') parenDepth--;
    if (char === ',' && parenDepth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current) parts.push(current.trim());

  // 3. Find first part that is a color (skip angle/direction)
  for (const part of parts) {
    // Ignore directions (to right) or angles (90deg, 0.5turn)
    if (/^(to\s|[\d.]+(deg|rad|turn|grad))/.test(part)) continue;

    // Extract color: Remove trailing position (e.g. "red 50%" -> "red")
    // Regex matches whitespace + number + unit at end of string
    const colorPart = part.replace(/\s+(-?[\d.]+(%|px|em|rem|ch|vh|vw)?)$/, '');

    // Check if it's not just a number (some gradients might have bare numbers? unlikely in standard syntax)
    if (colorPart) return colorPart;
  }

  return null;
}
export function resolveCssVariables(value, style) {
  if (!value || typeof value !== 'string') return value;
  let resolved = value;
  let match;
  let iterations = 0;
  // Limit to 10 iterations to prevent infinite loop
  while ((match = resolved.match(/var\((--[a-zA-Z0-9_-]+)\)/)) && iterations < 10) {
    iterations++;
    const varName = match[1];
    const varValue = style.getPropertyValue(varName).trim();
    if (varValue) {
      resolved = resolved.replace(match[0], varValue);
    } else {
      break;
    }
  }
  return resolved;
}

export function parseColor(str, style) {
  if (!str) return { hex: null, opacity: 0 };
  let resolvedStr = str;
  if (style) {
    resolvedStr = resolveCssVariables(str, style);
  }
  if (resolvedStr === 'transparent' || resolvedStr.trim() === 'rgba(0, 0, 0, 0)') {
    return { hex: null, opacity: 0 };
  }

  const ctx = getCtx();
  ctx.fillStyle = resolvedStr;
  const computed = ctx.fillStyle;

  // 1. Handle Hex Output (e.g. #ff0000) - Fast Path
  if (computed.startsWith('#')) {
    let hex = computed.slice(1);
    let opacity = 1;
    if (hex.length === 3)
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    if (hex.length === 4)
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    if (hex.length === 8) {
      opacity = parseInt(hex.slice(6), 16) / 255;
      hex = hex.slice(0, 6);
    }
    return { hex: hex.toUpperCase(), opacity };
  }

  // 2. Handle RGB/RGBA Output (standard) - Fast Path
  if (computed.startsWith('rgb')) {
    const match = computed.match(/[\d.]+/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0]);
      const g = parseInt(match[1]);
      const b = parseInt(match[2]);
      const a = match.length > 3 ? parseFloat(match[3]) : 1;
      const hex = ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
      return { hex, opacity: a };
    }
  }

  // 3. Fallback: Browser returned a format we don't parse (oklch, lab, color(srgb...), etc.)
  // Use Canvas API to convert to sRGB
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  // data = [r, g, b, a]
  const r = data[0];
  const g = data[1];
  const b = data[2];
  const a = data[3] / 255;

  if (a === 0) return { hex: null, opacity: 0 };

  const hex = ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
  return { hex, opacity: a };
}
