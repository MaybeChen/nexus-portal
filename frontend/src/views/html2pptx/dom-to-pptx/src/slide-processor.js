import { PX_TO_INCH } from './constants.js';
import { prepareRenderItem } from './rendering/render-item.js';

export function compareKeys(keyA = [], keyB = []) {
  const safeKeyA = Array.isArray(keyA) ? keyA : [];
  const safeKeyB = Array.isArray(keyB) ? keyB : [];
  const len = Math.max(safeKeyA.length, safeKeyB.length);
  for (let i = 0; i < len; i++) {
    const valA = safeKeyA[i] !== undefined ? safeKeyA[i] : 0;
    const valB = safeKeyB[i] !== undefined ? safeKeyB[i] : 0;
    if (valA !== valB) return valA - valB;
  }
  return 0;
}

function isVisuallyOverflowing(node, style) {
  if (!node?.parentElement || !style) return false;
  const parentStyle = node.ownerDocument.defaultView.getComputedStyle(node.parentElement);
  if (
    parentStyle.overflowX === 'hidden' ||
    parentStyle.overflowX === 'clip' ||
    parentStyle.overflowY === 'hidden' ||
    parentStyle.overflowY === 'clip'
  ) {
    return false;
  }

  const rect = node.getBoundingClientRect();
  const parentRect = node.parentElement.getBoundingClientRect();
  const tolerance = 0.5;
  return (
    rect.left < parentRect.left - tolerance ||
    rect.top < parentRect.top - tolerance ||
    rect.right > parentRect.right + tolerance ||
    rect.bottom > parentRect.bottom + tolerance
  );
}

function getStackingContextLevel(style) {
  if (!style || style.zIndex === 'auto') return 0;
  const parsedZ = parseInt(style.zIndex, 10);
  return Number.isNaN(parsedZ) ? 0 : parsedZ;
}

function isFlexOrGridItem(node) {
  const parent = node.parentElement;
  if (!parent) return false;

  const parentDisplay = window.getComputedStyle(parent).display;
  return (
    parentDisplay === 'flex' ||
    parentDisplay === 'inline-flex' ||
    parentDisplay === 'grid' ||
    parentDisplay === 'inline-grid'
  );
}

function createsStackingContext(style, node, root) {
  if (node === root) return true;
  if (!style) return false;

  const positionedWithZIndex =
    (style.position === 'relative' ||
      style.position === 'absolute' ||
      style.position === 'fixed' ||
      style.position === 'sticky') &&
    style.zIndex !== 'auto';
  const opacity = parseFloat(style.opacity);
  const hasOpacityStacking = !Number.isNaN(opacity) && opacity < 1;
  const hasTransform = style.transform && style.transform !== 'none';
  const hasFilter = style.filter && style.filter !== 'none';
  const hasBlendMode = style.mixBlendMode && style.mixBlendMode !== 'normal';
  const hasIsolation = style.isolation === 'isolate';
  const flexOrGridItemWithZIndex = isFlexOrGridItem(node) && style.zIndex !== 'auto';

  return (
    positionedWithZIndex ||
    hasOpacityStacking ||
    hasTransform ||
    hasFilter ||
    hasBlendMode ||
    hasIsolation ||
    flexOrGridItemWithZIndex
  );
}

function addItemToSlide(slide, item, index) {
  const transportVal = `__z_${index}__dom_${item.domOrder}`;
  item.options.altText = transportVal;
  item.options.objectName = transportVal;

  if (item.type === 'shape') slide.addShape(item.shapeType, item.options);
  if (item.type === 'image') slide.addImage(item.options);
  if (item.type === 'text' && Array.isArray(item.textParts)) slide.addText(item.textParts, item.options);
  if (item.type === 'table' && Array.isArray(item.tableData?.rows) && item.tableData.rows.length) {
    slide.addTable(item.tableData.rows, {
      x: item.options.x,
      y: item.options.y,
      w: item.options.w,
      colW: item.tableData.colWidths,
      autoPage: false,
      border: { type: 'none', color: 'FFFFFF', transparency: 100 },
      margin: 0,
      autoFit: false,
      fit: 'shrink',
    });
  }
}

export async function processSlide(root, slide, pptx, globalOptions = {}) {
  const rootRect = root.getBoundingClientRect();
  const PPTX_WIDTH_IN = globalOptions._slideWidth || 10;
  const PPTX_HEIGHT_IN = globalOptions._slideHeight || 5.625;
  const contentWidthIn = rootRect.width * PX_TO_INCH;
  const contentHeightIn = rootRect.height * PX_TO_INCH;
  const scale = Math.min(PPTX_WIDTH_IN / contentWidthIn, PPTX_HEIGHT_IN / contentHeightIn);
  const layoutConfig = {
    rootX: rootRect.x,
    rootY: rootRect.y,
    scale,
    offX: (PPTX_WIDTH_IN - contentWidthIn * scale) / 2,
    offY: (PPTX_HEIGHT_IN - contentHeightIn * scale) / 2,
  };
  const renderQueue = [];
  const asyncTasks = [];
  let domOrderCounter = 0;

  function collect(node, parentSortKey, parentOpacity = 1) {
    const order = domOrderCounter++;
    let currentSortKey = parentSortKey;
    let currentOpacity = parentOpacity;
    let nodeStyle = null;

    if (node.nodeType === 1) {
      nodeStyle = window.getComputedStyle(node);
      const elOpacity = parseFloat(nodeStyle.opacity);
      if (!isNaN(elOpacity)) currentOpacity *= elOpacity;

      if (nodeStyle.display === 'none' || nodeStyle.visibility === 'hidden' || currentOpacity === 0) return;

      if (createsStackingContext(nodeStyle, node, root)) {
        currentSortKey = parentSortKey.concat([getStackingContextLevel(nodeStyle), order]);
      }
    }

    const result = prepareRenderItem(
      node,
      { ...layoutConfig, root },
      order,
      pptx,
      currentSortKey,
      nodeStyle,
      { ...globalOptions, _inheritedOpacity: parentOpacity }
    );

    if (result) {
      if (result.items) {
        const visuallyOverflowing =
          node.nodeType === 1 && isVisuallyOverflowing(node, nodeStyle);
        result.items.forEach((item) => {
          item.stackingKey = currentSortKey;
          item.sourceNode = node;
          item.isVisuallyOverflowing = visuallyOverflowing;
        });
        renderQueue.push(...result.items);
      }
      if (result.job) asyncTasks.push(result.job);
      if (result.stopRecursion) return;
    }

    const childNodes = node.childNodes;
    for (let i = 0; i < childNodes.length; i++) {
      collect(childNodes[i], currentSortKey, currentOpacity);
    }
  }

  collect(root, []);

  if (asyncTasks.length > 0) await Promise.all(asyncTasks.map((task) => task()));

  const finalQueue = renderQueue.filter((item) => !item.skip && (item.type !== 'image' || item.options.data));
  finalQueue.sort((a, b) => {
    const stackingCompare = compareKeys(a.stackingKey || a.zIndex, b.stackingKey || b.zIndex);
    if (stackingCompare !== 0) return stackingCompare;

    if (a.isVisuallyOverflowing !== b.isVisuallyOverflowing) {
      const overflowItem = a.isVisuallyOverflowing ? a : b;
      const regularItem = a.isVisuallyOverflowing ? b : a;
      const regularIsAncestor =
        regularItem.sourceNode?.nodeType === 1 &&
        overflowItem.sourceNode &&
        regularItem.sourceNode.contains(overflowItem.sourceNode);
      if (!regularIsAncestor) return a.isVisuallyOverflowing ? -1 : 1;
    }

    const domOrderCompare = a.domOrder - b.domOrder;
    if (domOrderCompare !== 0) return domOrderCompare;
    return compareKeys(a.zIndex, b.zIndex);
  });

  for (let i = 0; i < finalQueue.length; i++) addItemToSlide(slide, finalQueue[i], i);
}
