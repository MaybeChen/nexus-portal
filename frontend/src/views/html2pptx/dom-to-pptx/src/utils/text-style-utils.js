import { getComputedStyleForNode } from './dom-utils.js';
import { parseColor } from './color-utils.js';

function getPrimaryFontFace(style) {
  return style.fontFamily.split(',')[0].replace(/["']/g, '').trim();
}

export function isFontAwesomeStyle(style) {
  return /font awesome/i.test(style?.fontFamily || '');
}

function normalizeFontFaceForPpt(style) {
  return getPrimaryFontFace(style);
}
export function getTextStyle(style, scale, includeMargins = true, inheritedOpacity = 1) {
  let colorObj = parseColor(style.color, style);
  let opacity = colorObj.opacity * inheritedOpacity;

  // Combine text color alpha with element-level opacity
  const elOpacity = parseFloat(style.opacity);
  if (!isNaN(elOpacity)) {
    opacity *= elOpacity;
  }

  const bgClip = style.webkitBackgroundClip || style.backgroundClip;
  if (colorObj.opacity === 0 && bgClip === 'text') {
    const fallback = getGradientFallbackColor(style.backgroundImage, style);
    if (fallback) colorObj = parseColor(fallback, style);
  }

  let lineSpacing = null;
  const fontSizePx = parseFloat(style.fontSize);
  const lhStr = style.lineHeight;

  if (lhStr && lhStr !== 'normal') {
    let lhPx = parseFloat(lhStr);

    // Edge Case: If browser returns a raw multiplier (e.g. "1.5")
    // we must multiply by font size to get the height in pixels.
    // (Note: getComputedStyle usually returns 'px', but inline styles might differ)
    if (/^[0-9.]+$/.test(lhStr)) {
      lhPx = lhPx * fontSizePx;
    }

    if (!isNaN(lhPx) && lhPx > 0) {
      // Convert Pixel Height to Point Height (1px = 0.75pt)
      // And apply the global layout scale.
      lineSpacing = lhPx * 0.75 * scale;
    }
  }

  // --- Spacing (Margins) ---
  // Convert CSS margins (px) to PPTX Paragraph Spacing (pt).
  let paraSpaceBefore = 0;
  let paraSpaceAfter = 0;

  if (includeMargins) {
    const mt = parseFloat(style.marginTop) || 0;
    const mb = parseFloat(style.marginBottom) || 0;

    if (mt > 0) paraSpaceBefore = mt * 0.75 * scale;
    if (mb > 0) paraSpaceAfter = mb * 0.75 * scale;
  }

  const transparency = Math.round((1 - opacity) * 100);

  return {
    color: colorObj.hex || '000000',
    ...(transparency > 0 && { transparency }),
    fontFace: normalizeFontFaceForPpt(style),
    fontSize: fontSizePx * 0.75 * scale,
    bold: parseInt(style.fontWeight) >= 600,
    italic: style.fontStyle === 'italic',
    underline: style.textDecoration.includes('underline'),
    // Only add if we have a valid value
    ...(lineSpacing && { lineSpacing }),
    ...(paraSpaceBefore > 0 && { paraSpaceBefore }),
    ...(paraSpaceAfter > 0 && { paraSpaceAfter }),
    // Map background color to highlight if present
    ...(parseColor(style.backgroundColor, style).hex
      ? { highlight: parseColor(style.backgroundColor, style).hex }
      : {}),
    // Mapping letter-spacing to charSpacing
    ...(style.letterSpacing && style.letterSpacing !== 'normal'
      ? { charSpacing: parseFloat(style.letterSpacing) * 0.75 * scale }
      : {}),
  };
}

/**
 * Determines if a given DOM node is primarily a text container.
 * Updated to correctly reject Icon elements so they are rendered as images.
 */
export function isTextContainer(node) {
  const hasText = node.textContent.trim().length > 0;
  if (!hasText) return false;
  if (isFontAwesomeStyle(getComputedStyleForNode(node))) return false;

  const children = Array.from(node.children);
  if (children.length === 0) return true;

  const isSafeInline = (el) => {
    // 1. Reject Web Components / Custom Elements
    if (el.tagName.includes('-')) return false;
    // 2. Reject Explicit Images/SVGs
    if (el.tagName === 'IMG' || el.tagName === 'SVG') return false;

    if (isFontAwesomeStyle(getComputedStyleForNode(el))) return false;

    if (el.tagName === 'I' || el.tagName === 'SPAN') {
      const cls = el.getAttribute('class') || '';
      if (
        typeof cls === 'string' &&
        (cls.includes('fa-') ||
          cls.includes('fas') ||
          cls.includes('far') ||
          cls.includes('fab') ||
          cls.includes('material-icons') ||
          cls.includes('bi-') ||
          cls.includes('icon'))
      ) {
        // Double-check: Must have pseudo-element content to be a CSS icon
        const before = getComputedStyleForNode(el, '::before').content;
        const after = getComputedStyleForNode(el, '::after').content;
        const hasContent = (c) => c && c !== 'none' && c !== 'normal' && c !== '""';

        if (hasContent(before) || hasContent(after)) return false;
      }
    }

    const style = getComputedStyleForNode(el);
    const display = style.display;

    // Reject block displays and flex/grid items
    const isBlockDisplay =
      display === 'block' || display === 'flex' || display === 'grid' || display === 'table';
    if (isBlockDisplay) return false;

    const parentStyle = el.parentElement ? getComputedStyleForNode(el.parentElement) : null;
    const parentDisplay = parentStyle ? parentStyle.display : '';
    const isFlexOrGridItem = parentDisplay.includes('flex') || parentDisplay.includes('grid');
    if (isFlexOrGridItem) return false;

    // 4. Standard Inline Tag Check
    const isInlineTag = ['SPAN', 'B', 'STRONG', 'EM', 'I', 'A', 'SMALL', 'MARK'].includes(
      el.tagName
    );
    const isInlineDisplay = display.includes('inline');

    if (!isInlineTag && !isInlineDisplay) return false;

    // 5. Structural Styling Check
    // If a child has a background or border, it's a layout block, not a simple text span.
    const bgColor = parseColor(style.backgroundColor, style);
    const hasVisibleBg = bgColor.hex && bgColor.opacity > 0;
    const hasBorder =
      parseFloat(style.borderWidth) > 0 && parseColor(style.borderColor, style).opacity > 0;

    if (hasVisibleBg || hasBorder) {
      // Relaxed check: Allow inline elements with background/border to be treated as text.
      // They will be rendered as highlighted text runs (no border support in text runs though).
      // This preserves text flow for "badges".
      // return false;
    }

    // 4. Check for empty shapes (visual objects without text, like dots)
    const hasContent = el.textContent.trim().length > 0;
    if (!hasContent && (hasVisibleBg || hasBorder)) {
      return false;
    }

    return true;
  };

  return children.every(isSafeInline);
}
export function collectTextParts(
  node,
  parentStyle,
  scale,
  activeHyperlink = null,
  isRoot = true,
  inheritedOpacity = 1
) {
  const parts = [];
  let hyperlink = activeHyperlink;

  // Hyperlink inheritance: If no hyperlink is active, check if this node is an <a> or inside one.
  if (!hyperlink && node.nodeType === 1) {
    const aNode = node.closest('a');
    if (aNode) {
      const href = aNode.getAttribute('href');
      if (href) {
        hyperlink = { url: href, tooltip: aNode.getAttribute('title') || undefined };
      }
    }
  }

  // Check for CSS Content (::before) - often used for icons
  if (node.nodeType === 1) {
    const beforeStyle = getComputedStyleForNode(node, '::before');
    const content = beforeStyle.content;
    if (content && content !== 'none' && content !== 'normal' && content !== '""') {
      // Strip quotes
      const cleanContent = content.replace(/^['"]|['"]$/g, '');
      if (cleanContent.trim()) {
        const textOpts = getTextStyle(beforeStyle, scale, false, inheritedOpacity);
        if (hyperlink) textOpts.hyperlink = hyperlink;

        // Apply __spc_ suffix if charSpacing is defined
        if (textOpts.charSpacing !== undefined) {
          const spcVal = Math.round(textOpts.charSpacing * 100);
          if (textOpts.fontFace) {
            textOpts.fontFace = `${textOpts.fontFace}__spc_${spcVal}`;
          }
        }

        const trailSpace = cleanContent.endsWith(' ') || cleanContent.endsWith('\xa0') ? '' : ' ';
        parts.push({
          text: cleanContent + trailSpace, // Add space after icon
          options: textOpts,
        });
      }
    }
  }

  let trimNextLeading = false;

  node.childNodes.forEach((child, index) => {
    if (child.nodeType === 3) {
      // Text
      let val = child.nodeValue.replace(/[\n\r\t]+/g, ' ').replace(/\s{2,}/g, ' ');

      if (index === 0) val = val.trimStart();
      if (trimNextLeading) {
        val = val.trimStart();
        trimNextLeading = false;
      }
      if (index === node.childNodes.length - 1) val = val.trimEnd();

      if (val) {
        // Use parent style if child is text node, otherwise current style
        const styleToUse = node.nodeType === 1 ? getComputedStyleForNode(node) : parentStyle;
        const transform = styleToUse.textTransform;
        if (transform === 'uppercase') val = val.toUpperCase();
        else if (transform === 'lowercase') val = val.toLowerCase();
        else if (transform === 'capitalize') val = val.replace(/\b\w/g, (c) => c.toUpperCase());

        const textOpts = getTextStyle(styleToUse, scale, !isRoot, inheritedOpacity);
        if (hyperlink) textOpts.hyperlink = hyperlink;

        // Apply __spc_ suffix if charSpacing is defined
        if (textOpts.charSpacing !== undefined) {
          const spcVal = Math.round(textOpts.charSpacing * 100);
          if (textOpts.fontFace) {
            textOpts.fontFace = `${textOpts.fontFace}__spc_${spcVal}`;
          }
        }

        // BUG FIX: Avoid rendering the parent's background as a text highlight for naked text nodes.
        // The parent container's background is typically already rendered as a Shape Fill.
        if (child.nodeType === 3 && textOpts.highlight) {
          delete textOpts.highlight;
        }

        parts.push({
          text: val,
          options: textOpts,
        });
      }
    } else if (child.nodeType === 1) {
      if (child.tagName === 'BR') {
        if (parts.length > 0) {
          const lastPart = parts[parts.length - 1];
          if (lastPart.text && typeof lastPart.text === 'string') {
            lastPart.text = lastPart.text.trimEnd();
          }
        }
        parts.push({ text: '', options: { breakLine: true } });
        trimNextLeading = true;
      } else {
        const isBlock = ['DIV', 'P', 'LI'].includes(child.tagName);
        if (isBlock && parts.length > 0 && !parts[parts.length - 1].options?.breakLine) {
          parts.push({ text: '', options: { breakLine: true } });
        }

        const childParts = collectTextParts(
          child,
          parentStyle,
          scale,
          hyperlink,
          false,
          inheritedOpacity
        );
        if (childParts.length > 0) parts.push(...childParts);

        if (isBlock) {
          parts.push({ text: '', options: { breakLine: true } });
          trimNextLeading = true;
        }
      }
    }
  });

  // Check for CSS Content (::after) - often used for icons
  if (node.nodeType === 1) {
    const afterStyle = getComputedStyleForNode(node, '::after');
    const content = afterStyle.content;
    if (content && content !== 'none' && content !== 'normal' && content !== '""') {
      // Strip quotes
      const cleanContent = content.replace(/^['"]|['"]$/g, '');
      if (cleanContent.trim()) {
        const textOpts = getTextStyle(afterStyle, scale, false, inheritedOpacity);
        if (hyperlink) textOpts.hyperlink = hyperlink;

        // Apply __spc_ suffix if charSpacing is defined
        if (textOpts.charSpacing !== undefined) {
          const spcVal = Math.round(textOpts.charSpacing * 100);
          if (textOpts.fontFace) {
            textOpts.fontFace = `${textOpts.fontFace}__spc_${spcVal}`;
          }
        }

        const leadSpace =
          cleanContent.startsWith(' ') || cleanContent.startsWith('\xa0') ? '' : ' ';
        parts.push({
          text: leadSpace + cleanContent, // Add space before icon/content
          options: textOpts,
        });
      }
    }
  }

  // Cleanup potential trailing empty breakLines
  while (
    parts.length > 0 &&
    parts[parts.length - 1].options?.breakLine &&
    parts[parts.length - 1].text === ''
  ) {
    parts.pop();
  }

  return parts;
}
