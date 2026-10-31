/* Bind remaining dock <select>s to popup-select. Theme keeps theme-picker.js. */
import { bindNativeSelect } from './popup-select.js';

function shapeIcon(option) {
  const diamond = option.value === 'diamond';
  const svg = diamond
    ? "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 16'><path d='M11 1.5L20 8L11 14.5L2 8Z' fill='none' stroke='%234a3524' stroke-width='1.5' stroke-linejoin='round'/></svg>"
    : "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 16'><rect x='2.5' y='3.5' width='17' height='9' rx='1.5' fill='none' stroke='%234a3524' stroke-width='1.5'/></svg>";
  return { fill: "url(\"data:image/svg+xml;utf8," + svg + "\") center / contain no-repeat", glyph: true };
}

const ALIGN_DOT = {
  'top-left': [6.5, 5],
  top: [11, 5],
  'top-right': [15.5, 5],
  left: [6.5, 8],
  center: [11, 8],
  right: [15.5, 8],
  'bottom-left': [6.5, 11],
  bottom: [11, 11],
  'bottom-right': [15.5, 11],
};

function alignIcon(option) {
  const spot = ALIGN_DOT[option.value] || ALIGN_DOT.center;
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 16'>"
    + "<rect x='3.5' y='2.5' width='15' height='11' rx='1.5' fill='none' stroke='%234a3524' stroke-width='1.5'/>"
    + "<rect x='" + (spot[0] - 1.5) + "' y='" + (spot[1] - 1.5) + "' width='3' height='3' rx='0.6' fill='%234a3524'/>"
    + "</svg>";
  return { fill: "url(\"data:image/svg+xml;utf8," + svg + "\") center / contain no-repeat", glyph: true };
}

const PLAIN = [
  'boardTypeEditor',
  'boardArrowEditor',
  'boardDirEditor',
  'boardAlignEditor',
  'boardJustifyEditor',
  'flowchartTypeEditor',
  'flowchartDirEditor',
  'mindmapLayoutEditor',
];

PLAIN.forEach((id) => {
  const select = document.getElementById(id);
  if (select) bindNativeSelect(select);
});

const shape = document.getElementById('boardShapeEditor');
const shapeHost = document.getElementById('boardShapeHost');
if (shape) bindNativeSelect(shape, { host: shapeHost || undefined, iconFor: shapeIcon });

const itemAlign = document.getElementById('board-item-align-editor');
const itemAlignHost = document.getElementById('board-item-align-host');
if (itemAlign) bindNativeSelect(itemAlign, { host: itemAlignHost || undefined, iconFor: alignIcon });
