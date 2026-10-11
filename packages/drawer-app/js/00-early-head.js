/* early head — Board-only flags before first paint; root routing to /landing */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof document !== "undefined" && typeof location !== "undefined") {
    var doc = document.documentElement;
    if (api.shouldShowLanding({
      pathname: location.pathname,
      hash: location.hash,
      search: location.search,
      storage: api.safeStorage(root),
    })) {
      location.replace(api.LANDING_PATH);
      return;
    }
    doc.dataset.drawerMode = "board";
    // Hide canvas until first transform is applied to avoid left-flash.
    doc.dataset.drawerBoot = "1";
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var LANDING_PATH = "/landing/";
  var SESSION_KEY_RE = /^sb-.+-auth-token$/;

  // Format check only (same shapes as 00-cloud-route.js); #z: payload is never decoded here.
  function isLegalHash(raw) {
    var token = String(raw || "").replace(/^#/, "");
    return /^b:b_[0-9a-f]{8}$/.test(token)
      || /^s:s_[0-9a-f]{32}$/.test(token)
      || /^z:[A-Za-z0-9_-]+$/.test(token);
  }

  // Supabase stores the session as JSON under "sb-<project-ref>-auth-token".
  function hasStoredSession(storage) {
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

  // OAuth (PKCE) returns to the page with ?code=...; the session is not stored yet.
  function isAuthReturn(search) {
    return /[?&](code|error|error_code)=/.test(String(search || ""));
  }

  function shouldShowLanding(ctx) {
    if (!/^\/(index\.html)?$/.test(String(ctx.pathname || ""))) return false;
    if (isLegalHash(ctx.hash)) return false;
    if (isAuthReturn(ctx.search)) return false;
    if (hasStoredSession(ctx.storage)) return false;
    return true;
  }

  function safeStorage(root) {
    try { return root.localStorage || null; } catch (_e) { return null; }
  }

  return {
    LANDING_PATH: LANDING_PATH,
    isLegalHash: isLegalHash,
    hasStoredSession: hasStoredSession,
    isAuthReturn: isAuthReturn,
    shouldShowLanding: shouldShowLanding,
    safeStorage: safeStorage,
  };
});
