(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DrawerStyleLine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var RENDERER_STYLE_RE = /^(?:%%\s*)?style\s+(\S+)\s*$/i;
  var DIAGRAM_START_RE = /^(C4Context|C4Container|C4Component|flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|gitGraph|pie|mindmap|timeline|quadrantChart|xychart-beta|block-beta|architecture-beta|packet-beta|kanban|sankey-beta)\b/i;
  var STYLE_THEMES = { default: 1, classic: 1, pastel: 1, kami: 1 };

  function isRendererStyleLine(line) {
    return RENDERER_STYLE_RE.test(String(line || "").trim());
  }

  function firstRealLine(body) {
    var lines = String(body == null ? "" : body).split(/\r?\n/);
    for (var i = 0; i < lines.length; i += 1) {
      var line = String(lines[i] || "").trim();
      if (!line || line.charAt(0) === "#" || line.indexOf("//") === 0) continue;
      return line;
    }
    return "";
  }

  function bodyIsBoard(body) {
    return /^board\s+/i.test(firstRealLine(body));
  }

  function splitRendererStyle(body) {
    var lines = String(body == null ? "" : body).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    var token = "";
    var out = [];
    var afterDiagram = false;
    for (var i = 0; i < lines.length; i += 1) {
      var trim = String(lines[i] || "").trim();
      if (!afterDiagram) {
        var hit = RENDERER_STYLE_RE.exec(trim);
        if (hit) {
          token = hit[1];
          continue;
        }
        if (DIAGRAM_START_RE.test(trim)) afterDiagram = true;
      }
      out.push(lines[i]);
    }
    return { token: token, body: out.join("\n") };
  }

  function joinRendererStyle(token, body) {
    var rest = String(body == null ? "" : body);
    var t = String(token || "").trim();
    if (!t) return rest;
    var line = (bodyIsBoard(rest) ? "style " : "%% style ") + t;
    if (!rest) return line + "\n";
    if (rest.charAt(0) === "\n") return line + rest;
    return line + "\n" + rest;
  }

  function authoredMermaidStyle(raw) {
    var src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    var out = {};
    if (STYLE_THEMES[src.theme] && src.theme !== "default") out.theme = src.theme;
    return out;
  }

  function applyMermaidStylePatch(token, patch, encode, decode) {
    var raw = {};
    try { raw = typeof decode === "function" ? decode(token) : {}; } catch (_e) { raw = {}; }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) raw = {};
    Object.keys(patch || {}).forEach(function (key) {
      if (patch[key] == null) delete raw[key];
      else raw[key] = patch[key];
    });
    var authored = authoredMermaidStyle(raw);
    if (!Object.keys(authored).length) return "";
    return encode(authored);
  }

  return {
    RENDERER_STYLE_RE: RENDERER_STYLE_RE,
    isRendererStyleLine: isRendererStyleLine,
    bodyIsBoard: bodyIsBoard,
    splitRendererStyle: splitRendererStyle,
    joinRendererStyle: joinRendererStyle,
    authoredMermaidStyle: authoredMermaidStyle,
    applyMermaidStylePatch: applyMermaidStylePatch,
  };
});
