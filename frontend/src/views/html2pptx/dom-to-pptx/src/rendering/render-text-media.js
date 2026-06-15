import {
  getTextStyle,
  isTextContainer,
  parseColor,
  getVisibleShadow,
  extractTableData,
  svgToPng,
  svgToSvg,
  collectTextParts,
  getPadding,
} from '../utils.js';
import { getProcessedImage } from '../image-processor.js';
import { PX_TO_INCH } from '../constants.js';
import { isIconElement, prepareElementImageItem } from './element-capture.js';

export function prepareTextNode(node, config, domOrder, effectiveZIndex, globalOptions = {}) {
  const textContent = node.nodeValue.trim();
  if (!textContent) return null;

  const parent = node.parentElement;
  if (!parent) return null;
  if (isTextContainer(parent)) return null;

  const range = document.createRange();
  range.selectNode(node);
  const rect = range.getBoundingClientRect();
  range.detach();

  const style = window.getComputedStyle(parent);
  const widthPx = rect.width;
  const heightPx = rect.height;
  const unrotatedW = widthPx * PX_TO_INCH * config.scale;
  const unrotatedH = heightPx * PX_TO_INCH * config.scale;
  const x = config.offX + (rect.left - config.rootX) * PX_TO_INCH * config.scale;
  const y = config.offY + (rect.top - config.rootY) * PX_TO_INCH * config.scale;
  const textOpts = getTextStyle(style, config.scale, true, globalOptions._inheritedOpacity || 1);

  if (textOpts.charSpacing !== undefined) {
    const spcVal = Math.round(textOpts.charSpacing * 100);
    if (textOpts.fontFace) textOpts.fontFace = `${textOpts.fontFace}__spc_${spcVal}`;
  }

  return {
    items: [
      {
        type: 'text',
        zIndex: effectiveZIndex.concat([0, -1]),
        domOrder,
        textParts: [{ text: textContent, options: textOpts }],
        options: {
          x,
          y,
          w: unrotatedW,
          h: unrotatedH,
          margin: 0,
          autoFit: true,
          wrap: !(style.whiteSpace === 'nowrap' || style.whiteSpace === 'pre'),
        },
      },
    ],
    stopRecursion: false,
  };
}

function getVisibleCellBorder(style, side, scale) {
  const width = parseFloat(style[`border${side}Width`]) || 0;
  const borderStyle = style[`border${side}Style`];
  const color = parseColor(style[`border${side}Color`], style);
  if (width <= 0 || borderStyle === 'none' || borderStyle === 'hidden' || !color.hex || color.opacity === 0) {
    return null;
  }
  return { width: width * PX_TO_INCH * scale, color: color.hex, opacity: color.opacity };
}

function createTableBorderOverlayItems(node, context) {
  const { config, parentSortKey, domOrder } = context;
  const items = [];
  const cells = Array.from(node.querySelectorAll('th,td'));
  const sideDefs = [
    { css: 'Top', edge: 'top' },
    { css: 'Right', edge: 'right' },
    { css: 'Bottom', edge: 'bottom' },
    { css: 'Left', edge: 'left' },
  ];

  cells.forEach((cell) => {
    const rect = cell.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const style = window.getComputedStyle(cell);
    const x = config.offX + (rect.left - config.rootX) * PX_TO_INCH * config.scale;
    const y = config.offY + (rect.top - config.rootY) * PX_TO_INCH * config.scale;
    const w = rect.width * PX_TO_INCH * config.scale;
    const h = rect.height * PX_TO_INCH * config.scale;

    sideDefs.forEach(({ css, edge }) => {
      const border = getVisibleCellBorder(style, css, config.scale);
      if (!border) return;
      const common = {
        type: 'shape',
        zIndex: parentSortKey.concat([0, 0]),
        domOrder,
        shapeType: 'rect',
        options: {
          fill: { color: border.color, transparency: (1 - border.opacity) * 100 },
          line: null,
        },
      };
      if (edge === 'top') items.push({ ...common, options: { ...common.options, x, y, w, h: border.width } });
      if (edge === 'right') items.push({ ...common, options: { ...common.options, x: x + w - border.width, y, w: border.width, h } });
      if (edge === 'bottom') items.push({ ...common, options: { ...common.options, x, y: y + h - border.width, w, h: border.width } });
      if (edge === 'left') items.push({ ...common, options: { ...common.options, x, y, w: border.width, h } });
    });
  });

  return items;
}

export function prepareTableItem(node, context) {
  const { config, parentSortKey, domOrder, x, y, unrotatedW, unrotatedH, widthPx, heightPx, style, pptx } = context;
  if (node.tagName !== 'TABLE') return null;

  const tableData = extractTableData(node, config.scale);
  const tableItems = [
    {
      type: 'table',
      zIndex: parentSortKey.concat([0, -1]),
      domOrder,
      tableData,
      options: { x, y, w: unrotatedW, h: unrotatedH },
    },
  ];

  const shadowStr = style.boxShadow;
  const hasShadow = shadowStr && shadowStr !== 'none';
  const borderRadius = parseFloat(style.borderRadius) || 0;
  const bgColor = parseColor(style.backgroundColor);
  const hasBg = bgColor.hex && bgColor.opacity > 0;

  if (hasShadow || borderRadius > 0 || hasBg) {
    const transparency = (1 - bgColor.opacity) * 100;
    const shadow = hasShadow ? getVisibleShadow(shadowStr, config.scale) : null;
    let shapeType = pptx.ShapeType.rect;
    let rectRadius = 0;

    if (borderRadius > 0) {
      shapeType = pptx.ShapeType.roundRect;
      const cappedRadiusPx = Math.min(borderRadius, Math.min(widthPx, heightPx) / 2);
      rectRadius = cappedRadiusPx * PX_TO_INCH * config.scale;
    }

    tableItems.unshift({
      type: 'shape',
      zIndex: parentSortKey.concat([-Infinity]),
      domOrder,
      shapeType,
      options: {
        x,
        y,
        w: unrotatedW,
        h: unrotatedH,
        ...(hasBg && { fill: { color: bgColor.hex, transparency } }),
        shadow,
        rectRadius,
      },
    });
  }

  tableItems.push(...createTableBorderOverlayItems(node, context));

  // Native PowerPoint tables can only contain text runs, not inline images.
  // Render icon-font elements separately above the editable table and omit the
  // corresponding private-use glyph from the cell text.
  const iconJobs = [];
  const iconElements = Array.from(node.querySelectorAll('i, span')).filter(isIconElement);
  iconElements.forEach((iconNode, iconIndex) => {
    const iconRect = iconNode.getBoundingClientRect();
    if (iconRect.width < 0.5 || iconRect.height < 0.5) return;

    const iconX =
      config.offX + (iconRect.left - config.rootX) * PX_TO_INCH * config.scale;
    const iconY =
      config.offY + (iconRect.top - config.rootY) * PX_TO_INCH * config.scale;
    const iconW = iconRect.width * PX_TO_INCH * config.scale;
    const iconH = iconRect.height * PX_TO_INCH * config.scale;
    const iconResult = prepareElementImageItem(
      iconNode,
      parentSortKey.concat([0, 1]),
      domOrder + (iconIndex + 1) / 1000,
      iconX,
      iconY,
      iconW,
      iconH,
      iconRect.width,
      iconRect.height,
      0
    );
    tableItems.push(...iconResult.items);
    if (iconResult.job) iconJobs.push(iconResult.job);
  });

  const job =
    iconJobs.length > 0
      ? async () => {
          await Promise.all(iconJobs.map((iconJob) => iconJob()));
        }
      : null;
  return { items: tableItems, job, stopRecursion: true };
}

export function prepareCanvasItem(node, context) {
  const { parentSortKey, domOrder, x, y, w, h, rotation } = context;
  if (node.tagName !== 'CANVAS') return null;

  const item = {
    type: 'image',
    zIndex: parentSortKey.concat([0, -1]),
    domOrder,
    options: { x, y, w, h, rotate: rotation, data: null },
  };

  const job = async () => {
    try {
      const dataUrl = node.toDataURL('image/png');
      if (dataUrl && dataUrl.length > 10) item.options.data = dataUrl;
      else item.skip = true;
    } catch (e) {
      console.warn('Failed to capture canvas content:', e);
      item.skip = true;
    }
  };

  return { items: [item], job, stopRecursion: true };
}

export function prepareSvgItem(node, context, globalOptions = {}) {
  const { parentSortKey, domOrder, x, y, w, h, rotation } = context;
  if (node.nodeName.toUpperCase() !== 'SVG') return null;

  const item = {
    type: 'image',
    zIndex: parentSortKey.concat([0, -1]),
    domOrder,
    options: { data: null, x, y, w, h, rotate: rotation },
  };

  const job = async () => {
    const converter = globalOptions.svgAsVector ? svgToSvg : svgToPng;
    const processed = await converter(node);
    if (processed) item.options.data = processed;
    else item.skip = true;
  };

  return { items: [item], job, stopRecursion: true };
}

export function prepareImgItem(node, context) {
  const { style, rect, parentSortKey, domOrder, x, y, w, h, widthPx, heightPx, rotation } = context;
  if (node.tagName !== 'IMG') return null;

  let radii = {
    tl: parseFloat(style.borderTopLeftRadius) || 0,
    tr: parseFloat(style.borderTopRightRadius) || 0,
    br: parseFloat(style.borderBottomRightRadius) || 0,
    bl: parseFloat(style.borderBottomLeftRadius) || 0,
  };

  const hasAnyRadius = radii.tl > 0 || radii.tr > 0 || radii.br > 0 || radii.bl > 0;
  if (!hasAnyRadius) {
    const parent = node.parentElement;
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.overflow !== 'visible') {
      const pRadii = {
        tl: parseFloat(parentStyle.borderTopLeftRadius) || 0,
        tr: parseFloat(parentStyle.borderTopRightRadius) || 0,
        br: parseFloat(parentStyle.borderBottomRightRadius) || 0,
        bl: parseFloat(parentStyle.borderBottomLeftRadius) || 0,
      };
      const pRect = parent.getBoundingClientRect();
      if (Math.abs(pRect.width - rect.width) < 5 && Math.abs(pRect.height - rect.height) < 5) radii = pRadii;
    }
  }

  const objectFit = style.objectFit || 'fill';
  const objectPosition = style.objectPosition || '50% 50%';
  const item = {
    type: 'image',
    zIndex: parentSortKey.concat([0, -1]),
    domOrder,
    options: { x, y, w, h, rotate: rotation, data: null },
  };

  const job = async () => {
    const processed = await getProcessedImage(node.src, widthPx, heightPx, radii, objectFit, objectPosition);
    if (processed) item.options.data = processed;
    else item.skip = true;
  };

  return { items: [item], job, stopRecursion: true };
}

export function buildTextPayload(node, style, config, writingModeVert, inheritedOpacity) {
  if (!isTextContainer(node)) return null;

  const textParts = collectTextParts(node, style, config.scale, null, true, inheritedOpacity);
  if (textParts.length === 0) return null;

  let align = style.textAlign || 'left';
  if (align === 'start') align = 'left';
  if (align === 'end') align = 'right';
  let valign = 'top';
  if (style.verticalAlign === 'middle') valign = 'middle';
  if (style.verticalAlign === 'bottom') valign = 'bottom';

  const isVertical = writingModeVert && writingModeVert !== 'none';
  const isColumn = style.flexDirection === 'column' || style.flexDirection === 'column-reverse';

  if (isVertical || isColumn) {
    if (style.alignItems === 'center') align = 'center';
    if (style.alignItems === 'flex-end' || style.alignItems === 'end') align = 'right';
    if (style.justifyContent === 'center' && style.display.includes('flex')) valign = 'middle';
    if (style.justifyContent === 'flex-end' && style.display.includes('flex')) valign = 'bottom';
  } else {
    if (style.alignItems === 'center') valign = 'middle';
    if (style.alignItems === 'flex-end' || style.alignItems === 'end') valign = 'bottom';
    if (style.justifyContent === 'center' && style.display.includes('flex')) align = 'center';
    if ((style.justifyContent === 'flex-end' || style.justifyContent === 'end') && style.display.includes('flex')) align = 'right';
  }

  if (isVertical) {
    textParts.forEach((p) => {
      if (p.options) delete p.options.lineSpacing;
    });
  }

  const padding = getPadding(style, config.scale);
  const margin = [padding[3] * 72, padding[1] * 72, padding[2] * 72, padding[0] * 72];
  return { text: textParts, align, valign, margin };
}
