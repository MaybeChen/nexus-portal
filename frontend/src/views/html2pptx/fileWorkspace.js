const HTML_FILE_PATTERN = /\.html?$/i;
const RESOURCE_REWRITE_RULES = [
  { selector: 'img[src]', attribute: 'src', label: '图片资源' },
  { selector: 'link[href]', attribute: 'href', label: '链接资源' },
  { selector: 'source[src]', attribute: 'src', label: '媒体资源' },
  { selector: 'video[src]', attribute: 'src', label: '视频资源' },
  { selector: 'video[poster]', attribute: 'poster', label: '视频封面资源' },
  { selector: 'audio[src]', attribute: 'src', label: '音频资源' },
  { selector: 'script[src]', attribute: 'src', label: '脚本资源' }
];
const KNOWN_ASSET_MAPPINGS = [
  {
    remotePrefix: 'https://cdn.digitalhumanai.top/slidagent/pptx-craft/assets/',
    localPrefixes: ['assets/', 'pptx-craft/assets/', '']
  },
  {
    remotePrefix: 'https://npmmirror.com/mirrors/fonteditor-core@2.6.3/',
    localPrefixes: ['fonteditor-core/', 'fonteditor-core@2.6.3/', 'assets/fonteditor-core/', '']
  }
];

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

function stripQueryAndHash(rawUrl) {
  return String(rawUrl || '').trim().split(/[?#]/)[0];
}

function isExternalOrSpecialUrl(rawUrl) {
  return /^(data:|blob:|https?:|mailto:|tel:|#)/i.test(String(rawUrl || '').trim());
}

function getAsset(fileMap, assetPath) {
  const record = fileMap.get(assetPath);
  if (!record) return null;
  return typeof record === 'string' ? { url: record } : record;
}

function findKnownAssetPath(rawUrl, fileMap) {
  const cleanUrl = stripQueryAndHash(rawUrl);
  const mapping = KNOWN_ASSET_MAPPINGS.find(({ remotePrefix }) => cleanUrl.startsWith(remotePrefix));
  if (!mapping) return null;

  const relativePath = normalizePath(cleanUrl.slice(mapping.remotePrefix.length));
  const candidates = mapping.localPrefixes.map((prefix) => normalizePath(`${prefix}${relativePath}`));
  return candidates.find((candidate) => getAsset(fileMap, candidate)) || candidates[0] || null;
}

function resolveRelativePath(basePath, rawUrl, fileMap) {
  const source = String(rawUrl || '').trim();
  if (!source) return null;

  const knownAssetPath = findKnownAssetPath(source, fileMap);
  if (knownAssetPath) return knownAssetPath;
  if (isExternalOrSpecialUrl(source)) return null;

  const cleanUrl = stripQueryAndHash(source);
  const path = cleanUrl.startsWith('/') ? cleanUrl.slice(1) : [dirname(basePath), cleanUrl].filter(Boolean).join('/');
  const resolved = [];

  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') resolved.pop();
    else resolved.push(part);
  }

  return resolved.join('/');
}

function preserveQueryAndHash(rawUrl, blobUrl) {
  return `${blobUrl}${getPathSuffix(rawUrl)}`;
}

function rewriteUrl(rawUrl, basePath, fileMap, warnings, label) {
  const assetPath = resolveRelativePath(basePath, rawUrl, fileMap);
  if (!assetPath) return rawUrl;

  const asset = getAsset(fileMap, assetPath);
  if (!asset?.url) {
    warnings.add(`未找到${label}：${rawUrl}`);
    return rawUrl;
  }

  return preserveQueryAndHash(rawUrl, asset.url);
}

function rewriteCssUrls(cssText, cssPath, fileMap, warnings) {
  return String(cssText || '').replace(/url\((['"]?)(.*?)\1\)/gi, (full, quote, rawUrl) => {
    const rewrittenUrl = rewriteUrl(String(rawUrl || '').trim(), cssPath, fileMap, warnings, '样式资源');
    return rewrittenUrl === rawUrl ? full : `url(${quote}${rewrittenUrl}${quote})`;
  });
}

function rewriteSrcset(value, htmlPath, fileMap, warnings) {
  return String(value || '')
    .split(',')
    .map((candidate) => {
      const parts = candidate.trim().split(/\s+/);
      if (!parts[0]) return candidate;
      parts[0] = rewriteUrl(parts[0], htmlPath, fileMap, warnings, '图片资源');
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
    const cssPath = resolveRelativePath(htmlPath, rawUrl, fileMap);
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

function rewriteResourceElements(document, htmlPath, fileMap, warnings) {
  RESOURCE_REWRITE_RULES.forEach(({ selector, attribute, label }) => {
    document.querySelectorAll(selector).forEach((element) => {
      if (selector === 'link[href]' && element.matches('link[rel~="stylesheet"]')) return;
      const rawUrl = element.getAttribute(attribute);
      const rewrittenUrl = rewriteUrl(rawUrl, htmlPath, fileMap, warnings, label);
      if (rewrittenUrl !== rawUrl) element.setAttribute(attribute, rewrittenUrl);
    });
  });
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
  rewriteResourceElements(document, item.path, fileMap, warnings);

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
