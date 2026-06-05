import {
  parseColor,
  isTextContainer,
  getVisibleShadow,
  generateGradientSVG,
  getRotation,
  getWritingModeVert,
  getSoftEdges,
  generateBlurredSVG,
  getBorderInfo,
  generateCompositeBorderSVG,
  isClippedByParent,
  generateCustomShapeSVG,
} from '../utils.js';
import { getProcessedImage } from '../image-processor.js';
import { PX_TO_INCH } from '../constants.js';
import { getCustomShapeType } from './shape-utils.js';
import {
  prepareElementImageItem,
  isIconElement,
  elementToCanvasImage,
} from './element-capture.js';
import { preparePseudoElementItem } from './pseudo-elements.js';
import { prepareListItem, createCompositeBorderItems } from './list-border-utils.js';
import {
  prepareTextNode,
  prepareTableItem,
  prepareCanvasItem,
  prepareSvgItem,
  prepareImgItem,
  buildTextPayload,
} from './render-text-media.js';

function getElementMetrics(node, rect, style, config) {
  const rotation = getRotation(style.transform);
  const widthPx = rotation === 0 ? rect.width || node.offsetWidth : node.offsetWidth || rect.width;
  const heightPx = rotation === 0 ? rect.height || node.offsetHeight : node.offsetHeight || rect.height;
  const w = widthPx * PX_TO_INCH * config.scale;
  const h = heightPx * PX_TO_INCH * config.scale;
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const x = config.offX + (centerX - config.rootX) * PX_TO_INCH * config.scale - w / 2;
  const y = config.offY + (centerY - config.rootY) * PX_TO_INCH * config.scale - h / 2;

  return { rotation, widthPx, heightPx, w, h, x, y };
}

function getBorderRadiusInfo(style) {
  const borderRadiusValue = parseFloat(style.borderRadius) || 0;
  const borderBottomLeftRadius = parseFloat(style.borderBottomLeftRadius) || 0;
  const borderBottomRightRadius = parseFloat(style.borderBottomRightRadius) || 0;
  const borderTopLeftRadius = parseFloat(style.borderTopLeftRadius) || 0;
  const borderTopRightRadius = parseFloat(style.borderTopRightRadius) || 0;
  const hasPartialBorderRadius =
    borderTopLeftRadius !== borderTopRightRadius ||
    borderTopLeftRadius !== borderBottomRightRadius ||
    borderTopLeftRadius !== borderBottomLeftRadius;

  return {
    borderRadiusValue,
    borderBottomLeftRadius,
    borderBottomRightRadius,
    borderTopLeftRadius,
    borderTopRightRadius,
    hasPartialBorderRadius,
  };
}

function addPartialRadiusFill(items, context, radiusInfo, customShapeName) {
  const { style, node, widthPx, heightPx, parentSortKey, domOrder, x, y, w, h, rotation } = context;
  const tempBg = parseColor(style.backgroundColor);
  const isTxt = isTextContainer(node);
  const hasContent = node.textContent.trim().length > 0 || node.children.length > 0;

  if (!radiusInfo.hasPartialBorderRadius || !tempBg.hex || isTxt || hasContent || customShapeName) return;

  const shapeSvg = generateCustomShapeSVG(widthPx, heightPx, tempBg.hex, tempBg.opacity, {
    tl: parseFloat(style.borderTopLeftRadius) || 0,
    tr: parseFloat(style.borderTopRightRadius) || 0,
    br: parseFloat(style.borderBottomRightRadius) || 0,
    bl: parseFloat(style.borderBottomLeftRadius) || 0,
  });

  items.push({
    type: 'image',
    zIndex: parentSortKey.concat([-Infinity]),
    domOrder,
    options: { data: shapeSvg, x, y, w, h, rotate: rotation },
  });
}

function prepareClippedBackground(node, context, radiusInfo) {
  if (!radiusInfo.hasPartialBorderRadius || !isClippedByParent(node) || context.hasContent) return null;

  const { style, config, parentSortKey, domOrder, widthPx, heightPx, rotation } = context;
  const x = context.x + (parseFloat(style.marginLeft) || 0) * PX_TO_INCH * config.scale;
  const y = context.y + (parseFloat(style.marginTop) || 0) * PX_TO_INCH * config.scale;
  const item = {
    type: 'image',
    zIndex: parentSortKey.concat([0, -1]),
    domOrder,
    options: { x, y, w: context.w, h: context.h, rotate: rotation, data: null },
  };

  const job = async () => {
    const canvasImageData = await elementToCanvasImage(node, widthPx, heightPx);
    if (canvasImageData) item.options.data = canvasImageData;
    else item.skip = true;
  };

  return { item, job };
}

function getRenderStyleInfo(style, config) {
  const bgColorObj = parseColor(style.backgroundColor);
  const bgClip = style.webkitBackgroundClip || style.backgroundClip;
  const isBgClipText = bgClip === 'text';
  const bgImgStr = style.backgroundImage;
  const hasGradient = !isBgClipText && bgImgStr && bgImgStr.includes('linear-gradient');
  const urlMatch = !isBgClipText && !hasGradient && bgImgStr ? bgImgStr.match(/url\(['"]?(.*?)['"]?\)/) : null;
  const borderColorObj = parseColor(style.borderColor);
  const borderWidth = parseFloat(style.borderWidth);
  const borderInfo = getBorderInfo(style, config.scale);

  return {
    bgColorObj,
    hasGradient,
    urlMatch,
    hasBgImgUrl: !!urlMatch,
    borderColorObj,
    borderWidth,
    hasBorder: borderWidth > 0 && borderColorObj.hex,
    borderInfo,
    hasUniformBorder: borderInfo.type === 'uniform',
    hasCompositeBorder: borderInfo.type === 'composite',
    shadowStr: style.boxShadow,
    hasShadow: style.boxShadow && style.boxShadow !== 'none',
    softEdge: getSoftEdges(style.filter, config.scale),
  };
}

function isImageWrapperNode(node, widthPx, heightPx) {
  const imgChild = Array.from(node.children).find((c) => c.tagName === 'IMG');
  if (!imgChild) return false;
  const childW = imgChild.offsetWidth || imgChild.getBoundingClientRect().width;
  const childH = imgChild.offsetHeight || imgChild.getBoundingClientRect().height;
  return childW >= widthPx - 2 && childH >= heightPx - 2;
}

function addTextOverlay(items, textPayload, context) {
  if (!textPayload) return;
  const { parentSortKey, domOrder, x, y, w, h, rotation, style, writingModeVert } = context;
  items.push({
    type: 'text',
    zIndex: parentSortKey.concat([0, -1]),
    domOrder,
    textParts: textPayload.text,
    options: {
      x,
      y,
      w,
      h,
      align: textPayload.align,
      valign: textPayload.valign,
      rotate: rotation,
      margin: textPayload.margin,
      wrap: !(style.whiteSpace === 'nowrap' || style.whiteSpace === 'pre'),
      autoFit: true,
      vert: writingModeVert,
    },
  });
}

function addCompositeBorderImages(items, renderInfo, context, radiusInfo) {
  const borderSvgData = generateCompositeBorderSVG(
    context.widthPx,
    context.heightPx,
    radiusInfo.borderRadiusValue,
    renderInfo.borderInfo.sides
  );
  if (!borderSvgData) return;

  items.push({
    type: 'image',
    zIndex: context.parentSortKey.concat([-500000]),
    domOrder: context.domOrder,
    options: { data: borderSvgData, x: context.x, y: context.y, w: context.w, h: context.h, rotate: context.rotation },
  });
}

function addCompositeBorderShapes(items, renderInfo, context) {
  const borderItems = createCompositeBorderItems(
    renderInfo.borderInfo.sides,
    context.x,
    context.y,
    context.w,
    context.h,
    context.config.scale,
    context.parentSortKey.concat([-500000]),
    context.domOrder
  );
  items.push(...borderItems);
}

function prepareBackgroundVisuals(items, context, renderInfo, radiusInfo, textPayload) {
  const { hasBgImgUrl, hasGradient, softEdge, bgColorObj } = renderInfo;
  const shouldHandle = hasBgImgUrl || hasGradient || (softEdge && bgColorObj.hex && !context.isImageWrapper);
  if (!shouldHandle) return null;

  let bgJob = null;
  if (hasBgImgUrl) {
    const bgUrl = renderInfo.urlMatch[1];
    const radii = {
      tl: parseFloat(context.style.borderTopLeftRadius) || 0,
      tr: parseFloat(context.style.borderTopRightRadius) || 0,
      br: parseFloat(context.style.borderBottomRightRadius) || 0,
      bl: parseFloat(context.style.borderBottomLeftRadius) || 0,
    };
    const bgItem = {
      type: 'image',
      zIndex: context.parentSortKey.concat([-Infinity]),
      domOrder: context.domOrder,
      options: { x: context.x, y: context.y, w: context.w, h: context.h, rotate: context.rotation, data: null },
    };
    items.push(bgItem);
    bgJob = async () => {
      const processed = await getProcessedImage(
        bgUrl,
        context.widthPx,
        context.heightPx,
        radii,
        context.style.backgroundSize || 'cover',
        context.style.backgroundPosition || '50% 50%'
      );
      if (processed) bgItem.options.data = processed;
      else bgItem.skip = true;
    };
  } else {
    let bgData;
    let padIn = 0;
    if (softEdge) {
      const svgInfo = generateBlurredSVG(
        context.widthPx,
        context.heightPx,
        bgColorObj.hex,
        radiusInfo.borderRadiusValue,
        softEdge
      );
      bgData = svgInfo.data;
      padIn = svgInfo.padding * PX_TO_INCH * context.config.scale;
    } else {
      bgData = generateGradientSVG(
        context.widthPx,
        context.heightPx,
        context.style.backgroundImage,
        radiusInfo.hasPartialBorderRadius
          ? {
              tl: radiusInfo.borderTopLeftRadius,
              tr: radiusInfo.borderTopRightRadius,
              br: radiusInfo.borderBottomRightRadius,
              bl: radiusInfo.borderBottomLeftRadius,
            }
          : radiusInfo.borderRadiusValue,
        renderInfo.hasBorder ? { color: renderInfo.borderColorObj.hex, width: renderInfo.borderWidth } : null
      );
    }

    if (bgData) {
      items.push({
        type: 'image',
        zIndex: context.parentSortKey.concat([-Infinity]),
        domOrder: context.domOrder,
        options: {
          data: bgData,
          x: context.x - padIn,
          y: context.y - padIn,
          w: context.w + padIn * 2,
          h: context.h + padIn * 2,
          rotate: context.rotation,
        },
      });
    }
  }

  addTextOverlay(items, textPayload, context);
  if (renderInfo.hasCompositeBorder) addCompositeBorderShapes(items, renderInfo, context);
  return bgJob;
}

function addShapeOrText(items, context, renderInfo, radiusInfo, textPayload, customShapeName, pptx) {
  const shouldHandle =
    (renderInfo.bgColorObj.hex && !context.isImageWrapper) ||
    renderInfo.hasUniformBorder ||
    renderInfo.hasCompositeBorder ||
    renderInfo.hasShadow ||
    textPayload ||
    customShapeName;
  if (!shouldHandle) return;

  const useSolidFill = (renderInfo.bgColorObj.hex && !context.isImageWrapper) || customShapeName;

  if (radiusInfo.hasPartialBorderRadius && useSolidFill && !textPayload && !customShapeName) {
    const shapeSvg = generateCustomShapeSVG(context.widthPx, context.heightPx, renderInfo.bgColorObj.hex, renderInfo.bgColorObj.opacity, {
      tl: parseFloat(context.style.borderTopLeftRadius) || 0,
      tr: parseFloat(context.style.borderTopRightRadius) || 0,
      br: parseFloat(context.style.borderBottomRightRadius) || 0,
      bl: parseFloat(context.style.borderBottomLeftRadius) || 0,
    });
    items.push({
      type: 'image',
      zIndex: context.parentSortKey.concat([-Infinity]),
      domOrder: context.domOrder,
      options: { data: shapeSvg, x: context.x, y: context.y, w: context.w, h: context.h, rotate: context.rotation },
    });
  } else {
    addStandardShapeOrText(items, context, renderInfo, radiusInfo, textPayload, customShapeName, pptx, useSolidFill);
  }

  if (renderInfo.hasCompositeBorder) addCompositeBorderImages(items, renderInfo, context, radiusInfo);
}

function addStandardShapeOrText(items, context, renderInfo, radiusInfo, textPayload, customShapeName, pptx, useSolidFill) {
  const finalAlpha = context.safeOpacity * renderInfo.bgColorObj.opacity;
  const transparency = (1 - finalAlpha) * 100;
  const shapeOpts = {
    x: context.x,
    y: context.y,
    w: context.w,
    h: context.h,
    rotate: context.rotation,
    ...(useSolidFill && { fill: { color: renderInfo.bgColorObj.hex || 'FFFFFF', transparency } }),
    line: renderInfo.hasUniformBorder ? renderInfo.borderInfo.options : null,
  };

  if (renderInfo.hasShadow) shapeOpts.shadow = getVisibleShadow(renderInfo.shadowStr, context.config.scale);

  const minDimension = Math.min(context.widthPx, context.heightPx);
  const rawRadius = parseFloat(context.style.borderRadius) || 0;
  const isPercentage = context.style.borderRadius && context.style.borderRadius.toString().includes('%');
  const radiusPx = isPercentage ? (rawRadius / 100) * minDimension : rawRadius;
  let shapeType = pptx.ShapeType.rect;
  const isSquare = Math.abs(context.widthPx - context.heightPx) < 1;
  const isFullyRound = radiusPx >= minDimension / 2;

  if (customShapeName) shapeType = getCustomShapeType(customShapeName, pptx);
  else if (isFullyRound && (isPercentage || isSquare)) shapeType = pptx.ShapeType.ellipse;
  else if (radiusPx > 0) {
    shapeType = pptx.ShapeType.roundRect;
    shapeOpts.rectRadius = Math.min(radiusPx, minDimension / 2) * PX_TO_INCH * context.config.scale;
  }

  if (textPayload) {
    items.push({
      type: 'text',
      zIndex: context.parentSortKey.concat([0, -1]),
      domOrder: context.domOrder,
      textParts: textPayload.text,
      options: {
        shape: shapeType,
        ...shapeOpts,
        w: context.w,
        h: context.h,
        rotate: context.rotation,
        align: textPayload.align,
        valign: textPayload.valign,
        margin: textPayload.margin,
        wrap: !(context.style.whiteSpace === 'nowrap' || context.style.whiteSpace === 'pre'),
        autoFit: true,
        vert: context.writingModeVert,
      },
    });
  } else if (!radiusInfo.hasPartialBorderRadius || customShapeName) {
    items.push({
      type: 'shape',
      zIndex: context.parentSortKey.concat([-Infinity]),
      domOrder: context.domOrder,
      shapeType,
      options: shapeOpts,
    });
  }
}

export function prepareRenderItem(node, config, domOrder, pptx, effectiveZIndex, computedStyle, globalOptions = {}) {
  if (node.nodeType === 3) return prepareTextNode(node, config, domOrder, effectiveZIndex, globalOptions);
  if (node.nodeType !== 1) return null;

  const style = computedStyle;
  const rect = node.getBoundingClientRect();
  if (rect.width < 0.5 || rect.height < 0.5) return null;

  const parentSortKey = effectiveZIndex;
  const metrics = getElementMetrics(node, rect, style, config);
  const writingModeVert = getWritingModeVert(style.writingMode, style.textOrientation);
  const elementOpacity = parseFloat(style.opacity);
  const localOpacity = isNaN(elementOpacity) ? 1 : elementOpacity;
  const inheritedOpacity = globalOptions._inheritedOpacity || 1;
  const safeOpacity = localOpacity * inheritedOpacity;
  const items = [];
  const customShapeName = style.getPropertyValue('--shape') || style.getPropertyValue('--shape-type') || style.getPropertyValue('--pptx-shape');
  const baseContext = { node, config, domOrder, pptx, parentSortKey, style, rect, ...metrics, rotation: metrics.rotation };

  const specialItem =
    prepareTableItem(node, { ...baseContext, unrotatedW: metrics.w, unrotatedH: metrics.h }) ||
    prepareListItem(node, { ...baseContext, items, globalOptions, writingModeVert }) ||
    prepareCanvasItem(node, baseContext) ||
    prepareSvgItem(node, baseContext, globalOptions) ||
    prepareImgItem(node, baseContext);
  if (specialItem) return specialItem;

  if (isIconElement(node)) {
    return prepareElementImageItem(node, parentSortKey, domOrder, metrics.x, metrics.y, metrics.w, metrics.h, metrics.widthPx, metrics.heightPx, metrics.rotation);
  }

  const radiusInfo = getBorderRadiusInfo(style);
  const hasContent = node.textContent.trim().length > 0 || node.children.length > 0;
  const context = {
    ...baseContext,
    items,
    writingModeVert,
    inheritedOpacity,
    safeOpacity,
    hasContent,
    isImageWrapper: isImageWrapperNode(node, metrics.widthPx, metrics.heightPx),
  };
  addPartialRadiusFill(items, context, radiusInfo, customShapeName);

  let bgJob = null;
  const clipped = prepareClippedBackground(node, context, radiusInfo);
  if (clipped) {
    items.push(clipped.item);
    bgJob = clipped.job;
  }

  const renderInfo = getRenderStyleInfo(style, config);
  const textPayload = buildTextPayload(node, style, config, writingModeVert, inheritedOpacity);
  const backgroundJob = prepareBackgroundVisuals(items, context, renderInfo, radiusInfo, textPayload);
  if (backgroundJob) bgJob = backgroundJob;
  if (!backgroundJob) addShapeOrText(items, context, renderInfo, radiusInfo, textPayload, customShapeName, pptx);

  const pseudoBefore = preparePseudoElementItem(node, '::before', rect, config, parentSortKey.concat([-1000000]), domOrder, pptx);
  if (pseudoBefore) items.unshift(pseudoBefore);
  const pseudoAfter = preparePseudoElementItem(node, '::after', rect, config, parentSortKey.concat([0, Infinity]), domOrder, pptx);
  if (pseudoAfter) items.push(pseudoAfter);

  return { items, job: bgJob, stopRecursion: !!textPayload };
}
