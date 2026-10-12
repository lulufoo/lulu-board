/* Board tone — one shade ramp per theme, and the automatic rule that keeps a nested Box / Item apart from its parent.
   A tone is an index into the theme ramp (0 = lightest). A nested node sits GAP steps from its parent's tone
   (one tone left empty between them). Colours are chosen by this rule only; there is no manual picker. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardTone = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SIZE = 8;
  const GAP = 2;

  // Default for a nested node: two steps darker than its parent, or two steps lighter at the bottom of the ramp.
  function auto(parent) {
    return parent + GAP <= SIZE - 1 ? parent + GAP : parent - GAP;
  }
  function isItem(node) { return !!(node && (node.role === 'item' || node.kind === 'item')); }
  function typeOf(node) { return String((node && (node.type || node.kind)) || (isItem(node) ? 'chip' : 'card')); }
  // Which nodes carry their own fill. Container / layout are transparent; note, text and icon keep their look.
  function fillable(node) {
    const t = typeOf(node);
    return isItem(node) ? (t === 'chip' || t === 'item') : (t === 'card' || t === 'box' || t === 'diamond');
  }

  /**
   * Resolve the automatic tone of every node: Map(node -> { tone, parent }).
   * tone: index into the ramp or null (= theme default look). parent: tone of the nearest filled ancestor or null.
   * auto: when true (theme.autoTone), a top-level node is tone 0 and each nested one is parent + GAP;
   * otherwise nodes keep the theme look.
   */
  function resolve(board, opts) {
    const autoOn = !!(opts && opts.auto);
    const out = new Map();
    function visit(node, parentTone) {
      const fills = fillable(node);
      let tone = null;
      if (fills && autoOn) tone = parentTone != null ? auto(parentTone) : 0;
      out.set(node, { tone, parent: parentTone });
      const below = fills ? tone : parentTone;
      const kids = Array.isArray(node.kids) ? node.kids : (node.items || []).concat(node.boxes || []);
      kids.forEach((kid) => visit(kid, below));
    }
    (board.views || board.boxes || []).forEach((node) => visit(node, null));
    return out;
  }

  /**
   * Paint a mounted node with its automatic tone. Top-level nodes keep the theme look; only nested ones are toned.
   * Rect fills go inline with !important (they must beat the per-type nth-of-type rules); a diamond face is an SVG
   * path, so it gets a CSS variable that 04-board-form.css reads.
   */
  function paint(el, ramp, info, diamond) {
    if (!el || !info || info.tone == null || !ramp) return;
    if (info.parent == null) return;
    const color = ramp[info.tone];
    if (!color) return;
    el.dataset.bfTone = String(info.tone);
    if (diamond) el.style.setProperty('--bf-tone-fill', color);
    else el.style.setProperty('background', color, 'important');
  }

  return { SIZE, GAP, paint, auto, fillable, resolve };
});
