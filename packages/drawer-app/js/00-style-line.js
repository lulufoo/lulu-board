(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DrawerStyleLine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var RENDERER_STYLE_RE = /^(?:%%\s*)?style\s+(\S+)\s*$/i;

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
  var MERMAID_RE = /^(C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|flowchart|graph|flowchart-elk|sequenceDiagram|classDiagram(?:-v2)?|stateDiagram(?:-v2)?|erDiagram|journey|gantt|gitGraph|pie|mindmap|timeline|quadrantChart|xychart(?:-beta)?|block(?:-beta)?|architecture(?:-beta)?|packet(?:-beta)?|kanban|sankey(?:-beta)?|requirement(?:Diagram)?|radar-beta|swimlane-beta|agentflow-beta|treeView-beta|usecase-beta|eventmodeling|railroad(?:-(?:ebnf|abnf|peg))?-beta|cynefin-beta|wardley-beta|venn-beta|ishikawa(?:-beta)?|treemap(?:-beta)?)\b/i;
  var TYPE_NAMES = {
    board: "Board",
    flowchart: "Flowchart",
    block: "Block",
    mindmap: "Mindmap",
    architecture: "Architecture",
    swimlane: "Swimlane",
    agentflow: "Agentflow",
    treeview: "Tree View",
    sequence: "Sequence",
    class: "Class",
    state: "State",
    er: "ER",
    requirement: "Requirement",
    c4: "C4",
    usecase: "Use Case",
    eventmodeling: "Event Modeling",
    railroad: "Railroad",
    gantt: "Gantt",
    journey: "Journey",
    timeline: "Timeline",
    gitgraph: "Git Graph",
    kanban: "Kanban",
    pie: "Pie",
    quadrant: "Quadrant",
    xychart: "XY Chart",
    sankey: "Sankey",
    packet: "Packet",
    radar: "Radar",
    treemap: "Treemap",
    cynefin: "Cynefin",
    wardley: "Wardley",
    venn: "Venn",
    ishikawa: "Ishikawa",
  };

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

  function bodyTypeKeyword(body) {
    var line = firstDiagramLine(body);
    if (!line) return "";
    if (/^board\s+/i.test(line)) return "board";
    var flow = FLOWCHART_RE.exec(line);
    if (flow) return flow[1];
    var mermaid = MERMAID_RE.exec(line);
    return mermaid ? mermaid[1] : "";
  }

  function normalizeTypeKey(keyword) {
    var key = String(keyword || "").toLowerCase();
    if (!key) return "";
    if (key === "board") return "board";
    if (key === "graph" || key === "flowchart" || key === "flowchart-elk") return "flowchart";
    if (/^c4/.test(key)) return "c4";
    key = key.replace(/-v2$/, "").replace(/-beta$/, "").replace(/-(?:ebnf|abnf|peg)$/, "").replace(/diagram$/, "");
    if (key === "quadrantchart") return "quadrant";
    return key;
  }

  function bodyTypeLabel(body) {
    var kind = bodyKind(body);
    if (kind === "empty" || kind === "unknown") return "Source";
    var name = TYPE_NAMES[normalizeTypeKey(bodyTypeKeyword(body))];
    if (name) return name;
    if (kind === "board") return "Board";
    if (kind === "flowchart") return "Flowchart";
    return "Mermaid";
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

  function styleTokenApi() {
    if (typeof BoardStyleToken !== "undefined") return BoardStyleToken;
    if (typeof require === "function") {
      try { return require("../../board/engine/style-token.js"); } catch (_e) {}
    }
    return null;
  }

  function resolveThemeId(id) {
    return styleTokenApi().resolveThemeId(id);
  }

  function clampMermaidTypeStep(raw) {
    return styleTokenApi().clampTypeStep(raw);
  }

  function encodeStylePayload(obj) {
    return styleTokenApi().encodeStylePayload(obj);
  }

  function decodeStylePayload(b64) {
    return styleTokenApi().decodeStylePayload(b64);
  }

  function isShortStyleName(token) {
    var raw = String(token == null ? "" : token).trim();
    var Token = styleTokenApi();
    return !!(Token.THEMES[raw] || raw === "kami" || raw === "minimal" || raw === "slate");
  }

  function decodeStyleTokenJson(token) {
    var raw = String(token == null ? "" : token).trim();
    if (!raw || isShortStyleName(raw)) return null;
    var data = decodeStylePayload(raw);
    return data && Object.keys(data).length ? data : null;
  }

  function fieldsFromStyleToken(token) {
    var raw = String(token == null ? "" : token).trim();
    var Token = styleTokenApi();
    if (!raw) return Token.resolveFields({});
    if (isShortStyleName(raw)) return Token.resolveFields({ theme: raw });
    return Token.resolveFields(Token.decodeStylePayload(raw));
  }

  function mermaidStyleToken(theme, typeStep, viewport) {
    var Token = styleTokenApi();
    var data = Token.authoredFields({
      theme: Token.resolveThemeId(theme),
      type_step: Token.clampTypeStep(typeStep),
      viewport: viewport,
    });
    if (!Object.keys(data).length) return "";
    return Token.encodeStylePayload(data);
  }

  function themeFromStyleToken(token) {
    return fieldsFromStyleToken(token).theme;
  }

  function typeStepFromStyleToken(token) {
    return fieldsFromStyleToken(token).type_step;
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

  function authoredViewport(raw) {
    var Token = styleTokenApi();
    return Token && typeof Token.authoredViewport === "function" ? Token.authoredViewport(raw) : null;
  }

  return {
    RENDERER_STYLE_RE: RENDERER_STYLE_RE,
    isRendererStyleLine: isRendererStyleLine,
    firstDiagramLine: firstDiagramLine,
    bodyIsBoard: bodyIsBoard,
    bodyKind: bodyKind,
    bodyTypeKeyword: bodyTypeKeyword,
    bodyTypeLabel: bodyTypeLabel,
    splitRendererStyle: splitRendererStyle,
    joinRendererStyle: joinRendererStyle,
    resolveThemeId: resolveThemeId,
    encodeStylePayload: encodeStylePayload,
    decodeStylePayload: decodeStylePayload,
    authoredFields: function (raw) { return styleTokenApi().authoredFields(raw); },
    resolveFields: function (raw) { return styleTokenApi().resolveFields(raw); },
    mermaidStyleToken: mermaidStyleToken,
    decodeStyleTokenJson: decodeStyleTokenJson,
    themeFromStyleToken: themeFromStyleToken,
    typeStepFromStyleToken: typeStepFromStyleToken,
    clampMermaidTypeStep: clampMermaidTypeStep,
    authoredViewport: authoredViewport,
  };
});
