const HTML_FILE_PATTERN = /\.html?$/i;
const ASSET_ATTRIBUTES = ['src', 'href', 'poster'];

function normalizePath(path) {
  return String(path || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function dirname(path) {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf('/');
  return index === -1 ? '' : normalized.slice(0, index + 1);
}

function resolveRelativePath(basePath, rawUrl) {
  if (!rawUrl || /^(data:|blob:|https?:|mailto:|tel:|#)/i.test(rawUrl)) return null;
  const cleanUrl = String(rawUrl).split(/[?#]/)[0];
  const stack = `${dirname(basePath)}${cleanUrl}`.split('/');
  const resolved = [];

  for (const part of stack) {
    if (!part || part === '.') continue;
    if (part === '..') resolved.pop();
    else resolved.push(part);
  }

  return resolved.join('/');
}

function preserveQueryAndHash(rawUrl, blobUrl) {
  const suffix = String(rawUrl).match(/([?#].*)$/)?.[1] || '';
  return `${blobUrl}${suffix}`;
}

function rewriteCssUrls(cssText, htmlPath, fileMap, warnings) {
  return String(cssText || '').replace(/url\((['"]?)(.*?)\1\)/gi, (full, quote, rawUrl) => {
    const trimmedUrl = String(rawUrl || '').trim();
    const assetPath = resolveRelativePath(htmlPath, trimmedUrl);
    if (!assetPath) return full;

    const assetUrl = fileMap.get(assetPath);
    if (!assetUrl) {
      warnings.add(`未找到样式资源：${trimmedUrl}`);
      return full;
    }

    return `url(${quote}${preserveQueryAndHash(trimmedUrl, assetUrl)}${quote})`;
  });
}

function rewriteSrcset(value, htmlPath, fileMap, warnings) {
  return String(value || '')
    .split(',')
    .map((candidate) => {
      const parts = candidate.trim().split(/\s+/);
      const assetPath = resolveRelativePath(htmlPath, parts[0]);
      if (!assetPath) return candidate;

      const assetUrl = fileMap.get(assetPath);
      if (!assetUrl) {
        warnings.add(`未找到图片资源：${parts[0]}`);
        return candidate;
      }

      parts[0] = preserveQueryAndHash(parts[0], assetUrl);
      return parts.join(' ');
    })
    .join(', ');
}

export function buildWorkspace(files) {
  const objectUrls = [];
  const fileMap = new Map();
  const htmlFiles = [];

  Array.from(files || []).forEach((file) => {
    const path = normalizePath(file.webkitRelativePath || file.name);
    const url = URL.createObjectURL(file);
    objectUrls.push(url);
    fileMap.set(path, url);

    if (HTML_FILE_PATTERN.test(file.name)) {
      htmlFiles.push({ file, path, name: file.name });
    }
  });

  htmlFiles.sort((left, right) => left.path.localeCompare(right.path, 'zh-CN'));

  return { htmlFiles, fileMap, objectUrls };
}

export async function readHtmlDocument(item, fileMap) {
  const warnings = new Set();
  const source = await item.file.text();
  const parser = new DOMParser();
  const document = parser.parseFromString(source, 'text/html');
  const base = document.createElement('base');
  base.href = window.location.href;
  document.head.prepend(base);

  ASSET_ATTRIBUTES.forEach((attribute) => {
    document.querySelectorAll(`[${attribute}]`).forEach((element) => {
      const rawUrl = element.getAttribute(attribute);
      const assetPath = resolveRelativePath(item.path, rawUrl);
      if (!assetPath) return;

      const assetUrl = fileMap.get(assetPath);
      if (!assetUrl) {
        warnings.add(`未找到资源：${rawUrl}`);
        return;
      }

      element.setAttribute(attribute, preserveQueryAndHash(rawUrl, assetUrl));
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
    warnings: Array.from(warnings)
  };
}

export function revokeWorkspaceUrls(objectUrls) {
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
}
