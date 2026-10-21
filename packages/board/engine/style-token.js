/* Shared style token: JSON object ↔ base64. Board `style` and mermaid `%% style` both use this. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.BoardStyleToken = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

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

  return {
    encodeStylePayload: encodeStylePayload,
    decodeStylePayload: decodeStylePayload,
  };
});
