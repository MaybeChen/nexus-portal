// src/font-embedder.js
import opentype from 'opentype.js';
import { fontToEot } from './font-utils.js';

const START_RID = 201314;
const P_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CONTENT_TYPES_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const RELS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

export class PPTXEmbedFonts {
  constructor() {
    this.zip = null;
    this.rId = START_RID;
    this.fonts = []; // { name, data, rid }
  }

  async loadZip(zip) {
    this.zip = zip;
  }

  /**
   * Reads the font name from the buffer using opentype.js
   */
  getFontInfo(fontBuffer) {
    try {
      const font = opentype.parse(fontBuffer);
      const names = font.names;
      // Prefer English name, fallback to others
      const fontFamily = names.fontFamily.en || Object.values(names.fontFamily)[0];
      return { name: fontFamily };
    } catch (e) {
      console.warn('Could not parse font info', e);
      return { name: 'Unknown' };
    }
  }

  async addFont(fontFace, fontBuffer, type) {
    // Convert to EOT/fntdata for PPTX compatibility
    const eotData = await fontToEot(type, fontBuffer);
    const rid = this.rId++;
    this.fonts.push({ name: fontFace, data: eotData, rid });
  }

  async updateFiles() {
    await this.updateContentTypesXML();
    await this.updatePresentationXML();
    await this.updateRelsPresentationXML();
    this.updateFontFiles();
  }

  async generateBlob() {
    if (!this.zip) throw new Error('Zip not loaded');
    return this.zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  }

  // --- XML Manipulation Methods ---
  async updateContentTypesXML() {
    const file = this.zip.file('[Content_Types].xml');
    if (!file) return;
    const xml = await file.async('string');
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const types = doc.documentElement;
    if (!Array.from(types.getElementsByTagName('Default')).some((node) => node.getAttribute('Extension') === 'fntdata')) {
      const def = doc.createElementNS(CONTENT_TYPES_NS, 'Default');
      def.setAttribute('Extension', 'fntdata');
      def.setAttribute('ContentType', 'application/x-fontdata');
      types.appendChild(def);
    }
    this.zip.file('[Content_Types].xml', new XMLSerializer().serializeToString(doc));
  }

  async updatePresentationXML() {
    const file = this.zip.file('ppt/presentation.xml');
    if (!file) return;
    const xml = await file.async('string');
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const presentation = doc.documentElement;
    let embeddedFontLst = doc.getElementsByTagNameNS(P_NS, 'embeddedFontLst')[0];
    if (!embeddedFontLst) {
      embeddedFontLst = doc.createElementNS(P_NS, 'p:embeddedFontLst');
      presentation.appendChild(embeddedFontLst);
    }
    for (const font of this.fonts) {
      const embeddedFont = doc.createElementNS(P_NS, 'p:embeddedFont');
      const fontNode = doc.createElementNS(P_NS, 'p:font');
      fontNode.setAttribute('typeface', font.name);
      const regular = doc.createElementNS(P_NS, 'p:regular');
      regular.setAttributeNS(R_NS, 'r:id', `rId${font.rid}`);
      embeddedFont.appendChild(fontNode);
      embeddedFont.appendChild(regular);
      embeddedFontLst.appendChild(embeddedFont);
    }
    this.zip.file('ppt/presentation.xml', new XMLSerializer().serializeToString(doc));
  }

  async updateRelsPresentationXML() {
    const path = 'ppt/_rels/presentation.xml.rels';
    const file = this.zip.file(path);
    if (!file) return;
    const xml = await file.async('string');
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const relationships = doc.documentElement;
    for (const font of this.fonts) {
      const rel = doc.createElementNS(RELS_NS, 'Relationship');
      rel.setAttribute('Id', `rId${font.rid}`);
      rel.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font');
      rel.setAttribute('Target', `fonts/font${font.rid}.fntdata`);
      relationships.appendChild(rel);
    }
    this.zip.file(path, new XMLSerializer().serializeToString(doc));
  }

  updateFontFiles() {
    for (const font of this.fonts) {
      this.zip.file(`ppt/fonts/font${font.rid}.fntdata`, font.data);
    }
  }
}
