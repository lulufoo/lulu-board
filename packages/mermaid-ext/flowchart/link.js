/** Link parse / mutate. */

import { fail, linesOf, joinLines, escapeRegExp } from './util.js';
import { ensureFlowchart, collectIds } from './source.js';

function addLink(source, fromId, toId, label, stroke) {
  var text = ensureFlowchart(source);
  fromId = String(fromId || "").trim();
  toId = String(toId || "").trim();
  if (!fromId || !toId) fail("link needs source and target node ids");
  if (fromId === toId) fail("a link needs two different nodes");
  var ids = collectIds(text);
  if (!ids[fromId]) fail("unknown node: " + fromId);
  if (!ids[toId]) fail("unknown node: " + toId);
  var arrow = stroke === "dotted" || stroke === "dashed" ? "-.->" : "-->";
  var line;
  if (label != null && String(label).trim()) {
    line = "  " + fromId + " " + arrow.replace(">", "|" + String(label).trim().replace(/\|/g, "/") + "|> ").replace("|> ", "| ") ;
    // fix: A -.->|lab| B
    if (arrow === "-->") line = "  " + fromId + " -->|" + String(label).trim().replace(/\|/g, "/") + "| " + toId;
    else line = "  " + fromId + " -.->|" + String(label).trim().replace(/\|/g, "/") + "| " + toId;
  } else {
    line = "  " + fromId + " " + arrow + " " + toId;
  }
  text = text.replace(/\s*$/, "") + "\n" + line + "\n";
  return {
    source: text,
    selection: { kind: "link", from: fromId, to: toId, key: "link:" + fromId + ":" + toId },
  };
}

function findLinkLine(lines, from, to) {
  // Allow inline node shapes: A["Start"] -->|go| B["End"]
  var re = new RegExp(
    "^\\s*" + escapeRegExp(from) + "\\b(?:\\s*(?:\\[[^\\]]*\\]|\\([^)]*\\)|\\{[^}]*\\}))?\\s*(-->|---|==>|o--|x--|<--|-.->|-\\.->)[^\\n]*\\b" + escapeRegExp(to) + "\\b"
  );
  for (var i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) return i;
  }
  var loose = new RegExp(
    "\\b" + escapeRegExp(from) + "\\b[\\s\\S]*?(-->|---|==>|-.->|-\\.->)[\\s\\S]*?\\b" + escapeRegExp(to) + "\\b"
  );
  for (var j = 0; j < lines.length; j++) {
    var line = lines[j];
    if (/^\s*subgraph\b/i.test(line) || /^\s*(style|classDef|class|click|linkStyle)\b/i.test(line)) continue;
    if (loose.test(line)) return j;
  }
  return -1;
}

function parseLinkLine(line, from, to) {
  var arrow = "-->";
  var stroke = "solid";
  if (/-\.->/.test(line) || /\.\.-/.test(line)) {
    arrow = "-.->";
    stroke = "dotted";
  } else if (/==>/.test(line)) arrow = "==>";
  else if (/---/.test(line) && !/-->/.test(line)) arrow = "---";
  var label = "";
  var m = String(line).match(/\|([^|]*)\|/);
  if (m) label = m[1];
  return { from: from, to: to, label: label, stroke: stroke, arrow: arrow };
}

function getLink(source, from, to) {
  var lines = linesOf(source);
  var idx = findLinkLine(lines, from, to);
  if (idx < 0) return null;
  return Object.assign({ line: idx }, parseLinkLine(lines[idx], from, to));
}

function formatLinkLine(indent, from, to, label, stroke) {
  var dotted = stroke === "dotted" || stroke === "dashed";
  if (label != null && String(label).trim()) {
    var lab = String(label).trim().replace(/\|/g, "/");
    return indent + from + (dotted ? " -.->|" : " -->|") + lab + "| " + to;
  }
  return indent + from + (dotted ? " -.-> " : " --> ") + to;
}

function updateLinkLabel(source, selection, label) {
  if (!selection || selection.kind !== "link") fail("select a link");
  var text = ensureFlowchart(source);
  var lines = linesOf(text);
  var idx = findLinkLine(lines, selection.from, selection.to);
  if (idx < 0) fail("selected link was not found in source");
  var info = parseLinkLine(lines[idx], selection.from, selection.to);
  var indent = (lines[idx].match(/^\s*/) || [""])[0];
  lines[idx] = formatLinkLine(indent, selection.from, selection.to, label, info.stroke);
  return { source: joinLines(lines), selection: selection };
}

function updateLinkStroke(source, selection, stroke) {
  if (!selection || selection.kind !== "link") fail("select a link");
  var text = ensureFlowchart(source);
  var lines = linesOf(text);
  var idx = findLinkLine(lines, selection.from, selection.to);
  if (idx < 0) fail("selected link was not found in source");
  var info = parseLinkLine(lines[idx], selection.from, selection.to);
  var indent = (lines[idx].match(/^\s*/) || [""])[0];
  var nextStroke = stroke === "dashed" || stroke === "dotted" ? "dotted" : "solid";
  lines[idx] = formatLinkLine(indent, selection.from, selection.to, info.label, nextStroke);
  return { source: joinLines(lines), selection: selection };
}

function deleteLink(source, selection) {
  if (!selection || selection.kind !== "link") fail("select a link before deleting");
  var text = ensureFlowchart(source);
  var lines = linesOf(text);
  var idx = findLinkLine(lines, selection.from, selection.to);
  if (idx < 0) fail("selected link was not found in source");
  lines.splice(idx, 1);
  return { source: joinLines(lines), selection: null };
}

export {
  addLink,
  findLinkLine,
  parseLinkLine,
  getLink,
  formatLinkLine,
  updateLinkLabel,
  updateLinkStroke,
  deleteLink,
};
