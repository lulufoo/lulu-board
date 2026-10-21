/* Flowchart toolbar + Properties. Own field IDs; do not reuse Board props. */
var selectedFlowchart = null;
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
var flowchartPropsHint = document.getElementById("flowchartPropsHint");

function isFlowchartKind() {
  return document.documentElement.dataset.diagramKind === "flowchart";
}

function flowchartSource() {
  return boardSourceEl ? boardSourceEl.value : "";
}

function peleDataId(el) {
  if (!el || !el.getAttribute) return "";
  return el.getAttribute("data-id") || el.getAttribute("data-edge-dom-id") || el.id || "";
}

var FLOWCHART_SEL_HALO_GAP = 2.5;

function flowchartSelectionAccent() {
  var cs = document.documentElement && window.getComputedStyle
    ? getComputedStyle(document.documentElement)
    : null;
  return (cs && cs.getPropertyValue("--accent").trim()) || "#db4c84";
}

function flowchartSelectionShape(g) {
  if (!g || !g.querySelector) return null;
  return g.querySelector(":scope > rect:not(.mermaid-edge-label-hit):not(.flowchart-selection-halo), :scope > polygon, :scope > path:not(.pele-marker):not(.mermaid-edge-hit), :scope > circle, :scope > ellipse");
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
    var theme = flowchartThemeRadius();
    if (isFinite(theme)) return theme;
  }
  return NaN;
}

function paintFlowchartSelectionHalo(g) {
  if (!g) return;
  g.querySelectorAll(".flowchart-selection-halo").forEach(function (el) { el.remove(); });
  var shape = flowchartSelectionShape(g);
  if (!shape) return;
  var halo = shape.cloneNode(true);
  halo.setAttribute("class", "flowchart-selection-halo");
  halo.removeAttribute("id");
  halo.setAttribute("fill", "none");
  halo.setAttribute("pointer-events", "none");
  var gap = FLOWCHART_SEL_HALO_GAP;
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
    if (typeof showBoardError === "function") showBoardError(err instanceof Error ? err.message : String(err));
  }
}

function applyFlowchartEditResult(result) {
  if (!result || typeof result.source !== "string") return;
  boardSourceEl.value = result.source;
  selectedFlowchart = result.selection || null;
  flowchartLinkStart = null;
  if (typeof updateBoardChars === "function") updateBoardChars();
  if (typeof scheduleBoardSave === "function") scheduleBoardSave();
  if (typeof renderBoard === "function") renderBoard({ fit: false });
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

function clearFlowchartSelectionVisual() {
  if (!previewEl) return;
  previewEl.querySelectorAll(".flowchart-selection-halo").forEach(function (el) { el.remove(); });
  previewEl.querySelectorAll(".flowchart-selection, .flowchart-link-source").forEach(function (el) {
    el.classList.remove("flowchart-selection", "flowchart-link-source");
  });
}

function applyFlowchartSelectionVisual() {
  clearFlowchartSelectionVisual();
  if (!selectedFlowchart || !previewEl) return;
  var sel = selectedFlowchart;
  if (sel.kind === "node" && sel.id) {
    previewEl.querySelectorAll("g.pele-node").forEach(function (g) {
      if (peleDataId(g) === sel.id) g.classList.add("flowchart-selection");
    });
  }
  if (sel.kind === "subgraph" && sel.id) {
    previewEl.querySelectorAll("g.pele-cluster, g.pele-cluster-title").forEach(function (g) {
      if (peleDataId(g) === sel.id) g.classList.add("flowchart-selection");
    });
  }
  if (sel.kind === "link") {
    var prefix = sel.from && sel.to ? ("L_" + sel.from + "_" + sel.to + "_") : "";
    var accent = flowchartSelectionAccent();
    previewEl.querySelectorAll("g.pele-edge").forEach(function (el) {
      var eid = peleDataId(el);
      if (!((sel.domId && eid === sel.domId) || (prefix && eid.indexOf(prefix) === 0))) return;
      el.classList.add("flowchart-selection");
      var path = el.querySelector("path:not(.pele-marker):not(.mermaid-edge-hit)") || el.querySelector("path");
      if (path) {
        path.style.stroke = accent;
        path.setAttribute("stroke", accent);
      }
    });
    previewEl.querySelectorAll("g.pele-edge-label").forEach(function (g) {
      var lid = peleDataId(g);
      if ((sel.domId && lid === sel.domId) || (prefix && lid.indexOf(prefix) === 0)) {
        g.classList.add("flowchart-selection");
      }
    });
  }
  applyFlowchartSelectionHalos();
  syncFlowchartDeleteButton();
}

function clearFlowchartSelection() {
  selectedFlowchart = null;
  flowchartLinkStart = null;
  clearFlowchartSelectionVisual();
  syncFlowchartDeleteButton();
  if (flowchartPropsFields) flowchartPropsFields.hidden = true;
  if (propsEmpty && isFlowchartKind()) {
    propsEmpty.hidden = false;
    propsEmpty.textContent = "Select a node, link, or subgraph";
  }
  if (propsKindLabel && isFlowchartKind()) propsKindLabel.textContent = "—";
}

function setFlowchartLinkMode(active) {
  flowchartLinkMode = !!active;
  flowchartLinkStart = null;
  if (flowchartLinkButton) flowchartLinkButton.classList.toggle("is-active", flowchartLinkMode);
  if (flowchartLinkMode) setStatus("Link mode · click source node, then target");
  else setStatus("Link mode off");
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
  setFlowchartLinkMode(false);
  return true;
}

function fillFlowchartProps() {
  if (!isFlowchartKind()) return;
  if (!selectedFlowchart || typeof FlowchartEdit === "undefined") {
    if (flowchartPropsFields) flowchartPropsFields.hidden = true;
    if (propsEmpty) propsEmpty.hidden = false;
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
    clearFlowchartSelection();
    return;
  }
  selectedFlowchart = sel;
  applyFlowchartSelectionVisual();
  fillFlowchartProps();
  if (typeof openPropsPanel === "function") openPropsPanel();
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
  var found = flowchartHitAt(event.clientX, event.clientY, source);
  if (found) return found;
  var pads = [[0, -10], [0, 10], [-10, 0], [10, 0], [0, -18], [0, 18]];
  var p;
  for (p = 0; p < pads.length; p += 1) {
    found = flowchartHitAt(event.clientX + pads[p][0], event.clientY + pads[p][1], source);
    if (found && found.kind === "link") return found;
  }
  return null;
}

function flowchartHitSelect(event) {
  if (!isFlowchartKind()) return false;
  if (event.target.closest && event.target.closest(".top-float, .menu, .sheet, .board-dock, .zoom-float, button, input, textarea, select")) return false;
  var sel = flowchartSelectionFromEvent(event);
  if (flowchartLinkMode) {
    event.preventDefault();
    event.stopPropagation();
    if (sel && sel.kind === "node") flowchartLinkPick(sel);
    else if (!sel) setFlowchartLinkMode(false);
    return true;
  }
  if (event.type === "pointerdown") {
    selectFlowchartHit(sel);
    if (sel) {
      event.preventDefault();
      event.stopPropagation();
    }
    return !!sel;
  }
  return !!sel;
}

if (flowchartAddNodeButton) {
  flowchartAddNodeButton.onclick = function () {
    if (!isFlowchartKind()) return;
    var opts = {};
    if (selectedFlowchart && selectedFlowchart.kind === "subgraph" && selectedFlowchart.id) opts.parent = selectedFlowchart.id;
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
    if (!selectedFlowchart) return;
    flowchartEditAction(function () { return FlowchartEdit.deleteSelection(flowchartSource(), selectedFlowchart); });
  };
}
if (flowchartTitleEditor) {
  flowchartTitleEditor.addEventListener("change", commitFlowchartTitle);
  flowchartTitleEditor.addEventListener("blur", commitFlowchartTitle);
}
if (flowchartTypeEditor) flowchartTypeEditor.addEventListener("change", commitFlowchartType);
if (flowchartIdEditor) {
  flowchartIdEditor.addEventListener("change", commitFlowchartId);
  flowchartIdEditor.addEventListener("blur", commitFlowchartId);
}

document.addEventListener("keydown", function (event) {
  if (!isFlowchartKind()) return;
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  if (!selectedFlowchart) return;
  var target = event.target;
  if (target === boardSourceEl || (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
  event.preventDefault();
  flowchartEditAction(function () { return FlowchartEdit.deleteSelection(flowchartSource(), selectedFlowchart); });
});

if (previewEl) {
  previewEl.addEventListener("pointerdown", function (event) {
    if (event.button !== 0) return;
    flowchartHitSelect(event);
  }, true);
}
