/* Early-head routing logic. Boot/DOM is early-head-boot.js. */
import { GRAPH_ID_RE } from '../../../board-core/document-format.js';
import { SHARE_ID_RE, SHORT_LINK_ID_RE } from './cloud-route.js';

export const LANDING_PATH = "/landing/";
export const SESSION_KEY_RE = /^sb-.+-auth-token$/;
export const BLANK_Z_HASH = "z:eJyrVkrKTVGyUkrKTyxKUYhRCs0rySzJSU2JUYrJU9JRKkstKs7Mz1OyMqwFACtUDgY";

export function isLegalHash(raw) {
  var token = String(raw || "").replace(/^#/, "");
  if (token.indexOf("b:") === 0) return GRAPH_ID_RE.test(token.slice(2));
  if (token.indexOf("s:") === 0) return SHARE_ID_RE.test(token.slice(2));
  if (token.indexOf("p:") === 0) return SHORT_LINK_ID_RE.test(token.slice(2));
  return /^z:[A-Za-z0-9_-]+$/.test(token);
}

export function hasStoredSession(storage) {
  try {
    if (!storage) return false;
    for (var i = 0; i < storage.length; i += 1) {
      var key = storage.key(i);
      if (!key || !SESSION_KEY_RE.test(key)) continue;
      var value = JSON.parse(storage.getItem(key) || "null");
      if (value && (value.refresh_token || value.access_token)) return true;
    }
  } catch (_e) {}
  return false;
}

export function isAuthReturn(search) {
  return /[?&](code|error|error_code)=/.test(String(search || ""));
}

export function isForcedWorkspace(search) {
  var m = /(?:^|[?&])ws=([^&]*)/.exec(String(search || ""));
  if (!m) return false;
  var v = decodeURIComponent(m[1]).toLowerCase();
  return v !== "" && v !== "0" && v !== "false" && v !== "no";
}

export function shouldShowLanding(ctx) {
  if (!/^\/(index\.html)?$/.test(String(ctx.pathname || ""))) return false;
  if (isForcedWorkspace(ctx.search)) return false;
  if (isLegalHash(ctx.hash)) return false;
  if (isAuthReturn(ctx.search)) return false;
  if (hasStoredSession(ctx.storage)) return false;
  return true;
}

export function shouldBlankStart(ctx) {
  if (isLegalHash(ctx && ctx.hash)) return false;
  if (isAuthReturn(ctx && ctx.search)) return false;
  if (isForcedWorkspace(ctx && ctx.search)) return true;
  if (!/^\/(index\.html)?$/.test(String(ctx && ctx.pathname || ""))) return false;
  return hasStoredSession(ctx && ctx.storage);
}

export function blankStartPlan(ctx) {
  if (!shouldBlankStart(ctx)) return null;
  return {
    openDrawer: true,
    pickKind: true,
  };
}

export function safeStorage(root) {
  try { return root.localStorage || null; } catch (_e) { return null; }
}

const DrawerEarlyHead = {
  LANDING_PATH: LANDING_PATH,
  BLANK_Z_HASH: BLANK_Z_HASH,
  isLegalHash: isLegalHash,
  hasStoredSession: hasStoredSession,
  isAuthReturn: isAuthReturn,
  isForcedWorkspace: isForcedWorkspace,
  shouldShowLanding: shouldShowLanding,
  shouldBlankStart: shouldBlankStart,
  blankStartPlan: blankStartPlan,
  safeStorage: safeStorage,
};

export default DrawerEarlyHead;
