/** UI kinds ↔ Mermaid shapes (protocol unchanged). */

import { quoteLabel } from './util.js';


var SHAPES = {
  rect: { open: '["', close: '"]', altOpen: "[", altClose: "]" },
  round: { open: '("', close: '")', altOpen: "(", altClose: ")" },
  stadium: { open: '(["', close: '"])', altOpen: "([", altClose: "])" },
  diamond: { open: '{"', close: '"}', altOpen: "{", altClose: "}" },
  circle: { open: '(("', close: '"))', altOpen: "((", altClose: "))" },
  cylinder: { open: '[("', close: '")]', altOpen: "[(", altClose: ")]" },
  hexagon: { open: '{{"', close: '"}}', altOpen: "{{", altClose: "}}" },
  subroutine: { open: '[["', close: '"]]', altOpen: "[[", altClose: "]]" },
};

// UI/render kinds (product) → Mermaid shape (protocol). Protocol stays Mermaid.

// UI/render kinds (product) → Mermaid shape (protocol). Protocol stays Mermaid.
var NODE_KINDS = {
  default: { shape: "rect", label: "default" },
  start: { shape: "stadium", label: "start" },
  end: { shape: "stadium", label: "end" },
  judgment: { shape: "diamond", label: "judgment" },
};
// Back-compat: older UI wrote "node"

// Back-compat: older UI wrote "node"
NODE_KINDS.node = NODE_KINDS.default;

function nodeKinds() {
  return ["default", "start", "end", "judgment"];
}

function normalizeNodeKind(kind) {
  kind = String(kind || "default");
  if (kind === "node") return "default";
  return NODE_KINDS[kind] ? kind : "default";
}

function kindFromShape(shape, label) {
  shape = String(shape || "rect");
  var lab = String(label == null ? "" : label).trim();
  if (shape === "diamond") return "judgment";
  if (shape === "stadium") {
    // Heuristic only for UI; source remains stadium either way.
    if (/^(end|结束|终止|完成)$/i.test(lab)) return "end";
    if (/^(start|开始|起点|default)$/i.test(lab)) return "start";
    return "start"; // stadium default in UI palette: start (end is explicit)
  }
  return "default";
}

function shapeFromKind(kind) {
  var k = NODE_KINDS[normalizeNodeKind(kind)] || NODE_KINDS.default;
  return k.shape;
}

function shapeKeys() {
  return Object.keys(SHAPES);
}

function detectShape(token) {
  // token is the bracketed part including brackets, e.g. ["x"] or ([y])
  if (!token) return "rect";
  if (/^\(\(\[/.test(token) || /^\(\("/.test(token) || /^\(\(/.test(token)) return "circle";
  if (/^\(\[/.test(token) || /^\(\["/.test(token)) return "stadium";
  if (/^\[\(/.test(token)) return "cylinder";
  if (/^\{\{/.test(token)) return "hexagon";
  if (/^\[\[/.test(token)) return "subroutine";
  if (/^\{/.test(token)) return "diamond";
  if (/^\(/.test(token)) return "round";
  return "rect";
}

function unwrapLabel(token) {
  if (!token) return "";
  var s = String(token);
  // strip matched outer wrappers greedily from known shapes
  s = s.replace(/^\(\["/, "").replace(/"\]\)$/, "");
  s = s.replace(/^\(\[/, "").replace(/\]\)$/, "");
  s = s.replace(/^\(\("/, "").replace(/"\)\)$/, "");
  s = s.replace(/^\(\(/, "").replace(/\)\)$/, "");
  s = s.replace(/^\[\("/, "").replace(/"\)\]$/, "");
  s = s.replace(/^\[\(/, "").replace(/\)\]$/, "");
  s = s.replace(/^\{\{"/, "").replace(/"\}\}$/, "");
  s = s.replace(/^\{\{/, "").replace(/\}\}$/, "");
  s = s.replace(/^\[\["/, "").replace(/"\]\]$/, "");
  s = s.replace(/^\[\[/, "").replace(/\]\]$/, "");
  s = s.replace(/^\{"/, "").replace(/"\}$/, "");
  s = s.replace(/^\{/, "").replace(/\}$/, "");
  s = s.replace(/^\("/, "").replace(/"\)$/, "");
  s = s.replace(/^\(/, "").replace(/\)$/, "");
  s = s.replace(/^\["/, "").replace(/"\]$/, "");
  s = s.replace(/^\[/, "").replace(/\]$/, "");
  if ((s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') || (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'")) {
    s = s.slice(1, -1);
  }
  return s.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function formatNodeDecl(id, shape, label) {
  shape = SHAPES[shape] ? shape : "rect";
  var q = quoteLabel(label == null || label === "" ? id : label);
  return id + SHAPES[shape].open + q + SHAPES[shape].close;
}

/** Match `ID[...]` / `ID(...)` etc. at start of a statement fragment */

export {
  SHAPES,
  NODE_KINDS,
  nodeKinds,
  normalizeNodeKind,
  kindFromShape,
  shapeFromKind,
  shapeKeys,
  detectShape,
  unwrapLabel,
  formatNodeDecl,
};
