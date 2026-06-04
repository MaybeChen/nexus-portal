export class PPTXEmbedFonts {
  async loadZip(zip) {
    this.zip = zip;
  }

  async addFont() {
    return undefined;
  }

  async updateFiles() {
    return undefined;
  }

  async generateBlob() {
    return this.zip?.generateAsync?.({ type: 'blob' });
  }
}
