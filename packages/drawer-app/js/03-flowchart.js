/* Flowchart toolbar + Properties. Own field IDs; do not reuse Board props. */
var selectedFlowchart = null;
var flowchartInspectGesture = null;
var flowchartLinkMode = false;
var flowchartLinkStart = null;
var flowchartPropsFill = false;

var flowchartAddSubgraphButton = document.getElementById("btnFlowchartAddSubgraph");
var flowchartAddNodeButton = document.getElementById("btnFlowchartAddNode");
var flowchartLinkButton = document.getElementById("btnFlowchartLink");
var flowchartDeleteButton = document.getElementById("btnFlowchartDelete");
var flowchartPropsFields = document.getElementById("flowchartPropsFields");
var flowchartTitleEditor = document.getElementById("flowchartTitleEditor");
var flowchartTitleLabel = document.getElementById("flowchartTitleLabel");
var flowchartTypeEditor = document.getElementById("flowchartTypeEditor");
var flowchartTypeLabel = document.getElementById("flowchartTypeLabel");
var flowchartTypeField = document.getElementById("flowchartTypeField");
var flowchartIdEditor = document.getElementById("flowchartIdEditor");
var flowchartIdLabel = document.getElementById("flowchartIdLabel");
var flowchartIdWrap = document.getElementById("flowchartIdWrap");
var flowchartDirField = document.getElementById("flowchartDirField");
var flowchartDirEditor = document.getElementById("flowchartDirEditor");
var flowchartDocTitleField = document.getElementById("flowchartDocTitleField");
var flowchartDocTitleEditor = document.getElementById("flowchartDocTitleEditor");
var flowchartPropsHint = document.getElementById("flowchartPropsHint");

function isFlowchartKind() {
  return document.documentElement.dataset.diagramKind === "flowchart";
}

function flowchartSource() {
  return velaSourceEl ? velaSourceEl.value : "";
}

function peleDataId(el) {
  if (!el || !el.getAttribute) return "";
  return el.getAttribute("data-id") || el.getAttribute("data-edge-dom-id") || el.id || "";
}

var FLOWCHART_HOVER_HALO_GAP = 3;
var FLOWCHART_SEL_HALO_GAP = 3;

function flowchartSelectionShape(g) {
  if (!g || !g.querySelector) return null;
  return g.querySelector(":scope > rect:not(.mermaid-edge-label-hit):not(.flowchart-selection-halo):not(.canvas-hover-halo), :scope > polygon, :scope > path:not(.pele-marker):not(.mermaid-edge-hit):not(.flowchart-selection-halo):not(.canvas-hover-halo), :scope > circle, :scope > ellipse");
}

function flowchartThemeRadius() {
  var host = document.documentElement;
  if (!host || !window.getComputedStyle) return NaN;
  var cs = getComputedStyle(host);
  var n = parseFloat(cs.getPropertyValue("--_r") || cs.getPropertyValue("--pele-radius") || "");
  return isFinite(n) ? n : NaN;
}

function flowchartUsedRadius(shape, axis) {
  if (!shape) return NaN;
  var attr = parseFloat(shape.getAttribute(axis) || "");
  if (isFinite(attr)) return attr;
  var cs = window.getComputedStyle ? getComputedStyle(shape) : null;
  if (cs) {
    var raw = axis === "ry"
      ? (cs.ry || cs.getPropertyValue("ry"))
      : (cs.rx || cs.getPropertyValue("rx"));
    var n = parseFloat(raw);
    if (isFinite(n)) return n;
  }
  var styleVal = (shape.style && shape.style[axis]) || "";
  var styleAttr = String(shape.getAttribute("style") || "");
  var m = styleAttr.match(new RegExp("(?:^|;)\\s*" + axis + "\\s*:\\s*([^;]+)"));
  var token = styleVal || (m ? m[1].trim() : "");
  if (token) {
    var sn = parseFloat(token);
    if (isFinite(sn)) return sn;
    if (/--_r|--pele-radius/.test(token)) {
      sn = flowchartThemeRadius();
      if (isFinite(sn)) return sn;
    }
  }
  var g = shape.parentNode;
  var cls = (g && g.getAttribute && g.getAttribute("class")) || "";
  if (/pele-shape-stadium/.test(cls)) {
    var hh = parseFloat(shape.getAttribute("height") || (cs && cs.height) || "");
    if (isFinite(hh) && hh > 0) return hh / 2;
  }
  if (/pele-shape-rect/.test(cls)) {
    if (typeof FlowchartShapes !== "undefined" && isFinite(FlowchartShapes.BOX_RX)) {
      return FlowchartShapes.BOX_RX;
    }
    return 4;
  }
  return NaN;
}

function paintFlowchartHalo(g, className) {
  if (!g) return;
  var ringClass = className || "flowchart-selection-halo";
  g.querySelectorAll("." + ringClass).forEach(function (el) { el.remove(); });
  var shape = flowchartSelectionShape(g);
  if (!shape) return;
  var halo = shape.cloneNode(true);
  halo.setAttribute("class", ringClass);
  halo.removeAttribute("id");
  halo.setAttribute("fill", "none");
  halo.setAttribute("pointer-events", "none");
  var gap = ringClass === "canvas-hover-halo" ? FLOWCHART_HOVER_HALO_GAP : FLOWCHART_SEL_HALO_GAP;
  var tag = String(shape.tagName || "").toLowerCase();
  var hostCls = (shape.parentNode && shape.parentNode.getAttribute && shape.parentNode.getAttribute("class")) || "";
  if (/pele-shape-diam/.test(hostCls) && typeof FlowchartShapes !== "undefined") {
    var cx = parseFloat(shape.getAttribute("data-flowchart-cx") || "");
    var cy = parseFloat(shape.getAttribute("data-flowchart-cy") || "");
    var a = parseFloat(shape.getAttribute("data-flowchart-a") || "");
    var b = parseFloat(shape.getAttribute("data-flowchart-b") || "");
    var r = parseFloat(shape.getAttribute("data-flowchart-r") || "");
    if (![cx, cy, a, b, r].every(isFinite) && shape.getAttribute("points")) {
      var geo = FlowchartShapes.diamondPathFromPoints(shape.getAttribute("points"));
      if (geo) {
        cx = geo.cx; cy = geo.cy; a = geo.a; b = geo.b; r = geo.r;
      }
    }
    var haloD = FlowchartShapes.diamondHaloPath(cx, cy, a, b, r, gap);
    if (haloD) {
      if (tag !== "path") {
        var doc = shape.ownerDocument || document;
        halo = doc.createElementNS("http://www.w3.org/2000/svg", "path");
        halo.setAttribute("class", ringClass);
        halo.setAttribute("fill", "none");
        halo.setAttribute("pointer-events", "none");
      }
      halo.setAttribute("d", haloD);
      halo.removeAttribute("points");
      halo.removeAttribute("transform");
      if (shape.parentNode) shape.parentNode.insertBefore(halo, shape);
      return;
    }
  }
  if (tag === "rect") {
    var x = parseFloat(shape.getAttribute("x") || 0);
    var y = parseFloat(shape.getAttribute("y") || 0);
    var w = parseFloat(shape.getAttribute("width") || 0);
    var h = parseFloat(shape.getAttribute("height") || 0);
    if (!(w > 0 && h > 0)) {
      try {
        var bb = shape.getBBox();
        x = bb.x; y = bb.y; w = bb.width; h = bb.height;
      } catch (_e) { return; }
    }
    halo.setAttribute("x", String(x - gap));
    halo.setAttribute("y", String(y - gap));
    halo.setAttribute("width", String(w + gap * 2));
    halo.setAttribute("height", String(h + gap * 2));
    var rxN = flowchartUsedRadius(shape, "rx");
    var ryN = flowchartUsedRadius(shape, "ry");
    if (isFinite(rxN)) {
      var rxNext = String(Math.max(0, rxN + gap));
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
  } else if (tag === "circle") {
    var r = parseFloat(shape.getAttribute("r") || 0);
    if (r > 0) halo.setAttribute("r", String(r + gap));
  } else if (tag === "ellipse") {
    var erx = parseFloat(shape.getAttribute("rx") || 0);
    var ery = parseFloat(shape.getAttribute("ry") || 0);
    if (erx > 0) halo.setAttribute("rx", String(erx + gap));
    if (ery > 0) halo.setAttribute("ry", String(ery + gap));
  } else if (tag === "polygon") {
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
    if (!pairs.length) return;
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
  } else {
    try {
      var box = shape.getBBox();
      var pcx = box.x + box.width / 2;
      var pcy = box.y + box.height / 2;
      var psx = box.width ? (box.width + gap * 2) / box.width : 1;
      var psy = box.height ? (box.height + gap * 2) / box.height : 1;
      halo.setAttribute("transform", "translate(" + pcx + " " + pcy + ") scale(" + psx + " " + psy + ") translate(" + (-pcx) + " " + (-pcy) + ")");
    } catch (_err) {}
  }
  if (shape.parentNode) shape.parentNode.insertBefore(halo, shape);
}

function paintFlowchartSelectionHalo(g) {
  paintFlowchartHalo(g, "flowchart-selection-halo");
}

function paintFlowchartEdgeHover(g) {
  if (!g || !g.querySelector) return;
  g.querySelectorAll(".canvas-hover-halo").forEach(function (el) { el.remove(); });
  var painted = g.querySelector(":scope > path:not(.pele-marker):not(.mermaid-edge-hit):not(.canvas-hover-halo):not(.flowchart-selection-halo)");
  if (!painted) return;
  var halo = painted.cloneNode(true);
  halo.setAttribute("class", "canvas-hover-halo");
  halo.removeAttribute("id");
  halo.setAttribute("fill", "none");
  halo.setAttribute("pointer-events", "none");
  if (painted.parentNode) painted.parentNode.insertBefore(halo, painted);
}

function clearFlowchartHoverVisual() {
  if (!previewEl) return;
  previewEl.querySelectorAll(".canvas-hover-halo").forEach(function (el) { el.remove(); });
  previewEl.querySelectorAll(".canvas-hover").forEach(function (el) {
    el.classList.remove("canvas-hover");
  });
}

function flowchartHoverHost(target) {
  if (!target || !target.closest) return null;
  return target.closest("g.pele-node, g.pele-cluster, g.pele-cluster-title, g.pele-edge, g.pele-edge-label, path.mermaid-edge-hit");
}

function applyFlowchartHover(host) {
  clearFlowchartHoverVisual();
  if (!host || !previewEl) return;
  var g = host.tagName && String(host.tagName).toLowerCase() === "path"
    ? (host.closest("g.pele-edge, g.pele-edge-label") || host)
    : host.closest("g");
  if (!g) return;
  if (g.classList.contains("canvas-selected") || g.classList.contains("flowchart-selection")) return;
  g.classList.add("canvas-hover");
  if (g.classList.contains("pele-edge") || g.classList.contains("pele-edge-label")) {
    paintFlowchartEdgeHover(g);
    return;
  }
  paintFlowchartHalo(g, "canvas-hover-halo");
}

function applyFlowchartSelectionHalos() {
  if (!previewEl) return;
  previewEl.querySelectorAll("g.pele-node.flowchart-selection, g.pele-cluster.flowchart-selection").forEach(paintFlowchartSelectionHalo);
}

function flowchartEditAction(action) {
  try {
    if (typeof FlowchartEdit === "undefined") throw new Error("FlowchartEdit missing — hard refresh (cache)");
    var result = action();
    if (!result || typeof result.source !== "string") return;
    applyFlowchartEditResult(result);
  } catch (err) {
    if (typeof showVelaError === "function") showVelaError(err instanceof Error ? err.message : String(err));
  }
}

function applyFlowchartEditResult(result) {
  if (!result || typeof result.source !== "string") return;
  velaSourceEl.value = result.source;
  selectedFlowchart = result.selection || null;
  flowchartLinkMode = false;
  flowchartLinkStart = null;
  syncFlowchartLinkChrome();
  if (typeof updateVelaChars === "function") updateVelaChars();
  if (typeof scheduleBoardSave === "function") scheduleBoardSave();
  if (typeof renderVela === "function") renderVela({ fit: false });
}

function restoreFlowchartSelection() {
  if (!isFlowchartKind()) return;
  applyFlowchartSelectionVisual();
  fillFlowchartProps();
  syncFlowchartDeleteButton();
}

function syncFlowchartDeleteButton() {
  if (!flowchartDeleteButton) return;
  flowchartDeleteButton.disabled = !selectedFlowchart;
}

function syncFlowchartLinkChrome() {
  if (flowchartLinkButton) flowchartLinkButton.classList.toggle("is-active", flowchartLinkMode);
  if (document.documentElement) {
    document.documentElement.classList.toggle("flowchart-link-mode", flowchartLinkMode);
  }
}

function flowchartDirectionOf(source) {
  if (typeof FlowchartEdit === "undefined" || typeof FlowchartEdit.getDirection !== "function") return "TD";
  return FlowchartEdit.getDirection(source || flowchartSource());
}

function showFlowchartDir(dir) {
  if (flowchartDirField) flowchartDirField.hidden = false;
  if (flowchartDirEditor) flowchartDirEditor.value = dir === "LR" ? "LR" : "TD";
}

function hideFlowchartDir() {
  if (flowchartDirField) flowchartDirField.hidden = true;
}

function flowchartTitleOf(source) {
  if (typeof FlowchartEdit === "undefined" || typeof FlowchartEdit.getTitle !== "function") return "";
  return FlowchartEdit.getTitle(source || flowchartSource());
}

function showFlowchartDocTitle() {
  if (flowchartDocTitleField) flowchartDocTitleField.hidden = false;
  if (flowchartDocTitleEditor) flowchartDocTitleEditor.value = flowchartTitleOf();
}

function hideFlowchartDocTitle() {
  if (flowchartDocTitleField) flowchartDocTitleField.hidden = true;
}

function showFlowchartPropsEmpty() {
  if (flowchartPropsFields) flowchartPropsFields.hidden = true;
  if (propsEmpty && isFlowchartKind()) {
    propsEmpty.hidden = false;
    propsEmpty.textContent = flowchartLinkMode
      ? "Link mode · click source, then target"
      : "Select a group, node, or link";
  }
  if (propsKindLabel && isFlowchartKind()) propsKindLabel.textContent = "—";
  if (isFlowchartKind()) {
    showFlowchartDocTitle();
    showFlowchartDir(flowchartDirectionOf());
  } else {
    hideFlowchartDocTitle();
    hideFlowchartDir();
  }
}

function clearFlowchartSelectionVisual() {
  if (!previewEl) return;
  clearFlowchartHoverVisual();
  previewEl.querySelectorAll(".flowchart-selection-halo").forEach(function (el) { el.remove(); });
  previewEl.querySelectorAll(".flowchart-selection, .flowchart-link-source, .canvas-selected").forEach(function (el) {
    el.classList.remove("flowchart-selection", "flowchart-link-source", "canvas-selected");
  });
}

function flowchartLinkMatches(el, sel) {
  if (!el || !sel) return false;
  var eid = peleDataId(el);
  var prefix = sel.from && sel.to ? ("L_" + sel.from + "_" + sel.to + "_") : "";
  return !!(sel.domId && eid === sel.domId) || !!(prefix && eid.indexOf(prefix) === 0);
}

function applyFlowchartSelectionVisual() {
  clearFlowchartSelectionVisual();
  if (!selectedFlowchart || !previewEl) {
    syncFlowchartDeleteButton();
    return;
  }
  var sel = selectedFlowchart;
  if (sel.kind === "node" && sel.id) {
    previewEl.querySelectorAll("g.pele-node").forEach(function (g) {
      if (peleDataId(g) === sel.id) g.classList.add("flowchart-selection", "canvas-selected");
    });
  }
  if (sel.kind === "subgraph" && sel.id) {
    previewEl.querySelectorAll("g.pele-cluster, g.pele-cluster-title").forEach(function (g) {
      if (peleDataId(g) === sel.id) g.classList.add("flowchart-selection", "canvas-selected");
    });
  }
  if (sel.kind === "link") {
    previewEl.querySelectorAll("g.pele-edge").forEach(function (el) {
      if (flowchartLinkMatches(el, sel)) el.classList.add("flowchart-selection", "canvas-selected");
    });
    previewEl.querySelectorAll("g.pele-edge-label").forEach(function (g) {
      if (flowchartLinkMatches(g, sel)) g.classList.add("flowchart-selection", "canvas-selected");
    });
  }
  applyFlowchartSelectionHalos();
  syncFlowchartDeleteButton();
}

function flowchartSelectionKey(sel) {
  return sel && sel.key ? sel.key : "";
}

function beginFlowchartInspect(sel) {
  var key = flowchartSelectionKey(sel);
  flowchartInspectGesture = { key: key, already: !!(key && key === flowchartSelectionKey(selectedFlowchart)) };
}

function consumeFlowchartInspect(sel) {
  var gesture = flowchartInspectGesture;
  flowchartInspectGesture = null;
  var key = flowchartSelectionKey(sel);
  return !!(gesture && gesture.already && gesture.key && gesture.key === key);
}

function inspectFlowchartSelection() {
  if (flowchartLinkMode) return;
  if (typeof openPropsPanel === "function") openPropsPanel();
}

function clearFlowchartSelection() {
  flowchartInspectGesture = null;
  selectedFlowchart = null;
  flowchartLinkStart = null;
  clearFlowchartSelectionVisual();
  syncFlowchartDeleteButton();
  showFlowchartPropsEmpty();
}

function setFlowchartLinkMode(active) {
  var on = !!active;
  var wasOn = flowchartLinkMode;
  flowchartLinkMode = on;
  flowchartLinkStart = null;
  syncFlowchartLinkChrome();
  if (on) {
    flowchartInspectGesture = null;
    selectedFlowchart = null;
    clearFlowchartSelectionVisual();
    syncFlowchartDeleteButton();
    showFlowchartPropsEmpty();
    setStatus("Link mode · click source node, then target");
    return;
  }
  if (wasOn) setStatus("Link mode off");
}

function clearFlowchartInteraction() {
  flowchartLinkMode = false;
  flowchartLinkStart = null;
  syncFlowchartLinkChrome();
  clearFlowchartSelection();
}

function flowchartLinkPick(selection) {
  if (!flowchartLinkMode || !selection || selection.kind !== "node") return false;
  if (!flowchartLinkStart) {
    flowchartLinkStart = selection;
    selectedFlowchart = selection;
    applyFlowchartSelectionVisual();
    previewEl.querySelectorAll("g.pele-node").forEach(function (g) {
      if (peleDataId(g) === selection.id) g.classList.add("flowchart-link-source");
    });
    setStatus("Source " + selection.id + " · click target");
    return true;
  }
  if (flowchartLinkStart.id === selection.id) {
    setStatus("Pick a different target node", true);
    return true;
  }
  flowchartEditAction(function () {
    return FlowchartEdit.addLink(flowchartSource(), flowchartLinkStart.id, selection.id);
  });
  return true;
}

function fillFlowchartProps() {
  if (!isFlowchartKind()) return;
  if (!selectedFlowchart || typeof FlowchartEdit === "undefined") {
    showFlowchartPropsEmpty();
    return;
  }
  flowchartPropsFill = true;
  try {
    fillFlowchartPropsBody();
  } finally {
    flowchartPropsFill = false;
  }
}

function fillFlowchartPropsBody() {
  if (propsEmpty) propsEmpty.hidden = true;
  if (propsFields) propsFields.hidden = true;
  if (flowchartPropsFields) flowchartPropsFields.hidden = false;
  var kind = selectedFlowchart.kind;
  if (propsKindLabel) propsKindLabel.textContent = kind;
  if (kind === "node") {
    var node = FlowchartEdit.getNode(flowchartSource(), selectedFlowchart.id) || {
      id: selectedFlowchart.id,
      label: selectedFlowchart.id,
      shape: "rect",
      nodeKind: "default",
    };
    if (flowchartTitleLabel) flowchartTitleLabel.textContent = "Label";
    if (flowchartTitleEditor) flowchartTitleEditor.value = node.label || "";
    if (flowchartTypeField) flowchartTypeField.hidden = false;
    if (flowchartTypeLabel) flowchartTypeLabel.textContent = "Type";
    if (flowchartTypeEditor) {
      flowchartTypeEditor.innerHTML = [
        { value: "default", label: "default" },
        { value: "start", label: "start" },
        { value: "end", label: "end" },
        { value: "judgment", label: "judgment" },
      ].map(function (k) { return "<option value=\"" + k.value + "\">" + k.label + "</option>"; }).join("");
      var cur = node.nodeKind || (FlowchartEdit.kindFromShape ? FlowchartEdit.kindFromShape(node.shape, node.label) : "default");
      if (FlowchartEdit.normalizeNodeKind) cur = FlowchartEdit.normalizeNodeKind(cur);
      flowchartTypeEditor.value = cur || "default";
    }
    if (flowchartIdWrap) flowchartIdWrap.hidden = true;
    if (flowchartIdEditor) flowchartIdEditor.value = node.id || selectedFlowchart.id;
    hideFlowchartDocTitle();
    hideFlowchartDir();
    if (flowchartPropsHint) flowchartPropsHint.textContent = "Type changes the shape: default box, start/end rounded, judgment diamond";
    return;
  }
  if (kind === "link") {
    var link = FlowchartEdit.getLink(flowchartSource(), selectedFlowchart.from, selectedFlowchart.to) || { label: "", stroke: "solid" };
    if (flowchartTitleLabel) flowchartTitleLabel.textContent = "Title";
    if (flowchartTitleEditor) flowchartTitleEditor.value = link.label || "";
    if (flowchartTypeField) flowchartTypeField.hidden = false;
    if (flowchartTypeLabel) flowchartTypeLabel.textContent = "Stroke";
    if (flowchartTypeEditor) {
      flowchartTypeEditor.innerHTML = '<option value="solid">solid</option><option value="dotted">dotted</option>';
      flowchartTypeEditor.value = (link.stroke === "dotted" || link.stroke === "dashed") ? "dotted" : "solid";
    }
    if (flowchartIdWrap) flowchartIdWrap.hidden = true;
    hideFlowchartDocTitle();
    hideFlowchartDir();
    if (flowchartPropsHint) flowchartPropsHint.textContent = "Edit the link title and stroke";
    return;
  }
  if (kind === "subgraph") {
    var sg = FlowchartEdit.getSubgraph(flowchartSource(), selectedFlowchart.id) || { id: selectedFlowchart.id, title: selectedFlowchart.id };
    if (flowchartTitleLabel) flowchartTitleLabel.textContent = "Title";
    if (flowchartTitleEditor) flowchartTitleEditor.value = sg.title || "";
    if (flowchartTypeField) flowchartTypeField.hidden = true;
    if (flowchartIdWrap) flowchartIdWrap.hidden = true;
    if (flowchartIdEditor) flowchartIdEditor.value = sg.id || selectedFlowchart.id;
    hideFlowchartDocTitle();
    showFlowchartDir(sg.direction || flowchartDirectionOf());
    if (flowchartPropsHint) flowchartPropsHint.textContent = "Group selected · Node adds inside this group";
  }
}

function commitFlowchartTitle() {
  if (flowchartPropsFill || !selectedFlowchart || typeof FlowchartEdit === "undefined") return;
  var next = flowchartTitleEditor ? flowchartTitleEditor.value : "";
  if (selectedFlowchart.kind === "node") {
    flowchartEditAction(function () { return FlowchartEdit.updateNodeLabel(flowchartSource(), selectedFlowchart, next); });
  } else if (selectedFlowchart.kind === "link") {
    flowchartEditAction(function () { return FlowchartEdit.updateLinkLabel(flowchartSource(), selectedFlowchart, next); });
  } else if (selectedFlowchart.kind === "subgraph") {
    flowchartEditAction(function () { return FlowchartEdit.updateSubgraphTitle(flowchartSource(), selectedFlowchart, next); });
  }
}

function commitFlowchartDocTitle() {
  if (flowchartPropsFill || selectedFlowchart || typeof FlowchartEdit === "undefined") return;
  if (typeof FlowchartEdit.updateTitle !== "function") return;
  var next = flowchartDocTitleEditor ? String(flowchartDocTitleEditor.value || "").trim() : "";
  if (next === flowchartTitleOf()) return;
  flowchartEditAction(function () { return FlowchartEdit.updateTitle(flowchartSource(), next); });
}

function commitFlowchartDirection() {
  if (flowchartPropsFill || typeof FlowchartEdit === "undefined") return;
  var next = flowchartDirEditor ? String(flowchartDirEditor.value || "").trim() : "TD";
  if (selectedFlowchart && selectedFlowchart.kind === "subgraph") {
    flowchartEditAction(function () { return FlowchartEdit.updateSubgraphDirection(flowchartSource(), selectedFlowchart, next); });
    return;
  }
  if (selectedFlowchart) return;
  flowchartEditAction(function () { return FlowchartEdit.updateDirection(flowchartSource(), next); });
}

function commitFlowchartType() {
  if (flowchartPropsFill || !selectedFlowchart || typeof FlowchartEdit === "undefined") return;
  var next = flowchartTypeEditor ? String(flowchartTypeEditor.value || "").trim() : "";
  if (selectedFlowchart.kind === "node") {
    flowchartEditAction(function () { return FlowchartEdit.updateNodeKind(flowchartSource(), selectedFlowchart, next); });
  } else if (selectedFlowchart.kind === "link") {
    flowchartEditAction(function () { return FlowchartEdit.updateLinkStroke(flowchartSource(), selectedFlowchart, next); });
  }
}

function commitFlowchartId() {
  if (flowchartPropsFill || !selectedFlowchart || typeof FlowchartEdit === "undefined") return;
  var next = flowchartIdEditor ? String(flowchartIdEditor.value || "").trim() : "";
  if (!next) return;
  if (selectedFlowchart.kind === "node") {
    flowchartEditAction(function () { return FlowchartEdit.updateNodeId(flowchartSource(), selectedFlowchart, next); });
  } else if (selectedFlowchart.kind === "subgraph") {
    flowchartEditAction(function () { return FlowchartEdit.updateSubgraphId(flowchartSource(), selectedFlowchart, next); });
  }
}

function selectFlowchartHit(sel) {
  if (!sel) {
    clearFlowchartInteraction();
    return;
  }
  if (flowchartLinkMode) setFlowchartLinkMode(false);
  beginFlowchartInspect(sel);
  selectedFlowchart = sel;
  applyFlowchartSelectionVisual();
  fillFlowchartProps();
  setStatus("Selected " + sel.kind + (sel.id ? (" " + sel.id) : (sel.from && sel.to ? (" " + sel.from + "→" + sel.to) : "")));
}

function flowchartHitAt(x, y, source) {
  if (typeof document.elementsFromPoint !== "function") return null;
  var stack = document.elementsFromPoint(x, y) || [];
  var i;
  for (i = 0; i < stack.length; i += 1) {
    var hit = FlowchartEdit.selectionFromDom(stack[i], source);
    if (hit) return hit;
  }
  return null;
}

function flowchartSelectionFromEvent(event) {
  if (typeof FlowchartEdit === "undefined" || typeof FlowchartEdit.selectionFromDom !== "function") return null;
  var source = flowchartSource();
  var sel = FlowchartEdit.selectionFromDom(event.target, source);
  if (sel) return sel;
  if (event.clientX == null || event.clientY == null) return null;
  return flowchartHitAt(event.clientX, event.clientY, source);
}

function flowchartEventOnChrome(event) {
  return !!(event.target.closest && event.target.closest(".top-float, .menu, .sheet, .vela-dock, .zoom-float, .props-panel, button, input, textarea, select"));
}

function flowchartHitSelect(event) {
  if (!isFlowchartKind()) return false;
  if (flowchartEventOnChrome(event)) return false;
  var sel = flowchartSelectionFromEvent(event);
  if (flowchartLinkMode) {
    if (sel && sel.kind === "node") {
      event.preventDefault();
      event.stopPropagation();
      flowchartLinkPick(sel);
      return true;
    }
    return false;
  }
  if (event.type === "pointerdown") {
    if (!sel) return false;
    selectFlowchartHit(sel);
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  if (event.type === "click") {
    if (!sel) return false;
    if (consumeFlowchartInspect(sel)) inspectFlowchartSelection();
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  if (event.type === "dblclick") {
    if (!sel) return false;
    selectFlowchartHit(sel);
    inspectFlowchartSelection();
    if (flowchartTitleEditor) {
      flowchartTitleEditor.focus();
      flowchartTitleEditor.select();
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  return !!sel;
}

if (flowchartAddNodeButton) {
  flowchartAddNodeButton.onclick = function () {
    if (!isFlowchartKind()) return;
    setFlowchartLinkMode(false);
    var opts = {};
    if (selectedFlowchart && selectedFlowchart.kind === "subgraph" && selectedFlowchart.id) opts.parent = selectedFlowchart.id;
    else clearFlowchartSelection();
    flowchartEditAction(function () {
      var result = FlowchartEdit.addNode(flowchartSource(), opts);
      if (opts.parent) result.selection = { kind: "subgraph", id: opts.parent, key: "subgraph:" + opts.parent };
      return result;
    });
  };
}
if (flowchartAddSubgraphButton) {
  flowchartAddSubgraphButton.onclick = function () {
    if (!isFlowchartKind()) return;
    clearFlowchartInteraction();
    flowchartEditAction(function () { return FlowchartEdit.addSubgraph(flowchartSource()); });
  };
}
if (flowchartLinkButton) {
  flowchartLinkButton.onclick = function () {
    if (!isFlowchartKind()) return;
    setFlowchartLinkMode(!flowchartLinkMode);
  };
}
if (flowchartDeleteButton) {
  flowchartDeleteButton.onclick = function () {
    if (!isFlowchartKind() || !selectedFlowchart) return;
    setFlowchartLinkMode(false);
    flowchartEditAction(function () { return FlowchartEdit.deleteSelection(flowchartSource(), selectedFlowchart); });
  };
}
if (flowchartTitleEditor) {
  flowchartTitleEditor.addEventListener("change", commitFlowchartTitle);
  flowchartTitleEditor.addEventListener("blur", commitFlowchartTitle);
}
if (flowchartTypeEditor) flowchartTypeEditor.addEventListener("change", commitFlowchartType);
if (flowchartDocTitleEditor) {
  flowchartDocTitleEditor.addEventListener("change", commitFlowchartDocTitle);
  flowchartDocTitleEditor.addEventListener("blur", commitFlowchartDocTitle);
}
if (flowchartDirEditor) flowchartDirEditor.addEventListener("change", commitFlowchartDirection);
if (flowchartIdEditor) {
  flowchartIdEditor.addEventListener("change", commitFlowchartId);
  flowchartIdEditor.addEventListener("blur", commitFlowchartId);
}

document.addEventListener("keydown", function (event) {
  if (!isFlowchartKind()) return;
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  if (!selectedFlowchart) return;
  var target = event.target;
  if (target === velaSourceEl || (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
  event.preventDefault();
  flowchartEditAction(function () { return FlowchartEdit.deleteSelection(flowchartSource(), selectedFlowchart); });
});

if (previewEl) {
  previewEl.addEventListener("pointerdown", function (event) {
    if (event.button !== 0) return;
    flowchartHitSelect(event);
  }, true);
  previewEl.addEventListener("click", function (event) {
    flowchartHitSelect(event);
  }, true);
  previewEl.addEventListener("dblclick", function (event) {
    flowchartHitSelect(event);
  }, true);
  previewEl.addEventListener("pointerover", function (event) {
    if (!isFlowchartKind()) return;
    applyFlowchartHover(flowchartHoverHost(event.target));
  });
  previewEl.addEventListener("pointerout", function (event) {
    if (!isFlowchartKind()) return;
    var next = event.relatedTarget;
    if (next && previewEl.contains(next) && flowchartHoverHost(next)) return;
    clearFlowchartHoverVisual();
  });
}

document.addEventListener("pointerdown", function (event) {
  if (!isFlowchartKind() || event.button !== 0) return;
  if (!event.target.closest) return;
  if (event.target.closest(".flowchart-edit-tools, .props-panel, .vela-dock, .sheet, #flowchartPropsFields, input, textarea, select, label")) return;
  if (event.target.closest(".top-float, .zoom-float, .shell-search, .menu")) {
    clearFlowchartInteraction();
  }
}, true);

function flowchartCanvasHit(target) {
  return !!(target && target.closest && target.closest("g.pele-node, g.pele-cluster, g.pele-cluster-title, g.pele-edge, g.pele-edge-label, path.mermaid-edge-hit"));
}

if (typeof CanvasInteraction !== "undefined" && typeof CanvasInteraction.registerKind === "function") {
  CanvasInteraction.registerKind("flowchart", {
    isHit: flowchartCanvasHit,
    clear: clearFlowchartInteraction,
  });
}
