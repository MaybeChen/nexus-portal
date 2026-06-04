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
      await waitForDocumentStable(iframe.contentDocument);
      resolve();
    };
  });
}

async function waitForDocumentStable(document) {
  if (document?.fonts?.ready) {
    await document.fonts.ready.catch(() => undefined);
  }

  await Promise.all(
    Array.from(document?.images || []).map((image) => {
      if (image.complete) return undefined;
      return new Promise((resolveImage) => {
        image.addEventListener('load', resolveImage, { once: true });
        image.addEventListener('error', resolveImage, { once: true });
      });
    })
  );

  await new Promise((resolve) => window.setTimeout(resolve, 300));
}

function getExportTargets(stage) {
  const explicitTargets = Array.from(stage.querySelectorAll('[data-pptx-export-target="true"]'));
  if (explicitTargets.length) return explicitTargets;

  const slides = Array.from(stage.querySelectorAll('.slide'));
  if (slides.length) return slides;

  return [
    stage.querySelector('#slide') ||
      stage.querySelector('.slide-container') ||
      stage.querySelector('body') ||
      stage
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

async function cloneIframeToStage(iframe, stage) {
  const clonedRoot = iframe.contentDocument.documentElement.cloneNode(true);
  cleanTextForPpt(clonedRoot);

  const container = document.createElement('section');
  container.appendChild(clonedRoot);
  stage.appendChild(container);
  await waitForDocumentStable(document);
  return getExportTargets(container);
}

function createOffscreenStage() {
  const stage = document.createElement('div');
  stage.style.cssText = 'position: fixed; left: -100000px; top: 0; width: auto; height: auto; opacity: 0; pointer-events: none;';
  document.body.appendChild(stage);
  return stage;
}

export async function exportItemsToPptx({ items, fileMap, filename, onProgress }) {
  if (!items.length) throw new Error('没有可导出的 HTML 文件');

  const iframes = [];
  const transientUrls = [];
  const stage = createOffscreenStage();
  const targets = [];

  try {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      onProgress?.({ index, total: items.length, item });
      const { html, objectUrls = [] } = await readHtmlDocument(item, fileMap);
      transientUrls.push(...objectUrls);
      const iframe = await createExportIframe(html);
      iframes.push(iframe);
      targets.push(...(await cloneIframeToStage(iframe, stage)));
    }

    if (!targets.length) throw new Error('没有找到可导出的页面节点');
    const blob = await exportToPptx(targets, EXPORT_OPTIONS);
    downloadBlob(blob, filename);
    return blob;
  } finally {
    iframes.forEach((iframe) => iframe.remove());
    stage.remove();
    revokeWorkspaceUrls(transientUrls);
  }
}
