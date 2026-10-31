/* Bind remaining dock <select>s to popup-select. Theme keeps theme-picker.js. */
import { bindNativeSelect } from './popup-select.js';

function shapeIcon(option) {
  const diamond = option.value === 'diamond';
  const svg = diamond
    ? "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 16'><path d='M11 1.5L20 8L11 14.5L2 8Z' fill='none' stroke='%234a3524' stroke-width='1.5' stroke-linejoin='round'/></svg>"
    : "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 16'><rect x='2.5' y='3.5' width='17' height='9' rx='1.5' fill='none' stroke='%234a3524' stroke-width='1.5'/></svg>";
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
