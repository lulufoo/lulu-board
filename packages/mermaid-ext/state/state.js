/** State / composite read + mutate. */

import { fail, linesOf, joinLines, quoteLabel } from './util.js';
import {
  ensureState,
  listStates,
  listComposites,
  parseStateHeader,
  findCompositeRange,
  collectIds,
  nextId,
  rewriteIdEverywhere,
  pruneEmptyComposites,
} from './source.js';
import { parseTransitionLine, getTransition } from './transition.js';

function getState(source, id) {
  id = String(id || "").trim();
  if (!id) return null;
  ensureState(source);
  if (id === "[*]") {
    return { kind: "pseudostate", id: "[*]", label: "[*]", key: "pseudostate:[*]", line: -1 };
  }
  var composites = listComposites(source);
  for (var c = 0; c < composites.length; c++) {
    if (composites[c].id === id) return composites[c];
  }
  var states = listStates(source);
  for (var i = 0; i < states.length; i++) {
    if (states[i].id === id) return states[i];
  }
  var lines = linesOf(source);
  for (var j = 0; j < lines.length; j++) {
    var hdr = parseStateHeader(String(lines[j] || "").trim());
    if (hdr && hdr.id === id) {
      return {
        kind: hdr.composite ? "composite" : (hdr.stereotype ? "pseudostate" : "state"),
        id: hdr.id,
        label: hdr.label,
        key: (hdr.composite ? "composite:" : hdr.stereotype ? "pseudostate:" : "state:") + hdr.id,
        line: j,
        stereotype: hdr.stereotype || "",
      };
    }
  }
  return null;
}

function formatStateAsDecl(id, label) {
  id = String(id);
  label = label == null || label === "" ? id : String(label);
  if (label === id) return "state " + id;
  return "state \"" + quoteLabel(label) + "\" as " + id;
}

function updateStateLabel(source, idOrSel, label) {
  var text = ensureState(source);
  var id = typeof idOrSel === "object" && idOrSel ? idOrSel.id : idOrSel;
  id = String(id || "").trim();
  if (!id || id === "[*]") fail("cannot rename pseudostate label via id");
  label = label == null ? "" : String(label);
  var info = getState(text, id);
  if (!info) fail("state not found: " + id);
  var lines = linesOf(text);
  var kind = info.kind;
  var selection = {
    kind: kind,
    id: id,
    label: label || id,
    key: kind + ":" + id,
  };

  if (info.line >= 0 && info.line < lines.length) {
    var raw = lines[info.line];
    var indent = (raw.match(/^(\s*)/) || ["", ""])[1];
    var hdr = parseStateHeader(String(raw).trim());
    if (hdr && hdr.composite) {
      // keep composite brace on same line if present
      var openBrace = /\{\s*$/.test(String(raw).trim()) || hdr.rawRest === "{";
      lines[info.line] = indent + formatStateAsDecl(id, label) + (openBrace ? " {" : "");
      return { source: joinLines(lines), selection: selection };
    }
    if (hdr) {
      lines[info.line] = indent + formatStateAsDecl(id, label);
      return { source: joinLines(lines), selection: selection };
    }
  }

  // No header line — insert `state "label" as id` before first use
  var insertAt = lines.length;
  for (var i = 0; i < lines.length; i++) {
    var tr = String(lines[i] || "").trim();
    if (!tr || /^(stateDiagram|direction)/i.test(tr)) continue;
    insertAt = i;
    break;
  }
  lines.splice(insertAt, 0, "  " + formatStateAsDecl(id, label));
  return { source: joinLines(lines), selection: selection };
}

function updateStateId(source, idOrSel, nextIdValue) {
  var text = ensureState(source);
  var id = typeof idOrSel === "object" && idOrSel ? idOrSel.id : idOrSel;
  id = String(id || "").trim();
  nextIdValue = String(nextIdValue || "").trim();
  if (!id || !nextIdValue) fail("state id required");
  if (id === "[*]" || nextIdValue === "[*]") fail("cannot use [*] as editable id");
  if (!/^[A-Za-z][\w-]*$/.test(nextIdValue)) fail("invalid state id: " + nextIdValue);
  if (id === nextIdValue) {
    var same = getState(text, id);
    return {
      source: text,
      selection: same
        ? { kind: same.kind, id: id, label: same.label, key: same.kind + ":" + id }
        : { kind: "state", id: id, key: "state:" + id },
    };
  }
  var ids = collectIds(text);
  if (ids[nextIdValue]) fail("state id already used: " + nextIdValue);
  var info = getState(text, id);
  if (!info) fail("state not found: " + id);
  var next = rewriteIdEverywhere(text, id, nextIdValue);
  return {
    source: next,
    selection: {
      kind: info.kind,
      id: nextIdValue,
      label: info.label === id ? nextIdValue : info.label,
      key: info.kind + ":" + nextIdValue,
    },
  };
}

function addState(source, opts) {
  opts = opts || {};
  var text = ensureState(source);
  var id = (opts.id && String(opts.id).trim()) || nextId(text, "S");
  if (!/^[A-Za-z][\w-]*$/.test(id)) fail("invalid state id: " + id);
  if (collectIds(text)[id]) fail("state id already used: " + id);
  var label = opts.label != null ? String(opts.label) : "state";
  var parent = opts.parent ? String(opts.parent).trim() : "";
  var decl = formatStateAsDecl(id, label);
  var selection = { kind: "state", id: id, label: label, key: "state:" + id };
  var lines = linesOf(text);
  if (parent) {
    var range = findCompositeRange(lines, parent);
    if (!range) fail("composite not found: " + parent);
    var childIndent = range.indent + "  ";
    lines.splice(range.end, 0, childIndent + decl);
    selection.parent = parent;
    return { source: joinLines(lines), selection: selection };
  }
  text = text.replace(/\s*$/, "") + "\n  " + decl + "\n";
  return { source: text, selection: selection };
}


function addComposite(source, opts) {
  opts = opts || {};
  var text = ensureState(source);
  var id = (opts.id && String(opts.id).trim()) || nextId(text, "G");
  if (!/^[A-Za-z][\w-]*$/.test(id)) fail("invalid composite id: " + id);
  if (collectIds(text)[id]) fail("state id already used: " + id);
  var label = opts.label != null ? String(opts.label) : "Group";
  var parent = opts.parent ? String(opts.parent).trim() : "";
  // Seed one child so Mermaid paints a real cluster (empty composites are flaky).
  var childId = nextId(text + "\n" + id + "\n", "S");
  var header = formatStateAsDecl(id, label) + " {";
  var childDecl = formatStateAsDecl(childId, "state");
  var selection = { kind: "composite", id: id, label: label, key: "composite:" + id };
  var lines = linesOf(text);
  if (parent) {
    var range = findCompositeRange(lines, parent);
    if (!range) fail("composite not found: " + parent);
    var ind = range.indent + "  ";
    lines.splice(range.end, 0, ind + header, ind + "  " + childDecl, ind + "}");
    selection.parent = parent;
    return { source: joinLines(lines), selection: selection };
  }
  text = text.replace(/\s*$/, "") + "\n  " + header + "\n    " + childDecl + "\n  }\n";
  return { source: text, selection: selection };
}

function deleteState(source, idOrSel) {
  var text = ensureState(source);
  var id = typeof idOrSel === "object" && idOrSel ? idOrSel.id : idOrSel;
  id = String(id || "").trim();
  if (!id || id === "[*]") fail("cannot delete [*] this way");
  var info = getState(text, id);
  if (!info) fail("state not found: " + id);
  var lines = linesOf(text);
  if (info.kind === "composite") {
    var range = findCompositeRange(lines, id);
    if (range) {
      lines.splice(range.start, range.end - range.start + 1);
    }
  } else if (info.line >= 0) {
    lines.splice(info.line, 1);
  }
  // drop transitions involving id
  var kept = [];
  for (var i = 0; i < lines.length; i++) {
    var tr = String(lines[i] || "").trim();
    var edge = tr.match(/^(?:\[\*\]|([A-Za-z][\w-]*))\s*(?:-->|-->>)\s*(?:\[\*\]|([A-Za-z][\w-]*))/);
    if (edge) {
      var from = tr.indexOf("[*]") === 0 ? "[*]" : edge[1];
      // re-parse properly
      var m = tr.match(/^(?:(\[\*\])|([A-Za-z][\w-]*))\s*(?:-->|-->>)\s*(?:(\[\*\])|([A-Za-z][\w-]*))/);
      if (m) {
        var f = m[1] ? "[*]" : m[2];
        var to = m[3] ? "[*]" : m[4];
        if (f === id || to === id) continue;
      }
    }
    kept.push(lines[i]);
  }
  pruneEmptyComposites(kept);
  return { source: joinLines(kept).replace(/\s*$/, "") + "\n", selection: null };
}


/** Innermost composite id containing lineIndex, or "" for root/canvas. */
function compositeParentAtLine(lines, lineIndex) {
  var best = "";
  var bestStart = -1;
  var composites = listComposites(joinLines(lines));
  for (var i = 0; i < composites.length; i++) {
    var r = composites[i].range;
    if (!r) continue;
    if (lineIndex > r.start && lineIndex < r.end && r.start > bestStart) {
      bestStart = r.start;
      best = composites[i].id;
    }
  }
  return best;
}

/** True if parent group ("" = canvas) already has a [*] --> start edge. */
function hasStart(source, parentId) {
  parentId = parentId ? String(parentId).trim() : "";
  var lines = linesOf(ensureState(source));
  for (var i = 0; i < lines.length; i++) {
    var tr = parseTransitionLine(lines[i], i);
    if (!tr || tr.from !== "[*]") continue;
    if (compositeParentAtLine(lines, i) === parentId) return true;
  }
  return false;
}

function firstStateIdInGroup(source, parentId) {
  parentId = parentId ? String(parentId).trim() : "";
  var lines = linesOf(ensureState(source));
  var range = parentId ? findCompositeRange(lines, parentId) : null;
  var from = range ? range.start + 1 : 0;
  var to = range ? range.end : lines.length;
  var i;
  for (i = from; i < to; i++) {
    if (compositeParentAtLine(lines, i) !== parentId) continue;
    var hdr = parseStateHeader(String(lines[i] || "").trim());
    if (hdr && !hdr.composite && hdr.id && hdr.id !== parentId) return hdr.id;
  }
  for (i = from; i < to; i++) {
    if (compositeParentAtLine(lines, i) !== parentId) continue;
    var tr = parseTransitionLine(lines[i], i);
    if (!tr) continue;
    if (tr.to && tr.to !== "[*]") return tr.to;
    if (tr.from && tr.from !== "[*]") return tr.from;
  }
  return "";
}

/**
 * Add start [*] --> opts.to in parent group ("" = canvas/root).
 * Requires opts.to (selected state). Only one start per group;
 * refuses if [*] already points to that state anywhere.
 */
function addStart(source, opts) {
  opts = opts || {};
  var text = ensureState(source);
  var toId = opts.to ? String(opts.to).trim() : "";
  if (!toId || toId === "[*]") fail("select a state to point start at");
  var parent = opts.parent ? String(opts.parent).trim() : "";
  if (hasStart(text, parent)) fail("this group already has a start [*]");
  if (getTransition(text, "[*]", toId)) fail("start already points to " + toId);
  if (toId === parent) fail("cannot point start at the group itself");
  var edge = "[*] --> " + toId;
  var selection = {
    kind: "transition",
    from: "[*]",
    to: toId,
    label: "",
    key: "transition:[*]:" + toId,
  };
  var lines = linesOf(text);
  if (parent) {
    var range = findCompositeRange(lines, parent);
    if (!range) fail("composite not found: " + parent);
    var ind = range.indent + "  ";
    lines.splice(range.end, 0, ind + edge);
    text = joinLines(lines);
  } else {
    text = text.replace(/\s*$/, "") + "\n  " + edge + "\n";
  }
  var added = getTransition(text, "[*]", toId);
  if (added) {
    selection.line = added.line;
    selection.key = "transition:[*]:" + toId + "#" + added.line;
  }
  return { source: text, selection: selection };
}

export {
  getState,
  updateStateLabel,
  updateStateId,
  addState,
  addComposite,
  addStart,
  hasStart,
  deleteState,
  formatStateAsDecl,
};
