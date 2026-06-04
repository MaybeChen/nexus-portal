// Route-local dom-to-pptx source entry.
// Upstream source reference: https://github.com/atharva9167j/dom-to-pptx/tree/master/src

import { createZip } from './pptx-normalizer.js';
import {
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  EMU_PER_INCH,
  XMLNS_A,
  XMLNS_P,
  XMLNS_R,
  download,
  resolveTargets
} from './utils.js';
import { getProcessedImage } from './image-processor.js';

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
    files.push(
      { path: `ppt/slides/slide${index + 1}.xml`, content: slideXml(index + 1, widthEmu, heightEmu) },
      { path: `ppt/slides/_rels/slide${index + 1}.xml.rels`, content: slideRels(index + 1) },
      { path: `ppt/media/slide${index + 1}.svg`, content: getProcessedImage(element) }
    );
  });

  const blob = new Blob([createZip(files)], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  });

  if (!options.skipDownload) download(blob, options.fileName || 'export.pptx');
  return blob;
}
