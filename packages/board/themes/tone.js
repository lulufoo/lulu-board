/* Board tone — one shade ramp per theme, and the rule that keeps a nested Box / Item apart from its parent.
   A tone is an index into the theme ramp (0 = lightest). A nested node must sit at least GAP steps away from its
   parent's tone (one tone left empty between them). Top-level nodes are not constrained. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardTone = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SIZE = 8;
  const GAP = 2;

  function clamp(n) {
    const v = Math.round(Number(n));
    if (!Number.isFinite(v)) return null;
    return Math.min(SIZE - 1, Math.max(0, v));
  }
  function ok(tone, parent) {
    return parent == null || Math.abs(tone - parent) >= GAP;
  }
  // Nearest tone that keeps the gap to the parent; ties go to the darker one.
  function fix(tone, parent) {
    const t = clamp(tone);
    if (t == null || ok(t, parent)) return t;
    let best = null;
    for (let c = 0; c < SIZE; c++) {
      if (!ok(c, parent)) continue;
      if (best == null) { best = c; continue; }
      const d = Math.abs(c - t);
      const bd = Math.abs(best - t);
      if (d < bd || (d === bd && c > best)) best = c;
    }
    return best;
  }
  // Default for a nested node: two steps darker than its parent, or two steps lighter at the bottom of the ramp.
  function auto(parent) {
    return parent + GAP <= SIZE - 1 ? parent + GAP : parent - GAP;
  }
  /** For the picker: which tones are allowed under this parent tone. */
  function allowed(parent) {
    const out = [];
    for (let c = 0; c < SIZE; c++) out.push(ok(c, parent));
    return out;
  }

  function explicitOf(board, id) {
    const ids = board && board.style && board.style.ids;
    const row = id && ids && ids[id];
    if (!row || row.tone == null || row.tone === '') return null;
    return clamp(row.tone);
  }
  function isItem(node) { return !!(node && (node.role === 'item' || node.kind === 'item')); }
  function typeOf(node) { return String((node && (node.type || node.kind)) || (isItem(node) ? 'chip' : 'card')); }
  // Which nodes carry their own fill. Container / layout are transparent; note, text and icon keep their look.
  function fillable(node) {
    const t = typeOf(node);
    return isItem(node) ? (t === 'chip' || t === 'item') : (t === 'card' || t === 'box' || t === 'diamond');
  }

  /**
   * Resolve the tone of every node: Map(node -> { tone, explicit, parent }).
   * tone: effective index or null (= theme default look). parent: tone of the nearest filled ancestor or null.
   * auto: when true (theme.autoTone), unset nested nodes get parent + GAP; otherwise they keep the theme look.
   */
  function resolve(board, opts) {
    const autoOn = !!(opts && opts.auto);
    const out = new Map();
    // Boxes take their swatch in mount order (pre-order, every box), so a counter here reproduces it.
    // hue = that number for the outermost box above a node (itself when it is outermost); null for a root item.
    let seq = 0;
    function visit(node, parentTone, rootSeq) {
      const mySeq = isItem(node) ? null : seq++;
      const hue = rootSeq != null ? rootSeq : mySeq;
      const fills = fillable(node);
      const explicit = fills ? explicitOf(board, node.id) : null;
      let tone = null;
      if (fills) {
        if (parentTone != null) {
          if (explicit != null) tone = fix(explicit, parentTone);
          else if (autoOn) tone = auto(parentTone);
        } else if (explicit != null) {
          tone = explicit;
        } else if (autoOn) {
          tone = 0;
        }
      }
      out.set(node, { tone, explicit, parent: parentTone, hue });
      const below = fills ? tone : parentTone;
      const kids = Array.isArray(node.kids) ? node.kids : (node.items || []).concat(node.boxes || []);
      kids.forEach((kid) => visit(kid, below, hue));
    }
    (board.views || board.boxes || []).forEach((node) => visit(node, null, null));
    return out;
  }

  /**
   * Paint a mounted node with its tone. Top-level nodes that were never given a tone keep the theme look.
   * Rect fills go inline with !important (they must beat the per-type nth-of-type rules); a diamond face is an SVG
   * path, so it gets a CSS variable that 04-board-form.css reads.
   */
  function paint(el, ramp, info, diamond) {
    if (!el || !info || info.tone == null || !ramp) return;
    if (info.explicit == null && info.parent == null) return;
    const steps = typeof ramp === 'function' ? ramp(info) : ramp;
    const color = steps && steps[info.tone];
    if (!color) return;
    el.dataset.bfTone = String(info.tone);
    if (diamond) el.style.setProperty('--bf-tone-fill', color);
    else el.style.setProperty('background', color, 'important');
  }

  return { SIZE, GAP, paint, clamp, ok, fix, auto, allowed, explicitOf, fillable, resolve };
});
