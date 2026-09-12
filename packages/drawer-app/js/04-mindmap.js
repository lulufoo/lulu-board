/* drawer-app/04-mindmap.js — lines 2297-2625 of former inline module */
function isMindmapMode() {
  return document.documentElement.dataset.drawerMode === "mermaid"
    && document.documentElement.dataset.mermaidMindmap === "1";
}

function syncMindmapDeleteButton() {
  if (!mindmapDeleteButton) return;
  var on = isMindmapMode() && selectedMermaid && selectedMermaid.kind === "topic";
  var isRoot = false;
  try {
    if (on && typeof MindmapEdit !== "undefined" && MindmapEdit.getTopic) {
      var info = MindmapEdit.getTopic(sourceEl.value, selectedMermaid.id);
      isRoot = !!(info && info.isRoot);
    }
  } catch (_e) {}
  mindmapDeleteButton.disabled = !on || isRoot;
}

function applyMindmapSelectionVisual() {
  if (!previewEl) return;
  previewEl.querySelectorAll("g.mindmap-node.mermaid-selection").forEach(function(el) {
    el.classList.remove("mermaid-selection");
  });
  if (!selectedMermaid || selectedMermaid.kind !== "topic") return;
  var g = previewEl.querySelector('g.mindmap-node[data-id="' + selectedMermaid.id + '"]');
  if (g) g.classList.add("mermaid-selection");
}

function selectMindmapTopic(sel, openInspect) {
  if (!sel) { clearMermaidSelection(); return; }
  var key = sel.key || ("topic:" + sel.id);
  var already = key && key === currentMermaidSelectionKey();
  if (!already && !mermaidLinkMode) closePropsPanel();
  selectedMermaid = {
    kind: "topic",
    id: sel.id,
    key: key,
    label: sel.label || "",
    shape: sel.shape || "default",
  };
  try { if (sourceEl) sourceEl.dataset.mermaidSelectionKey = key; } catch (_e) {}
  applyMindmapSelectionVisual();
  fillMindmapProps();
  syncMindmapEditButtons();
  setStatus("Selected topic " + (selectedMermaid.label || selectedMermaid.id));
  if (openInspect) inspectMermaidSelection();
}


function mindmapSelectionMeta() {
  if (!selectedMermaid || selectedMermaid.kind !== "topic") return null;
  var info = null;
  try {
    if (typeof MindmapEdit !== "undefined" && MindmapEdit.getTopic) {
      info = MindmapEdit.getTopic(sourceEl.value, selectedMermaid.id);
    }
  } catch (_e) {}
  var isRoot = !!(info && info.isRoot) || (selectedMermaid.depth === 0);
  return { info: info, isRoot: isRoot };
}

function syncMindmapEditButtons() {
  syncMindmapDeleteButton();
}

function fillMindmapProps() {
  if (!selectedMermaid || selectedMermaid.kind !== "topic") return;
  hidePropsLinkOnlyChrome();
  if (propsEmpty) propsEmpty.hidden = true;
  if (propsFields) propsFields.hidden = false;
  if (typeof setBoardIconField === "function") setBoardIconField(false);
  else if (boardIconField) boardIconField.hidden = true;
  if (typeof setBoardIdField === "function") setBoardIdField(false);
  if (boardDirLabel) boardDirLabel.hidden = true;
  if (boardDirEditor) boardDirEditor.hidden = true;
  if (boardDirTip) boardDirTip.hidden = true;
  if (typeof setBoardAlignJustifyFields === "function") setBoardAlignJustifyFields(false);
  if (typeof setBoardCapField === "function") setBoardCapField(false);
  if (typeof setBoardArrowField === "function") setBoardArrowField(false);

  var meta = mindmapSelectionMeta() || { info: null, isRoot: false };
  var info = meta.info;
  var isRoot = !!meta.isRoot;
  if (propsKindLabel) propsKindLabel.textContent = isRoot ? "Root" : "Node";

  var label = (info && info.label) || selectedMermaid.label || "";
  if (boardTitleLabel) { boardTitleLabel.hidden = false; boardTitleLabel.textContent = "Text"; }
  if (boardTitleEditor) {
    boardTitleEditor.hidden = false;
    boardTitleEditor.value = label;
    boardTitleEditor.rows = 1;
    boardTitleEditor.classList.remove("is-multiline");
  }

  // Shape removed — all mindmap nodes share one pill; Topic stays larger via layout measure.
  if (boardTypeLabel) {
    boardTypeLabel.hidden = true;
    boardTypeLabel.textContent = "Shape";
  }
  if (boardTypeEditor) {
    boardTypeEditor.hidden = true;
    boardTypeEditor.innerHTML = "";
  }

  if (propsHint) {
    propsHint.textContent = isRoot
      ? "Root · hover any node and click + to add a child"
      : "Node · hover and click + to add a child";
  }
  syncMindmapEditButtons();
}

function mindmapEditAction(mutator) {
  if (typeof MindmapEdit === "undefined") throw new Error("MindmapEdit missing — hard refresh");
  var out = mutator();
  if (!out || typeof out.source !== "string") return;
  sourceEl.value = out.source;
  selectedMermaid = out.selection || null;
  setTypeUI(sourceEl.value);
  void renderDiagram({ fit: false }).then(function() {
    if (selectedMermaid && selectedMermaid.kind === "topic") {
      applyMindmapSelectionVisual();
      fillMindmapProps();
    }
    syncMindmapEditButtons();
    applyMindmapAddSuppress();
  });
  scheduleSave();
}

function mindmapWantPropsForKey(key) {
  MermaidInspect.wantProps(key, {
    blocked: !isMindmapMode(),
    fill: function() { fillMindmapProps(); },
  });
}


var mindmapPointerPress = null;
var MINDMAP_PAN_SLOP = 5;

var mindmapAddSuppressId = null;

function applyMindmapAddSuppress() {
  if (!previewEl) return;
  previewEl.querySelectorAll(".mindmap-add-zone.is-suppressed").forEach(function(el) {
    el.classList.remove("is-suppressed");
  });
  if (mindmapAddSuppressId == null || !isMindmapMode()) return;
  var node = previewEl.querySelector('g.mindmap-node[data-id="' + mindmapAddSuppressId + '"]');
  var zone = node && node.querySelector(".mindmap-add-zone");
  if (zone) zone.classList.add("is-suppressed");
}

function clearMindmapAddSuppress() {
  mindmapAddSuppressId = null;
  if (!previewEl) return;
  previewEl.querySelectorAll(".mindmap-add-zone.is-suppressed").forEach(function(el) {
    el.classList.remove("is-suppressed");
  });
}

function mindmapAddChildUnder(parentId) {
  if (typeof MindmapEdit === "undefined" || !MindmapEdit.addChild) throw new Error("MindmapEdit.addChild missing — hard refresh");
  // Pointer is still in the right-side zone after click — suppress + until leave.
  mindmapAddSuppressId = Number(parentId);
  mindmapEditAction(function() { return MindmapEdit.addChild(sourceEl.value, parentId, "Node"); });
}

function mindmapHitSelect(event) {
  if (!isMindmapMode()) return false;
  if (typeof MindmapEdit === "undefined" || typeof MindmapEdit.selectionFromDom !== "function") return false;
  if (event.target.closest && event.target.closest(".top-float, .menu, .sheet, .board-dock, .zoom-float, button, input, textarea, select")) return false;
  // Hover + control: add child under that node (Mermaid has no Branch/Leaf).
  var addEl = event.target.closest ? event.target.closest(".mindmap-add") : null;
  if (addEl && (event.type === "pointerdown" || event.type === "click")) {
    var pid = addEl.getAttribute("data-add-parent");
    if (pid != null && pid !== "") {
      event.preventDefault();
      event.stopPropagation();
      if (event.type === "pointerdown") mindmapAddChildUnder(Number(pid));
      return true;
    }
  }
  var sel = MindmapEdit.selectionFromDom(event.target);
  if (event.type !== "pointerdown" && event.type !== "click" && event.type !== "dblclick") return !!sel;
  if (!sel) {
    // Blank inside SVG: let stage pan handle (keeps selection while dragging).
    return false;
  }
  var key = sel.key || ("topic:" + sel.id);
  if (event.type === "pointerdown") {
    beginMermaidInspectGesture(key);
    var already = !!(mermaidInspectGesture && mermaidInspectGesture.already);
    selectMindmapTopic(sel, false);
    mindmapPointerPress = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      key: key,
      already: already,
      panning: false,
    };
    event.preventDefault();
    event.stopPropagation();
    try { previewEl.setPointerCapture(event.pointerId); } catch (_e) {}
    return true;
  }
  if (event.type === "click") {
    // Props / re-press handled on pointerup if the press did not become a pan.
    event.stopPropagation();
    return true;
  }
  if (event.type === "dblclick") {
    selectMindmapTopic(sel, false);
    mindmapWantPropsForKey(key);
    MermaidInspect.clearGesture();
    mindmapPointerPress = null;
    if (boardTitleEditor && !boardTitleEditor.hidden) { boardTitleEditor.focus(); boardTitleEditor.select(); }
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  return true;
}

function mindmapPointerDrag(event) {
  if (!mindmapPointerPress || event.pointerId !== mindmapPointerPress.pointerId) return;
  var dx = event.clientX - mindmapPointerPress.x;
  var dy = event.clientY - mindmapPointerPress.y;
  if (!mindmapPointerPress.panning) {
    if (dx * dx + dy * dy < MINDMAP_PAN_SLOP * MINDMAP_PAN_SLOP) return;
    mindmapPointerPress.panning = true;
    MermaidInspect.clearGesture();
    panning = true;
    panMoved = true;
    panBlankMindmap = false;
    stageEl.classList.add("panning");
    panOrigin = { x: mindmapPointerPress.x - panX, y: mindmapPointerPress.y - panY, startX: mindmapPointerPress.x, startY: mindmapPointerPress.y };
  }
  if (mindmapPointerPress.panning && panOrigin) {
    panX = event.clientX - panOrigin.x;
    panY = event.clientY - panOrigin.y;
    applyTransform();
  }
}

function mindmapPointerEnd(event) {
  if (!mindmapPointerPress || event.pointerId !== mindmapPointerPress.pointerId) return;
  var press = mindmapPointerPress;
  mindmapPointerPress = null;
  try { previewEl.releasePointerCapture(event.pointerId); } catch (_e) {}
  if (press.panning) {
    panning = false;
    panOrigin = null;
    stageEl.classList.remove("panning");
    flushDrawerUiSave();
    return;
  }
  // Click without drag: re-press opens Props.
  if (press.already) {
    mindmapWantPropsForKey(press.key);
    MermaidInspect.clearGesture();
  }
}

previewEl.addEventListener("pointerout", function(event) {
  if (!isMindmapMode()) return;
  var zone = event.target && event.target.closest ? event.target.closest(".mindmap-add-zone") : null;
  if (!zone || !zone.classList.contains("is-suppressed")) return;
  var next = event.relatedTarget;
  if (next && zone.contains(next)) return;
  // Left the suppressed right-side zone — allow + again on next enter.
  zone.classList.remove("is-suppressed");
  var node = zone.closest("g.mindmap-node");
  var id = node && node.getAttribute("data-id");
  if (id != null && Number(id) === mindmapAddSuppressId) mindmapAddSuppressId = null;
}, true);
previewEl.addEventListener("pointerdown", function(event) {
  if (event.button !== 0) return;
  if (!isMindmapMode()) return;
  mindmapHitSelect(event);
}, true);
previewEl.addEventListener("pointermove", function(event) {
  if (!isMindmapMode()) return;
  mindmapPointerDrag(event);
}, true);
previewEl.addEventListener("pointerup", function(event) {
  if (!isMindmapMode()) return;
  mindmapPointerEnd(event);
}, true);
previewEl.addEventListener("pointercancel", function(event) {
  if (!isMindmapMode()) return;
  mindmapPointerEnd(event);
}, true);
previewEl.addEventListener("click", function(event) {
  if (!isMindmapMode()) return;
  mindmapHitSelect(event);
}, true);
previewEl.addEventListener("dblclick", function(event) {
  if (!isMindmapMode()) return;
  mindmapHitSelect(event);
}, true);

if (mindmapDeleteButton) mindmapDeleteButton.onclick = function() {
  if (!isMindmapMode() || !selectedMermaid || selectedMermaid.kind !== "topic") return;
  mindmapEditAction(function() { return MindmapEdit.deleteTopic(sourceEl.value, selectedMermaid.id); });
};
document.addEventListener("keydown", function(event) {
  if (!isMindmapMode()) return;
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  if (!selectedMermaid || selectedMermaid.kind !== "topic") return;
  var tag = (event.target && event.target.tagName) || "";
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
  event.preventDefault();
  try { mindmapEditAction(function() { return MindmapEdit.deleteTopic(sourceEl.value, selectedMermaid.id); }); }
  catch (err) { setStatus(err instanceof Error ? err.message : String(err), true); }
});

