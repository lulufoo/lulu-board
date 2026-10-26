/* Shared style token: field KV + JSON ↔ base64.
 * Board `style` and mermaid `%% style` both use these keys. */
import { ORDER, resolveId } from '../board-themes/index.js';

export const THEMES = Object.fromEntries(ORDER.map((id) => [id, 1]));
export const ROUTES = { trunk: 1, stagger: 1, straight: 1 };
export const DEFAULTS = {
  theme: 'default',
  item_cap: 16,
  link_route: 'stagger',
  type_step: 0,
  viewport: { scale: 1, cx: 0, cy: 0 },
};
export const ITEM_CAP_MIN = 8;
export const ITEM_CAP_MAX = 24;
export const STEP_MIN = -3;
export const STEP_MAX = 3;
export const FACTOR = 1.125;
export const MIN_PX = 8;
export const TYPE_STEP_MIN = STEP_MIN;
export const TYPE_STEP_MAX = STEP_MAX;
const FIELD_KEYS = { theme: 1, item_cap: 1, link_route: 1, type_step: 1, viewport: 1 };

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

export function clampItemCap(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULTS.item_cap;
  return Math.min(ITEM_CAP_MAX, Math.max(ITEM_CAP_MIN, n));
}

export function clampTypeStep(value) {
  return clampStep(value);
}

export function resolveLinkRoute(value) {
  const raw = String(value == null ? '' : value).trim();
  return ROUTES[raw] ? raw : DEFAULTS.link_route;
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
  if (src.item_cap != null && src.item_cap !== '') {
    const cap = clampItemCap(src.item_cap);
    if (cap !== DEFAULTS.item_cap) out.item_cap = cap;
  }
  if (src.link_route != null && src.link_route !== '') {
    const route = resolveLinkRoute(src.link_route);
    if (route !== DEFAULTS.link_route) out.link_route = route;
  }
  if (src.type_step != null && src.type_step !== '') {
    const step = clampTypeStep(src.type_step);
    if (step !== DEFAULTS.type_step) out.type_step = step;
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
    item_cap: src.item_cap == null || src.item_cap === '' ? DEFAULTS.item_cap : clampItemCap(src.item_cap),
    link_route: src.link_route == null || src.link_route === '' ? DEFAULTS.link_route : resolveLinkRoute(src.link_route),
    type_step: src.type_step == null || src.type_step === '' ? DEFAULTS.type_step : clampTypeStep(src.type_step),
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
