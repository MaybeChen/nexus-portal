export function getCustomShapeType(customShapeName, pptx) {
  if (!customShapeName) return pptx.ShapeType.rect;
  const name = customShapeName.trim().replace(/[\'"]/g, '').toLowerCase();
  if (name === 'circle' || name === 'ellipse' || name === 'oval') return pptx.ShapeType.ellipse;
  if (name === 'triangle') return pptx.ShapeType.triangle;
  if (name === 'diamond') return pptx.ShapeType.diamond;
  if (name === 'parallelogram') return pptx.ShapeType.parallelogram;
  if (name === 'hexagon') return pptx.ShapeType.hexagon;
  if (name === 'pentagon') return pptx.ShapeType.pentagon;
  if (name === 'star') return pptx.ShapeType.star5;
  if (name === 'chevron') return pptx.ShapeType.chevron;
  if (name === 'rect' || name === 'rectangle') return pptx.ShapeType.rect;
  if (name === 'roundrect' || name === 'roundedrectangle') return pptx.ShapeType.roundRect;
  for (const key of Object.keys(pptx.ShapeType)) {
    if (key.toLowerCase() === name) return pptx.ShapeType[key];
  }
  return pptx.ShapeType.rect;
}
