/* Shared Board type scale — one ladder for all diagram themes (vendor/board/themes). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardTypeScale = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCALE = {
    display: '24px',
    title: '13px',
    body: '12px',
    caption: '10px',
    diamondTitle: '12px',
  };
  const STEP_MIN = -3;
  const STEP_MAX = 3;
  const FACTOR = 1.125;
  const MIN_PX = 8;

  function get() {
    return SCALE;
  }
  function clampStep(raw) {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return 0;
    return Math.min(STEP_MAX, Math.max(STEP_MIN, n));
  }
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
  function sizes(n) {
    const step = clampStep(n);
    return {
      display: pxCss('display', step),
      title: pxCss('title', step),
      body: pxCss('body', step),
      caption: pxCss('caption', step),
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

  return {
    SCALE, STEP_MIN, STEP_MAX, FACTOR, MIN_PX,
    get, clampStep, factor, px, sizeForTitle, sizeForCard, sizes,
    stepFromStyle, applyBoxTitleStep, applyItemStep,
  };
});
