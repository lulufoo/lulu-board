(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LuluBoardCloudRoute = api;
  root.cloudBoardIdFromHash = api.cloudBoardIdFromHash;
  root.cloudBoardHash = api.cloudBoardHash;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var BOARD_ID_RE = /^b_[0-9a-f]{8}$/;

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

  return {
    cloudBoardIdFromHash: cloudBoardIdFromHash,
    cloudBoardHash: cloudBoardHash,
  };
});

var cloudBoardIdFromHash = globalThis.cloudBoardIdFromHash;
var cloudBoardHash = globalThis.cloudBoardHash;
