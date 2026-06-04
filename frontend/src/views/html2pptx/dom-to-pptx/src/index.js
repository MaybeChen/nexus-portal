// Local vendored entry for the html2pptx route.
// It mirrors the upstream dom-to-pptx public API by exporting exportToPptx(target, options).
// Source reference: https://github.com/atharva9167j/dom-to-pptx/tree/master/src

const XMLNS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const XMLNS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const XMLNS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const EMU_PER_INCH = 914400;
const DEFAULT_WIDTH = 13.333;
const DEFAULT_HEIGHT = 7.5;
const encoder = new TextEncoder();

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    bytes.set(part, offset);
    offset += part.length;
  });
  return bytes;
}

function uint16(value) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function uint32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function getDosTimestamp() {
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  return { time, date };
}

function createZip(files) {
  const { time, date } = getDosTimestamp();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach(({ path, content }) => {
    const name = encoder.encode(path);
    const data = typeof content === 'string' ? encoder.encode(content) : content;
    const crc = crc32(data);
    const localHeader = concatBytes([
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(time),
      uint16(date),
      uint32(crc),
      uint32(data.length),
      uint32(data.length),
      uint16(name.length),
      uint16(0),
      name
    ]);

    localParts.push(localHeader, data);
    centralParts.push(
      concatBytes([
        uint32(0x02014b50),
        uint16(20),
        uint16(20),
        uint16(0),
        uint16(0),
        uint16(time),
        uint16(date),
        uint32(crc),
        uint32(data.length),
        uint32(data.length),
        uint16(name.length),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(0),
        uint32(offset),
        name
      ])
    );
    offset += localHeader.length + data.length;
  });

  const centralDirectory = concatBytes(centralParts);
  const end = concatBytes([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(files.length),
    uint16(files.length),
    uint32(centralDirectory.length),
    uint32(offset),
    uint16(0)
  ]);

  return concatBytes([...localParts, centralDirectory, end]);
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function inlineComputedStyles(source, clone) {
  if (source.nodeType !== Node.ELEMENT_NODE || clone.nodeType !== Node.ELEMENT_NODE) return;

  const computed = window.getComputedStyle(source);
  const inlineStyle = Array.from(computed)
    .map((property) => `${property}:${computed.getPropertyValue(property)};`)
    .join('');
  clone.setAttribute('style', inlineStyle);

  Array.from(source.children).forEach((child, index) => {
    if (clone.children[index]) inlineComputedStyles(child, clone.children[index]);
  });
}

function elementToSvgData(target, width, height) {
  const clone = target.cloneNode(true);
  inlineComputedStyles(target, clone);
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');

  const html = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width)}" height="${Math.ceil(height)}" viewBox="0 0 ${Math.ceil(width)} ${Math.ceil(height)}"><foreignObject width="100%" height="100%">${html}</foreignObject></svg>`;
  return encoder.encode(svg);
}

function resolveTargets(target) {
  const items = Array.isArray(target) ? target : [target];
  return items
    .map((item) => (typeof item === 'string' ? document.querySelector(item) : item))
    .filter(Boolean);
}

function contentTypes(slideCount) {
  const slideOverrides = Array.from({ length: slideCount }, (_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="svg" ContentType="image/svg+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>${slideOverrides}</Types>`;
}

function rootRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function presentationXml(slideCount, widthEmu, heightEmu) {
  const slideIds = Array.from({ length: slideCount }, (_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="${XMLNS_A}" xmlns:r="${XMLNS_R}" xmlns:p="${XMLNS_P}"><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="${widthEmu}" cy="${heightEmu}" type="wide"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
}

function presentationRels(slideCount) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${Array.from({ length: slideCount }, (_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join('')}</Relationships>`;
}

function slideXml(index, widthEmu, heightEmu) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="${XMLNS_A}" xmlns:r="${XMLNS_R}" xmlns:p="${XMLNS_P}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:pic><p:nvPicPr><p:cNvPr id="2" name="slide-${index}.svg"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function slideRels(index) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/slide${index}.svg"/></Relationships>`;
}

function coreProps() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>HTML2PPTX Export</dc:title><dc:creator>Nexus Portal</dc:creator><cp:lastModifiedBy>Nexus Portal</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
}

function appProps(slideCount) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Nexus Portal HTML2PPTX</Application><PresentationFormat>Widescreen</PresentationFormat><Slides>${slideCount}</Slides></Properties>`;
}

function download(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportToPptx(target, options = {}) {
  const targets = resolveTargets(target);
  if (!targets.length) throw new Error('Element not found.');

  const width = options.width || options.slideWidth || DEFAULT_WIDTH;
  const height = options.height || options.slideHeight || DEFAULT_HEIGHT;
  const widthEmu = Math.round(width * EMU_PER_INCH);
  const heightEmu = Math.round(height * EMU_PER_INCH);
  const files = [
    { path: '[Content_Types].xml', content: contentTypes(targets.length) },
    { path: '_rels/.rels', content: rootRels() },
    { path: 'docProps/core.xml', content: coreProps() },
    { path: 'docProps/app.xml', content: appProps(targets.length) },
    { path: 'ppt/presentation.xml', content: presentationXml(targets.length, widthEmu, heightEmu) },
    { path: 'ppt/_rels/presentation.xml.rels', content: presentationRels(targets.length) }
  ];

  targets.forEach((element, index) => {
    const rect = element.getBoundingClientRect();
    files.push(
      { path: `ppt/slides/slide${index + 1}.xml`, content: slideXml(index + 1, widthEmu, heightEmu) },
      { path: `ppt/slides/_rels/slide${index + 1}.xml.rels`, content: slideRels(index + 1) },
      { path: `ppt/media/slide${index + 1}.svg`, content: elementToSvgData(element, rect.width || 1280, rect.height || 720) }
    );
  });

  const blob = new Blob([createZip(files)], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  });

  if (!options.skipDownload) download(blob, options.fileName || 'export.pptx');
  return blob;
}
