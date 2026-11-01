/* Appearance tables. Palette packs stay in ../packs until they retire. */
import light from './light.js';

export const DEFAULT_APPEARANCE = 'light';
export const APPEARANCES = { light: 1, dark: 1 };

const TABLES = { light: light };

export function resolveAppearance(id) {
  const raw = String(id == null ? '' : id).trim();
  return APPEARANCES[raw] ? raw : DEFAULT_APPEARANCE;
}

export function getAppearance(id) {
  return TABLES[resolveAppearance(id)] || light;
}
