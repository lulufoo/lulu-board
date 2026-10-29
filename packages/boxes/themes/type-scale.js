/* Boxes type scale: local rungs. Clamp and step bounds live in board-core (P2). */
import { clampStep, STEP_MIN, STEP_MAX, FACTOR, MIN_PX } from '../../board-core/style-token.js';

const SCALE = {
  display: '24px',
  title: '13px',
  body: '12px',
  caption: '10px',
  label: '11px', // link titles
  diamondTitle: '12px',
};
// One font stack and one set of weights for every theme: themes change colour and chrome, not typography.
// Same stack as the site shell (--font) plus CJK fallbacks so Chinese text does not fall to a serif.
const FONT_FAMILY = '"SF Pro Text", "SF Pro Display", Inter, system-ui, -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", sans-serif';
// Font weights of everything Board draws, the only place they are written. Themes/index.js turns each one
// into a CSS variable and 03-diagram.css reads that variable, so the packs and every `.board-` rule carry
// no weight number. App chrome (toolbar, panels, dock) is not drawn by boxes and keeps its own weights.
// Keep text <= title: item text does not follow the title, and a lighter title reads as the weakest line.
const WEIGHT = {
  title: '600', // every box title: card and container
  text: '500', // text items and icon captions
  note: '400', // note items
  bold: '650', // **bold** and headings inside markdown
  subtitle: '520', // small line under a box title
  edgeLabel: '600', // connector labels, selected or not
  header: '720', // document header h2 of an HTML-style board
};

function factor(n) {
  return Math.pow(FACTOR, clampStep(n));
}
function basePx(rung) {
  return parseFloat(SCALE[rung]) || 0;
}
function px(rung, n) {
  return Math.max(MIN_PX, Math.round(basePx(rung) * factor(n)));
}
function pxCss(rung, n) {
  return px(rung, n) + 'px';
}
function sizeForTitle(typeName, n) {
  return pxCss(typeName === 'diamond' ? 'diamondTitle' : 'title', n);
}
function sizeForCard(n) {
  return pxCss('body', n);
}
function sizeForLabel(n) {
  return pxCss('label', n);
}
function sizes(n) {
  const step = clampStep(n);
  return {
    display: pxCss('display', step),
    title: pxCss('title', step),
    body: pxCss('body', step),
    caption: pxCss('caption', step),
    label: pxCss('label', step),
    diamondTitle: pxCss('diamondTitle', step),
  };
}
function stepFromStyle(style, id) {
  const key = String(id || '').trim();
  if (!key || !style || !style.ids || typeof style.ids !== 'object' || Array.isArray(style.ids)) return null;
  const row = style.ids[key];
  if (!row || row.fz == null || row.fz === '') return null;
  return clampStep(row.fz);
}
function applyBoxTitleStep(el, typeName, step) {
  if (!el || step == null) return;
  el.style.setProperty('--board-title-size', sizeForTitle(typeName, step));
  el.style.setProperty('--board-card-title-size', sizeForTitle(typeName, step));
}
function applyItemStep(el, step) {
  if (!el || step == null) return;
  const css = sizeForCard(step);
  el.style.setProperty('--board-card-size', css);
  el.style.setProperty('--board-card-card-size', css);
}

export {
  SCALE, FONT_FAMILY, WEIGHT, STEP_MIN, STEP_MAX, FACTOR, MIN_PX,
  clampStep, factor, px, sizeForTitle, sizeForCard, sizeForLabel, sizes,
  stepFromStyle, applyBoxTitleStep, applyItemStep,
};
