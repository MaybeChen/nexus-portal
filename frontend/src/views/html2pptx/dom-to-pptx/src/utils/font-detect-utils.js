import { getComputedStyleForNode } from './dom-utils.js';
import { getPrimaryFontFace, isPrivateUseText, normalizeFontFaceForPpt } from './text-style-utils.js';

export function getUsedFontFamilies(root) {
  const families = new Set();

  function scan(node) {
    if (node.nodeType === 1) {
      // Element
      const style = getComputedStyleForNode(node);
      const primary = normalizeFontFaceForPpt(style);
      if (primary) families.add(primary);
      for (const pseudoElement of ['::before', '::after']) {
        const pseudoStyle = getComputedStyleForNode(node, pseudoElement);
        const content = pseudoStyle.content;
        if (!content || content === 'none' || content === 'normal' || content === '""') continue;
        const cleanContent = content.replace(/^["']|["']$/g, '');
        if (isPrivateUseText(cleanContent)) {
          const iconFont = getPrimaryFontFace(pseudoStyle);
          if (iconFont) families.add(iconFont);
        }
      }
    }
    for (const child of node.childNodes) {
      scan(child);
    }
  }

  // Handle array of roots or single root
  const elements = Array.isArray(root) ? root : [root];
  elements.forEach((el) => {
    const node = typeof el === 'string' ? document.querySelector(el) : el;
    if (node) scan(node);
  });

  return families;
}

function extractUrl(srcStr) {
  const matches = srcStr.match(/url\((["']?)(.*?)\1\)/g);
  if (!matches) return null;

  let chosen = null;
  for (const match of matches) {
    const urlRaw = match.replace(/url\((["']?)(.*?)\1\)/, '$2');
    if (urlRaw.startsWith('data:')) continue;
    const trailingSource = srcStr.slice(srcStr.indexOf(match) + match.length);
    const format = trailingSource.match(/^\s*format\((["']?)([^"')]+)\1\)/i)?.[2]?.toLowerCase();
    const extension = urlRaw.match(/\.(woff2?|otf|ttf)(?:[?#]|$)/i)?.[1]?.toLowerCase();
    const type =
      format === 'truetype' ? 'ttf' : format === 'opentype' ? 'otf' : format || extension;

    if (urlRaw.includes('.ttf') || urlRaw.includes('.otf') || urlRaw.includes('.woff')) {
      chosen = { url: urlRaw, type };
      break;
    }
    if (!chosen) chosen = { url: urlRaw, type };
  }
  return chosen;
}

function resolveFontUrl(url, baseUrl) {
  try {
    return new URL(url, baseUrl || document.baseURI).href;
  } catch (e) {
    return url;
  }
}

function shouldEmbedFontFamily(usedFamilies, familyName, pptFontName) {
  const isExplicitlyUsedFont = usedFamilies.has(familyName);
  const isNormalizedFont = usedFamilies.has(pptFontName);

  if (!isExplicitlyUsedFont && !isNormalizedFont) return false;
  if (!isExplicitlyUsedFont && pptFontName.toLowerCase() !== familyName.toLowerCase()) return false;
  return true;
}

function addFontFace(foundFonts, processedUrls, usedFamilies, familyName, src, baseUrl) {
  if (!familyName || !src) return;

  const styleLike = { fontFamily: familyName };
  const pptFontName = normalizeFontFaceForPpt(styleLike);
  if (!shouldEmbedFontFamily(usedFamilies, familyName, pptFontName)) return;

  const fontSource = extractUrl(src);
  if (!fontSource?.url) return;

  const resolvedUrl = resolveFontUrl(fontSource.url, baseUrl);
  if (processedUrls.has(resolvedUrl)) return;

  processedUrls.add(resolvedUrl);
  foundFonts.push({
    name: usedFamilies.has(familyName) ? familyName : pptFontName,
    url: resolvedUrl,
    type: fontSource.type,
  });
}

function scanFontFaceRules(rules, foundFonts, processedUrls, usedFamilies, baseUrl) {
  if (!rules) return;

  for (const rule of Array.from(rules)) {
    if (rule.constructor.name !== 'CSSFontFaceRule' && rule.type !== 5) continue;

    const familyName = rule.style.getPropertyValue('font-family').replace(/["']/g, '').trim();
    const src = rule.style.getPropertyValue('src');
    addFontFace(foundFonts, processedUrls, usedFamilies, familyName, src, baseUrl);
  }
}

function scanFontFaceText(cssText, foundFonts, processedUrls, usedFamilies, baseUrl) {
  const blocks = cssText.match(/@font-face\s*{[^}]*}/gi) || [];
  for (const block of blocks) {
    const familyMatch = block.match(/font-family\s*:\s*([^;]+);/i);
    const srcMatch = block.match(/src\s*:\s*([^;]+);/i);
    const familyName = familyMatch?.[1]?.replace(/["']/g, '').trim();
    const src = srcMatch?.[1]?.trim();
    addFontFace(foundFonts, processedUrls, usedFamilies, familyName, src, baseUrl);
  }
}

async function scanStylesheetHref(sheet, foundFonts, processedUrls, usedFamilies) {
  if (!sheet.href) return;

  try {
    const response = await fetch(sheet.href);
    if (!response.ok) return;
    const cssText = await response.text();
    scanFontFaceText(cssText, foundFonts, processedUrls, usedFamilies, sheet.href);
  } catch (e) {
    console.warn('Cannot fetch stylesheet for font detection:', sheet.href, e);
  }
}

/**
 * Scans document.styleSheets to find @font-face URLs for the requested families.
 * Returns an array of { name, url } objects.
 */
export async function getAutoDetectedFonts(usedFamilies, documents = [document]) {
  const foundFonts = [];
  const processedUrls = new Set();

  for (const targetDocument of documents) {
    for (const sheet of Array.from(targetDocument?.styleSheets || [])) {
      try {
        // Accessing cssRules on cross-origin sheets might fail if CORS headers
        // are not set. Fall back to fetching the stylesheet text where possible.
        const rules = sheet.cssRules || sheet.rules;
        scanFontFaceRules(rules, foundFonts, processedUrls, usedFamilies, sheet.href);
      } catch (e) {
        console.warn('Cannot scan stylesheet via CSSOM; trying fetch fallback:', sheet.href, e);
        await scanStylesheetHref(sheet, foundFonts, processedUrls, usedFamilies);
      }
    }
  }

  return foundFonts;
}
