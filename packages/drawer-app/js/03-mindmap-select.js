/* Mindmap selection / hover: shared mermaid SVG halo + canvas registerKind. */
var mindmapInspectGesture = null;

function mindmapNodeHost(target) {
  if (!target || !target.closest) return null;
  return target.closest("g.mindmap-node");
}

function mindmapPathSelector(path) {
  return 'g.mindmap-node[data-path="' + (path || []).join(".") + '"]';
}

function paintMindmapHalo(g, className) {
  if (!g || typeof mermaidPaintHalo !== "function") return;
  mermaidPaintHalo(g, className, {
    findShape: function (host) {
      return host.querySelector(":scope > rect.node-bkg");
    },
    bboxFallback: true,
  });
}

function clearMindmapHoverVisual() {
  if (!previewEl) return;
  previewEl.querySelectorAll(".canvas-hover-halo").forEach(function (el) { el.remove(); });
  previewEl.querySelectorAll(".canvas-hover").forEach(function (el) {
    el.classList.remove("canvas-hover");
  });
}

function applyMindmapHover(g) {
  clearMindmapHoverVisual();
  if (!g || !previewEl) return;
  if (g.classList.contains("canvas-selected")) return;
  g.classList.add("canvas-hover");
  paintMindmapHalo(g, "canvas-hover-halo");
}

function applyMindmapSelectionVisual() {
  if (!previewEl) return;
  previewEl.querySelectorAll(".mindmap-selection-halo").forEach(function (el) { el.remove(); });
  previewEl.querySelectorAll("g.mindmap-node.canvas-selected").forEach(function (el) {
    el.classList.remove("canvas-selected");
  });
  if (!selectedMindmap) return;
  var g = previewEl.querySelector(mindmapPathSelector(selectedMindmap.path));
  if (!g) return;
  g.classList.add("canvas-selected");
  paintMindmapHalo(g, "mindmap-selection-halo");
}

function inspectMindmapSelection() {
  if (typeof openPropsPanel === "function") openPropsPanel();
}

function beginMindmapInspect(sel) {
  var key = sel && sel.key ? sel.key : "";
  mindmapInspectGesture = {
    key: key,
    already: !!(key && selectedMindmap && selectedMindmap.key === key),
  };
}

function consumeMindmapInspect(sel) {
  var gesture = mindmapInspectGesture;
  mindmapInspectGesture = null;
  var key = sel && sel.key ? sel.key : "";
  return !!(gesture && gesture.already && gesture.key && gesture.key === key);
}

function clearMindmapInteraction() {
  mindmapInspectGesture = null;
  clearMindmapHoverVisual();
  selectedMindmap = null;
  if (previewEl) {
    previewEl.querySelectorAll(".mindmap-selection-halo").forEach(function (el) { el.remove(); });
    previewEl.querySelectorAll("g.mindmap-node.canvas-selected").forEach(function (el) {
      el.classList.remove("canvas-selected");
    });
  }
  if (typeof fillMindmapProps === "function") fillMindmapProps();
  if (typeof syncMindmapButtons === "function") syncMindmapButtons();
}

function mindmapCanvasHit(target) {
  return !!(target && target.closest && target.closest("g.mindmap-node"));
}

function mindmapHitSelect(event) {
  if (!isMindmapKind()) return false;
  var hit = mindmapHitFromEvent(event);
  if (hit && hit.kind === "add") {
    if (event.type === "click") addMindmapChild(hit.parent);
    return true;
  }
  if (hit && hit.kind === "topic") {
    if (event.type === "pointerdown") beginMindmapInspect(hit);
    if (event.type === "dblclick" || (event.type === "click" && consumeMindmapInspect(hit))) {
      selectMindmapTopic(hit);
      applyMindmapSelectionVisual();
      inspectMindmapSelection();
      return true;
    }
    if (event.type === "click") {
      selectMindmapTopic(hit);
      applyMindmapSelectionVisual();
    }
    return true;
  }
  return false;
}

if (previewEl) {
  previewEl.addEventListener("pointerdown", function (event) {
    if (event.button !== 0) return;
    mindmapHitSelect(event);
  }, true);
  previewEl.addEventListener("click", function (event) {
    mindmapHitSelect(event);
  }, true);
  previewEl.addEventListener("dblclick", function (event) {
    mindmapHitSelect(event);
  }, true);
  previewEl.addEventListener("pointerover", function (event) {
    if (!isMindmapKind()) return;
    applyMindmapHover(mindmapNodeHost(event.target));
  });
  previewEl.addEventListener("pointerout", function (event) {
    if (!isMindmapKind()) return;
    var next = event.relatedTarget;
    if (next && previewEl.contains(next) && mindmapNodeHost(next)) return;
    clearMindmapHoverVisual();
  });
}

if (typeof CanvasInteraction !== "undefined" && typeof CanvasInteraction.registerKind === "function") {
  CanvasInteraction.registerKind("mindmap", {
    isHit: mindmapCanvasHit,
    clear: clearMindmapInteraction,
  });
}
