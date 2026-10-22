/* Mermaid-level SVG halo. Flowchart and later mindmap call this; Board stays on HTML outline. */
var MERMAID_HOVER_HALO_GAP = 3;
var MERMAID_SEL_HALO_GAP = 3;
var MERMAID_HALO_NS = "http://www.w3.org/2000/svg";

function mermaidHaloGap(className) {
  return className === "canvas-hover-halo" ? MERMAID_HOVER_HALO_GAP : MERMAID_SEL_HALO_GAP;
}

function mermaidClearHalo(g, className) {
  if (!g || !g.querySelectorAll) return;
  g.querySelectorAll("." + className).forEach(function (el) { el.remove(); });
}

function mermaidDefaultSelectionShape(g) {
  if (!g || !g.querySelector) return null;
  return g.querySelector(
    ":scope > rect:not(.mermaid-edge-label-hit):not(.flowchart-selection-halo):not(.mermaid-selection-halo):not(.canvas-hover-halo), " +
    ":scope > polygon, " +
    ":scope > path:not(.pele-marker):not(.mermaid-edge-hit):not(.flowchart-selection-halo):not(.mermaid-selection-halo):not(.canvas-hover-halo), " +
    ":scope > circle, :scope > ellipse"
  );
}

function mermaidHaloBase(el, ringClass) {
  el.setAttribute("class", ringClass);
  el.removeAttribute("id");
  el.setAttribute("fill", "none");
  el.setAttribute("pointer-events", "none");
}

function mermaidPaintBBoxHalo(host, ringClass, gap) {
  if (!host) return;
  try {
    var box = host.getBBox();
    if (!(box.width > 0 || box.height > 0)) return;
    var doc = host.ownerDocument || document;
    var halo = doc.createElementNS(MERMAID_HALO_NS, "rect");
    mermaidHaloBase(halo, ringClass);
    halo.setAttribute("x", String(box.x - gap));
    halo.setAttribute("y", String(box.y - gap));
    halo.setAttribute("width", String(box.width + gap * 2));
    halo.setAttribute("height", String(box.height + gap * 2));
    if (host.firstChild) host.insertBefore(halo, host.firstChild);
    else host.appendChild(halo);
  } catch (_e) {}
}

function mermaidExpandShapeHalo(shape, halo, gap, usedRadius) {
  var tag = String(shape.tagName || "").toLowerCase();
  if (tag === "rect") {
    var x = parseFloat(shape.getAttribute("x") || 0);
    var y = parseFloat(shape.getAttribute("y") || 0);
    var w = parseFloat(shape.getAttribute("width") || 0);
    var h = parseFloat(shape.getAttribute("height") || 0);
    if (!(w > 0 && h > 0)) {
      try {
        var bb = shape.getBBox();
        x = bb.x; y = bb.y; w = bb.width; h = bb.height;
      } catch (_e) { return false; }
    }
    halo.setAttribute("x", String(x - gap));
    halo.setAttribute("y", String(y - gap));
    halo.setAttribute("width", String(w + gap * 2));
    halo.setAttribute("height", String(h + gap * 2));
    var rxN = typeof usedRadius === "function" ? usedRadius(shape, "rx") : parseFloat(shape.getAttribute("rx") || "");
    var ryN = typeof usedRadius === "function" ? usedRadius(shape, "ry") : parseFloat(shape.getAttribute("ry") || "");
    var rxNext;
    if (isFinite(rxN)) {
      rxNext = String(Math.max(0, rxN + gap));
      halo.setAttribute("rx", rxNext);
      halo.style.rx = rxNext + "px";
    }
    if (isFinite(ryN)) {
      var ryNext = String(Math.max(0, ryN + gap));
      halo.setAttribute("ry", ryNext);
      halo.style.ry = ryNext + "px";
    } else if (isFinite(rxN)) {
      halo.setAttribute("ry", rxNext);
      halo.style.ry = rxNext + "px";
    }
    return true;
  }
  if (tag === "circle") {
    var r = parseFloat(shape.getAttribute("r") || 0);
    if (r > 0) halo.setAttribute("r", String(r + gap));
    return true;
  }
  if (tag === "ellipse") {
    var erx = parseFloat(shape.getAttribute("rx") || 0);
    var ery = parseFloat(shape.getAttribute("ry") || 0);
    if (erx > 0) halo.setAttribute("rx", String(erx + gap));
    if (ery > 0) halo.setAttribute("ry", String(ery + gap));
    return true;
  }
  if (tag === "polygon") {
    var raw = String(shape.getAttribute("points") || "").trim().split(/\s+/);
    var pairs = [];
    var i;
    for (i = 0; i < raw.length; i += 1) {
      var xy = raw[i].split(",");
      if (xy.length < 2) continue;
      var px = parseFloat(xy[0]);
      var py = parseFloat(xy[1]);
      if (!isFinite(px) || !isFinite(py)) continue;
      pairs.push([px, py]);
    }
    if (!pairs.length) return false;
    var minX = pairs[0][0], maxX = pairs[0][0], minY = pairs[0][1], maxY = pairs[0][1];
    for (i = 1; i < pairs.length; i += 1) {
      if (pairs[i][0] < minX) minX = pairs[i][0];
      if (pairs[i][0] > maxX) maxX = pairs[i][0];
      if (pairs[i][1] < minY) minY = pairs[i][1];
      if (pairs[i][1] > maxY) maxY = pairs[i][1];
    }
    var cx = (minX + maxX) / 2;
    var cy = (minY + maxY) / 2;
    var bw = maxX - minX || 1;
    var bh = maxY - minY || 1;
    halo.setAttribute("points", pairs.map(function (p) {
      return (cx + (p[0] - cx) * ((bw + gap * 2) / bw)) + "," + (cy + (p[1] - cy) * ((bh + gap * 2) / bh));
    }).join(" "));
    return true;
  }
  try {
    var box = shape.getBBox();
    var pcx = box.x + box.width / 2;
    var pcy = box.y + box.height / 2;
    var psx = box.width ? (box.width + gap * 2) / box.width : 1;
    var psy = box.height ? (box.height + gap * 2) / box.height : 1;
    halo.setAttribute("transform", "translate(" + pcx + " " + pcy + ") scale(" + psx + " " + psy + ") translate(" + (-pcx) + " " + (-pcy) + ")");
    return true;
  } catch (_err) {
    return false;
  }
}

function mermaidPaintHalo(g, className, opts) {
  opts = opts || {};
  if (!g) return;
  var ringClass = className || "mermaid-selection-halo";
  mermaidClearHalo(g, ringClass);
  var gap = typeof opts.gap === "number" ? opts.gap : mermaidHaloGap(ringClass);
  var findShape = opts.findShape || mermaidDefaultSelectionShape;
  var shape = findShape(g);
  if (typeof opts.paintSpecial === "function" && opts.paintSpecial(g, shape, ringClass, gap)) return;
  if (!shape) {
    if (opts.bboxFallback) mermaidPaintBBoxHalo(g, ringClass, gap);
    return;
  }
  var halo = shape.cloneNode(true);
  mermaidHaloBase(halo, ringClass);
  if (!mermaidExpandShapeHalo(shape, halo, gap, opts.usedRadius)) return;
  if (shape.parentNode) shape.parentNode.insertBefore(halo, shape);
}
