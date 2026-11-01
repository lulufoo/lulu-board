/* Shared diagram palette (product / cross-type). Box chrome stays in packages/boxes. */
import packDefault from './packs/default.js';
import packClassic from './packs/classic.js';
import packPastel from './packs/pastel.js';
import { APPEARANCES, getAppearance } from './appearance/index.js';

export { APPEARANCES, DEFAULT_APPEARANCE, getAppearance, resolveAppearance } from './appearance/index.js';

export const FONT_FAMILY = '"SF Pro Text", "SF Pro Display", Inter, system-ui, -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", sans-serif';
export const ORDER = ['default', 'classic', 'pastel'];
export const LEGACY_IDS = { minimal: 'classic', slate: 'pastel', kami: 'default' };
export const EDGE_RING_ALPHA = 0.14;
const EDGE_RGB_FALLBACK = '74, 53, 36';
export const BOX_RX = 4;
export const FILL_STROKE_DARKEN = 0.10;
export const FILL_STROKE_INK = 'rgb(var(--bf-rgb, 74, 53, 36))';
export const ring = {
  color: '#db4c84',
  hover: 'rgba(219, 76, 132, .4)',
  width: 2,
  offset: 2,
  gap: 3,
};

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

export const THEMES = {
  default: hydrate(packDefault),
  classic: hydrate(packClassic),
  pastel: hydrate(packPastel),
};

function formatAlpha(alpha) {
  const n = Number(alpha);
  if (!Number.isFinite(n)) return '.14';
  return String(n).replace(/^0\./, '.');
}

export function resolveId(id) {
  const raw = String(id == null || id === '' ? 'default' : id);
  const mapped = LEGACY_IDS[raw] || raw;
  return THEMES[mapped] ? mapped : 'default';
}

export function appearanceTheme(id) {
  const table = getAppearance(id);
  return hydrate({
    id: table.id,
    label: table.id === 'dark' ? 'Dark' : 'Light',
    color: table.diagram.color,
    edgeStroke: table.diagram.edgeStroke,
    edgeLabel: table.diagram.edgeLabel,
    edgeEvidence: table.diagram.edgeEvidence,
    edgeFeedback: table.diagram.edgeFeedback,
    bandBg: table.diagram.bandBg,
    bandBorder: table.diagram.bandBorder,
    edgeRgb: table.diagram.edgeRgb,
    colors: table.diagram.colors,
  });
}

export function get(id) {
  if (id == null || id === '') return THEMES.default;
  const raw = String(id).trim();
  if (APPEARANCES[raw]) return appearanceTheme(raw);
  return THEMES[resolveId(raw)];
}

export function list() {
  return ORDER.map((id) => ({ id, label: THEMES[id].label }));
}

export function edgeTint(themeOrId, alpha) {
  const theme = typeof themeOrId === 'string' ? get(themeOrId) : (themeOrId || get());
  const rgb = (theme && theme.edgeRgb) || EDGE_RGB_FALLBACK;
  const a = alpha == null ? EDGE_RING_ALPHA : Number(alpha);
  return 'rgba(' + rgb + ', ' + formatAlpha(a) + ')';
}

export function strokeFromFill(fill, amount, ink) {
  const darken = Number.isFinite(Number(amount)) ? Number(amount) : FILL_STROKE_DARKEN;
  const keep = Math.round((1 - darken) * 100);
  const src = fill == null || fill === '' ? 'var(--_s)' : String(fill);
  const dye = ink == null || ink === '' ? FILL_STROKE_INK : String(ink);
  return 'color-mix(in srgb, ' + src + ' ' + keep + '%, ' + dye + ')';
}
