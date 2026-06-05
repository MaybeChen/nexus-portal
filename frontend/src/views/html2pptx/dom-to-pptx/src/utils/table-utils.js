import { getComputedStyleForNode } from './dom-utils.js';
import { parseColor, getGradientFallbackColor } from './color-utils.js';
import { getTextStyle, collectTextParts } from './text-style-utils.js';
import { getPadding } from './layout-utils.js';

function getTableFill(style) {
  let bg = parseColor(style.backgroundColor, style);
  if (
    (!bg.hex || bg.opacity === 0) &&
    style.backgroundImage &&
    style.backgroundImage !== 'none'
  ) {
    const fallback = getGradientFallbackColor(style.backgroundImage, style);
    if (fallback) bg = parseColor(fallback, style);
  }

  return bg.hex && bg.opacity > 0 ? { color: bg.hex } : null;
}

function getTableBorder(style, side, scale) {
  const widthStr = style[`border${side}Width`];
  const styleStr = style[`border${side}Style`];
  const colorStr = style[`border${side}Color`];

  const width = parseFloat(widthStr) || 0;
  if (width === 0 || styleStr === 'none' || styleStr === 'hidden') return null;

  const color = parseColor(colorStr, style);
  if (!color.hex || color.opacity === 0) return null;

  let dash = 'solid';
  if (styleStr === 'dashed') dash = 'dash';
  if (styleStr === 'dotted') dash = 'dot';

  return { pt: width * 0.75 * scale, color: color.hex, type: dash };
}
export function extractTableData(node, scale) {
  const rows = [];
  const colWidths = [];

  // 1. Calculate Column Widths based on the first row of cells
  // We look at the first <tr>'s children to determine visual column widths.
  // Note: This assumes a fixed grid. Complex colspan/rowspan on the first row
  // might skew widths, but getBoundingClientRect captures the rendered result.
  const firstRow = node.querySelector('tr');
  if (firstRow) {
    const cells = Array.from(firstRow.children);
    cells.forEach((cell) => {
      const rect = cell.getBoundingClientRect();
      const colspan = parseInt(cell.getAttribute('colspan')) || 1;
      const wIn = (rect.width * (1 / 96) * scale) / colspan;
      for (let i = 0; i < colspan; i++) {
        colWidths.push(wIn);
      }
    });
  }

  const tableStyle = getComputedStyleForNode(node);
  const borderSpacing = tableStyle.borderSpacing.split(' ');
  const hSpace = parseFloat(borderSpacing[0]) || 0;
  const vSpace = parseFloat(borderSpacing[1] || borderSpacing[0]) || 0;
  const hSpacePt = hSpace * 0.75 * scale;
  const vSpacePt = vSpace * 0.75 * scale;

  // 2. Iterate Rows
  const trList = node.querySelectorAll('tr');
  trList.forEach((tr) => {
    const rowData = [];
    const rowStyle = getComputedStyleForNode(tr);
    const rowFill = getTableFill(rowStyle);
    const cellList = Array.from(tr.children).filter((c) => ['TD', 'TH'].includes(c.tagName));

    cellList.forEach((cell) => {
      const style = getComputedStyleForNode(cell);
      const cellParts = collectTextParts(cell, style, scale);
      // Fallback to plain text if collectTextParts returns empty/invalid
      const cellText =
        cellParts && cellParts.length > 0
          ? cellParts
          : cell.innerText.replace(/[\n\r\t]+/g, ' ').trim();

      // A. Text Style
      const textStyle = getTextStyle(style, scale);

      // B. Cell Background. PowerPoint cells do not inherit their row fill, so
      // copy the <tr> background onto transparent <td>/<th> cells to match browser rendering.
      const fill = getTableFill(style) || rowFill;

      // C. Alignment
      let align = 'left';
      if (style.textAlign === 'center') align = 'center';
      if (style.textAlign === 'right' || style.textAlign === 'end') align = 'right';

      let valign = 'top';
      if (style.verticalAlign === 'middle') valign = 'middle';
      if (style.verticalAlign === 'bottom') valign = 'bottom';

      // D. Padding (Margins in PPTX)
      // CSS Padding px -> PPTX Margin pt
      const padding = getPadding(style, scale);
      // getPadding returns [top, right, bottom, left] in inches relative to scale
      // PptxGenJS expects points (pt) for margin: [t, r, b, l]
      // or discrete properties. Let's use discrete for clarity.
      const margin = [
        padding[0] * 72 + vSpacePt / 2, // top
        padding[1] * 72 + hSpacePt / 2, // right
        padding[2] * 72 + vSpacePt / 2, // bottom
        padding[3] * 72 + hSpacePt / 2, // left
      ];

      // E. Borders
      const borderTop = getTableBorder(style, 'Top', scale);
      const borderRight = getTableBorder(style, 'Right', scale);
      const borderBottom = getTableBorder(style, 'Bottom', scale);
      const borderLeft = getTableBorder(style, 'Left', scale);

      // F. Construct Cell Object
      rowData.push({
        text: cellText,
        options: {
          color: textStyle.color,
          fontFace: textStyle.fontFace,
          fontSize: textStyle.fontSize,
          bold: textStyle.bold,
          italic: textStyle.italic,
          underline: textStyle.underline,

          fill: fill,
          align: align,
          valign: valign,
          margin: margin,

          rowspan: parseInt(cell.getAttribute('rowspan')) || null,
          colspan: parseInt(cell.getAttribute('colspan')) || null,

          border: [borderTop, borderRight, borderBottom, borderLeft],
        },
      });
    });

    if (rowData.length > 0) {
      rows.push(rowData);
    }
  });

  return { rows, colWidths };
}
