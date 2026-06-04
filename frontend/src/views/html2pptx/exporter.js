import { exportToPptx } from './dom-to-pptx/src/index.js';
import { readHtmlDocument, revokeWorkspaceUrls } from './fileWorkspace';

const EXPORT_OPTIONS = {
  autoEmbedFonts: true,
  layout: 'LAYOUT_WIDE',
  svgAsVector: false,
  svgAsEditable: false,
  skipDownload: true
};

function waitForIframe(iframe) {
  return new Promise((resolve) => {
    iframe.onload = async () => {
      await waitForDocumentFonts(iframe.contentDocument);
      await waitForImages(iframe.contentDocument);
      await nextPaint();
      resolve();
    };
  });
}

async function waitForDocumentFonts(document) {
  if (document?.fonts?.ready) {
    await document.fonts.ready.catch(() => undefined);
  }
}

async function waitForImages(root) {
  await Promise.all(
    Array.from(root?.querySelectorAll?.('img') || root?.images || []).map((image) => {
      if (image.complete) return undefined;
      return new Promise((resolveImage) => {
        image.addEventListener('load', resolveImage, { once: true });
        image.addEventListener('error', resolveImage, { once: true });
      });
    })
  );
}

function nextPaint(delay = 300) {
  return new Promise((resolve) => window.setTimeout(resolve, delay));
}

function getExportTargets(document) {
  const explicitTargets = Array.from(document.querySelectorAll('[data-pptx-export-target="true"]'));
  if (explicitTargets.length) return explicitTargets;

  const slides = Array.from(document.querySelectorAll('.slide'));
  if (slides.length) return slides;

  return [
    document.querySelector('#slide') ||
      document.querySelector('.slide-container') ||
      document.body ||
      document.documentElement
  ].filter(Boolean);
}

function cleanTextForPpt(node) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const textNode = walker.currentNode;
    textNode.nodeValue = String(textNode.nodeValue || '')
      .normalize('NFC')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '');
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function createExportIframe(html) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups');
  iframe.style.cssText = 'position: fixed; left: -200vw; top: 0; width: 1600px; height: 900px; opacity: 0; pointer-events: none;';
  document.body.appendChild(iframe);
  const loaded = waitForIframe(iframe);
  iframe.srcdoc = html;
  await loaded;
  return iframe;
}

function collectAccessibleCssRules(document) {
  const cssTexts = [];

  Array.from(document.styleSheets || []).forEach((sheet) => {
    try {
      const rules = Array.from(sheet.cssRules || []);
      const cssText = rules.map((rule) => rule.cssText).filter(Boolean).join('\n');
      if (cssText) cssTexts.push(cssText);
    } catch {
      // Cross-origin stylesheets are left as their original link tags in the snapshot.
    }
  });

  Array.from(document.adoptedStyleSheets || []).forEach((sheet) => {
    try {
      const cssText = Array.from(sheet.cssRules || []).map((rule) => rule.cssText).filter(Boolean).join('\n');
      if (cssText) cssTexts.push(cssText);
    } catch {
      // Ignore unreadable adopted stylesheets.
    }
  });

  return cssTexts;
}

function extractExportSnapshot(iframe) {
  const sourceDocument = iframe.contentDocument;
  const clonedDocument = sourceDocument.documentElement.cloneNode(true);
  cleanTextForPpt(clonedDocument);

  const parser = new DOMParser();
  const snapshot = parser.parseFromString('<!doctype html><html><head></head><body></body></html>', 'text/html');
  const htmlAttrs = Array.from(sourceDocument.documentElement.attributes || []);
  htmlAttrs.forEach((attribute) => snapshot.documentElement.setAttribute(attribute.name, attribute.value));

  Array.from(clonedDocument.querySelector('head')?.childNodes || []).forEach((node) => {
    snapshot.head.appendChild(node.cloneNode(true));
  });

  const cssTexts = collectAccessibleCssRules(sourceDocument);
  if (cssTexts.length) {
    const style = snapshot.createElement('style');
    style.setAttribute('data-html2pptx-snapshot', 'true');
    style.textContent = cssTexts.join('\n');
    snapshot.head.appendChild(style);
  }

  Array.from(clonedDocument.querySelector('body')?.childNodes || []).forEach((node) => {
    snapshot.body.appendChild(node.cloneNode(true));
  });

  return `<!doctype html>\n${snapshot.documentElement.outerHTML}`;
}

export async function exportItemsToPptx({ items, fileMap, filename, onProgress }) {
  if (!items.length) throw new Error('没有可导出的 HTML 文件');

  const iframes = [];
  const transientUrls = [];
  const targets = [];

  try {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      onProgress?.({ index, total: items.length, item });
      const { html, objectUrls = [] } = await readHtmlDocument(item, fileMap);
      transientUrls.push(...objectUrls);

      const renderIframe = await createExportIframe(html);
      iframes.push(renderIframe);
      const snapshotHtml = extractExportSnapshot(renderIframe);
      const snapshotIframe = await createExportIframe(snapshotHtml);
      iframes.push(snapshotIframe);

      await waitForDocumentFonts(snapshotIframe.contentDocument);
      await waitForImages(snapshotIframe.contentDocument);
      await nextPaint();
      targets.push(...getExportTargets(snapshotIframe.contentDocument));
    }

    if (!targets.length) throw new Error('没有找到可导出的页面节点');
    const blob = await exportToPptx(targets, EXPORT_OPTIONS);
    downloadBlob(blob, filename);
    return blob;
  } finally {
    iframes.forEach((iframe) => iframe.remove());
    revokeWorkspaceUrls(transientUrls);
  }
}
