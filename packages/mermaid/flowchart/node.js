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

var INLINE_TOKEN = "(?:\\(\\[\\[|\\[\\[|\\{\\{|\\(\\[|\\[\\(|[\\[\\(\\{>])[\\s\\S]*?(?:\\)\\]|\\]\\)|\\]|\\)|\\})";

function rewriteNodeAppearance(lines, id, shape, label) {
  var idx = findNodeDeclLine(lines, id);
  if (idx >= 0) {
    var info = parseNodeDecl(lines[idx]);
    lines[idx] = info.indent + formatNodeDecl(id, shape, label);
    return true;
  }
  var re = new RegExp(escapeRegExp(id) + "\\s*" + INLINE_TOKEN);
  var i;
  for (i = 0; i < lines.length; i++) {
    if (!re.test(lines[i])) continue;
    lines[i] = lines[i].replace(re, formatNodeDecl(id, shape, label));
    return true;
  }
  return false;
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
  var look = snapshotInlineNodeLooks(source)[id];
  if (look) {
    return {
      id: id,
      label: look.label,
      shape: look.shape,
      nodeKind: kindFromShape(look.shape, look.label),
      line: -1,
      inline: true,
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
  var node = getNode(text, selection.id);
  var shape = (node && node.shape) || "rect";
  if (!rewriteNodeAppearance(lines, selection.id, shape, label)) {
    lines.push("  " + formatNodeDecl(selection.id, shape, label));
  }
  return { source: joinLines(lines), selection: selection };
}

function updateNodeShape(source, selection, shape) {
  if (!selection || selection.kind !== "node" || !selection.id) fail("select a node");
  if (!SHAPES[shape]) fail("unknown shape: " + shape);
  var text = ensureFlowchart(source);
  var lines = linesOf(text);
  var node = getNode(text, selection.id);
  var label = (node && node.label) || selection.id;
  if (!rewriteNodeAppearance(lines, selection.id, shape, label)) {
    lines.push("  " + formatNodeDecl(selection.id, shape, label));
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

function snapshotInlineNodeLooks(source) {
  var looks = Object.create(null);
  var re = /([A-Za-z][\w-]*)\s*((?:\([\[\(]|\[\[|\{\{|[\[\(\{>])[\s\S]*?(?:\)\]|\]\)|\]|\)|\}))/g;
  var m;
  while ((m = re.exec(String(source || "")))) {
    var id = m[1];
    if (/^(flowchart|graph|subgraph|end|style|classDef|class|click|linkStyle)$/i.test(id)) continue;
    looks[id] = { shape: detectShape(m[2]), label: unwrapLabel(m[2]) };
  }
  return looks;
}

function keepRemainingNodes(original, next, dropId) {
  var before = collectIds(original);
  var after = collectIds(next);
  var looks = snapshotInlineNodeLooks(original);
  var extras = [];
  Object.keys(before).forEach(function(nid) {
    if (dropId && nid === dropId) return;
    if (after[nid]) return;
    var node = getNode(original, nid);
    var look = looks[nid];
    extras.push("  " + formatNodeDecl(
      nid,
      (look && look.shape) || (node && node.shape) || "rect",
      (look && look.label) || (node && node.label) || nid
    ));
  });
  if (!extras.length) return next;
  return String(next).replace(/\s*$/, "") + "\n" + extras.join("\n") + "\n";
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
  var next = keepRemainingNodes(text, joinLines(out).replace(/\n{3,}/g, "\n\n"), id);
  return { source: next, selection: null };
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
  keepRemainingNodes,
  deleteNode,
};
