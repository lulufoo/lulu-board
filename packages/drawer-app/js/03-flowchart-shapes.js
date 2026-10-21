/* Flowchart node corners. Default stays a box; Start/End stay stadium. */
var FlowchartShapes = (function () {
  "use strict";

  var BOX_RX = 4;
  var DIAMOND_R = 6;

  function roundedRhombusPath(cx, cy, a, b, r) {
    var pts = [[cx, cy - b], [cx + a, cy], [cx, cy + b], [cx - a, cy]];
    var parts = [];
    var i;
    for (i = 0; i < 4; i += 1) {
      var v = pts[i];
      var p = pts[(i + 3) % 4];
      var n = pts[(i + 1) % 4];
      var l1 = Math.hypot(p[0] - v[0], p[1] - v[1]);
      var l2 = Math.hypot(n[0] - v[0], n[1] - v[1]);
      if (!(l1 > 0) || !(l2 > 0)) continue;
      var u1 = [(p[0] - v[0]) / l1, (p[1] - v[1]) / l1];
      var u2 = [(n[0] - v[0]) / l2, (n[1] - v[1]) / l2];
      var cos = Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1]));
      var half = Math.acos(cos) / 2;
      var t = Math.min(r / Math.tan(half), l1 / 2, l2 / 2);
      var s = [v[0] + u1[0] * t, v[1] + u1[1] * t];
      var e = [v[0] + u2[0] * t, v[1] + u2[1] * t];
      parts.push((i === 0 ? "M" : "L") + s[0].toFixed(2) + " " + s[1].toFixed(2)
        + " Q" + v[0].toFixed(2) + " " + v[1].toFixed(2) + " " + e[0].toFixed(2) + " " + e[1].toFixed(2));
    }
    return parts.length ? parts.join(" ") + " Z" : "";
  }

  function rhombusHalfDiagonals(W, H, r) {
    var a0 = W / 2;
    var b0 = H / 2;
    var side = Math.hypot(a0, b0);
    var sinSide = side ? b0 / side : 0;
    var sinTop = side ? a0 / side : 0;
    return {
      a: a0 + (sinSide ? r * (1 / sinSide - 1) : 0),
      b: b0 + (sinTop ? r * (1 / sinTop - 1) : 0),
    };
  }

  function parsePoints(raw) {
    var pairs = [];
    String(raw || "").trim().split(/\s+/).forEach(function (tok) {
      var xy = tok.split(",");
      if (xy.length < 2) return;
      var x = parseFloat(xy[0]);
      var y = parseFloat(xy[1]);
      if (isFinite(x) && isFinite(y)) pairs.push([x, y]);
    });
    return pairs;
  }

  function diamondGeoFromPoints(pairs, rWanted) {
    if (!pairs || pairs.length < 4) return null;
    var minX = pairs[0][0];
    var maxX = pairs[0][0];
    var minY = pairs[0][1];
    var maxY = pairs[0][1];
    var i;
    for (i = 1; i < pairs.length; i += 1) {
      if (pairs[i][0] < minX) minX = pairs[i][0];
      if (pairs[i][0] > maxX) maxX = pairs[i][0];
      if (pairs[i][1] < minY) minY = pairs[i][1];
      if (pairs[i][1] > maxY) maxY = pairs[i][1];
    }
    var W = maxX - minX;
    var H = maxY - minY;
    if (!(W > 0 && H > 0)) return null;
    var r = Math.min(isFinite(rWanted) && rWanted > 0 ? rWanted : DIAMOND_R, Math.min(W, H) / 6);
    var base = rhombusHalfDiagonals(W, H, r);
    return {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      a: base.a,
      b: base.b,
      r: r,
      W: W,
      H: H,
    };
  }

  function diamondPathFromPoints(raw, rWanted) {
    var geo = diamondGeoFromPoints(parsePoints(raw), rWanted);
    if (!geo) return null;
    geo.d = roundedRhombusPath(geo.cx, geo.cy, geo.a, geo.b, geo.r);
    return geo.d ? geo : null;
  }

  function diamondHaloPath(cx, cy, a, b, r, gap) {
    var side = Math.hypot(a, b);
    if (!(side > 0) || !(a > 0) || !(b > 0)) return "";
    var g = isFinite(gap) ? gap : 0;
    return roundedRhombusPath(cx, cy, a + g * side / b, b + g * side / a, r + g);
  }

  function stripStyleRx(shape) {
    var style = String(shape.getAttribute("style") || "");
    if (!style) return;
    style = style.replace(/(?:^|;)\s*r[xy]\s*:\s*[^;]*/gi, "").replace(/^;+|;+$/g, "").trim();
    if (style) shape.setAttribute("style", style);
    else shape.removeAttribute("style");
  }

  function bakeDefaultRectRadius(rect, rx) {
    if (!rect || !rect.setAttribute) return;
    var n = isFinite(rx) ? rx : BOX_RX;
    var token = String(n);
    rect.setAttribute("rx", token);
    rect.setAttribute("ry", token);
    stripStyleRx(rect);
  }

  function writeDiamondGeo(el, geo) {
    el.setAttribute("data-flowchart-shape", "diam");
    el.setAttribute("data-flowchart-cx", String(geo.cx));
    el.setAttribute("data-flowchart-cy", String(geo.cy));
    el.setAttribute("data-flowchart-a", String(geo.a));
    el.setAttribute("data-flowchart-b", String(geo.b));
    el.setAttribute("data-flowchart-r", String(geo.r));
  }

  function replacePolygonWithPath(poly, geo) {
    var doc = poly.ownerDocument || (typeof document !== "undefined" ? document : null);
    if (!doc || !doc.createElementNS) return;
    var path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    ["fill", "stroke", "stroke-width"].forEach(function (k) {
      var v = poly.getAttribute(k);
      if (v) path.setAttribute(k, v);
    });
    path.setAttribute("d", geo.d);
    writeDiamondGeo(path, geo);
    if (poly.parentNode) poly.parentNode.replaceChild(path, poly);
  }

  function polishDefaultRects(root) {
    root.querySelectorAll("g.pele-node.pele-shape-rect > rect").forEach(function (rect) {
      bakeDefaultRectRadius(rect, BOX_RX);
    });
  }

  function polishDiamonds(root) {
    root.querySelectorAll("g.pele-node.pele-shape-diam").forEach(function (g) {
      if (g.querySelector(":scope > path[data-flowchart-shape='diam']")) return;
      var poly = g.querySelector(":scope > polygon");
      if (!poly) return;
      var geo = diamondPathFromPoints(poly.getAttribute("points"), DIAMOND_R);
      if (!geo) return;
      replacePolygonWithPath(poly, geo);
    });
  }

  function installFlowchartEdgeHits(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll("path.mermaid-edge-hit").forEach(function (el) { el.remove(); });
    root.querySelectorAll("g.pele-edge").forEach(function (g) {
      var path = g.querySelector("path:not(.pele-marker)") || g.querySelector("path");
      if (!path || !path.parentNode) return;
      var hit = path.cloneNode(false);
      hit.removeAttribute("id");
      hit.removeAttribute("marker-end");
      hit.removeAttribute("marker-start");
      hit.removeAttribute("style");
      hit.setAttribute("class", "mermaid-edge-hit");
      var did = (g.getAttribute && g.getAttribute("data-id")) || g.id || "";
      if (did) hit.setAttribute("data-edge-dom-id", did);
      hit.setAttribute("fill", "none");
      hit.setAttribute("stroke", "transparent");
      hit.setAttribute("stroke-width", "20");
      hit.setAttribute("pointer-events", "stroke");
      path.parentNode.insertBefore(hit, path);
    });
  }

  function polishFlowchartNodeShapes(root) {
    if (!root || !root.querySelectorAll) return;
    polishDefaultRects(root);
    polishDiamonds(root);
    installFlowchartEdgeHits(root);
  }

  return {
    BOX_RX: BOX_RX,
    DIAMOND_R: DIAMOND_R,
    roundedRhombusPath: roundedRhombusPath,
    rhombusHalfDiagonals: rhombusHalfDiagonals,
    diamondPathFromPoints: diamondPathFromPoints,
    diamondHaloPath: diamondHaloPath,
    bakeDefaultRectRadius: bakeDefaultRectRadius,
    installFlowchartEdgeHits: installFlowchartEdgeHits,
    polishFlowchartNodeShapes: polishFlowchartNodeShapes,
  };
})();
if (typeof module === "object" && module.exports) module.exports = FlowchartShapes;
