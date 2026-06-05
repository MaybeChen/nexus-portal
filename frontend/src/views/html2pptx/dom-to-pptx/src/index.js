import * as PptxGenJSImport from 'pptxgenjs';
import JSZip from 'jszip';
import { PPTXEmbedFonts } from './font-embedder.js';
import { normalizePptxZip } from './pptx-normalizer.js';
import { getUsedFontFamilies, getAutoDetectedFonts } from './utils.js';
import { processSlide } from './slide-processor.js';

const PptxGenJS = PptxGenJSImport?.default ?? PptxGenJSImport;

function resolvePptxConstructor(pkg) {
  if (!pkg) return null;
  if (typeof pkg === 'function') return pkg;
  if (pkg && typeof pkg.default === 'function') return pkg.default;
  if (pkg && typeof pkg.PptxGenJS === 'function') return pkg.PptxGenJS;
  if (pkg && pkg.PptxGenJS && typeof pkg.PptxGenJS.default === 'function') return pkg.PptxGenJS.default;
  return null;
}

function configureLayout(pptx, target, options) {
  let finalWidth = 10;
  let finalHeight = 5.625;

  if (options.width && options.height) {
    pptx.defineLayout({ name: 'CUSTOM', width: options.width, height: options.height });
    pptx.layout = 'CUSTOM';
    finalWidth = options.width;
    finalHeight = options.height;
  } else if (options.layout) {
    pptx.layout = options.layout;
    if (options.layout === 'LAYOUT_4x3') {
      finalWidth = 10;
      finalHeight = 7.5;
    } else if (options.layout === 'LAYOUT_16x10') {
      finalWidth = 10;
      finalHeight = 6.25;
    } else if (options.layout === 'LAYOUT_WIDE') {
      finalWidth = 13.3;
      finalHeight = 7.5;
    }
  } else {
    const firstEl = Array.isArray(target) ? target[0] : target;
    const root = typeof firstEl === 'string' ? document.querySelector(firstEl) : firstEl;
    if (root) {
      const rect = root.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const aspect = rect.width / rect.height;
        finalWidth = 10;
        finalHeight = 10 / aspect;
        pptx.defineLayout({ name: 'AUTO_DESIGN', width: finalWidth, height: finalHeight });
        pptx.layout = 'AUTO_DESIGN';
      } else {
        pptx.layout = 'LAYOUT_16x9';
      }
    } else {
      pptx.layout = 'LAYOUT_16x9';
    }
  }

  return { finalWidth, finalHeight };
}

async function getFontsToEmbed(elements, options) {
  const fontsToEmbed = options.fonts || [];
  if (!options.autoEmbedFonts) return fontsToEmbed;

  const usedFamilies = getUsedFontFamilies(elements);
  const detectedFonts = await getAutoDetectedFonts(usedFamilies);
  const explicitNames = new Set(fontsToEmbed.map((f) => f.name));

  for (const autoFont of detectedFonts) {
    if (!explicitNames.has(autoFont.name)) fontsToEmbed.push(autoFont);
  }

  if (detectedFonts.length > 0) {
    console.log(
      'Auto-detected fonts:',
      detectedFonts.map((f) => f.name)
    );
  }

  return fontsToEmbed;
}

async function embedFontsInPptx(pptx, fontsToEmbed, options) {
  const initialBlob = await pptx.write({ outputType: 'blob' });
  const zip = await JSZip.loadAsync(initialBlob);
  const embedder = new PPTXEmbedFonts();
  await embedder.loadZip(zip);

  for (const fontCfg of fontsToEmbed) {
    try {
      const response = await fetch(fontCfg.url);
      if (!response.ok) throw new Error(`Failed to fetch ${fontCfg.url}`);
      const buffer = await response.arrayBuffer();
      const ext = fontCfg.url.split('.').pop().split(/[?#]/)[0].toLowerCase();
      let type = 'ttf';
      if (['woff', 'woff2', 'otf'].includes(ext)) type = ext;
      await embedder.addFont(fontCfg.name, buffer, type);
    } catch (e) {
      console.warn(`Failed to embed font: ${fontCfg.name} (${fontCfg.url})`, e);
    }
  }

  await embedder.updateFiles();
  if (options.skipNormalize !== true) await normalizePptxZip(zip);
  return embedder.generateBlob();
}

async function normalizeOutputBlob(pptx, options) {
  const initialBlob = await pptx.write({ outputType: 'blob' });
  if (options.skipNormalize === true) return initialBlob;

  const zip = await JSZip.loadAsync(initialBlob);
  await normalizePptxZip(zip);
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

function downloadBlob(finalBlob, options) {
  if (options.skipDownload) return;

  const fileName = options.fileName || 'export.pptx';
  const url = URL.createObjectURL(finalBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportToPptx(target, options = {}) {
  const PptxConstructor = resolvePptxConstructor(PptxGenJS);
  if (!PptxConstructor) throw new Error('PptxGenJS constructor not found.');

  const pptx = new PptxConstructor();
  const { finalWidth, finalHeight } = configureLayout(pptx, target, options);
  const extendedOptions = { ...options, _slideWidth: finalWidth, _slideHeight: finalHeight };
  const elements = Array.isArray(target) ? target : [target];

  for (const el of elements) {
    const root = typeof el === 'string' ? document.querySelector(el) : el;
    if (!root) {
      console.warn('Element not found, skipping slide:', el);
      continue;
    }
    const slide = pptx.addSlide();
    await processSlide(root, slide, pptx, extendedOptions);
  }

  const fontsToEmbed = await getFontsToEmbed(elements, options);
  const finalBlob =
    fontsToEmbed.length > 0
      ? await embedFontsInPptx(pptx, fontsToEmbed, options)
      : await normalizeOutputBlob(pptx, options);

  downloadBlob(finalBlob, options);
  return finalBlob;
}
