(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LuluBoardCloudRoute = api;
  root.cloudBoardIdFromHash = api.cloudBoardIdFromHash;
  root.cloudBoardHash = api.cloudBoardHash;
  root.cloudShareIdFromHash = api.cloudShareIdFromHash;
  root.cloudShareHash = api.cloudShareHash;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var BOARD_ID_RE = /^b_[0-9a-f]{8}$/;
  var SHARE_ID_RE = /^s_[0-9a-f]{32}$/;

  function cloudBoardIdFromHash(raw) {
    var token = String(raw || "").replace(/^#/, "");
    var match = /^b:(b_[0-9a-f]{8})$/.exec(token);
    return match ? match[1] : "";
  }

  function cloudBoardHash(boardId) {
    var id = String(boardId || "").trim();
    if (!BOARD_ID_RE.test(id)) throw new Error("invalid cloud board id");
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

  return {
    cloudBoardIdFromHash: cloudBoardIdFromHash,
    cloudBoardHash: cloudBoardHash,
    cloudShareIdFromHash: cloudShareIdFromHash,
    cloudShareHash: cloudShareHash,
  };
});

var cloudBoardIdFromHash = globalThis.cloudBoardIdFromHash;
var cloudBoardHash = globalThis.cloudBoardHash;
var cloudShareIdFromHash = globalThis.cloudShareIdFromHash;
var cloudShareHash = globalThis.cloudShareHash;
