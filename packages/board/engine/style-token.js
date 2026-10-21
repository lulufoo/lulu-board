/* Shared style token: field KV + JSON ↔ base64.
 * Board `style` and mermaid `%% style` both use these keys. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.BoardStyleToken = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  var THEMES = { default: 1, classic: 1, pastel: 1 };
  var ROUTES = { trunk: 1, stagger: 1, straight: 1 };
  var DEFAULTS = {
    theme: "default",
    item_cap: 16,
    link_route: "stagger",
    type_step: 0,
  };
  var ITEM_CAP_MIN = 8;
  var ITEM_CAP_MAX = 24;
  var TYPE_STEP_MIN = -3;
  var TYPE_STEP_MAX = 3;
  var FIELD_KEYS = { theme: 1, item_cap: 1, link_route: 1, type_step: 1 };

  function encodeStylePayload(obj) {
    var json = JSON.stringify(obj || {});
    if (typeof Buffer !== "undefined") return Buffer.from(json, "utf8").toString("base64");
    return btoa(unescape(encodeURIComponent(json)));
  }

  function decodeStylePayload(b64) {
    try {
      var raw = String(b64 || "").replace(/\s+/g, "");
      if (!raw) return {};
      var json = typeof Buffer !== "undefined"
        ? Buffer.from(raw, "base64").toString("utf8")
        : decodeURIComponent(escape(atob(raw)));
      var data = JSON.parse(json);
      if (!data || typeof data !== "object" || Array.isArray(data)) return {};
      return data;
    } catch (_e) {
      return {};
    }
  }

  function resolveThemeId(id) {
    var raw = String(id == null ? "" : id).trim();
    if (raw === "minimal") return "classic";
    if (raw === "slate" || raw === "kami") return "default";
    return THEMES[raw] ? raw : DEFAULTS.theme;
  }

  function clampItemCap(value) {
    var n = Math.round(Number(value));
    if (!Number.isFinite(n)) return DEFAULTS.item_cap;
    return Math.min(ITEM_CAP_MAX, Math.max(ITEM_CAP_MIN, n));
  }

  function clampTypeStep(value) {
    var Scale = (root && root.BoardTypeScale)
      || (typeof BoardTypeScale !== "undefined" ? BoardTypeScale : null)
      || (typeof FlowchartTypeScale !== "undefined" ? FlowchartTypeScale : null);
    if (Scale && typeof Scale.clampStep === "function") return Scale.clampStep(value);
    var n = Math.round(Number(value));
    if (!Number.isFinite(n)) return DEFAULTS.type_step;
    return Math.min(TYPE_STEP_MAX, Math.max(TYPE_STEP_MIN, n));
  }

  function resolveLinkRoute(value) {
    var raw = String(value == null ? "" : value).trim();
    return ROUTES[raw] ? raw : DEFAULTS.link_route;
  }

  function authoredFields(raw) {
    var src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    var out = {};
    var theme = src.theme != null && src.theme !== "" ? resolveThemeId(src.theme) : "";
    if (theme && theme !== DEFAULTS.theme) out.theme = theme;
    if (src.item_cap != null && src.item_cap !== "") {
      var cap = clampItemCap(src.item_cap);
      if (cap !== DEFAULTS.item_cap) out.item_cap = cap;
    }
    if (src.link_route != null && src.link_route !== "") {
      var route = resolveLinkRoute(src.link_route);
      if (route !== DEFAULTS.link_route) out.link_route = route;
    }
    if (src.type_step != null && src.type_step !== "") {
      var step = clampTypeStep(src.type_step);
      if (step !== DEFAULTS.type_step) out.type_step = step;
    }
    return out;
  }

  function resolveFields(raw) {
    var src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    return {
      theme: src.theme != null && src.theme !== "" ? resolveThemeId(src.theme) : DEFAULTS.theme,
      item_cap: src.item_cap == null || src.item_cap === "" ? DEFAULTS.item_cap : clampItemCap(src.item_cap),
      link_route: src.link_route == null || src.link_route === "" ? DEFAULTS.link_route : resolveLinkRoute(src.link_route),
      type_step: src.type_step == null || src.type_step === "" ? DEFAULTS.type_step : clampTypeStep(src.type_step),
    };
  }

  function isFieldKey(key) {
    return !!FIELD_KEYS[key];
  }

  return {
    THEMES: THEMES,
    ROUTES: ROUTES,
    DEFAULTS: DEFAULTS,
    ITEM_CAP_MIN: ITEM_CAP_MIN,
    ITEM_CAP_MAX: ITEM_CAP_MAX,
    TYPE_STEP_MIN: TYPE_STEP_MIN,
    TYPE_STEP_MAX: TYPE_STEP_MAX,
    encodeStylePayload: encodeStylePayload,
    decodeStylePayload: decodeStylePayload,
    resolveThemeId: resolveThemeId,
    clampItemCap: clampItemCap,
    clampTypeStep: clampTypeStep,
    resolveLinkRoute: resolveLinkRoute,
    authoredFields: authoredFields,
    resolveFields: resolveFields,
    isFieldKey: isFieldKey,
  };
});
