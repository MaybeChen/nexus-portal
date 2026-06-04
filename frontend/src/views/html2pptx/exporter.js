import { exportToPptx } from './dom-to-pptx/src/index.js';
import { readHtmlDocument } from './fileWorkspace';

const EXPORT_OPTIONS = {
  slideWidth: 13.333,
  slideHeight: 7.5,
  svgAsVector: false,
  svgAsEditable: false,
  skipDownload: true
};

function waitForIframe(iframe) {
  return new Promise((resolve) => {
    iframe.onload = async () => {
      const document = iframe.contentDocument;
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

      window.setTimeout(resolve, 300);
    };
  });
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

export async function exportItemsToPptx({ items, fileMap, filename, onProgress }) {
  if (!items.length) throw new Error('没有可导出的 HTML 文件');

  const iframes = [];
  const targets = [];

  try {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      onProgress?.({ index, total: items.length, item });
      const { html } = await readHtmlDocument(item, fileMap);
      const iframe = await createExportIframe(html);
      iframes.push(iframe);
      targets.push(...getExportTargets(iframe.contentDocument));
    }

    if (!targets.length) throw new Error('没有找到可导出的页面节点');
    const blob = await exportToPptx(targets, EXPORT_OPTIONS);
    downloadBlob(blob, filename);
    return blob;
  } finally {
    iframes.forEach((iframe) => iframe.remove());
  }
}
