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
  return el.getAttribute("data-id") || el.getAttribute("data-edge-dom-id") || "";
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
    previewEl.querySelectorAll("g.pele-edge").forEach(function (el) {
      var eid = peleDataId(el);
      if ((sel.domId && eid === sel.domId) || (prefix && eid.indexOf(prefix) === 0)) {
        el.classList.add("flowchart-selection");
      }
    });
  }
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
      flowchartTypeEditor.innerHTML = ["default", "start", "end", "judgment"]
        .map(function (k) { return "<option value=\"" + k + "\">" + k + "</option>"; })
        .join("");
      var cur = node.nodeKind || (FlowchartEdit.kindFromShape ? FlowchartEdit.kindFromShape(node.shape, node.label) : "default");
      if (FlowchartEdit.normalizeNodeKind) cur = FlowchartEdit.normalizeNodeKind(cur);
      flowchartTypeEditor.value = cur || "default";
    }
    if (flowchartIdWrap) flowchartIdWrap.hidden = false;
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
    if (flowchartIdWrap) flowchartIdWrap.hidden = false;
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
  return flowchartHitAt(event.clientX, event.clientY, source);
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
