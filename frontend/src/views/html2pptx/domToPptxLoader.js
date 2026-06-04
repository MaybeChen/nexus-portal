const DOM_TO_PPTX_CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/dom-to-pptx@1.6.2/dist/dom-to-pptx.bundle.js',
  'https://unpkg.com/dom-to-pptx@1.6.2/dist/dom-to-pptx.bundle.js'
];

let loadingPromise;

function hasDomToPptx() {
  return typeof window !== 'undefined' && typeof window.domToPptx?.exportToPptx === 'function';
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[data-html2pptx-loader="${src}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', () => reject(new Error(`加载转换引擎失败：${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.html2pptxLoader = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`加载转换引擎失败：${src}`));
    document.head.appendChild(script);
  });
}

export async function getDomToPptx() {
  if (hasDomToPptx()) return window.domToPptx;
  if (!loadingPromise) {
    loadingPromise = DOM_TO_PPTX_CDN_URLS.reduce(
      (promise, src) => promise.catch(() => loadScript(src).then(() => window.domToPptx)),
      Promise.reject()
    ).then((library) => {
      if (!hasDomToPptx()) {
        throw new Error('转换引擎已加载，但没有发现 exportToPptx 方法');
      }
      return library;
    });
  }
  return loadingPromise;
}
