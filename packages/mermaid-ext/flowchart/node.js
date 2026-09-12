/** Node parse / mutate. */

import { fail, linesOf, joinLines, escapeRegExp } from './util.js';
import { ensureFlowchart, collectIds, nextId, rewriteIdEverywhere, findSubgraphRange } from './source.js';
import { SHAPES, NODE_KINDS, normalizeNodeKind, kindFromShape, shapeFromKind, detectShape, unwrapLabel, formatNodeDecl } from './kinds.js';

var NODE_DECL_RE = /^(\s*)([A-Za-z][\w-]*)(\s*)((?:\([\[\(]|\[\[|\{\{|[\[\(\{>])[\s\S]*)$/;

function parseNodeDecl(line) {
  var trimmed = String(line || "");
  // Only treat pure node declaration lines (no arrows)
  if (/-->|---|==>|-\.->|--o|--x|<-->/.test(trimmed)) return null;
  if (/^\s*subgraph\b/i.test(trimmed) || /^\s*end\b/i.test(trimmed)) return null;
  if (/^\s*(flowchart|graph|direction|style|classDef|class|click|linkStyle)\b/i.test(trimmed)) return null;
  var m = trimmed.match(/^(\s*)([A-Za-z][\w-]*)(\s*)((?:\([\[\(]|\[\[|\{\{|[\[\(\{])[\s\S]+)$/);
  if (!m) {
    // bare id only
    var bare = trimmed.match(/^(\s*)([A-Za-z][\w-]*)\s*$/);
    if (!bare) return null;
    return { indent: bare[1], id: bare[2], shape: "rect", label: bare[2], token: "", bare: true };
  }
  var token = m[4].trim();
  return {
    indent: m[1],
    id: m[2],
    shape: detectShape(token),
    label: unwrapLabel(token),
    token: token,
    bare: false,
  };
}

function findNodeDeclLine(lines, id) {
  for (var i = 0; i < lines.length; i++) {
    var info = parseNodeDecl(lines[i]);
    if (info && info.id === id) return i;
  }
  return -1;
}

function getNode(source, id) {
  id = String(id || "").trim();
  if (!id) return null;
  var lines = linesOf(source);
  var idx = findNodeDeclLine(lines, id);
  if (idx >= 0) {
    var info = parseNodeDecl(lines[idx]);
    return {
      id: info.id,
      label: info.label,
      shape: info.shape,
      nodeKind: kindFromShape(info.shape, info.label),
      line: idx,
    };
  }
  // referenced only via edges — still a node
  if (collectIds(source)[id]) return { id: id, label: id, shape: "rect", nodeKind: "default", line: -1 };
  return null;
}

function addNode(source, opts) {
  var text = ensureFlowchart(source);
  var id = (opts && opts.id && String(opts.id).trim()) || nextId(text, "N");
  if (collectIds(text)[id]) fail("node id already used: " + id);
  var uiKind = normalizeNodeKind((opts && opts.kind) || "default");
  var shape = (opts && opts.shape) || shapeFromKind(uiKind);
  var label = opts && opts.label != null ? opts.label : NODE_KINDS[uiKind].label;
  var parent = opts && (opts.parent || opts.subgraphId || opts.subgraph);
  parent = parent ? String(parent).trim() : "";
  var decl = formatNodeDecl(id, shape, label);
  var selection = { kind: "node", id: id, key: "node:" + id, nodeKind: uiKind };
  if (parent) selection.parent = parent;
  if (parent) {
    var lines = linesOf(text);
    var range = findSubgraphRange(lines, parent);
    if (!range) fail("subgraph not found: " + parent);
    var childIndent = range.indent + "  ";
    lines.splice(range.end, 0, childIndent + decl);
    return { source: joinLines(lines), selection: selection };
  }
  var line = "  " + decl;
  text = text.replace(/\s*$/, "") + "\n" + line + "\n";
  return { source: text, selection: selection };
}

function updateNodeLabel(source, selection, label) {
  if (!selection || selection.kind !== "node" || !selection.id) fail("select a node");
  var text = ensureFlowchart(source);
  var lines = linesOf(text);
  var idx = findNodeDeclLine(lines, selection.id);
  var shape = "rect";
  if (idx >= 0) {
    var info = parseNodeDecl(lines[idx]);
    shape = info.shape || "rect";
    lines[idx] = info.indent + formatNodeDecl(selection.id, shape, label);
  } else {
    // create declaration
    lines.push("  " + formatNodeDecl(selection.id, shape, label));
  }
  return { source: joinLines(lines), selection: selection };
}

function updateNodeShape(source, selection, shape) {
  if (!selection || selection.kind !== "node" || !selection.id) fail("select a node");
  if (!SHAPES[shape]) fail("unknown shape: " + shape);
  var text = ensureFlowchart(source);
  var lines = linesOf(text);
  var idx = findNodeDeclLine(lines, selection.id);
  var label = selection.id;
  var indent = "  ";
  if (idx >= 0) {
    var info = parseNodeDecl(lines[idx]);
    label = info.label;
    indent = info.indent;
    lines[idx] = indent + formatNodeDecl(selection.id, shape, label);
  } else {
    lines.push(indent + formatNodeDecl(selection.id, shape, label));
  }
  var nextSel = Object.assign({}, selection, { nodeKind: kindFromShape(shape, label) });
  return { source: joinLines(lines), selection: nextSel };
}

/** UI/render kind only — writes Mermaid shape, never invents protocol keywords. */

function updateNodeKind(source, selection, uiKind) {
  uiKind = normalizeNodeKind(uiKind);
  if (!NODE_KINDS[uiKind]) fail("unknown node kind: " + uiKind);
  var shape = shapeFromKind(uiKind);
  var result = updateNodeShape(source, selection, shape);
  // Optional: if label is still a generic placeholder, nudge toward kind default
  var node = getNode(result.source, selection.id);
  if (node) {
    var placeholders = {
      Node: 1, Start: 1, End: 1, "判断": 1,
      node: 1, default: 1, start: 1, end: 1, judgment: 1,
    };
    if (placeholders[node.label]) {
      result = updateNodeLabel(result.source, result.selection, NODE_KINDS[uiKind].label);
    }
  }
  result.selection = Object.assign({}, result.selection, { nodeKind: uiKind });
  return result;
}

function updateNodeId(source, selection, nextId) {
  if (!selection || selection.kind !== "node" || !selection.id) fail("select a node");
  nextId = String(nextId || "").trim();
  if (!/^[A-Za-z][\w-]*$/.test(nextId)) fail("invalid node id");
  if (nextId === selection.id) return { source: ensureFlowchart(source), selection: selection };
  var text = ensureFlowchart(source);
  if (collectIds(text)[nextId]) fail("node id already used: " + nextId);
  text = rewriteIdEverywhere(text, selection.id, nextId);
  return { source: text, selection: { kind: "node", id: nextId, key: "node:" + nextId } };
}

function deleteNode(source, selection) {
  if (!selection || selection.kind !== "node" || !selection.id) fail("select a node before deleting");
  var text = ensureFlowchart(source);
  var id = selection.id;
  var lines = linesOf(text);
  var out = [];
  var idRe = new RegExp("^\\s*" + escapeRegExp(id) + "\\s*(?:\\[|\\(|\\{|\\>|\\[\\[|\\[\\(|\\[\\/|\\[\\\\|$)");
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var trimmed = line.trim();
    if (!trimmed) { out.push(line); continue; }
    if (idRe.test(line) && trimmed.indexOf("subgraph") !== 0) continue;
    if (new RegExp("\\b" + escapeRegExp(id) + "\\b").test(line) && /-->|---|==>|-\.->/.test(line) && trimmed.indexOf("subgraph") !== 0 && !/^(style|classDef|class|click|linkStyle)\b/.test(trimmed)) {
      continue;
    }
    out.push(line);
  }
  return { source: joinLines(out).replace(/\n{3,}/g, "\n\n"), selection: null };
}

export {
  parseNodeDecl,
  findNodeDeclLine,
  getNode,
  addNode,
  updateNodeLabel,
  updateNodeShape,
  updateNodeKind,
  updateNodeId,
  deleteNode,
};
