/* Shared style token: field KV + JSON ↔ base64.
 * Board `style` and mermaid `%% style` both use these keys. */
import { ORDER, resolveId } from '../board-themes/index.js';

export const THEMES = Object.fromEntries(ORDER.map((id) => [id, 1]));
export const ROUTES = { trunk: 1, stagger: 1, straight: 1 };
export const BACKGROUNDS = { paper: 1, mist: 1, sage: 1, dusk: 1 };
export const DEFAULTS = {
  theme: 'default',
  max_width: 0,
  link_route: 'stagger',
  font_size: 0,
  background: 'paper',
  viewport: { scale: 1, cx: 0, cy: 0 },
};
export const STEP_MIN = -3;
export const STEP_MAX = 3;
export const FACTOR = 1.125;
export const MIN_PX = 8;
export const TYPE_STEP_MIN = STEP_MIN;
export const TYPE_STEP_MAX = STEP_MAX;
const FIELD_KEYS = { theme: 1, max_width: 1, link_route: 1, font_size: 1, background: 1, viewport: 1 };
const SKIP_LEFTOVER = { view: 1, viewport: 1, ids: 1 };

export function clampStep(raw) {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return 0;
  return Math.min(STEP_MAX, Math.max(STEP_MIN, n));
}

export function encodeStylePayload(obj) {
  const json = JSON.stringify(obj || {});
  if (typeof Buffer !== 'undefined') return Buffer.from(json, 'utf8').toString('base64');
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodeStylePayload(b64) {
  try {
    const raw = String(b64 || '').replace(/\s+/g, '');
    if (!raw) return {};
    const json = typeof Buffer !== 'undefined'
      ? Buffer.from(raw, 'base64').toString('utf8')
      : decodeURIComponent(escape(atob(raw)));
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    return data;
  } catch (_e) {
    return {};
  }
}

export function resolveThemeId(id) {
  const raw = String(id == null ? '' : id).trim();
  return resolveId(raw);
}

export function clampTypeStep(value) {
  return clampStep(value);
}

export function resolveLinkRoute(value) {
  const raw = String(value == null ? '' : value).trim();
  return ROUTES[raw] ? raw : DEFAULTS.link_route;
}

export function resolveBackground(id) {
  const raw = String(id == null ? '' : id).trim();
  return BACKGROUNDS[raw] ? raw : DEFAULTS.background;
}

export function authoredViewport(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const scale = Number(raw.scale);
  const cx = Number(raw.cx);
  const cy = Number(raw.cy);
  if (!isFinite(scale) || !isFinite(cx) || !isFinite(cy)) return null;
  return {
    scale: Math.min(3, Math.max(0.2, scale)),
    cx: Math.round(cx),
    cy: Math.round(cy),
  };
}

function isDefaultViewport(raw) {
  return !!(raw && raw.scale === DEFAULTS.viewport.scale && raw.cx === DEFAULTS.viewport.cx && raw.cy === DEFAULTS.viewport.cy);
}

export function authoredFields(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  const theme = src.theme != null && src.theme !== '' ? resolveThemeId(src.theme) : '';
  if (theme && theme !== DEFAULTS.theme) out.theme = theme;
  if (src.max_width != null && src.max_width !== '') {
    const width = clampStep(src.max_width);
    if (width !== DEFAULTS.max_width) out.max_width = width;
  }
  if (src.link_route != null && src.link_route !== '') {
    const route = resolveLinkRoute(src.link_route);
    if (route !== DEFAULTS.link_route) out.link_route = route;
  }
  if (src.font_size != null && src.font_size !== '') {
    const step = clampTypeStep(src.font_size);
    if (step !== DEFAULTS.font_size) out.font_size = step;
  }
  if (src.background != null && src.background !== '') {
    const background = resolveBackground(src.background);
    if (background !== DEFAULTS.background) out.background = background;
  }
  const viewport = authoredViewport(src.viewport || src.view);
  if (viewport && !isDefaultViewport(viewport)) out.viewport = viewport;
  return out;
}

export function resolveFields(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const viewport = authoredViewport(src.viewport || src.view);
  return {
    theme: src.theme != null && src.theme !== '' ? resolveThemeId(src.theme) : DEFAULTS.theme,
    max_width: src.max_width == null || src.max_width === '' ? DEFAULTS.max_width : clampStep(src.max_width),
    link_route: src.link_route == null || src.link_route === '' ? DEFAULTS.link_route : resolveLinkRoute(src.link_route),
    font_size: src.font_size == null || src.font_size === '' ? DEFAULTS.font_size : clampTypeStep(src.font_size),
    background: src.background == null || src.background === '' ? DEFAULTS.background : resolveBackground(src.background),
    viewport: viewport || {
      scale: DEFAULTS.viewport.scale,
      cx: DEFAULTS.viewport.cx,
      cy: DEFAULTS.viewport.cy,
    },
  };
}

export function isFieldKey(key) {
  return !!FIELD_KEYS[key];
}

export function leftoverFields(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  Object.keys(src).forEach((key) => {
    if (isFieldKey(key) || SKIP_LEFTOVER[key]) return;
    if (src[key] == null) return;
    out[key] = src[key];
  });
  return out;
}
