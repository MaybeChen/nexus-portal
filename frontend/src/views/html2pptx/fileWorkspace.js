const HTML_FILE_PATTERN = /\.html?$/i;
const ASSET_ATTRIBUTES = ['src', 'href', 'poster'];

function normalizePath(path) {
  return String(path || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function dirname(path) {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf('/');
  return index === -1 ? '' : normalized.slice(0, index);
}

function getPathSuffix(rawUrl) {
  const match = String(rawUrl || '').match(/([?#].*)$/);
  return match?.[1] || '';
}

function isExternalOrSpecialUrl(rawUrl) {
  return /^(data:|blob:|https?:|mailto:|tel:|#)/i.test(String(rawUrl || '').trim());
}

function resolveRelativePath(basePath, rawUrl) {
  const source = String(rawUrl || '').trim();
  if (!source || isExternalOrSpecialUrl(source)) return null;

  const cleanUrl = source.split(/[?#]/)[0];
  const path = cleanUrl.startsWith('/') ? cleanUrl.slice(1) : [dirname(basePath), cleanUrl].filter(Boolean).join('/');
  const resolved = [];

  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') resolved.pop();
    else resolved.push(part);
  }

  return resolved.join('/');
}

function getAsset(fileMap, assetPath) {
  const record = fileMap.get(assetPath);
  if (!record) return null;
  return typeof record === 'string' ? { url: record } : record;
}

function preserveQueryAndHash(rawUrl, blobUrl) {
  return `${blobUrl}${getPathSuffix(rawUrl)}`;
}

function rewriteCssUrls(cssText, cssPath, fileMap, warnings) {
  return String(cssText || '').replace(/url\((['"]?)(.*?)\1\)/gi, (full, quote, rawUrl) => {
    const trimmedUrl = String(rawUrl || '').trim();
    const assetPath = resolveRelativePath(cssPath, trimmedUrl);
    if (!assetPath) return full;

    const asset = getAsset(fileMap, assetPath);
    if (!asset?.url) {
      warnings.add(`未找到样式资源：${trimmedUrl}`);
      return full;
    }

    return `url(${quote}${preserveQueryAndHash(trimmedUrl, asset.url)}${quote})`;
  });
}

function rewriteSrcset(value, htmlPath, fileMap, warnings) {
  return String(value || '')
    .split(',')
    .map((candidate) => {
      const parts = candidate.trim().split(/\s+/);
      const assetPath = resolveRelativePath(htmlPath, parts[0]);
      if (!assetPath) return candidate;

      const asset = getAsset(fileMap, assetPath);
      if (!asset?.url) {
        warnings.add(`未找到图片资源：${parts[0]}`);
        return candidate;
      }

      parts[0] = preserveQueryAndHash(parts[0], asset.url);
      return parts.join(' ');
    })
    .join(', ');
}

async function rewriteLinkedStylesheets(document, htmlPath, fileMap, warnings, transientUrls) {
  const links = Array.from(document.querySelectorAll('link[href]'));

  for (const link of links) {
    const rel = String(link.getAttribute('rel') || '').toLowerCase();
    if (!rel.split(/\s+/).includes('stylesheet')) continue;

    const rawUrl = link.getAttribute('href');
    const cssPath = resolveRelativePath(htmlPath, rawUrl);
    if (!cssPath) continue;

    const asset = getAsset(fileMap, cssPath);
    if (!asset?.file) {
      warnings.add(`未找到样式表：${rawUrl}`);
      continue;
    }

    const cssText = await asset.file.text();
    const rewrittenCss = rewriteCssUrls(cssText, cssPath, fileMap, warnings);
    const cssUrl = URL.createObjectURL(new Blob([rewrittenCss], { type: 'text/css' }));
    transientUrls.push(cssUrl);
    link.setAttribute('href', preserveQueryAndHash(rawUrl, cssUrl));
  }
}

export function buildWorkspace(files) {
  const objectUrls = [];
  const fileMap = new Map();
  const htmlFiles = [];

  Array.from(files || []).forEach((file) => {
    const path = normalizePath(file.webkitRelativePath || file.name);
    const url = URL.createObjectURL(file);
    objectUrls.push(url);
    fileMap.set(path, { file, url });

    if (HTML_FILE_PATTERN.test(file.name)) {
      htmlFiles.push({ file, path, name: file.name });
    }
  });

  htmlFiles.sort((left, right) => left.path.localeCompare(right.path, 'zh-CN'));

  return { htmlFiles, fileMap, objectUrls };
}

export async function readHtmlDocument(item, fileMap) {
  const warnings = new Set();
  const transientUrls = [];
  const source = await item.file.text();
  const parser = new DOMParser();
  const document = parser.parseFromString(source, 'text/html');
  const base = document.createElement('base');
  base.href = window.location.href;
  document.head.prepend(base);

  await rewriteLinkedStylesheets(document, item.path, fileMap, warnings, transientUrls);

  ASSET_ATTRIBUTES.forEach((attribute) => {
    document.querySelectorAll(`[${attribute}]`).forEach((element) => {
      if (attribute === 'href' && element.matches('link[rel~="stylesheet"]')) return;

      const rawUrl = element.getAttribute(attribute);
      const assetPath = resolveRelativePath(item.path, rawUrl);
      if (!assetPath) return;

      const asset = getAsset(fileMap, assetPath);
      if (!asset?.url) {
        warnings.add(`未找到资源：${rawUrl}`);
        return;
      }

      element.setAttribute(attribute, preserveQueryAndHash(rawUrl, asset.url));
    });
  });

  document.querySelectorAll('[srcset]').forEach((element) => {
    element.setAttribute('srcset', rewriteSrcset(element.getAttribute('srcset'), item.path, fileMap, warnings));
  });

  document.querySelectorAll('[style]').forEach((element) => {
    element.setAttribute('style', rewriteCssUrls(element.getAttribute('style'), item.path, fileMap, warnings));
  });

  document.querySelectorAll('style').forEach((style) => {
    style.textContent = rewriteCssUrls(style.textContent, item.path, fileMap, warnings);
  });

  return {
    html: `<!doctype html>\n${document.documentElement.outerHTML}`,
    warnings: Array.from(warnings),
    objectUrls: transientUrls
  };
}

export function revokeWorkspaceUrls(objectUrls) {
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
}
