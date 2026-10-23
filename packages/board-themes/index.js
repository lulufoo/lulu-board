/* Shared diagram palette. Public API: BoardThemes. Box chrome stays in packages/board. */
(function (root, factory) {
  const packs = root.BoardPalettePacks || {};
  const loadPack = (name) => packs[name] || (typeof require === 'function' ? require('./packs/' + name) : null);
  const loaded = { default: loadPack('default'), classic: loadPack('classic'), pastel: loadPack('pastel') };
  if (!loaded.default || !loaded.classic || !loaded.pastel) throw new Error('BoardThemes packs are not loaded');
  const api = factory(loaded);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardThemes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (packs) {
  'use strict';

  const FONT_FAMILY = '"SF Pro Text", "SF Pro Display", Inter, system-ui, -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", sans-serif';
  const ORDER = ['default', 'classic', 'pastel'];
  const LEGACY_IDS = { minimal: 'classic', slate: 'pastel' };
  const EDGE_RING_ALPHA = 0.14;
  const EDGE_RGB_FALLBACK = '74, 53, 36';
  const BOX_RX = 4;
  const FILL_STROKE_DARKEN = 0.10;
  const FILL_STROKE_INK = 'rgb(var(--bf-rgb, 74, 53, 36))';

  function hydrate(pack) {
    return {
      id: pack.id,
      label: pack.label,
      fontFamily: FONT_FAMILY,
      color: pack.color,
      edgeStroke: pack.edgeStroke,
      edgeLabel: pack.edgeLabel,
      edgeEvidence: pack.edgeEvidence,
      edgeFeedback: pack.edgeFeedback,
      bandBg: pack.bandBg,
      bandBorder: pack.bandBorder,
      colors: pack.colors,
      edgeRgb: pack.edgeRgb || EDGE_RGB_FALLBACK,
    };
  }

  const THEMES = {
    default: hydrate(packs.default),
    classic: hydrate(packs.classic),
    pastel: hydrate(packs.pastel),
  };

  function formatAlpha(alpha) {
    const n = Number(alpha);
    if (!Number.isFinite(n)) return '.14';
    return String(n).replace(/^0\./, '.');
  }

  function resolveId(id) {
    const raw = String(id == null || id === '' ? 'default' : id);
    const mapped = LEGACY_IDS[raw] || raw;
    return THEMES[mapped] ? mapped : 'default';
  }

  function get(id) {
    return THEMES[resolveId(id)];
  }

  function list() {
    return ORDER.map((id) => ({ id, label: THEMES[id].label }));
  }

  function edgeTint(themeOrId, alpha) {
    const theme = typeof themeOrId === 'string' ? get(themeOrId) : (themeOrId || get());
    const rgb = (theme && theme.edgeRgb) || EDGE_RGB_FALLBACK;
    const a = alpha == null ? EDGE_RING_ALPHA : Number(alpha);
    return 'rgba(' + rgb + ', ' + formatAlpha(a) + ')';
  }

  function strokeFromFill(fill, amount, ink) {
    const darken = Number.isFinite(Number(amount)) ? Number(amount) : FILL_STROKE_DARKEN;
    const keep = Math.round((1 - darken) * 100);
    const src = fill == null || fill === '' ? 'var(--_s)' : String(fill);
    const dye = ink == null || ink === '' ? FILL_STROKE_INK : String(ink);
    return 'color-mix(in srgb, ' + src + ' ' + keep + '%, ' + dye + ')';
  }

  return {
    FONT_FAMILY, THEMES, ORDER, LEGACY_IDS,
    EDGE_RING_ALPHA, BOX_RX, FILL_STROKE_DARKEN, FILL_STROKE_INK,
    get, list, resolveId, edgeTint, strokeFromFill,
  };
});
