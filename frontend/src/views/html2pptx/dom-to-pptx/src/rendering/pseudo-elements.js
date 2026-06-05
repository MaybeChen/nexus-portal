import { parseColor, getTextStyle, shouldSkipTextForPpt } from '../utils.js';
import { PX_TO_INCH } from '../constants.js';

export function getPseudoElementRect(hostRect, pseudoStyle) {
  const w = parseFloat(pseudoStyle.width) || 0;
  const h = parseFloat(pseudoStyle.height) || 0;
  if (w <= 0 || h <= 0) return null;

  let x = hostRect.left;
  let y = hostRect.top;

  const position = pseudoStyle.position;
  if (position === 'absolute') {
    const leftStr = pseudoStyle.left;
    const topStr = pseudoStyle.top;
    const rightStr = pseudoStyle.right;
    const bottomStr = pseudoStyle.bottom;

    let left = 0;
    let hasLeft = false;
    if (leftStr && leftStr !== 'auto') {
      hasLeft = true;
      left = leftStr.endsWith('%')
        ? (parseFloat(leftStr) / 100) * hostRect.width
        : parseFloat(leftStr);
    }

    let top = 0;
    let hasTop = false;
    if (topStr && topStr !== 'auto') {
      hasTop = true;
      top = topStr.endsWith('%')
        ? (parseFloat(topStr) / 100) * hostRect.height
        : parseFloat(topStr);
    }

    let right = 0;
    let hasRight = false;
    if (rightStr && rightStr !== 'auto') {
      hasRight = true;
      right = rightStr.endsWith('%')
        ? (parseFloat(rightStr) / 100) * hostRect.width
        : parseFloat(rightStr);
    }

    let bottom = 0;
    let hasBottom = false;
    if (bottomStr && bottomStr !== 'auto') {
      hasBottom = true;
      bottom = bottomStr.endsWith('%')
        ? (parseFloat(bottomStr) / 100) * hostRect.height
        : parseFloat(bottomStr);
    }

    if (hasLeft) {
      x += left;
    } else if (hasRight) {
      x += hostRect.width - right - w;
    }
    if (hasTop) {
      y += top;
    } else if (hasBottom) {
      y += hostRect.height - bottom - h;
    }
  } else {
    const marginLeft = parseFloat(pseudoStyle.marginLeft) || 0;
    const marginTop = parseFloat(pseudoStyle.marginTop) || 0;
    x += marginLeft;
    y += marginTop;
  }

  // Apply CSS transform translation (e.g. translateY(-50%))
  const transform = pseudoStyle.transform;
  if (transform && transform !== 'none') {
    const matrixMatch = transform.match(/matrix\((.+?)\)/);
    if (matrixMatch) {
      const parts = matrixMatch[1].split(',').map((p) => parseFloat(p.trim()));
      if (parts.length === 6) {
        x += parts[4];
        y += parts[5];
      }
    } else {
      const matrix3dMatch = transform.match(/matrix3d\((.+?)\)/);
      if (matrix3dMatch) {
        const parts = matrix3dMatch[1].split(',').map((p) => parseFloat(p.trim()));
        if (parts.length === 16) {
          x += parts[12];
          y += parts[13];
        }
      }
    }
  }

  return { left: x, top: y, width: w, height: h };
}

export function preparePseudoElementItem(node, pseudoType, hostRect, config, zIndex, domOrder, pptx) {
  const pseudoStyle = window.getComputedStyle(node, pseudoType);
  const content = pseudoStyle.content;
  const rawHasContent = content && content !== 'none' && content !== 'normal' && content !== '""';
  const cleanText = rawHasContent ? content.replace(/^['"]|['"]$/g, '') : '';
  const hasContent = rawHasContent && !shouldSkipTextForPpt(cleanText, pseudoStyle);

  const bgColor = parseColor(pseudoStyle.backgroundColor);
  const hasBg = bgColor.hex && bgColor.opacity > 0;
  const borderCol = parseColor(pseudoStyle.borderColor);
  const borderWidth = parseFloat(pseudoStyle.borderWidth) || 0;
  const hasBorder = borderWidth > 0 && borderCol.opacity > 0;

  if (!hasBg && !hasBorder && !hasContent) return null;

  const rect = getPseudoElementRect(hostRect, pseudoStyle);
  if (!rect) return null;

  const scale = config.scale;
  const w = rect.width * PX_TO_INCH * scale;
  const h = rect.height * PX_TO_INCH * scale;
  const x = config.offX + (rect.left - config.rootX) * PX_TO_INCH * scale;
  const y = config.offY + (rect.top - config.rootY) * PX_TO_INCH * scale;

  const borderRadius = parseFloat(pseudoStyle.borderRadius) || 0;
  const isCircle = borderRadius >= Math.min(rect.width, rect.height) / 2 - 1;

  if (hasContent) {
    const textOpts = getTextStyle(pseudoStyle, scale, false);
    const textOptions = {
      x,
      y,
      w,
      h,
      align: pseudoStyle.textAlign || 'left',
      valign: 'middle',
      margin: 0,
      wrap: true,
      ...textOpts,
      ...(hasBg && { fill: { color: bgColor.hex, transparency: (1 - bgColor.opacity) * 100 } }),
      line: hasBorder ? { color: borderCol.hex, width: borderWidth * 0.75 * scale } : null,
    };

    if (isCircle) {
      textOptions.rectRadius = Math.min(w, h) / 2;
    } else if (borderRadius > 0) {
      let cappedRadiusPx = Math.min(borderRadius, Math.min(rect.width, rect.height) / 2);
      textOptions.rectRadius = cappedRadiusPx * PX_TO_INCH * scale;
    }

    return {
      type: 'text',
      zIndex,
      domOrder,
      textParts: [
        {
          text: cleanText,
          options: textOpts,
        },
      ],
      options: textOptions,
    };
  }

  let shapeType = pptx.ShapeType.rect;
  let shapeOpts = {
    x,
    y,
    w,
    h,
    ...(hasBg && { fill: { color: bgColor.hex, transparency: (1 - bgColor.opacity) * 100 } }),
    line: hasBorder ? { color: borderCol.hex, width: borderWidth * 0.75 * scale } : null,
  };

  if (isCircle) {
    shapeType = pptx.ShapeType.ellipse;
  } else if (borderRadius > 0) {
    shapeType = pptx.ShapeType.roundRect;
    let cappedRadiusPx = Math.min(borderRadius, Math.min(rect.width, rect.height) / 2);
    shapeOpts.rectRadius = cappedRadiusPx * PX_TO_INCH * scale;
  }

  return {
    type: 'shape',
    zIndex,
    domOrder,
    shapeType,
    options: shapeOpts,
  };
}

