/** DOM hit → mermaid selection. Pele SVG only (`data-id`, `.pele-*`). */

import { resolveSubgraphRef } from './subgraph.js';
import { collectIds, isEmptySubgraph } from './source.js';
import { getLink } from './link.js';

/** Pele / Mermaid edge ids look like L_From_To_0 (from/to may contain underscores). */
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
  var simple = body.match(/^([A-Za-z][\w-]*)_([A-Za-z][\w-]*)$/);
  if (simple) {
    return { kind: "link", from: simple[1], to: simple[2], key: "link:" + simple[1] + ":" + simple[2], domId: id };
  }
  return null;
}

function attr(el, name) {
  if (!el) return "";
  if (el.getAttribute) return el.getAttribute(name) || "";
  return "";
}

function edgeDomId(edge) {
  var n = edge;
  while (n && n !== n.parentNode) {
    var id = attr(n, "data-id") || attr(n, "id") || n.id || "";
    if (id && /^L_/.test(id)) return id;
    n = n.parentElement || n.parentNode;
  }
  return attr(edge, "data-id") || attr(edge, "id") || (edge && edge.id) || "";
}

function linkFromEdgeEl(edge, source) {
  if (!edge) return null;
  var parsed = parseEdgeDomId(edgeDomId(edge), source);
  if (parsed) return parsed;
  var title = edge.querySelector && edge.querySelector("title");
  if (title && title.textContent) {
    var tm = String(title.textContent).match(/([A-Za-z][\w-]*)\s*(?:-->|==>|-.->|—|->|-\s*)\s*([A-Za-z][\w-]*)/);
    if (tm) return { kind: "link", from: tm[1], to: tm[2], key: "link:" + tm[1] + ":" + tm[2], domId: edgeDomId(edge) || undefined };
  }
  return null;
}

function linkFromEdgeLabelEl(labelEl, source) {
  if (!labelEl || source == null) return null;
  var fromId = parseEdgeDomId(edgeDomId(labelEl), source);
  if (fromId) return fromId;
  var text = String(labelEl.textContent || "").replace(/\s+/g, " ").trim();
  var root = labelEl.ownerSVGElement || (labelEl.closest && labelEl.closest("svg"));
  if (root) {
    var paths = root.querySelectorAll("g.pele-edge");
    var i;
    if (text) {
      for (i = 0; i < paths.length; i++) {
        var hit = linkFromEdgeEl(paths[i], source);
        if (!hit) continue;
        var info = getLink(source, hit.from, hit.to);
        if (info && String(info.label || "").trim() === text) return hit;
      }
    }
    if (!text && paths.length === 1) {
      return linkFromEdgeEl(paths[0], source);
    }
  }
  return null;
}

function selectionFromDom(el, source) {
  if (!el || !el.closest) return null;

  var hitPath = el.closest("path.mermaid-edge-hit");
  if (hitPath) {
    var hid = attr(hitPath, "data-edge-dom-id") || hitPath.id || "";
    var fromHit = parseEdgeDomId(hid, source);
    if (fromHit) return fromHit;
  }
  var edge = el.closest("g.pele-edge");
  if (edge) {
    var link = linkFromEdgeEl(edge, source);
    if (link) return link;
  }

  var edgeLabel = el.closest("g.pele-edge-label");
  if (edgeLabel) {
    var fromLabel = linkFromEdgeLabelEl(edgeLabel, source);
    if (fromLabel) return fromLabel;
  }

  function nodeIdFromEl(node) {
    var did = attr(node, "data-id") || attr(node, "data-node") || "";
    if (did) return { id: did, domId: node.id || did };
    var nid = node.id || "";
    var nm = String(nid).match(/^([A-Za-z][\w-]*)$/);
    return nm ? { id: nm[1], domId: nid } : null;
  }

  var node = el.closest("g.pele-node");
  if (node) {
    var parsed = nodeIdFromEl(node);
    if (parsed) {
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
    var sid = attr(cluster, "data-id") || "";
    if (!sid || /^(flowchart|cluster|root|subgraph|pele)$/i.test(sid)) {
      var titleEl = cluster.querySelector && cluster.querySelector("title");
      if (titleEl && titleEl.textContent) {
        var raw = String(titleEl.textContent).trim();
        var tm2 = raw.match(/^([A-Za-z][\w-]*)/);
        if (tm2 && !/^(flowchart|cluster|root|subgraph)$/i.test(tm2[1])) sid = tm2[1];
      }
    }
    if (source != null && source !== "") {
      sid = resolveSubgraphRef(source, sid, cid || attr(cluster, "data-id")) || sid;
    }
    if (!sid) return null;
    return { kind: "subgraph", id: sid, key: "subgraph:" + sid, domId: cid || attr(cluster, "data-id") || undefined };
  }

  var cluster = el.closest("g.pele-cluster");
  if (cluster) {
    var hit = subgraphFromClusterEl(cluster);
    if (hit) return hit;
  }
  var clusterLabel = el.closest("g.pele-cluster-title");
  if (clusterLabel) {
    var fromTitle = subgraphFromClusterEl(clusterLabel);
    if (fromTitle) return fromTitle;
    var labelText = String((clusterLabel.textContent || "")).trim().split("\n")[0].trim();
    if (source != null && source !== "" && labelText) {
      var resolved = resolveSubgraphRef(source, attr(clusterLabel, "data-id") || labelText, attr(clusterLabel, "data-id"));
      if (resolved) {
        return { kind: "subgraph", id: resolved, key: "subgraph:" + resolved, domId: attr(clusterLabel, "data-id") || undefined };
      }
    }
  }
  return null;
}

export {
  selectionFromDom,
  parseEdgeDomId,
};
