(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DrawerDocumentMeta = api;
  root.splitDocument = api.splitDocument;
  root.joinDocument = api.joinDocument;
  root.sourceBody = api.sourceBody;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var META_LINE = /^meta\s+(\S+|{.*})\s*$/;
  var ID_RE = /^b_[0-9a-f]{8}$/;

  function encodeMetaPayload(meta) {
    var json = JSON.stringify({ id: String(meta.id), version: Number(meta.version) });
    if (typeof Buffer !== "undefined") return Buffer.from(json, "utf8").toString("base64");
    return btoa(unescape(encodeURIComponent(json)));
  }

  function decodeMetaPayload(token) {
    var text = String(token == null ? "" : token).trim();
    if (!text) throw new Error("document meta required");
    var json;
    if (text.charAt(0) === "{") {
      json = text;
    } else {
      var compact = text.replace(/\s+/g, "");
      try {
        json = typeof Buffer !== "undefined"
          ? Buffer.from(compact, "base64").toString("utf8")
          : decodeURIComponent(escape(atob(compact)));
      } catch (_e) {
        throw new Error("document meta required");
      }
    }
    var data;
    try { data = JSON.parse(json); } catch (_e) { throw new Error("document meta required"); }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("document meta required");
    var id = data.id != null ? String(data.id).trim() : "";
    var version = data.version;
    if (!ID_RE.test(id) || !Number.isInteger(version) || version < 1) throw new Error("document meta required");
    return { id: id, version: version };
  }

  function splitDocument(text) {
    var raw = String(text == null ? "" : text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    var lines = raw.split("\n");
    var i = 0;
    while (i < lines.length && !String(lines[i] || "").trim()) i += 1;
    var found = [];
    while (i < lines.length) {
      var hit = String(lines[i]).trim().match(META_LINE);
      if (!hit) break;
      try { found.push(decodeMetaPayload(hit[1])); } catch (_e) {}
      i += 1;
      while (i < lines.length && !String(lines[i] || "").trim()) i += 1;
    }
    if (!found.length) throw new Error("document meta required");
    var meta = found[0];
    for (var n = 1; n < found.length; n += 1) {
      if (found[n].version > meta.version) meta = found[n];
    }
    return { meta: meta, body: lines.slice(i).join("\n") };
  }

  function joinDocument(meta, body) {
    var id = String(meta.id);
    var rest = String(body == null ? "" : body);
    var line = "meta " + encodeMetaPayload({ id: id, version: Number(meta.version) });
    if (rest.charAt(0) === "\n") return line + rest;
    if (rest) return line + "\n" + rest;
    return line + "\n";
  }

  function sourceBody(text) {
    var raw = String(text == null ? "" : text);
    if (!raw.trim()) return "";
    return splitDocument(raw).body;
  }

  return {
    encodeMetaPayload: encodeMetaPayload,
    decodeMetaPayload: decodeMetaPayload,
    splitDocument: splitDocument,
    joinDocument: joinDocument,
    sourceBody: sourceBody,
  };
});
var splitDocument = globalThis.splitDocument;
var joinDocument = globalThis.joinDocument;
var sourceBody = globalThis.sourceBody;
