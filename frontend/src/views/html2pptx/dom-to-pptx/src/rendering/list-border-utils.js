import { parseColor, collectTextParts } from '../utils.js';
import { PX_TO_INCH } from '../constants.js';
import { isIconElement } from './element-capture.js';

export function isComplexHierarchy(root) {
  const stack = [root];
  while (stack.length > 0) {
    const el = stack.pop();

    if (el.tagName === 'LI') {
      const s = window.getComputedStyle(el);
      if (s.display === 'flex' || s.display === 'grid' || s.display === 'inline-flex') return true;
    }

    if (['IMG', 'SVG', 'CANVAS', 'VIDEO', 'IFRAME'].includes(el.tagName)) return true;
    if (isIconElement(el)) return true;

    if (el !== root && (el.tagName === 'UL' || el.tagName === 'OL')) return true;

    for (let i = 0; i < el.children.length; i++) {
      stack.push(el.children[i]);
    }
  }
  return false;
}

function getBulletConfig(node, child, liStyle, config, globalOptions) {
  let bullet;
  const listStyleType = liStyle.listStyleType || 'disc';

  if (node.tagName === 'OL' || listStyleType === 'decimal') {
    bullet = { type: 'number' };
  } else if (listStyleType === 'none') {
    bullet = false;
  } else {
    let code = '2022';
    if (listStyleType === 'circle') code = '25CB';
    if (listStyleType === 'square') code = '25A0';

    let finalHex = '000000';
    let markerFontSize = null;

    if (globalOptions?.listConfig?.color) {
      finalHex = parseColor(globalOptions.listConfig.color).hex || '000000';
    } else {
      const markerStyle = window.getComputedStyle(child, '::marker');
      const markerColor = parseColor(markerStyle.color);
      if (markerColor.hex) {
        finalHex = markerColor.hex;
      } else {
        const colorObj = parseColor(liStyle.color);
        if (colorObj.hex) finalHex = colorObj.hex;
      }

      const markerFs = parseFloat(markerStyle.fontSize);
      if (!isNaN(markerFs) && markerFs > 0) {
        markerFontSize = markerFs * 0.75 * config.scale;
      }
    }

    bullet = { code, color: finalHex };
    if (markerFontSize) bullet.fontSize = markerFontSize;
  }

  return bullet;
}

function applyListSpacing(parts, liStyle, index, liChildren, config, globalOptions) {
  let ptBefore = 0;
  let ptAfter = 0;

  if (globalOptions.listConfig?.spacing) {
    if (typeof globalOptions.listConfig.spacing.before === 'number') {
      ptBefore = globalOptions.listConfig.spacing.before;
    }
    if (typeof globalOptions.listConfig.spacing.after === 'number') {
      ptAfter = globalOptions.listConfig.spacing.after;
    }
  } else {
    const mt = parseFloat(liStyle.marginTop) || 0;
    const mb = parseFloat(liStyle.marginBottom) || 0;
    if (mt > 0) ptBefore = mt * 0.75 * config.scale;
    if (mb > 0) ptAfter = mb * 0.75 * config.scale;
  }

  if (ptBefore > 0) parts[0].options.paraSpaceBefore = ptBefore;
  if (ptAfter > 0) parts[0].options.paraSpaceAfter = ptAfter;

  if (index < liChildren.length - 1) {
    parts[parts.length - 1].options.breakLine = true;
  }
}

export function prepareListItem(node, context) {
  const { config, globalOptions, items, style, parentSortKey, domOrder, x, y, w, h, writingModeVert } = context;
  if ((node.tagName !== 'UL' && node.tagName !== 'OL') || isComplexHierarchy(node)) return null;

  const listItems = [];
  const liChildren = Array.from(node.children).filter((c) => c.tagName === 'LI');

  liChildren.forEach((child, index) => {
    const liStyle = window.getComputedStyle(child);
    const liRect = child.getBoundingClientRect();
    const parentRect = node.getBoundingClientRect();
    const bullet = getBulletConfig(node, child, liStyle, config, globalOptions);
    const visualIndentPx = liRect.left - parentRect.left;
    const computedIndentPt = visualIndentPx * 0.75 * config.scale;

    if (bullet && computedIndentPt > 0) bullet.indent = computedIndentPt;

    const parts = collectTextParts(child, liStyle, config.scale);

    if (parts.length > 0) {
      parts.forEach((p) => {
        if (!p.options) p.options = {};
      });

      if (bullet) {
        const firstPartInfo = parts[0].options;
        const bulletRun = {
          text: '\u200B',
          options: {
            ...firstPartInfo,
            color: bullet.color || firstPartInfo.color,
            fontSize: bullet.fontSize || firstPartInfo.fontSize,
            bullet,
          },
        };

        if (bullet.color) bulletRun.options.color = bullet.color;
        if (bullet.fontSize) bulletRun.options.fontSize = bullet.fontSize;
        parts.unshift(bulletRun);
      }

      applyListSpacing(parts, liStyle, index, liChildren, config, globalOptions);
      listItems.push(...parts);
    }
  });

  if (listItems.length === 0) return null;

  const bgColorObj = parseColor(style.backgroundColor);
  if (bgColorObj.hex && bgColorObj.opacity > 0) {
    items.push({
      type: 'shape',
      zIndex: parentSortKey.concat([-Infinity]),
      domOrder,
      shapeType: 'rect',
      options: { x, y, w, h, fill: { color: bgColorObj.hex } },
    });
  }

  items.push({
    type: 'text',
    zIndex: parentSortKey.concat([0, -1]),
    domOrder,
    textParts: listItems,
    options: {
      x,
      y,
      w,
      h,
      align: 'left',
      valign: 'top',
      margin: 0,
      autoFit: true,
      wrap: !(style.whiteSpace === 'nowrap' || style.whiteSpace === 'pre'),
      vert: writingModeVert,
    },
  });

  return { items, stopRecursion: true };
}

export function createCompositeBorderItems(sides, x, y, w, h, scale, zIndex, domOrder) {
  const items = [];
  const common = { type: 'shape', zIndex, domOrder, shapeType: 'rect' };

  if (sides.top.width > 0)
    items.push({
      ...common,
      options: { x, y, w, h: sides.top.width * PX_TO_INCH * scale, fill: { color: sides.top.color } },
    });
  if (sides.right.width > 0)
    items.push({
      ...common,
      options: {
        x: x + w - sides.right.width * PX_TO_INCH * scale,
        y,
        w: sides.right.width * PX_TO_INCH * scale,
        h,
        fill: { color: sides.right.color },
      },
    });
  if (sides.bottom.width > 0)
    items.push({
      ...common,
      options: {
        x,
        y: y + h - sides.bottom.width * PX_TO_INCH * scale,
        w,
        h: sides.bottom.width * PX_TO_INCH * scale,
        fill: { color: sides.bottom.color },
      },
    });
  if (sides.left.width > 0)
    items.push({
      ...common,
      options: { x, y, w: sides.left.width * PX_TO_INCH * scale, h, fill: { color: sides.left.color } },
    });

  return items;
}
