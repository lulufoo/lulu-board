/* Session Light/Dark. Cookie-backed chrome preference. Not in the style token. */
import { DEFAULT_APPEARANCE, resolveAppearance } from '../../../board-themes/appearance/index.js';

export const APPEARANCE_COOKIE = 'drawer.appearance';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function cookieSource() {
  try {
    if (typeof document === 'undefined') return '';
    const raw = document.cookie;
    return typeof raw === 'string' ? raw : '';
  } catch (_e) {
    return '';
  }
}

export function readAppearanceCookie(raw) {
  const source = raw == null ? cookieSource() : String(raw);
  let found = DEFAULT_APPEARANCE;
  const parts = source.split(';');
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i].trim();
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== APPEARANCE_COOKIE) continue;
    try {
      found = resolveAppearance(decodeURIComponent(part.slice(eq + 1).trim()));
    } catch (_e) {
      found = DEFAULT_APPEARANCE;
    }
  }
  return found;
}

export function writeAppearanceCookie(id) {
  const value = resolveAppearance(id);
  let line = APPEARANCE_COOKIE + '=' + encodeURIComponent(value)
    + '; Path=/; SameSite=Lax; Max-Age=' + COOKIE_MAX_AGE;
  try {
    if (typeof location !== 'undefined' && location.protocol === 'https:') line += '; Secure';
  } catch (_e) {}
  try {
    if (typeof document !== 'undefined') document.cookie = line;
  } catch (_e) {}
  return line;
}

let current = readAppearanceCookie();

export function getSessionAppearance() {
  return current;
}

export function setSessionAppearance(id) {
  current = resolveAppearance(id);
  writeAppearanceCookie(current);
  return current;
}

const DrawerSessionAppearance = {
  APPEARANCE_COOKIE: APPEARANCE_COOKIE,
  readAppearanceCookie: readAppearanceCookie,
  writeAppearanceCookie: writeAppearanceCookie,
  getSessionAppearance: getSessionAppearance,
  setSessionAppearance: setSessionAppearance,
};

export default DrawerSessionAppearance;
