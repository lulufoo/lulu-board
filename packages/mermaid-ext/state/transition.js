/** Transition parse / read / mutate. */

import { fail, linesOf, joinLines } from './util.js';
import { ensureState, collectIds, findCompositeRange } from './source.js';

function transitionKey(from, to, line) {
  var base = "transition:" + from + ":" + to;
  if (line == null || line < 0) return base;
  return base + "#" + line;
}

function parseTransitionLine(line, lineIndex) {
  var trimmed = String(line || "").trim();
  if (!trimmed || trimmed.indexOf("%%") === 0) return null;
  var m = trimmed.match(/^(?:(\[\*\])|([A-Za-z][\w-]*))\s*(-->|-->>)\s*(?:(\[\*\])|([A-Za-z][\w-]*))\s*(?::\s*(.*))?$/);
  if (!m) return null;
  var from = m[1] ? "[*]" : m[2];
  var arrow = m[3];
  var to = m[4] ? "[*]" : m[5];
  var label = m[6] != null ? String(m[6]).trim() : "";
  var lineNo = lineIndex == null ? -1 : lineIndex;
  return {
    kind: "transition",
    from: from,
    to: to,
    label: label,
    arrow: arrow,
    key: transitionKey(from, to, lineNo),
    line: lineNo,
    fromKind: from === "[*]" ? "pseudostate" : "state",
    toKind: to === "[*]" ? "pseudostate" : "state",
  };
}

function listTransitions(source) {
  var lines = linesOf(source);
  var out = [];
  for (var i = 0; i < lines.length; i++) {
    var t = parseTransitionLine(lines[i], i);
    if (t) out.push(t);
  }
  return out;
}

function getTransition(source, from, to, lineMaybe) {
  if (typeof from === "object" && from && from.kind === "transition") {
    lineMaybe = from.line;
    to = from.to;
    from = from.from;
  }
  from = String(from || "").trim();
  to = String(to || "").trim();
  if (!from || !to) return null;
  ensureState(source);
  var list = listTransitions(source);
  var line = lineMaybe == null || lineMaybe === "" ? -1 : +lineMaybe;
  if (line >= 0) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].line === line && list[i].from === from && list[i].to === to) return list[i];
    }
  }
  for (var j = 0; j < list.length; j++) {
    if (list[j].from === from && list[j].to === to) return list[j];
  }
  return null;
}

function formatTransitionLine(indent, from, to, label, arrow) {
  arrow = arrow || "-->";
  var core = from + " " + arrow + " " + to;
  if (label != null && String(label).trim()) core += ": " + String(label).trim();
  return indent + core;
}

function updateTransitionLabel(source, fromOrSel, toMaybe, labelMaybe) {
  var text = ensureState(source);
  var from, to, label, lineHint = -1;
  if (typeof fromOrSel === "object" && fromOrSel && fromOrSel.kind === "transition") {
    from = fromOrSel.from;
    to = fromOrSel.to;
    lineHint = fromOrSel.line != null ? fromOrSel.line : -1;
    label = toMaybe;
  } else {
    from = fromOrSel;
    to = toMaybe;
    label = labelMaybe;
  }
  from = String(from || "").trim();
  to = String(to || "").trim();
  label = label == null ? "" : String(label);
  var t = getTransition(text, from, to, lineHint);
  if (!t) fail("transition not found: " + from + " → " + to);
  var lines = linesOf(text);
  var indent = (String(lines[t.line] || "").match(/^(\s*)/) || ["", ""])[1];
  lines[t.line] = formatTransitionLine(indent, from, to, label, t.arrow);
  return {
    source: joinLines(lines),
    selection: {
      kind: "transition",
      from: from,
      to: to,
      label: label,
      line: t.line,
      key: transitionKey(from, to, t.line),
    },
  };
}

function addTransition(source, fromId, toId, label, opts) {
  opts = opts || {};
  var text = ensureState(source);
  fromId = String(fromId || "").trim();
  toId = String(toId || "").trim();
  if (!fromId || !toId) fail("transition needs from and to");
  if (fromId === toId && fromId !== "[*]") fail("transition needs two different endpoints");
  var ids = collectIds(text);
  if (fromId !== "[*]" && !ids[fromId]) fail("unknown state: " + fromId);
  if (toId !== "[*]" && !ids[toId]) fail("unknown state: " + toId);
  if (getTransition(text, fromId, toId)) fail("transition already exists: " + fromId + " → " + toId);
  var line = formatTransitionLine("  ", fromId, toId, label, "-->");
  var parent = opts.parent ? String(opts.parent).trim() : "";
  if (parent) {
    var lines = linesOf(text);
    var range = findCompositeRange(lines, parent);
    if (!range) fail("composite not found: " + parent);
    lines.splice(range.end, 0, range.indent + "  " + line.trim());
    text = joinLines(lines);
  } else {
    text = text.replace(/\s*$/, "") + "\n" + line + "\n";
  }
  var added = getTransition(text, fromId, toId);
  return {
    source: text,
    selection: {
      kind: "transition",
      from: fromId,
      to: toId,
      label: label == null ? "" : String(label),
      line: added ? added.line : -1,
      key: transitionKey(fromId, toId, added ? added.line : -1),
    },
  };
}

function deleteTransition(source, fromOrSel, toMaybe) {
  var text = ensureState(source);
  var from, to, lineHint = -1;
  if (typeof fromOrSel === "object" && fromOrSel && fromOrSel.kind === "transition") {
    from = fromOrSel.from;
    to = fromOrSel.to;
    lineHint = fromOrSel.line != null ? fromOrSel.line : -1;
  } else {
    from = fromOrSel;
    to = toMaybe;
  }
  var t = getTransition(text, from, to, lineHint);
  if (!t) fail("transition not found: " + from + " → " + to);
  var lines = linesOf(text);
  lines.splice(t.line, 1);
  return { source: joinLines(lines).replace(/\s*$/, "") + "\n", selection: null };
}

export {
  transitionKey,
  parseTransitionLine,
  listTransitions,
  getTransition,
  updateTransitionLabel,
  addTransition,
  deleteTransition,
};
