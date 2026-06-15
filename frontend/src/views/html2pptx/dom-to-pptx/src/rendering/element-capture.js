import html2canvas from 'html2canvas';

export function isIconFontStyle(style) {
  return /font awesome|fontawesome|bootstrap[- ]icons|material (?:icons|symbols)/i.test(
    style?.fontFamily || ''
  );
}

export function getRenderedPseudoContent(content) {
  if (!content || content === 'none' || content === 'normal' || content === '""' || content === "''") {
    return '';
  }

  const unquoted = content.replace(/^(['"])(.*)\1$/s, '$2');
  return unquoted
    .replace(/\\([0-9a-f]{1,6})\s?/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\(["'\\])/g, '$1');
}

function getIconPseudoStyle(node) {
  const ownerWindow = node.ownerDocument?.defaultView || window;
  for (const pseudoType of ['::before', '::after']) {
    const style = ownerWindow.getComputedStyle(node, pseudoType);
    const text = getRenderedPseudoContent(style.content);
    if (text && isIconFontStyle(style)) return { style, text };
  }
  return null;
}

export async function iconGlyphToCanvasImage(ownerDocument, style, text, widthPx, heightPx) {
  const width = Math.max(Math.ceil(widthPx), 1);
  const height = Math.max(Math.ceil(heightPx), 1);
  const pixelRatio = 3;
  const fontSize = parseFloat(style.fontSize) || Math.min(width, height);
  const fontFamily = style.fontFamily || 'sans-serif';
  const fontWeight = style.fontWeight || 'normal';
  const fontStyle = style.fontStyle || 'normal';
  const font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

  try {
    await ownerDocument.fonts?.load(font, text);
  } catch (error) {
    console.warn('Icon font could not be preloaded before capture', error);
  }

  const canvas = ownerDocument.createElement('canvas');
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.scale(pixelRatio, pixelRatio);
  context.font = font;
  context.fillStyle = style.color || '#000';
  context.globalAlpha = Number.isFinite(parseFloat(style.opacity)) ? parseFloat(style.opacity) : 1;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, width / 2, height / 2);
  return canvas.toDataURL('image/png');
}

async function iconElementToCanvasImage(node, widthPx, heightPx) {
  const icon = getIconPseudoStyle(node);
  if (!icon) return null;
  return iconGlyphToCanvasImage(
    node.ownerDocument || document,
    icon.style,
    icon.text,
    widthPx,
    heightPx
  );
}

export async function elementToCanvasImage(node, widthPx, heightPx) {
  const iconImage = await iconElementToCanvasImage(node, widthPx, heightPx);
  if (iconImage) return iconImage;

  return new Promise((resolve) => {
    const originalId = node.id;
    const tempId = 'pptx-capture-' + Math.random().toString(36).substr(2, 9);
    node.id = tempId;

    const width = Math.max(Math.ceil(widthPx), 1);
    const height = Math.max(Math.ceil(heightPx), 1);
    const style = window.getComputedStyle(node);
    const padding = 10;

    html2canvas(node, {
      backgroundColor: null,
      logging: false,
      scale: 3,
      useCORS: true,
      width: width + padding * 2,
      height: height + padding * 2,
      x: -padding,
      y: -padding,
      onclone: (clonedDoc) => {
        const clonedNode = clonedDoc.getElementById(tempId);
        if (clonedNode) {
          if (isIconFontStyle(style)) {
            clonedNode.style.setProperty('font-family', style.fontFamily, 'important');
          }

          const images = clonedNode.querySelectorAll('img');
          images.forEach((img) => {
            img.style.setProperty('display', 'inline-block', 'important');
          });

          clonedNode.style.overflow = 'visible';

          const tag = clonedNode.tagName;
          if (tag === 'I' || tag === 'SPAN' || clonedNode.className.includes('fa-')) {
            clonedNode.style.display = 'inline-flex';
            clonedNode.style.justifyContent = 'center';
            clonedNode.style.alignItems = 'center';
            if (isIconFontStyle(style)) {
              clonedNode.style.setProperty('font-family', style.fontFamily, 'important');
            }
            clonedNode.style.margin = '0';
            clonedNode.style.lineHeight = '1';
            clonedNode.style.verticalAlign = 'middle';
          }
        }
      },
    })
      .then((canvas) => {
        if (originalId) node.id = originalId;
        else node.removeAttribute('id');

        const destCanvas = document.createElement('canvas');
        destCanvas.width = width;
        destCanvas.height = height;
        const ctx = destCanvas.getContext('2d');
        const scale = 3;
        const sX = padding * scale;
        const sY = padding * scale;
        const sW = width * scale;
        const sH = height * scale;

        ctx.drawImage(canvas, sX, sY, sW, sH, 0, 0, width, height);

        let tl = parseFloat(style.borderTopLeftRadius) || 0;
        let tr = parseFloat(style.borderTopRightRadius) || 0;
        let br = parseFloat(style.borderBottomRightRadius) || 0;
        let bl = parseFloat(style.borderBottomLeftRadius) || 0;

        const f = Math.min(
          width / (tl + tr) || Infinity,
          height / (tr + br) || Infinity,
          width / (br + bl) || Infinity,
          height / (bl + tl) || Infinity
        );

        if (f < 1) {
          tl *= f;
          tr *= f;
          br *= f;
          bl *= f;
        }

        if (tl + tr + br + bl > 0) {
          ctx.globalCompositeOperation = 'destination-in';
          ctx.beginPath();
          ctx.moveTo(tl, 0);
          ctx.lineTo(width - tr, 0);
          ctx.arcTo(width, 0, width, tr, tr);
          ctx.lineTo(width, height - br);
          ctx.arcTo(width, height, width - br, height, br);
          ctx.lineTo(bl, height);
          ctx.arcTo(0, height, 0, height - bl, bl);
          ctx.lineTo(0, tl);
          ctx.arcTo(0, 0, tl, 0, tl);
          ctx.closePath();
          ctx.fill();
        }

        resolve(destCanvas.toDataURL('image/png'));
      })
      .catch((e) => {
        if (originalId) node.id = originalId;
        else node.removeAttribute('id');
        console.warn('Canvas capture failed for node', node, e);
        resolve(null);
      });
  });
}

export function isIconElement(node) {
  const tag = node.tagName.toUpperCase();
  if (
    tag.includes('-') ||
    [
      'MATERIAL-ICON',
      'ICONIFY-ICON',
      'REMIX-ICON',
      'ION-ICON',
      'EVA-ICON',
      'BOX-ICON',
    ].includes(tag)
  ) {
    return true;
  }

  if (tag === 'I' || tag === 'SPAN') {
    const cls = node.getAttribute('class') || '';
    if (
      typeof cls === 'string' &&
      (cls.includes('fa-') ||
        cls.includes('fas') ||
        cls.includes('far') ||
        cls.includes('fab') ||
        cls.includes('bi-') ||
        cls.includes('material-icons') ||
        cls.includes('icon'))
    ) {
      if (getIconPseudoStyle(node)) return true;
    }
  }

  return false;
}

export function prepareElementImageItem(node, parentSortKey, domOrder, x, y, w, h, widthPx, heightPx, rotation) {
  const item = {
    type: 'image',
    zIndex: parentSortKey.concat([0, -1]),
    domOrder,
    options: { x, y, w, h, rotate: rotation, data: null },
  };
  const job = async () => {
    const pngData = await elementToCanvasImage(node, widthPx, heightPx);
    if (pngData) item.options.data = pngData;
    else item.skip = true;
  };
  return { items: [item], job, stopRecursion: true };
}
