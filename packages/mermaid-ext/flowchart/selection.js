/** DOM hit → mermaid selection. */

import { resolveSubgraphRef } from './subgraph.js';
import { collectIds, isEmptySubgraph } from './source.js';
import { getLink } from './link.js';

/** Mermaid 11 edge ids look like L_From_To_0 (from/to may contain underscores). */
function parseEdgeDomId(eid, source) {
  var id = String(eid || "");
  var m = id.match(/^L_(.+)_(\d+)$/);
  if (!m) return null;
  var body = m[1];
  var ids = Object.keys(collectIds(source || "") || {});
  // Prefer longer ids first so Foo_Bar wins over Foo when both exist.
  ids.sort(function (a, b) { return b.length - a.length; });
  for (var i = 0; i < ids.length; i++) {
    var from = ids[i];
    var prefix = from + "_";
    if (body.indexOf(prefix) !== 0) continue;
    var rest = body.slice(prefix.length);
    for (var j = 0; j < ids.length; j++) {
      var to = ids[j];
      if (rest === to) {
        return { kind: "link", from: from, to: to, key: "link:" + from + ":" + to, domId: id };
      }
    }
  }
  // Fallback: split on last underscore-ish simple pattern From_To
  var simple = body.match(/^([A-Za-z][\w-]*)_([A-Za-z][\w-]*)$/);
  if (simple) {
    return { kind: "link", from: simple[1], to: simple[2], key: "link:" + simple[1] + ":" + simple[2], domId: id };
  }
  return null;
}

function linkFromEdgeEl(edge, source) {
  if (!edge) return null;
  var eid = edge.id || (edge.getAttribute && edge.getAttribute("id")) || "";
  var parsed = parseEdgeDomId(eid, source);
  if (parsed) return parsed;
  var title = edge.querySelector && edge.querySelector("title");
  if (title && title.textContent) {
    var tm = String(title.textContent).match(/([A-Za-z][\w-]*)\s*(?:-->|==>|-.->|—|->|-\s*)\s*([A-Za-z][\w-]*)/);
    if (tm) return { kind: "link", from: tm[1], to: tm[2], key: "link:" + tm[1] + ":" + tm[2], domId: eid || undefined };
  }
  return null;
}

/** Map edgeLabel click → link via label text + nearby path id. */
function linkFromEdgeLabelEl(labelEl, source) {
  if (!labelEl || source == null) return null;
  var text = String(labelEl.textContent || "").replace(/\s+/g, " ").trim();
  var root = labelEl.ownerSVGElement || labelEl.closest && labelEl.closest("svg");
  if (root) {
    // Prefer labeled path whose getLink label matches
    var paths = root.querySelectorAll("path.flowchart-link, g.edgePath, path.edge-thickness-normal");
    var i;
    if (text) {
      for (i = 0; i < paths.length; i++) {
        var hit = linkFromEdgeEl(paths[i].tagName && paths[i].tagName.toLowerCase() === "path" ? paths[i] : paths[i], source);
        if (!hit) continue;
        var info = getLink(source, hit.from, hit.to);
        if (info && String(info.label || "").trim() === text) return hit;
      }
    }
    // Unlabeled / ambiguous: if exactly one edge path, use it when label empty
    if (!text && paths.length === 1) {
      return linkFromEdgeEl(paths[0], source);
    }
  }
  return null;
}

function selectionFromDom(el, source) {
  if (!el || !el.closest) return null;

  var hitPath = el.closest && el.closest("path.mermaid-edge-hit");
  if (hitPath) {
    var hid = hitPath.getAttribute("data-edge-dom-id") || hitPath.id || "";
    var fromHit = parseEdgeDomId(hid, source);
    if (fromHit) return fromHit;
  }
  var edge = el.closest("path.flowchart-link, g.edgePath, g.flowchart-link, path.edge-thickness-normal.flowchart-link");
  if (edge) {
    var link = linkFromEdgeEl(edge, source);
    if (link) return link;
  }

  var edgeLabel = el.closest("g.edgeLabel, span.edgeLabel, .edgeLabel");
  if (edgeLabel) {
    var fromLabel = linkFromEdgeLabelEl(edgeLabel, source);
    if (fromLabel) return fromLabel;
  }

  function nodeIdFromEl(node) {
    var nid = node.id || "";
    var nm = String(nid).match(/^flowchart-([A-Za-z][\w-]*)-\d+$/);
    if (!nm) nm = String(nid).match(/^flowchart-([A-Za-z][\w-]*)-/);
    if (!nm) nm = String(nid).match(/^([A-Za-z][\w-]*)$/);
    if (!nm && node.getAttribute) {
      var did = node.getAttribute("data-id") || node.getAttribute("data-node") || "";
      if (did) nm = [null, did];
    }
    return nm ? { id: nm[1], domId: nid } : null;
  }

  var node = el.closest("g.node");
  if (node) {
    var parsed = nodeIdFromEl(node);
    if (parsed) {
      // Mermaid draws *empty* subgraphs as a normal node (id = subgraph id, label = title).
      // Treat that stand-in as a subgraph so it can be selected / receive Node inserts.
      if (source != null && source !== "" && isEmptySubgraph(source, parsed.id)) {
        return {
          kind: "subgraph",
          id: parsed.id,
          key: "subgraph:" + parsed.id,
          domId: parsed.domId,
          emptyStandIn: true,
        };
      }
      return { kind: "node", id: parsed.id, key: "node:" + parsed.id, domId: parsed.domId };
    }
  }

  function subgraphFromClusterEl(cluster) {
    if (!cluster) return null;
    var cid = cluster.id || "";
    var cm = String(cid).match(/^flowchart-([A-Za-z][\w-]*)-\d+$/);
    if (!cm) cm = String(cid).match(/^flowchart-([A-Za-z][\w-]*)-/);
    if (!cm) cm = String(cid).match(/^cluster-([A-Za-z][\w-]*)/);
    if (!cm) cm = String(cid).match(/^([A-Za-z][\w-]*)$/);
    var sid = cm ? cm[1] : "";
    if (!sid || /^(flowchart|cluster|root|subgraph)$/i.test(sid)) {
      var titleEl = cluster.querySelector && cluster.querySelector("title");
      if (titleEl && titleEl.textContent) {
        var raw = String(titleEl.textContent).trim();
        var tm2 = raw.match(/^([A-Za-z][\w-]*)/);
        if (tm2 && !/^(flowchart|cluster|root|subgraph)$/i.test(tm2[1])) sid = tm2[1];
      }
    }
    if (source != null && source !== "") {
      sid = resolveSubgraphRef(source, sid, cid) || sid;
    }
    if (!sid) return null;
    return { kind: "subgraph", id: sid, key: "subgraph:" + sid, domId: cid || undefined };
  }

  var cluster = el.closest("g.cluster");
  if (cluster) {
    var hit = subgraphFromClusterEl(cluster);
    if (hit) return hit;
  }
  var clusterLabel = el.closest("g.cluster-label, g.clusterTitle, .cluster-label");
  if (clusterLabel) {
    var cid2 = clusterLabel.id || "";
    var hint = "";
    var lm = String(cid2).match(/(?:cluster-label-|flowchart-)?([A-Za-z][\w-]*)/);
    if (lm && !/^(cluster|label|flowchart|root)$/i.test(lm[1])) hint = lm[1];
    var sibling = clusterLabel.previousElementSibling || clusterLabel.nextElementSibling;
    if (sibling && sibling.classList && sibling.classList.contains("cluster")) {
      var fromSib = subgraphFromClusterEl(sibling);
      if (fromSib) return fromSib;
    }
    var labelText = String((clusterLabel.textContent || "")).trim().split("\n")[0].trim();
    if (!hint) hint = labelText;
    if (source != null && source !== "") {
      var resolved = resolveSubgraphRef(source, hint, cid2) || resolveSubgraphRef(source, labelText, cid2);
      if (resolved) {
        return { kind: "subgraph", id: resolved, key: "subgraph:" + resolved, domId: cid2 || undefined };
      }
    }
    var parentEl = clusterLabel.parentElement;
    // Mermaid nests label inside cluster — parent may be the cluster itself
    if (parentEl && parentEl.classList && parentEl.classList.contains("cluster")) {
      var fromParent = subgraphFromClusterEl(parentEl);
      if (fromParent) return fromParent;
    }
    var parentClusters = parentEl ? parentEl.querySelectorAll("g.cluster") : [];
    if (parentClusters && parentClusters.length === 1) {
      var only = subgraphFromClusterEl(parentClusters[0]);
      if (only) return only;
    }
  }
  return null;
}

export {
  selectionFromDom,
  parseEdgeDomId,
};
