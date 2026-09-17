(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DrawerHashPersist = api;
  root.boardPersistMode = api.boardPersistMode;
  root.encodeBoardHash = api.encodeBoardHash;
  root.decodeBoardHash = api.decodeBoardHash;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function boardPersistMode() {
    var doc = typeof document !== "undefined" ? document.documentElement : null;
    var forced = doc && doc.getAttribute("data-persist");
    if (forced === "hash" || forced === "local") return forced;
    var host = typeof location !== "undefined" ? String(location.hostname || "") : "";
    return host === "127.0.0.1" || host === "localhost" ? "local" : "hash";
  }

  function bytesToBase64Url(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
    var b64 = typeof btoa === "function" ? btoa(bin) : Buffer.from(bytes).toString("base64");
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlToBytes(token) {
    var b64 = String(token || "").replace(/-/g, "+").replace(/_/g, "/");
    var pad = b64.length % 4;
    if (pad) b64 += "====".slice(pad);
    if (typeof atob === "function") {
      var bin = atob(b64);
      var out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new Uint8Array(Buffer.from(b64, "base64"));
  }

  async function compressZlib(bytes) {
    if (typeof CompressionStream === "function") {
      var stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    return new Uint8Array(require("zlib").deflateSync(Buffer.from(bytes)));
  }

  async function decompressZlib(bytes) {
    if (typeof DecompressionStream === "function") {
      var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    return new Uint8Array(require("zlib").inflateSync(Buffer.from(bytes)));
  }

  async function encodeBoardHash(text) {
    var input = new TextEncoder().encode(String(text || ""));
    return "z:" + bytesToBase64Url(await compressZlib(input));
  }

  async function decodeBoardHash(raw) {
    var token = String(raw || "").replace(/^#/, "");
    if (token.indexOf("z:") !== 0) throw new Error("invalid board hash");
    var bytes = base64UrlToBytes(token.slice(2));
    if (!bytes.length) throw new Error("invalid board hash");
    var out = await decompressZlib(bytes);
    return new TextDecoder().decode(out);
  }

  return {
    boardPersistMode: boardPersistMode,
    encodeBoardHash: encodeBoardHash,
    decodeBoardHash: decodeBoardHash,
  };
});
var boardPersistMode = globalThis.boardPersistMode;
var encodeBoardHash = globalThis.encodeBoardHash;
var decodeBoardHash = globalThis.decodeBoardHash;
