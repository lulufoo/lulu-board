/* Boxes max-width: Box and Item bases + linear step. Clamp lives in board-core. */
import { clampStep, STEP_MIN, STEP_MAX } from '../../board-core/style-token.js';

const ITEM_BASE_REM = 16;
const BOX_BASE_REM = 20;
const BASE_REM = ITEM_BASE_REM;
const STEP_REM = 2;

function widthKind(kind) {
  return kind === 'box' ? 'box' : 'item';
}

function baseRem(kind) {
  return widthKind(kind) === 'box' ? BOX_BASE_REM : ITEM_BASE_REM;
}

function remForStep(step, kind) {
  return baseRem(kind) + STEP_REM * clampStep(step);
}

function remCss(step, kind) {
  return remForStep(step, kind) + 'rem';
}

function authoredRem(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function remFromStyle(style, id, kind) {
  const key = String(id || '').trim();
  if (key && style && style.ids && typeof style.ids === 'object' && !Array.isArray(style.ids)) {
    const row = style.ids[key];
    if (row && row.max_width != null && row.max_width !== '') {
      const rem = authoredRem(row.max_width);
      if (rem != null) return rem;
    }
  }
  return remForStep(style && style.max_width, kind);
}

function applyItemRem(el, rem) {
  if (!el || rem == null) return;
  if (el.dataset) el.dataset.boardMaxWidthRem = String(rem);
  el.style.maxWidth = rem + 'rem';
}

// Box layout blanks inline max-width on every kid; put the authored cap back.
function restoreItemRem(el) {
  if (!el || !el.dataset) return;
  const rem = authoredRem(el.dataset.boardMaxWidthRem);
  if (rem != null) el.style.maxWidth = rem + 'rem';
}

function applyBoxRem(el, rem) {
  if (!el || rem == null) return;
  el.style.setProperty('--board-box-cap', rem + 'rem');
}

export {
  ITEM_BASE_REM, BOX_BASE_REM, BASE_REM, STEP_REM, STEP_MIN, STEP_MAX,
  clampStep, widthKind, remForStep, remCss, authoredRem, remFromStyle,
  applyItemRem, restoreItemRem, applyBoxRem,
};
