export { getOwnerWindow, getComputedStyleForNode } from './utils/dom-utils.js';
export { parseColor, resolveCssVariables, getGradientFallbackColor } from './utils/color-utils.js';
export { getBorderInfo, generateCompositeBorderSVG, generateCustomShapeSVG } from './utils/border-svg-utils.js';
export { getPadding, getSoftEdges, isClippedByParent, getRotation, getWritingModeVert, getVisibleShadow } from './utils/layout-utils.js';
export { getTextStyle, isTextContainer, collectTextParts, isFontAwesomeStyle } from './utils/text-style-utils.js';
export { svgToPng, svgToSvg, generateGradientSVG, generateBlurredSVG } from './utils/svg-background-utils.js';
export { getUsedFontFamilies, getAutoDetectedFonts } from './utils/font-detect-utils.js';
export { extractTableData } from './utils/table-utils.js';
