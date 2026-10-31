/* Boxes item max-width: 0-step rem + linear step. Clamp lives in board-core. */
import { clampStep, STEP_MIN, STEP_MAX } from '../../board-core/style-token.js';

const BASE_REM = 16;
const STEP_REM = 2;

function remForStep(step) {
  return BASE_REM + STEP_REM * clampStep(step);
}

function remCss(step) {
  return remForStep(step) + 'rem';
}

function authoredRem(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function remFromStyle(style, id) {
  const key = String(id || '').trim();
  if (key && style && style.ids && typeof style.ids === 'object' && !Array.isArray(style.ids)) {
    const row = style.ids[key];
    if (row && row.max_width != null && row.max_width !== '') {
      const rem = authoredRem(row.max_width);
      if (rem != null) return rem;
    }
  }
  return remForStep(style && style.max_width);
}

function applyItemRem(el, rem) {
  if (!el || rem == null) return;
  el.style.maxWidth = rem + 'rem';
}

export {
  BASE_REM, STEP_REM, STEP_MIN, STEP_MAX,
  clampStep, remForStep, remCss, authoredRem, remFromStyle, applyItemRem,
};
