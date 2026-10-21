(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DrawerStyleLine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var RENDERER_STYLE_RE = /^(?:%%\s*)?style\s+(\S+)\s*$/i;
  var THEME_IDS = { default: 1, classic: 1, pastel: 1 };

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

  var FLOWCHART_RE = /^(flowchart|graph|flowchart-elk)\b/i;
  var MERMAID_RE = /^(C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|flowchart|graph|flowchart-elk|sequenceDiagram|classDiagram(?:-v2)?|stateDiagram(?:-v2)?|erDiagram|journey|gantt|gitGraph|pie|mindmap|timeline|quadrantChart|xychart-beta|block-beta|architecture(?:-beta)?|packet-beta|kanban|sankey-beta|requirement(?:Diagram)?|radar-beta)\b/i;

  function firstDiagramLine(body) {
    var lines = String(body == null ? "" : body).split(/\r?\n/);
    for (var i = 0; i < lines.length; i += 1) {
      var line = String(lines[i] || "").trim();
      if (!line) continue;
      if (line.charAt(0) === "#" || line.indexOf("//") === 0) continue;
      if (line.indexOf("%%") === 0 || line.indexOf("meta ") === 0) continue;
      if (/^---/.test(line)) continue;
      if (isRendererStyleLine(line)) continue;
      return line;
    }
    return "";
  }

  function bodyIsBoard(body) {
    return /^board\s+/i.test(firstRealLine(body));
  }

  // board | flowchart | mermaid-unsupported | empty | unknown
  function bodyKind(body) {
    var line = firstDiagramLine(body);
    if (!line) return "empty";
    if (/^board\s+/i.test(line)) return "board";
    if (FLOWCHART_RE.test(line)) return "flowchart";
    if (MERMAID_RE.test(line)) return "mermaid-unsupported";
    return "unknown";
  }

  function splitRendererStyle(body) {
    var lines = String(body == null ? "" : body).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    var token = "";
    var out = [];
    for (var i = 0; i < lines.length; i += 1) {
      var trim = String(lines[i] || "").trim();
      if (!token) {
        var hit = RENDERER_STYLE_RE.exec(trim);
        if (hit) {
          token = hit[1];
          continue;
        }
      }
      out.push(lines[i]);
    }
    return { token: token, body: out.join("\n") };
  }

  function resolveThemeId(id) {
    var raw = String(id == null ? "" : id).trim();
    if (raw === "minimal") return "classic";
    if (raw === "slate" || raw === "kami") return "default";
    return THEME_IDS[raw] ? raw : "default";
  }

  function clampMermaidTypeStep(raw) {
    if (typeof FlowchartTypeScale !== "undefined" && FlowchartTypeScale.clampStep) {
      return FlowchartTypeScale.clampStep(raw);
    }
    var n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return 0;
    return Math.min(3, Math.max(-3, n));
  }

  function styleTokenApi() {
    if (typeof BoardStyleToken !== "undefined") return BoardStyleToken;
    if (typeof require === "function") {
      try { return require("../../board/engine/style-token.js"); } catch (_e) {}
    }
    return null;
  }

  function encodeStylePayload(obj) {
    return styleTokenApi().encodeStylePayload(obj);
  }

  function decodeStylePayload(b64) {
    return styleTokenApi().decodeStylePayload(b64);
  }

  function decodeStyleTokenJson(token) {
    var raw = String(token == null ? "" : token).trim();
    if (!raw || THEME_IDS[raw] || raw === "kami") return null;
    var data = decodeStylePayload(raw);
    return data && Object.keys(data).length ? data : null;
  }

  function mermaidStyleToken(theme, typeStep) {
    var t = resolveThemeId(theme);
    var step = clampMermaidTypeStep(typeStep);
    var data = {};
    if (t !== "default") data.theme = t;
    if (step !== 0) data.type_step = step;
    if (!Object.keys(data).length) return "";
    return encodeStylePayload(data);
  }

  function themeFromStyleToken(token) {
    var raw = String(token == null ? "" : token).trim();
    if (!raw) return "default";
    if (THEME_IDS[raw]) return raw;
    if (raw === "kami") return "default";
    var data = decodeStyleTokenJson(raw);
    if (data && data.theme) return resolveThemeId(data.theme);
    return "default";
  }

  function typeStepFromStyleToken(token) {
    var data = decodeStyleTokenJson(token);
    if (!data || data.type_step == null || data.type_step === "") return 0;
    return clampMermaidTypeStep(data.type_step);
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

  // Camera viewport: world point at the stage centre + zoom.
  // Legacy {scale, x, y} pan-pixel viewports are not a camera and read as null.
  function authoredViewport(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    var scale = Number(raw.scale);
    var cx = Number(raw.cx);
    var cy = Number(raw.cy);
    if (!isFinite(scale) || !isFinite(cx) || !isFinite(cy)) return null;
    return {
      scale: Math.min(3, Math.max(0.2, scale)),
      cx: Math.round(cx),
      cy: Math.round(cy),
    };
  }

  return {
    RENDERER_STYLE_RE: RENDERER_STYLE_RE,
    isRendererStyleLine: isRendererStyleLine,
    firstDiagramLine: firstDiagramLine,
    bodyIsBoard: bodyIsBoard,
    bodyKind: bodyKind,
    splitRendererStyle: splitRendererStyle,
    joinRendererStyle: joinRendererStyle,
    resolveThemeId: resolveThemeId,
    encodeStylePayload: encodeStylePayload,
    decodeStylePayload: decodeStylePayload,
    mermaidStyleToken: mermaidStyleToken,
    themeFromStyleToken: themeFromStyleToken,
    typeStepFromStyleToken: typeStepFromStyleToken,
    clampMermaidTypeStep: clampMermaidTypeStep,
    authoredViewport: authoredViewport,
  };
});
