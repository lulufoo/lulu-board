/* early head — Board-only flags before first paint; root routing to /landing */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DrawerEarlyHead = api;
  if (typeof document !== "undefined" && typeof location !== "undefined") {
    var doc = document.documentElement;
    var storage = api.safeStorage(root);
    var ctx = {
      pathname: location.pathname,
      hash: location.hash,
      search: location.search,
      storage: storage,
    };
    if (api.shouldShowLanding(ctx)) {
      location.replace(api.LANDING_PATH);
      return;
    }
    doc.dataset.drawerMode = "board";
    // Hide canvas until first transform is applied to avoid left-flash.
    doc.dataset.drawerBoot = "1";
    // Blank start: /?ws=1 (any auth) or signed-in / (LB-355); plan from blankStartPlan.
    var plan = api.blankStartPlan(ctx);
    if (plan) {
      var next = location.pathname + location.search + "#" + plan.hash;
      if (typeof history !== "undefined" && typeof history.replaceState === "function") {
        history.replaceState(null, "", next);
      } else {
        location.hash = plan.hash;
      }
      if (plan.openDrawer) doc.dataset.blankStartDrawer = "1";
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var LANDING_PATH = "/landing/";
  var SESSION_KEY_RE = /^sb-.+-auth-token$/;
  // Same blank Untitled payload landing CTAs use (encodeBoardHash of blankHashBoardSource).
  var BLANK_Z_HASH = "z:eJyrVkrKTVGyUkrKTyxKUYhRCs0rySzJSU2JUYrJU9JRKkstKs7Mz1OyMqwFACtUDgY";

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

  // OAuth (PKCE) returns with ?code=... (LB-356: redirectTo is /?ws=1, so often
  // /?ws=1&code=... or /?code=...&ws=1). Session is not stored yet — skip landing
  // and blank-start until detectSessionInUrl exchanges the code.
  function isAuthReturn(search) {
    return /[?&](code|error|error_code)=/.test(String(search || ""));
  }

  // /?ws=1 (truthy ws) forces workspace; replaces /start (LB-359). Blank #z is LB-354.
  function isForcedWorkspace(search) {
    var m = /(?:^|[?&])ws=([^&]*)/.exec(String(search || ""));
    if (!m) return false;
    var v = decodeURIComponent(m[1]).toLowerCase();
    return v !== "" && v !== "0" && v !== "false" && v !== "no";
  }

  function shouldShowLanding(ctx) {
    if (!/^\/(index\.html)?$/.test(String(ctx.pathname || ""))) return false;
    if (isForcedWorkspace(ctx.search)) return false;
    if (isLegalHash(ctx.hash)) return false;
    if (isAuthReturn(ctx.search)) return false;
    if (hasStoredSession(ctx.storage)) return false;
    return true;
  }

  // Shared blank-start gate: /?ws=1 (any auth), or signed-in empty / (LB-355).
  // Legal #z/#b/#s and OAuth returns skip. must not override ws=1.
  function shouldBlankStart(ctx) {
    if (isLegalHash(ctx && ctx.hash)) return false;
    if (isAuthReturn(ctx && ctx.search)) return false;
    if (isForcedWorkspace(ctx && ctx.search)) return true;
    if (!/^\/(index\.html)?$/.test(String(ctx && ctx.pathname || ""))) return false;
    return hasStoredSession(ctx && ctx.storage);
  }

  function blankStartPlan(ctx) {
    if (!shouldBlankStart(ctx)) return null;
    return {
      hash: BLANK_Z_HASH,
      openDrawer: true, // LB-360: signed-in and unsigned both open drawer
    };
  }

  function safeStorage(root) {
    try { return root.localStorage || null; } catch (_e) { return null; }
  }

  return {
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
});
