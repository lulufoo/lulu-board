(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LuluBoardCloudRoute = api;
  root.cloudDiagramIdFromHash = api.cloudDiagramIdFromHash;
  root.cloudDiagramHash = api.cloudDiagramHash;
  root.cloudShareIdFromHash = api.cloudShareIdFromHash;
  root.cloudShareHash = api.cloudShareHash;
  root.cloudShortLinkIdFromHash = api.cloudShortLinkIdFromHash;
  root.cloudShortLinkHash = api.cloudShortLinkHash;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var GRAPH_ID_RE = /^b_[0-9a-f]{8}$/;
  var SHARE_ID_RE = /^s_[0-9a-f]{32}$/;
  var SHORT_LINK_ID_RE = /^p_[0-9a-f]{64}$/;

  function cloudDiagramIdFromHash(raw) {
    var token = String(raw || "").replace(/^#/, "");
    var match = /^b:(b_[0-9a-f]{8})$/.exec(token);
    return match ? match[1] : "";
  }

  function cloudDiagramHash(diagramId) {
    var id = String(diagramId || "").trim();
    if (!GRAPH_ID_RE.test(id)) throw new Error("invalid cloud graph id");
    return "#b:" + id;
  }

  function cloudShareIdFromHash(raw) {
    var token = String(raw || "").replace(/^#/, "");
    var match = /^s:(s_[0-9a-f]{32})$/.exec(token);
    return match ? match[1] : "";
  }

  function cloudShareHash(shareId) {
    var id = String(shareId || "").trim();
    if (!SHARE_ID_RE.test(id)) throw new Error("invalid share id");
    return "#s:" + id;
  }

  function cloudShortLinkIdFromHash(raw) {
    var token = String(raw || "").replace(/^#/, "");
    var match = /^p:(p_[0-9a-f]{64})$/.exec(token);
    return match ? match[1] : "";
  }

  function cloudShortLinkHash(shortLinkId) {
    var id = String(shortLinkId || "").trim();
    if (!SHORT_LINK_ID_RE.test(id)) throw new Error("invalid short link id");
    return "#p:" + id;
  }

  return {
    cloudDiagramIdFromHash: cloudDiagramIdFromHash,
    cloudDiagramHash: cloudDiagramHash,
    cloudShareIdFromHash: cloudShareIdFromHash,
    cloudShareHash: cloudShareHash,
    cloudShortLinkIdFromHash: cloudShortLinkIdFromHash,
    cloudShortLinkHash: cloudShortLinkHash,
  };
});

var cloudDiagramIdFromHash = globalThis.cloudDiagramIdFromHash;
var cloudDiagramHash = globalThis.cloudDiagramHash;
var cloudShareIdFromHash = globalThis.cloudShareIdFromHash;
var cloudShareHash = globalThis.cloudShareHash;
var cloudShortLinkIdFromHash = globalThis.cloudShortLinkIdFromHash;
var cloudShortLinkHash = globalThis.cloudShortLinkHash;
