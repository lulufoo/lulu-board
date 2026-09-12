/** Subgraph parse / mutate + deleteSelection. */

import { fail, linesOf, joinLines, quoteLabel, escapeRegExp } from './util.js';
import { ensureFlowchart, collectIds, nextId, rewriteIdEverywhere, findSubgraphRange } from './source.js';
import { deleteNode } from './node.js';
import { deleteLink } from './link.js';
import { unwrapLabel } from './kinds.js';


function listSubgraphs(source) {
  var lines = linesOf(source);
  var out = [];
  for (var i = 0; i < lines.length; i++) {
    var m = String(lines[i] || "").match(/^(\s*)subgraph\s+([A-Za-z][\w-]*)\b(.*)$/);
    if (!m) continue;
    var id = m[2];
    var rest = String(m[3] || "").trim();
    var title = id;
    if (rest) {
      if (rest.charAt(0) === "[") title = unwrapLabel(rest);
      else title = rest.replace(/^["']|["']$/g, "");
    }
    out.push({ id: id, title: String(title == null ? id : title), line: i, indent: m[1] });
  }
  return out;
}

/** Map a DOM hint (id or visible title like "Group") to a real subgraph id in source. */
function resolveSubgraphRef(source, hint, domId) {
  var graphs = listSubgraphs(source);
  if (!graphs.length) return null;
  hint = String(hint || "").trim();
  domId = String(domId || "").trim();
  var i, g;
  if (hint) {
    for (i = 0; i < graphs.length; i++) {
      if (graphs[i].id === hint) return graphs[i].id;
    }
  }
  // flowchart-<id>-<n> already parsed into hint; also try extracting from raw domId
  var cm = domId.match(/^flowchart-([A-Za-z][\w-]*)(?:-\d+)?$/);
  if (cm) {
    for (i = 0; i < graphs.length; i++) {
      if (graphs[i].id === cm[1]) return graphs[i].id;
    }
  }
  if (hint) {
    var hits = [];
    for (i = 0; i < graphs.length; i++) {
      if (String(graphs[i].title).trim() === hint) hits.push(graphs[i].id);
    }
    if (hits.length === 1) return hits[0];
  }
  // Single subgraph diagram: any cluster hit maps to it
  if (graphs.length === 1) return graphs[0].id;
  return hint || null;
}

function addSubgraph(source, opts) {
  var text = ensureFlowchart(source);
  var id = (opts && opts.id && String(opts.id).trim()) || nextId(text, "G");
  if (collectIds(text)[id]) fail("subgraph id already used: " + id);
  var title = opts && opts.title != null ? opts.title : "Group";
  // Seed one child node so Mermaid paints a real g.cluster (empty subgraphs render as a node stand-in).
  var childId = nextId(text + "\n" + id + "\n", "N");
  var block =
    "  subgraph " + id + "[\"" + quoteLabel(title) + "\"]\n" +
    "    " + childId + "[\"Node\"]\n" +
    "  end";
  text = text.replace(/\s*$/, "") + "\n" + block + "\n";
  return { source: text, selection: { kind: "subgraph", id: id, key: "subgraph:" + id } };
}

function getSubgraph(source, id) {
  id = String(id || "").trim();
  var lines = linesOf(source);
  var startRe = new RegExp("^(\\s*)subgraph\\s+" + escapeRegExp(id) + "\\b(.*)$");
  for (var i = 0; i < lines.length; i++) {
    var m = lines[i].match(startRe);
    if (!m) continue;
    var rest = m[2].trim();
    var title = id;
    if (rest) {
      if (rest.charAt(0) === "[") title = unwrapLabel(rest);
      else title = rest.replace(/^["']|["']$/g, "");
    }
    return { id: id, title: title, line: i, indent: m[1] };
  }
  return null;
}

function updateSubgraphTitle(source, selection, title) {
  if (!selection || selection.kind !== "subgraph" || !selection.id) fail("select a subgraph");
  var text = ensureFlowchart(source);
  var lines = linesOf(text);
  var startRe = new RegExp("^(\\s*)subgraph\\s+" + escapeRegExp(selection.id) + "\\b.*$");
  var found = false;
  for (var i = 0; i < lines.length; i++) {
    var m = lines[i].match(startRe);
    if (!m) continue;
    lines[i] = m[1] + "subgraph " + selection.id + "[\"" + quoteLabel(title) + "\"]";
    found = true;
    break;
  }
  if (!found) fail("subgraph not found");
  return { source: joinLines(lines), selection: selection };
}

function updateSubgraphId(source, selection, nextId) {
  if (!selection || selection.kind !== "subgraph" || !selection.id) fail("select a subgraph");
  nextId = String(nextId || "").trim();
  if (!/^[A-Za-z][\w-]*$/.test(nextId)) fail("invalid subgraph id");
  if (nextId === selection.id) return { source: ensureFlowchart(source), selection: selection };
  var text = ensureFlowchart(source);
  if (collectIds(text)[nextId]) fail("id already used: " + nextId);
  var lines = linesOf(text);
  var startRe = new RegExp("^(\\s*)subgraph\\s+" + escapeRegExp(selection.id) + "\\b(.*)$");
  for (var i = 0; i < lines.length; i++) {
    var m = lines[i].match(startRe);
    if (!m) continue;
    lines[i] = m[1] + "subgraph " + nextId + m[2];
    break;
  }
  // also rewrite edge endpoints that used subgraph id
  text = joinLines(lines);
  text = rewriteIdEverywhere(text, selection.id, nextId);
  return { source: text, selection: { kind: "subgraph", id: nextId, key: "subgraph:" + nextId } };
}

function deleteSubgraph(source, selection) {
  if (!selection || selection.kind !== "subgraph" || !selection.id) fail("select a subgraph before deleting");
  var text = ensureFlowchart(source);
  var id = selection.id;
  var lines = linesOf(text);
  var out = [];
  var depth = 0;
  var removing = false;
  var startRe = new RegExp("^\\s*subgraph\\s+" + escapeRegExp(id) + "\\b");
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var trimmed = line.trim();
    if (!removing && startRe.test(line)) {
      removing = true;
      depth = 1;
      continue;
    }
    if (removing) {
      if (/^subgraph\b/i.test(trimmed)) depth += 1;
      else if (/^end\b/i.test(trimmed)) {
        depth -= 1;
        if (depth <= 0) {
          removing = false;
          continue;
        }
      }
      continue;
    }
    out.push(line);
  }
  return { source: joinLines(out).replace(/\n{3,}/g, "\n\n"), selection: null };
}

function deleteSelection(source, selection) {
  if (!selection) fail("nothing selected");
  if (selection.kind === "node") return deleteNode(source, selection);
  if (selection.kind === "link") return deleteLink(source, selection);
  if (selection.kind === "subgraph") return deleteSubgraph(source, selection);
  fail("unsupported selection");
}

export {
  listSubgraphs,
  resolveSubgraphRef,
  addSubgraph,
  getSubgraph,
  updateSubgraphTitle,
  updateSubgraphId,
  deleteSubgraph,
  deleteSelection,
};
