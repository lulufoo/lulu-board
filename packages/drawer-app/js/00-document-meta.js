(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DrawerDocumentMeta = api;
  root.splitDocument = api.splitDocument;
  root.joinDocument = api.joinDocument;
  root.stripDocumentMeta = api.stripDocumentMeta;
  root.sourceBody = api.sourceBody;
  root.newGraphId = api.newGraphId;
  root.blankHashBoardSource = api.blankHashBoardSource;
  root.blankHashFlowchartSource = api.blankHashFlowchartSource;
  root.blankHashMindmapSource = api.blankHashMindmapSource;
  root.blankHashSequenceSource = api.blankHashSequenceSource;
  root.blankHashClassSource = api.blankHashClassSource;
  root.blankHashStateSource = api.blankHashStateSource;
  root.blankHashErSource = api.blankHashErSource;
  root.blankHashRequirementSource = api.blankHashRequirementSource;
  root.blankHashSourceForKind = api.blankHashSourceForKind;
  root.diagramTitleFromBody = api.diagramTitleFromBody;
  root.updateMermaidTitle = api.updateMermaidTitle;
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

  function stripDocumentMeta(text) {
    var raw = String(text == null ? "" : text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    var lines = raw.split("\n");
    var i = 0;
    while (i < lines.length && !String(lines[i] || "").trim()) i += 1;
    while (i < lines.length) {
      if (!/^(?:%%\s*)?meta\s+/.test(String(lines[i]).trim())) break;
      i += 1;
      while (i < lines.length && !String(lines[i] || "").trim()) i += 1;
    }
    return lines.slice(i).join("\n");
  }

  function sourceBody(text) {
    return stripDocumentMeta(text);
  }

  function newGraphId() {
    var bytes;
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      bytes = new Uint8Array(4);
      crypto.getRandomValues(bytes);
    } else {
      bytes = require("crypto").randomBytes(4);
    }
    var hex = "";
    for (var i = 0; i < bytes.length; i += 1) hex += ("0" + bytes[i].toString(16)).slice(-2);
    return "b_" + hex;
  }

  function titledName(title) {
    var name = String(title == null ? "Untitled" : title).replace(/"/g, "");
    if (!name) name = "Untitled";
    return name;
  }

  function blankHashBoardSource(title) {
    return "board \"" + titledName(title) + "\"\n";
  }

  function blankHashFlowchartSource(title) {
    return "%% title " + titledName(title) + "\nflowchart TD\n";
  }

  function blankHashMindmapSource(title) {
    return "%% title " + titledName(title) + "\nmindmap\n  Topic\n";
  }

  function wrapMermaidSeed(title, body) {
    return "%% title " + titledName(title) + "\n" + body;
  }

  function blankHashSequenceSource(title) {
    return wrapMermaidSeed(title, "sequenceDiagram\n  actor User\n  participant UI\n  participant API\n  participant DB\n  User->>UI: action\n  UI->>API: request\n  API->>DB: query\n  DB-->>API: rows\n  API-->>UI: result\n  UI-->>User: render\n");
  }

  function blankHashClassSource(title) {
    return wrapMermaidSeed(title, "classDiagram\n  class Service {\n    +run()\n  }\n  class Store {\n    +load()\n    +save()\n  }\n  Service --> Store : uses\n  class Api\n  Api --> Service : uses\n");
  }

  function blankHashStateSource(title) {
    return wrapMermaidSeed(title, "stateDiagram-v2\n  [*] --> Idle\n  Idle --> Open : open\n  Open --> Saving : submit\n  Saving --> Idle : success\n  Saving --> Open : failure\n  Open --> Idle : cancel\n");
  }

  function blankHashErSource(title) {
    return wrapMermaidSeed(title, "erDiagram\n  USER ||--o{ NOTE : writes\n  NOTE ||--|{ TAG : tagged\n  USER {\n    string id PK\n    string name\n  }\n  NOTE {\n    string id PK\n    string user_id FK\n    string body\n  }\n");
  }

  function blankHashRequirementSource(title) {
    return wrapMermaidSeed(title, "requirementDiagram\n  requirement auth {\n    id: 1\n    text: user must sign in\n    risk: high\n    verifymethod: test\n  }\n  element login {\n    type: simulation\n  }\n  login - satisfies -> auth\n");
  }

  function blankHashSourceForKind(kind, title) {
    var key = String(kind || "").trim();
    if (key === "flowchart") return blankHashFlowchartSource(title);
    if (key === "mindmap") return blankHashMindmapSource(title);
    if (key === "sequence" || key === "sequenceDiagram") return blankHashSequenceSource(title);
    if (key === "class" || key === "classDiagram") return blankHashClassSource(title);
    if (key === "state" || key === "stateDiagram" || key === "stateDiagram-v2") return blankHashStateSource(title);
    if (key === "er" || key === "erDiagram") return blankHashErSource(title);
    if (key === "requirement" || key === "requirementDiagram") return blankHashRequirementSource(title);
    return blankHashBoardSource(title);
  }

  function matchMermaidTitleLine(line) {
    return /^%%\s*title\s*:?\s*(.*)$/i.exec(String(line || "").trim());
  }

  function mermaidTitleFromMatch(hit) {
    if (!hit) return "";
    return String(hit[1] || "").replace(/^["']|["']$/g, "").trim();
  }

  function firstDiagramLineIndex(lines) {
    for (var i = 0; i < lines.length; i += 1) {
      var t = String(lines[i] || "").trim();
      if (!t) continue;
      if (/^%%/.test(t)) continue;
      if (/^(?:%%\s*)?style\s+/i.test(t)) continue;
      if (/^(?:%%\s*)?meta\s+/i.test(t)) continue;
      return i;
    }
    return 0;
  }

  function diagramTitleFromBody(body) {
    var text = String(body || "");
    var board = /^\s*board\s+"([^"]*)"/.exec(text);
    if (board) return board[1];
    var lines = text.split(/\r?\n/);
    for (var i = 0; i < lines.length; i += 1) {
      var title = mermaidTitleFromMatch(matchMermaidTitleLine(lines[i]));
      if (title) return title;
    }
    return "";
  }

  function updateMermaidTitle(source, title) {
    var name = String(title == null ? "" : title).replace(/[\r\n]/g, " ").trim();
    var lines = String(source == null ? "" : source).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    var found = -1;
    for (var i = 0; i < lines.length; i += 1) {
      if (matchMermaidTitleLine(lines[i])) {
        found = i;
        break;
      }
    }
    if (!name) {
      if (found >= 0) lines.splice(found, 1);
      return lines.join("\n");
    }
    var next = "%% title " + name;
    if (found >= 0) {
      lines[found] = next;
      return lines.join("\n");
    }
    lines.splice(firstDiagramLineIndex(lines), 0, next);
    return lines.join("\n");
  }

  return {
    encodeMetaPayload: encodeMetaPayload,
    decodeMetaPayload: decodeMetaPayload,
    splitDocument: splitDocument,
    joinDocument: joinDocument,
    stripDocumentMeta: stripDocumentMeta,
    sourceBody: sourceBody,
    newGraphId: newGraphId,
    blankHashBoardSource: blankHashBoardSource,
    blankHashFlowchartSource: blankHashFlowchartSource,
    blankHashMindmapSource: blankHashMindmapSource,
    blankHashSequenceSource: blankHashSequenceSource,
    blankHashClassSource: blankHashClassSource,
    blankHashStateSource: blankHashStateSource,
    blankHashErSource: blankHashErSource,
    blankHashRequirementSource: blankHashRequirementSource,
    blankHashSourceForKind: blankHashSourceForKind,
    diagramTitleFromBody: diagramTitleFromBody,
    updateMermaidTitle: updateMermaidTitle,
  };
});
var splitDocument = globalThis.splitDocument;
var joinDocument = globalThis.joinDocument;
var stripDocumentMeta = globalThis.stripDocumentMeta;
var sourceBody = globalThis.sourceBody;
var newGraphId = globalThis.newGraphId;
var blankHashBoardSource = globalThis.blankHashBoardSource;
var blankHashFlowchartSource = globalThis.blankHashFlowchartSource;
var blankHashMindmapSource = globalThis.blankHashMindmapSource;
var blankHashSequenceSource = globalThis.blankHashSequenceSource;
var blankHashClassSource = globalThis.blankHashClassSource;
var blankHashStateSource = globalThis.blankHashStateSource;
var blankHashErSource = globalThis.blankHashErSource;
var blankHashRequirementSource = globalThis.blankHashRequirementSource;
var blankHashSourceForKind = globalThis.blankHashSourceForKind;
var diagramTitleFromBody = globalThis.diagramTitleFromBody;
var updateMermaidTitle = globalThis.updateMermaidTitle;
