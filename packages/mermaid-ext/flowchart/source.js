/** Flowchart source helpers + subgraph range. */

import { fail, linesOf, joinLines, escapeRegExp } from './util.js';

function firstDiagramKeyword(source) {
  var lines = linesOf(source);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line || line.indexOf("%%") === 0 || line.charAt(0) === "#") continue;
    if (/^---/.test(line)) continue;
    var m = line.match(/^(flowchart|graph)\b/i);
    if (m) return m[1].toLowerCase();
    var other = line.match(/^[A-Za-z][\w-]*/);
    return other ? other[0] : "";
  }
  return "";
}

function isFlowchart(source) {
  var k = firstDiagramKeyword(source);
  return k === "flowchart" || k === "graph";
}

function ensureFlowchart(source) {
  var text = String(source == null ? "" : source);
  if (!String(text).trim()) return "flowchart TD\n";
  if (!isFlowchart(text)) fail("Editing is only available for flowchart (or graph) diagrams");
  return text.replace(/\s*$/, "") + "\n";
}

function collectIds(source) {
  var ids = Object.create(null);
  var text = String(source || "");
  var re = /\b([A-Za-z][\w-]*)\b\s*(?:\[|\(|\{|>|\[\[|\[\(|\[\/|\[\\|subgraph\b)/g;
  var m;
  while ((m = re.exec(text))) {
    var id = m[1];
    if (/^(flowchart|graph|subgraph|end|direction|style|classDef|class|click|linkStyle|TB|TD|BT|LR|RL)$/i.test(id)) continue;
    ids[id] = true;
  }
  var edgeRe = /(^|[\s;])([A-Za-z][\w-]*)\s*(?:-->|---|-\.-|==>|--o|--x|<--|x--|o--)/gm;
  while ((m = edgeRe.exec(text))) ids[m[2]] = true;
  var edgeRe2 = /(?:-->|---|-\.->|==>|--o|--x|<-->)\s*([A-Za-z][\w-]*)/g;
  while ((m = edgeRe2.exec(text))) ids[m[1]] = true;
  var sg = /^\s*subgraph\s+([A-Za-z][\w-]*)\b/gm;
  while ((m = sg.exec(text))) ids[m[1]] = true;
  return ids;
}

function nextId(source, prefix) {
  var ids = collectIds(source);
  var n = 1;
  while (ids[prefix + n]) n += 1;
  return prefix + n;
}

function rewriteIdEverywhere(text, fromId, toId) {
  var re = new RegExp("\\b" + escapeRegExp(fromId) + "\\b", "g");
  return String(text).replace(re, toId);
}


function isEmptySubgraph(source, id) {
  id = String(id || "").trim();
  if (!id) return false;
  var lines = linesOf(source);
  var range = findSubgraphRange(lines, id);
  if (!range) return false;
  for (var i = range.start + 1; i < range.end; i++) {
    if (String(lines[i] || "").trim()) return false;
  }
  return true;
}

function findSubgraphRange(lines, id) {
  id = String(id || "").trim();
  if (!id) return null;
  var startRe = new RegExp("^(\\s*)subgraph\\s+" + escapeRegExp(id) + "\\b");
  var start = -1;
  var baseIndent = "";
  var depth = 0;
  for (var i = 0; i < lines.length; i++) {
    var trimmed = String(lines[i] || "").trim();
    if (start < 0) {
      var m = String(lines[i] || "").match(startRe);
      if (!m) continue;
      start = i;
      baseIndent = m[1];
      depth = 1;
      continue;
    }
    if (/^subgraph\b/i.test(trimmed)) depth += 1;
    else if (/^end\b/i.test(trimmed)) {
      depth -= 1;
      if (depth === 0) return { start: start, end: i, indent: baseIndent };
    }
  }
  return null;
}

export {
  firstDiagramKeyword,
  isFlowchart,
  ensureFlowchart,
  collectIds,
  nextId,
  rewriteIdEverywhere,
  findSubgraphRange,
  isEmptySubgraph,
};
