/** State diagram source helpers + composite ranges. */

import { fail, linesOf, joinLines, escapeRegExp } from './util.js';

function firstDiagramKeyword(source) {
  var lines = linesOf(source);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line || line.indexOf("%%") === 0 || line.charAt(0) === "#") continue;
    if (/^---/.test(line)) continue;
    var m = line.match(/^(stateDiagram(?:-v2)?)\b/i);
    if (m) return m[1].toLowerCase();
    var other = line.match(/^[A-Za-z][\w-]*/);
    return other ? other[0] : "";
  }
  return "";
}

function isState(source) {
  var k = firstDiagramKeyword(source);
  return k === "statediagram" || k === "statediagram-v2";
}

function ensureState(source) {
  var text = String(source == null ? "" : source);
  if (!String(text).trim()) return "stateDiagram-v2\n";
  if (!isState(text)) fail("Editing is only available for stateDiagram / stateDiagram-v2");
  return text.replace(/\s*$/, "") + "\n";
}

var RESERVED = /^(state|stateDiagram|stateDiagram-v2|note|end|direction|classDef|class|style|click|[*]|TB|TD|BT|LR|RL)$/i;

/** Parse `state "Label" as Id` / `state Id` / `state Id {` header (no body). */
function parseStateHeader(line) {
  var trimmed = String(line || "").trim();
  var m;
  // state "Label" as Id  OR  state 'Label' as Id
  m = trimmed.match(/^state\s+(?:"([^"]*)"|'([^']*)')\s+as\s+([A-Za-z][\w-]*)\b(.*)$/);
  if (m) {
    var rest = String(m[4] || "").trim();
    return {
      id: m[3],
      label: m[1] != null ? m[1] : m[2],
      composite: rest.charAt(0) === "{",
      headerOnly: rest === "" || rest === "{",
      rawRest: rest,
    };
  }
  // state Id {…}  OR  state Id <<fork>>  OR  state Id
  m = trimmed.match(/^state\s+([A-Za-z][\w-]*)\b(.*)$/);
  if (m) {
    var rest2 = String(m[2] || "").trim();
    return {
      id: m[1],
      label: m[1],
      composite: rest2.charAt(0) === "{",
      headerOnly: rest2 === "" || rest2 === "{" || /^<<\w+>>/.test(rest2),
      stereotype: (rest2.match(/^<<(\w+)>>/) || [])[1] || "",
      rawRest: rest2,
    };
  }
  return null;
}

/**
 * Find composite `state Id { … }` block range (start=header line, end=`end` or closing `}` line).
 * Mermaid uses `}` on its own or `state Id {` … `}` — also supports nested via brace depth
 * when braces are used; some sources use `end` like subgraph (rare in state). Prefer `}`.
 */
function findCompositeRange(lines, id) {
  id = String(id || "").trim();
  if (!id) return null;
  var start = -1;
  var baseIndent = "";
  var depth = 0;
  var i;
  for (i = 0; i < lines.length; i++) {
    var raw = String(lines[i] || "");
    var trimmed = raw.trim();
    if (start < 0) {
      var hdr = parseStateHeader(trimmed);
      if (!hdr || hdr.id !== id || !hdr.composite) continue;
      start = i;
      baseIndent = (raw.match(/^(\s*)/) || ["", ""])[1];
      // count braces on header line
      depth = (trimmed.match(/\{/g) || []).length - (trimmed.match(/\}/g) || []).length;
      if (depth <= 0) {
        // `state Id {` then body until matching `}`
        depth = 1;
      }
      if (trimmed.indexOf("}") >= 0 && depth === 0) {
        return { start: start, end: i, indent: baseIndent, id: id };
      }
      continue;
    }
    var opens = (trimmed.match(/\{/g) || []).length;
    var closes = (trimmed.match(/\}/g) || []).length;
    // also treat lone `end` as closer when depth==1 (compat)
    if (/^end\b/i.test(trimmed) && opens === 0 && closes === 0) {
      depth -= 1;
    } else {
      depth += opens - closes;
    }
    if (depth <= 0) return { start: start, end: i, indent: baseIndent, id: id };
  }
  return null;
}

function listComposites(source) {
  var lines = linesOf(source);
  var out = [];
  var seen = Object.create(null);
  for (var i = 0; i < lines.length; i++) {
    var hdr = parseStateHeader(String(lines[i] || "").trim());
    if (!hdr || !hdr.composite || seen[hdr.id]) continue;
    seen[hdr.id] = true;
    var range = findCompositeRange(lines, hdr.id);
    out.push({
      kind: "composite",
      id: hdr.id,
      label: hdr.label,
      key: "composite:" + hdr.id,
      line: i,
      range: range,
    });
  }
  return out;
}

/**
 * Collect state / composite ids (not [*] / reserved).
 */
function collectIds(source) {
  var ids = Object.create(null);
  var lines = linesOf(source);
  var i;
  for (i = 0; i < lines.length; i++) {
    var trimmed = String(lines[i] || "").trim();
    if (!trimmed || trimmed.indexOf("%%") === 0) continue;
    var hdr = parseStateHeader(trimmed);
    if (hdr) {
      ids[hdr.id] = true;
      continue;
    }
    // Id : description (state description line)
    var desc = trimmed.match(/^([A-Za-z][\w-]*)\s*:\s+/);
    if (desc && !RESERVED.test(desc[1])) ids[desc[1]] = true;
    // transitions: from / to (skip [*])
    var edge = trimmed.match(/^(?:\[\*\]|([A-Za-z][\w-]*))\s*(-->|-->>)\s*(?:\[\*\]|([A-Za-z][\w-]*))/);
    if (edge) {
      if (edge[1]) ids[edge[1]] = true;
      if (edge[3]) ids[edge[3]] = true;
    }
  }
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

function isBlankOrComment(line) {
  var tr = String(line || "").trim();
  return !tr || tr.indexOf("%%") === 0;
}

function isCompositeBodyEmpty(lines, range) {
  if (!range) return false;
  for (var i = range.start + 1; i < range.end; i++) {
    if (!isBlankOrComment(lines[i])) return false;
  }
  return true;
}

function idUsedOutside(lines, id, range) {
  var edgeRe = /^(?:(\[\*\])|([A-Za-z][\w-]*))\s*(?:-->|-->>)\s*(?:(\[\*\])|([A-Za-z][\w-]*))/;
  for (var i = 0; i < lines.length; i++) {
    if (range && i >= range.start && i <= range.end) continue;
    var m = String(lines[i] || "").trim().match(edgeRe);
    if (!m) continue;
    var from = m[1] ? "[*]" : m[2];
    var to = m[3] ? "[*]" : m[4];
    if (from === id || to === id) return true;
  }
  return false;
}

/** Drop unused empty composites. Mermaid paints those as a naked title. */
function pruneEmptyComposites(lines) {
  var changed = true;
  while (changed) {
    changed = false;
    var composites = listComposites(joinLines(lines));
    composites.sort(function (a, b) {
      var as = a.range ? a.range.end - a.range.start : 1e9;
      var bs = b.range ? b.range.end - b.range.start : 1e9;
      return as - bs;
    });
    for (var c = 0; c < composites.length; c++) {
      var range = composites[c].range;
      if (!range || !isCompositeBodyEmpty(lines, range)) continue;
      if (idUsedOutside(lines, composites[c].id, range)) continue;
      lines.splice(range.start, range.end - range.start + 1);
      changed = true;
      break;
    }
  }
  return lines;
}

/**
 * List simple states (non-composite decls + ids only seen on transitions/descriptions).
 */
function listStates(source) {
  var lines = linesOf(source);
  var composites = Object.create(null);
  listComposites(source).forEach(function (c) { composites[c.id] = c; });
  var byId = Object.create(null);
  var i;
  for (i = 0; i < lines.length; i++) {
    var trimmed = String(lines[i] || "").trim();
    if (!trimmed || trimmed.indexOf("%%") === 0) continue;
    var hdr = parseStateHeader(trimmed);
    if (hdr) {
      if (hdr.composite) continue;
      byId[hdr.id] = {
        kind: hdr.stereotype ? "pseudostate" : "state",
        id: hdr.id,
        label: hdr.label,
        key: (hdr.stereotype ? "pseudostate:" : "state:") + hdr.id,
        stereotype: hdr.stereotype || "",
        line: i,
      };
      continue;
    }
    var desc = trimmed.match(/^([A-Za-z][\w-]*)\s*:\s+(.*)$/);
    if (desc && !RESERVED.test(desc[1]) && !composites[desc[1]]) {
      if (!byId[desc[1]]) {
        byId[desc[1]] = {
          kind: "state",
          id: desc[1],
          label: desc[1],
          key: "state:" + desc[1],
          description: desc[2],
          line: i,
        };
      } else {
        byId[desc[1]].description = desc[2];
      }
    }
  }
  // ids only referenced on edges
  Object.keys(collectIds(source)).forEach(function (id) {
    if (byId[id] || composites[id]) return;
    byId[id] = {
      kind: "state",
      id: id,
      label: id,
      key: "state:" + id,
      line: -1,
    };
  });
  return Object.keys(byId).map(function (k) { return byId[k]; });
}

export {
  firstDiagramKeyword,
  isState,
  ensureState,
  parseStateHeader,
  findCompositeRange,
  listComposites,
  listStates,
  collectIds,
  nextId,
  rewriteIdEverywhere,
  pruneEmptyComposites,
  joinLines,
  linesOf,
};
