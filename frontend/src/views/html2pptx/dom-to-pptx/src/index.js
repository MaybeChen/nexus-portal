// src/index.js
import * as PptxGenJSImport from 'pptxgenjs';
import html2canvas from 'html2canvas';
import { PPTXEmbedFonts } from './font-embedder.js';
import { normalizePptxZip } from './pptx-normalizer.js';
import JSZip from 'jszip';
// Normalize import
const PptxGenJS = PptxGenJSImport?.default ?? PptxGenJSImport;
import {
  parseColor,
  getTextStyle,
  isTextContainer,
  getVisibleShadow,
  generateGradientSVG,
  getRotation,
  getWritingModeVert,
  svgToPng,
  svgToSvg,
  getPadding,
  getSoftEdges,
  generateBlurredSVG,
  getBorderInfo,
  generateCompositeBorderSVG,
  isClippedByParent,
  generateCustomShapeSVG,
  getUsedFontFamilies,
  getAutoDetectedFonts,
  extractTableData,
  collectTextParts,
  getComputedStyleForNode,
} from './utils.js';
import { getProcessedImage } from './image-processor.js';
const PPI = 96;
const PX_TO_INCH = 1 / PPI;

/**
 * Main export function.
 * @param {HTMLElement | string | Array} target
 * @param {Object} options
 * @param {string} [options.fileName]
 * @param {boolean} [options.skipDownload=false] - If true, prevents automatic download
 * @param {Object} [options.listConfig] - Config for bullets
 * @param {boolean} [options.svgAsVector=false] - If true, keeps SVG as vector (for Convert to Shape in PowerPoint)
 * @param {boolean} [options.skipNormalize=false] - If true, skips re-zipping with DEFLATE
 * and stripping dangling [Content_Types].xml Overrides. Leave it false unless you are
 * debugging the raw PptxGenJS output, otherwise Microsoft PowerPoint may reject the file.
 * @returns {Promise} - Returns the generated PPTX Blob
 */
export async function exportToPptx(target, options = {}) {
  const resolvePptxConstructor = (pkg) => {
    if (!pkg) return null;
    if (typeof pkg === 'function') return pkg;
    if (pkg && typeof pkg.default === 'function') return pkg.default;
    if (pkg && typeof pkg.PptxGenJS === 'function') return pkg.PptxGenJS;
    if (pkg && pkg.PptxGenJS && typeof pkg.PptxGenJS.default === 'function') return pkg.PptxGenJS.default;
    return null;
  };
  const PptxConstructor = resolvePptxConstructor(PptxGenJS);
  if (!PptxConstructor) throw new Error('PptxGenJS constructor not found.');
  const pptx = new PptxConstructor();

  // 1. Layout Handling
  let finalWidth = 10; // default 16:9
  let finalHeight = 5.625;
  if (options.width && options.height) {
    pptx.defineLayout({ name: 'CUSTOM', width: options.width, height: options.height });
    pptx.layout = 'CUSTOM';
    finalWidth = options.width;
    finalHeight = options.height;
  } else if (options.layout) {
    pptx.layout = options.layout;
    // Map standard layouts for internal scale calculation if possible,
    // though PptxGenJS defaults to 16:9 if unknown.
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

  // Pass these dimensions to options so processSlide can use them
  const extendedOptions = {
    ...options,
    _slideWidth: finalWidth,
    _slideHeight: finalHeight,
  };
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

  // 3. Font Embedding Logic
  let finalBlob;
  let fontsToEmbed = options.fonts || [];
  if (options.autoEmbedFonts) {
    // A. Scan DOM for used font families
    const usedFamilies = getUsedFontFamilies(elements);
    // B. Scan CSS for URLs matches
    const detectedFonts = await getAutoDetectedFonts(usedFamilies);
    // C. Merge (Avoid duplicates)
    const explicitNames = new Set(fontsToEmbed.map((f) => f.name));
    for (const autoFont of detectedFonts) {
      if (!explicitNames.has(autoFont.name)) {
        fontsToEmbed.push(autoFont);
      }
    }
    if (detectedFonts.length > 0) {
      console.log(
        'Auto-detected fonts:',
        detectedFonts.map((f) => f.name)
      );
    }
  }

  if (fontsToEmbed.length > 0) {
    // Generate initial PPTX
    const initialBlob = await pptx.write({ outputType: 'blob' });
    // Load into Embedder
    const zip = await JSZip.loadAsync(initialBlob);
    const embedder = new PPTXEmbedFonts();
    await embedder.loadZip(zip);

    // Fetch and Embed
    for (const fontCfg of fontsToEmbed) {
      try {
        const response = await fetch(fontCfg.url);
        if (!response.ok) throw new Error(`Failed to fetch ${fontCfg.url}`);
        const buffer = await response.arrayBuffer();
        // Infer type
        const ext = fontCfg.url.split('.').pop().split(/[?#]/)[0].toLowerCase();
        let type = 'ttf';
        if (['woff', 'otf'].includes(ext)) type = ext;
        await embedder.addFont(fontCfg.name, buffer, type);
      } catch (e) {
        console.warn(`Failed to embed font: ${fontCfg.name} (${fontCfg.url})`, e);
      }
    }
    await embedder.updateFiles();
    if (options.skipNormalize !== true) {
      await normalizePptxZip(zip);
    }
    finalBlob = await embedder.generateBlob();
  } else {
    // No fonts to embed — still re-zip with DEFLATE and strip dangling Overrides
    // so Microsoft PowerPoint accepts the file (PptxGenJS leaves both issues
    // unresolved on its own; see 错误诊断.md).
    const initialBlob = await pptx.write({ outputType: 'blob' });
    if (options.skipNormalize === true) {
      finalBlob = initialBlob;
    } else {
      const zip = await JSZip.loadAsync(initialBlob);
      await normalizePptxZip(zip);
      finalBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });
    }
  }

  // 4. Output Handling
  // If skipDownload is NOT true, proceed with browser download
  if (!options.skipDownload) {
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

  // Always return the blob so the caller can use it (e.g. upload to server)
  return finalBlob;
}

/**
 * Worker function to process a single DOM element into a single PPTX slide.
 * @param {HTMLElement} root - The root element for this slide.
 * @param {PptxGenJS.Slide} slide - The PPTX slide object to add content to.
 * @param {PptxGenJS} pptx - The main PPTX instance.
 */
function compareKeys(keyA, keyB) {
  const len = Math.max(keyA.length, keyB.length);
  for (let i = 0; i < len; i++) {
    const valA = keyA[i] !== undefined ? keyA[i] : 0;
    const valB = keyB[i] !== undefined ? keyB[i] : 0;
    if (valA !== valB) {
      return valA - valB;
    }
  }
  return 0;
}

function getCustomShapeType(customShapeName, pptx) {
  if (!customShapeName) return pptx.ShapeType.rect;
  const name = customShapeName.trim().replace(/['"]/g, '').toLowerCase();
  if (name === 'circle' || name === 'ellipse' || name === 'oval') return pptx.ShapeType.ellipse;
  if (name === 'triangle') return pptx.ShapeType.triangle;
  if (name === 'diamond') return pptx.ShapeType.diamond;
  if (name === 'parallelogram') return pptx.ShapeType.parallelogram;
  if (name === 'hexagon') return pptx.ShapeType.hexagon;
  if (name === 'pentagon') return pptx.ShapeType.pentagon;
  if (name === 'star') return pptx.ShapeType.star5;
  if (name === 'chevron') return pptx.ShapeType.chevron;
  if (name === 'rect' || name === 'rectangle') return pptx.ShapeType.rect;
  if (name === 'roundrect' || name === 'roundedrectangle') return pptx.ShapeType.roundRect;
  for (const key of Object.keys(pptx.ShapeType)) {
    if (key.toLowerCase() === name) return pptx.ShapeType[key];
  }
  return pptx.ShapeType.rect;
}

async function processSlide(root, slide, pptx, globalOptions = {}) {
  const rootRect = root.getBoundingClientRect();
  const PPTX_WIDTH_IN = globalOptions._slideWidth || 10;
  const PPTX_HEIGHT_IN = globalOptions._slideHeight || 5.625;
  const contentWidthIn = rootRect.width * PX_TO_INCH;
  const contentHeightIn = rootRect.height * PX_TO_INCH;
  const scale = Math.min(PPTX_WIDTH_IN / contentWidthIn, PPTX_HEIGHT_IN / contentHeightIn);
  const layoutConfig = {
    rootX: rootRect.x,
    rootY: rootRect.y,
    scale: scale,
    offX: (PPTX_WIDTH_IN - contentWidthIn * scale) / 2,
    offY: (PPTX_HEIGHT_IN - contentHeightIn * scale) / 2,
  };
  const renderQueue = [];
  const asyncTasks = []; // Queue for heavy operations (Images, Canvas)
  let domOrderCounter = 0;

  // Sync Traversal Function
  function collect(node, parentSortKey, parentOpacity = 1) {
    const order = domOrderCounter++;
    let currentSortKey = parentSortKey;
    let currentOpacity = parentOpacity;
    let nodeStyle = null;
    const nodeType = node.nodeType;

    if (nodeType === 1) {
      nodeStyle = getComputedStyleForNode(node);
      const elOpacity = parseFloat(nodeStyle.opacity);
      if (!isNaN(elOpacity)) {
        currentOpacity *= elOpacity;
      }
      // Optimization: Skip completely hidden elements immediately
      if (
        nodeStyle.display === 'none' ||
        nodeStyle.visibility === 'hidden' ||
        currentOpacity === 0
      ) {
        return;
      }
      let zVal = 0;
      if (nodeStyle.zIndex !== 'auto') {
        const parsedZ = parseInt(nodeStyle.zIndex);
        if (!isNaN(parsedZ)) {
          zVal = parsedZ;
        }
      }
      currentSortKey = parentSortKey.concat([zVal, order]);
    }

    // Prepare the item. If it needs async work, it returns a 'job'
    const result = prepareRenderItem(
      node,
      { ...layoutConfig, root },
      order,
      pptx,
      currentSortKey,
      nodeStyle,
      { ...globalOptions, _inheritedOpacity: parentOpacity }
    );

    if (result) {
      if (result.items) {
        // Push items immediately to queue (data might be missing but filled later)
        renderQueue.push(...result.items);
      }
      if (result.job) {
        // Push the promise-returning function to the task list
        asyncTasks.push(result.job);
      }
      if (result.stopRecursion) return;
    }

    // Recurse children synchronously
    const childNodes = node.childNodes;
    for (let i = 0; i < childNodes.length; i++) {
      collect(childNodes[i], currentSortKey, currentOpacity);
    }
  }

  // 1. Traverse and build the structure (Fast)
  collect(root, []);

  // 2. Execute all heavy tasks in parallel (Fast)
  if (asyncTasks.length > 0) {
    await Promise.all(asyncTasks.map((task) => task()));
  }

  // 3. Cleanup and Sort
  // Remove items that failed to generate data (marked with skip)
  const finalQueue = renderQueue.filter(
    (item) => !item.skip && (item.type !== 'image' || item.options.data)
  );
  finalQueue.sort((a, b) => {
    return compareKeys(a.zIndex, b.zIndex);
  });

  // 4. Add to Slide
  for (let i = 0; i < finalQueue.length; i++) {
    const item = finalQueue[i];
    const transportVal = `__z_${i}__dom_${item.domOrder}`;
    item.options.altText = transportVal;
    item.options.objectName = transportVal;
    if (item.type === 'shape') slide.addShape(item.shapeType, item.options);
    if (item.type === 'image') slide.addImage(item.options);
    if (item.type === 'text') slide.addText(item.textParts, item.options);
    if (item.type === 'table') {
      slide.addTable(item.tableData.rows, {
        x: item.options.x,
        y: item.options.y,
        w: item.options.w,
        colW: item.tableData.colWidths,
        // Essential for correct layout
        autoPage: false,
        // Remove default table styles so our extracted CSS applies cleanly
        border: { type: 'none' },
        fill: { color: 'FFFFFF', transparency: 100 },
        altText: item.options.altText,
        objectName: item.options.objectName,
      });
    }
  }
}

/**
 * Optimized html2canvas wrapper
 * Includes fix for cropped icons by adjusting styles in the cloned document.
 */
async function elementToCanvasImage(node, widthPx, heightPx) {
  return new Promise((resolve) => {
    const originalId = node.id;
    const tempId = 'pptx-capture-' + Math.random().toString(36).substr(2, 9);
    node.id = tempId;
    const width = Math.max(Math.ceil(widthPx), 1);
    const height = Math.max(Math.ceil(heightPx), 1);
    const padding = 10;
    html2canvas(node, {
      backgroundColor: null,
      logging: false,
      scale: 3,
      useCORS: true,
      width: width + padding * 2,
      height: height + padding * 2,
      x: -padding,
      y: -padding,
    }).then((canvas) => {
      node.id = originalId;
      resolve(canvas.toDataURL('image/png'));
    }).catch(() => {
      node.id = originalId;
      resolve(null);
    });
  });
}


function getCornerRadii(style) {
  return {
    tl: parseFloat(style.borderTopLeftRadius) || parseFloat(style.borderRadius) || 0,
    tr: parseFloat(style.borderTopRightRadius) || parseFloat(style.borderRadius) || 0,
    br: parseFloat(style.borderBottomRightRadius) || parseFloat(style.borderRadius) || 0,
    bl: parseFloat(style.borderBottomLeftRadius) || parseFloat(style.borderRadius) || 0,
  };
}

function prepareRenderItem(node, layout, order, pptx, zIndex, nodeStyle, globalOptions = {}) {
  const nodeType = node.nodeType;
  const inheritedOpacity = globalOptions._inheritedOpacity || 1;
  if (nodeType === 3) {
    const text = node.textContent;
    if (!text || !text.trim()) return null;
    const parent = node.parentElement;
    if (!parent) return null;
    const rect = parent.getBoundingClientRect();
    const style = getComputedStyleForNode(parent);
    return {
      items: [{
        type: 'text',
        textParts: collectTextParts(parent, style, layout.scale, null, true, inheritedOpacity),
        options: {
          x: (rect.x - layout.rootX) * PX_TO_INCH * layout.scale + layout.offX,
          y: (rect.y - layout.rootY) * PX_TO_INCH * layout.scale + layout.offY,
          w: rect.width * PX_TO_INCH * layout.scale,
          h: rect.height * PX_TO_INCH * layout.scale,
          margin: 0,
          breakLine: false,
          fit: 'shrink',
          ...getTextStyle(style, layout.scale, true, inheritedOpacity),
        },
        zIndex,
        domOrder: order,
      }],
      stopRecursion: true,
    };
  }

  if (nodeType !== 1) return null;

  const rect = node.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const x = (rect.x - layout.rootX) * PX_TO_INCH * layout.scale + layout.offX;
  const y = (rect.y - layout.rootY) * PX_TO_INCH * layout.scale + layout.offY;
  const w = rect.width * PX_TO_INCH * layout.scale;
  const h = rect.height * PX_TO_INCH * layout.scale;
  const commonOptions = { x, y, w, h, rotate: getRotation(nodeStyle.transform), transparency: Math.round((1 - inheritedOpacity) * 100) };

  if (node.tagName === 'TABLE') {
    return {
      items: [{ type: 'table', tableData: extractTableData(node, layout.scale), options: commonOptions, zIndex, domOrder: order }],
      stopRecursion: true,
    };
  }

  if (node.tagName === 'IMG') {
    const item = { type: 'image', options: { ...commonOptions }, zIndex, domOrder: order };
    return {
      items: [item],
      job: async () => {
        item.options.data = await getProcessedImage(node.currentSrc || node.src, rect.width, rect.height, getCornerRadii(nodeStyle), nodeStyle.objectFit, nodeStyle.objectPosition);
        if (!item.options.data) item.skip = true;
      },
      stopRecursion: true,
    };
  }

  if (node.tagName === 'SVG') {
    const item = { type: 'image', options: { ...commonOptions }, zIndex, domOrder: order };
    return {
      items: [item],
      job: async () => {
        item.options.data = globalOptions.svgAsVector ? await svgToSvg(node) : await svgToPng(node);
        if (!item.options.data) item.skip = true;
      },
      stopRecursion: true,
    };
  }

  if (isTextContainer(node)) {
    return {
      items: [{ type: 'text', textParts: collectTextParts(node, nodeStyle, layout.scale, null, true, inheritedOpacity), options: { ...commonOptions, ...getTextStyle(nodeStyle, layout.scale, true, inheritedOpacity), margin: 0, breakLine: false, fit: 'shrink' }, zIndex, domOrder: order }],
      stopRecursion: true,
    };
  }

  const radius = getCornerRadii(nodeStyle);
  const border = getBorderInfo(nodeStyle, layout.scale);
  const bg = nodeStyle.backgroundImage && nodeStyle.backgroundImage !== 'none'
    ? generateGradientSVG(rect.width, rect.height, nodeStyle.backgroundImage, radius, border?.type === 'uniform' ? border.options : null)
    : null;
  const fillColor = parseColor(nodeStyle.backgroundColor, nodeStyle);
  const items = [];
  if ((fillColor.hex && fillColor.opacity > 0) || bg || border.type !== 'none') {
    items.push({
      type: bg ? 'image' : 'shape',
      shapeType: getCustomShapeType(nodeStyle.getPropertyValue('--pptx-shape'), pptx),
      options: bg ? { ...commonOptions, data: bg } : { ...commonOptions, fill: fillColor.hex ? { color: fillColor.hex, transparency: Math.round((1 - fillColor.opacity) * 100) } : { color: 'FFFFFF', transparency: 100 }, line: border.type === 'uniform' ? border.options : { transparency: 100 }, radius: radius.tl },
      zIndex,
      domOrder: order,
    });
  }
  getVisibleShadow(nodeStyle.boxShadow || nodeStyle.textShadow, layout.scale);
  getWritingModeVert(nodeStyle.writingMode, nodeStyle.textOrientation);
  getPadding(nodeStyle, layout.scale);
  getSoftEdges(nodeStyle.filter, layout.scale);
  if (fillColor.hex) generateBlurredSVG(rect.width, rect.height, fillColor.hex, radius.tl, 0);
  if (border.type === 'composite') generateCompositeBorderSVG(rect.width, rect.height, radius.tl, border.sides);
  isClippedByParent(node);
  if (fillColor.hex) generateCustomShapeSVG(rect.width, rect.height, fillColor.hex, fillColor.opacity, radius);
  return items.length ? { items } : null;
}
