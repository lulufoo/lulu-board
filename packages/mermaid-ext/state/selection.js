/** DOM hit → mermaid state selection (ELK + classic render). */

import { listTransitions } from './transition.js';
import { getState } from './state.js';

/**
 * Parse Mermaid ELK state node id: `state-S_incomplete-1` → S_incomplete
 * Start/end inside composite: `state-Sub_start-0` → { parent: Sub, pseudo: start }
 */
function parseStateDomId(domId) {
  var id = String(domId || "");
  var m = id.match(/^state-(.+)-(\d+)$/);
  if (!m) {
    if (/^[A-Za-z][\w-]*$/.test(id)) return { id: id, raw: id, kind: "state" };
    return null;
  }
  var body = m[1];
  var startEnd = body.match(/^(.+)_(start|end)$/);
  if (startEnd) {
    return {
      id: "[*]",
      parent: startEnd[1],
      pseudo: startEnd[2],
      raw: id,
      kind: "pseudostate",
    };
  }
  return { id: body, raw: id, kind: "state" };
}


/** Innermost statediagram-cluster whose bbox contains the element's center (ELK keeps nodes under g.nodes). */
function clusterParentFromDom(el) {
  if (!el || !el.ownerSVGElement) return "";
  var svg = el.ownerSVGElement;
  var br;
  try { br = el.getBoundingClientRect(); } catch (_e) { return ""; }
  if (!br || !br.width && !br.height) return "";
  var cx = br.left + br.width / 2;
  var cy = br.top + br.height / 2;
  var best = "";
  var bestArea = Infinity;
  var clusters = svg.querySelectorAll("g.statediagram-cluster");
  for (var i = 0; i < clusters.length; i++) {
    var c = clusters[i];
    if (!c.id) continue;
    var cb;
    try { cb = c.getBoundingClientRect(); } catch (_e2) { continue; }
    if (cx < cb.left || cx > cb.right || cy < cb.top || cy > cb.bottom) continue;
    var area = Math.max(1, cb.width) * Math.max(1, cb.height);
    if (area < bestArea) {
      bestArea = area;
      best = c.id;
    }
  }
  return best;
}

function transitionFromEdgeIndex(source, edgeIndex) {
  var list = listTransitions(source || "");
  if (edgeIndex < 0 || edgeIndex >= list.length) return null;
  var t = list[edgeIndex];
  return {
    kind: "transition",
    from: t.from,
    to: t.to,
    label: t.label,
    key: t.key,
    line: t.line,
  };
}

function transitionFromLabelText(source, text) {
  text = String(text || "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  var list = listTransitions(source || "");
  var hits = [];
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].label || "").trim() === text) hits.push(list[i]);
  }
  if (hits.length !== 1) return null;
  var t = hits[0];
  return {
    kind: "transition",
    from: t.from,
    to: t.to,
    label: t.label,
    key: t.key,
    line: t.line,
  };
}

/**
 * @param {Element} el
 * @param {string} source stateDiagram source (needed for transition map)
 */
function selectionFromDom(el, source) {
  if (!el || !el.closest) return null;
  source = source == null ? "" : String(source);

  // Wide hit clone for short [*] edges (installStateEdgeHits).
  var edgeHit = el.closest && el.closest("path.mermaid-edge-hit");
  if (edgeHit) {
    var hitRoot = edgeHit.ownerSVGElement || (edgeHit.closest && edgeHit.closest("svg"));
    var hitPaths = hitRoot ? hitRoot.querySelectorAll("path.mermaid-edge-hit") : [];
    var hitIdx = -1;
    for (var hi = 0; hi < hitPaths.length; hi++) {
      if (hitPaths[hi] === edgeHit) { hitIdx = hi; break; }
    }
    var fromHit = transitionFromEdgeIndex(source, hitIdx);
    if (fromHit) {
      fromHit.domId = edgeHit.getAttribute("data-edge-dom-id") || undefined;
      return fromHit;
    }
  }

  var path = el.closest("path.transition");
  if (path) {
    var root = path.ownerSVGElement || (path.closest && path.closest("svg"));
    var paths = root ? root.querySelectorAll("path.transition") : [];
    var idx = -1;
    for (var i = 0; i < paths.length; i++) {
      if (paths[i] === path) { idx = i; break; }
    }
    var hit = transitionFromEdgeIndex(source, idx);
    if (hit) {
      hit.domId = path.id || undefined;
      return hit;
    }
  }

  var labelEl = el.closest("g.edgeLabel");
  if (labelEl) {
    var fromLabel = transitionFromLabelText(source, labelEl.textContent);
    if (fromLabel) return fromLabel;
    // Duplicate labels (e.g. two "create" from [*]) — fall back to DOM index.
    var labelRoot = labelEl.ownerSVGElement || (labelEl.closest && labelEl.closest("svg"));
    var labels = labelRoot ? labelRoot.querySelectorAll("g.edgeLabel") : [];
    var li = -1;
    for (var j = 0; j < labels.length; j++) {
      if (labels[j] === labelEl) { li = j; break; }
    }
    var fromIdx = transitionFromEdgeIndex(source, li);
    if (fromIdx) return fromIdx;
  }

  var node = el.closest("g.node");
  if (node && node.id) {
    var parsed = parseStateDomId(node.id);
    if (parsed) {
      if (parsed.kind === "pseudostate") {
        return {
          kind: "pseudostate",
          id: "[*]",
          parent: parsed.parent || "",
          pseudo: parsed.pseudo || "start",
          key: "pseudostate:" + (parsed.parent ? parsed.parent + ":" : "") + "[*]",
          domId: node.id,
          dom: node,
        };
      }
      var info = null;
      try { info = getState(source, parsed.id); } catch (_e) { info = null; }
      if (info && info.kind === "composite") {
        return {
          kind: "composite",
          id: parsed.id,
          label: info.label,
          key: "composite:" + parsed.id,
          domId: node.id,
          dom: node,
        };
      }
      var clusterParent = "";
      try {
        var clusterEl = node.closest("g.statediagram-cluster");
        if (clusterEl && clusterEl.id) clusterParent = clusterEl.id;
      } catch (_pe) {}
      if (!clusterParent) clusterParent = clusterParentFromDom(node);
      return {
        kind: "state",
        id: parsed.id,
        label: (info && info.label) || parsed.id,
        parent: clusterParent,
        key: "state:" + parsed.id,
        domId: node.id,
        dom: node,
      };
    }
  }

  var cluster = el.closest("g.statediagram-cluster");
  if (cluster && cluster.id) {
    var cinfo = null;
    try { cinfo = getState(source, cluster.id); } catch (_e2) { cinfo = null; }
    return {
      kind: "composite",
      id: cluster.id,
      label: (cinfo && cinfo.label) || cluster.id,
      key: "composite:" + cluster.id,
      domId: cluster.id,
      dom: cluster,
    };
  }

  var group = el.closest("g.stateGroup");
  if (group && group.id) {
    var ginfo = null;
    try { ginfo = getState(source, group.id); } catch (_e3) { ginfo = null; }
    var kind = (ginfo && ginfo.kind) || "state";
    return {
      kind: kind,
      id: group.id,
      label: (ginfo && ginfo.label) || group.id,
      key: kind + ":" + group.id,
      domId: group.id,
      dom: group,
    };
  }

  return null;
}

export {
  selectionFromDom,
  parseStateDomId,
  clusterParentFromDom,
  transitionFromEdgeIndex,
  transitionFromLabelText,
};
