// src/pptx-normalizer.js
//
// Defensive OOXML normalizer that runs over the PPTX produced by PptxGenJS
// before we hand the .pptx blob to the user. Microsoft PowerPoint refuses to
// open files when [Content_Types].xml advertises parts that are not actually
// present in the package — see 错误诊断.md for the original incident report.
//
// This module operates on an already-loaded JSZip instance and mutates it in
// place. The caller is responsible for re-serializing the zip with DEFLATE
// compression afterwards.
const pPrOrder = [
  'lnSpc',
  'spcBef',
  'spcAft',
  'buClrTx',
  'buClr',
  'buSzTx',
  'buSzPct',
  'buSzPts',
  'buFontTx',
  'buFont',
  'buNone',
  'buAutoNum',
  'buChar',
  'buBlip',
  'tabLst',
  'defRPr',
  'extLst',
];

/**
 * Strips dangling <Override> entries from [Content_Types].xml.
 *
 * An Override is "dangling" when its PartName attribute references a file path
 * that does not exist inside the zip. Default entries are left untouched
 * because they apply to every file with a matching extension, and removing
 * them would break legitimate parts (e.g. the fntdata default added by the
 * font embedder).
 *
 * The function is idempotent: running it twice on the same zip yields the
 * same result as running it once.
 *
 * @param {import('jszip')} zip - JSZip instance with the loaded PPTX package.
 * @returns {Promise<void>}
 */
export async function normalizePptxZip(zip) {
  if (!zip) return;
  const contentTypesFile = zip.file('[Content_Types].xml');
  if (!contentTypesFile) return;
  let xmlStr;
  try {
    xmlStr = await contentTypesFile.async('string');
  } catch (e) {
    console.warn('[pptx-normalizer] Failed to read [Content_Types].xml:', e);
    return;
  }
  let doc;
  try {
    doc = new DOMParser().parseFromString(xmlStr, 'text/xml');
  } catch (e) {
    console.warn('[pptx-normalizer] Failed to parse [Content_Types].xml:', e);
    return;
  }
  const parserError = doc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    console.warn('[pptx-normalizer] [Content_Types].xml has parser errors, skipping cleanup.');
    return;
  }

  stripDanglingOverrides(zip, doc);
  await normalizePresentationParts(zip);

  const serialized = new XMLSerializer().serializeToString(doc);
  zip.file('[Content_Types].xml', serialized);
}

function stripDanglingOverrides(zip, doc) {
  const overrides = Array.from(doc.getElementsByTagName('Override'));
  for (const override of overrides) {
    const partName = override.getAttribute('PartName');
    if (!partName) continue;
    const zipPath = partName.replace(/^\//, '');
    if (!zip.file(zipPath)) override.parentNode?.removeChild(override);
  }
}

async function normalizePresentationParts(zip) {
  const paths = Object.keys(zip.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path));
  await Promise.all(paths.map(async (path) => {
    const file = zip.file(path);
    if (!file) return;
    const xml = await file.async('string');
    zip.file(path, normalizeParagraphProperties(xml));
  }));
}

function normalizeParagraphProperties(xml) {
  return xml.replace(/<a:pPr([^>]*)>([\s\S]*?)<\/a:pPr>/g, (match, attrs, body) => {
    const children = [];
    body.replace(/<a:([A-Za-z0-9]+)\b[\s\S]*?<\/a:\1>|<a:([A-Za-z0-9]+)\b[^/]*\/>/g, (child) => {
      children.push(child);
      return child;
    });
    if (!children.length) return match;
    children.sort((a, b) => orderOf(a) - orderOf(b));
    return `<a:pPr${attrs}>${children.join('')}</a:pPr>`;
  });
}

function orderOf(childXml) {
  const name = childXml.match(/^<a:([A-Za-z0-9]+)/)?.[1];
  const index = pPrOrder.indexOf(name);
  return index === -1 ? pPrOrder.length : index;
}
