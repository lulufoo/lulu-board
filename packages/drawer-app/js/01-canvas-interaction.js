/* Shared canvas gestures. Live camera stays scale / panX / panY in 01-shell-state.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.Canvas = Object.assign(root.Canvas || {}, api);
  root.CanvasInteraction = root.Canvas;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var CHROME_SEL = [
    ".board-inspector",
    ".diagram-dock",
    ".diagram-dock-resize",
    ".shell-account-bar",
    ".props-panel",
    ".top-float",
    ".zoom-float",
    ".menu",
    ".sheet",
    "button",
    "input",
    "select",
    "textarea",
    "label",
  ].join(", ");

  var kinds = Object.create(null);
  var boundStage = null;
  var panning = false;
  var panOrigin = null;
  var panMoved = false;

  function registerKind(id, rec) {
    var key = String(id || "").trim();
    if (!key || !rec) return;
    kinds[key] = {
      isHit: typeof rec.isHit === "function" ? rec.isHit : null,
      clear: typeof rec.clear === "function" ? rec.clear : null,
    };
  }

  function activeKindId() {
    var html = typeof document !== "undefined" ? document.documentElement : null;
    var kind = html && html.dataset ? html.dataset.kind : "";
    if (kind === "mindmap") return "mindmap";
    if (kind === "flowchart" || kind === "mermaid-unsupported") return "flowchart";
    if (typeof DrawerStyleLine !== "undefined" && typeof DrawerStyleLine.isDesignKind === "function"
      && DrawerStyleLine.isDesignKind(kind)) {
      return "design";
    }
    return "board";
  }

  function kindHit(target) {
    var rec = kinds[activeKindId()];
    return !!(rec && rec.isHit && rec.isHit(target));
  }

  function isBlockedTarget(target) {
    if (!target || typeof target.closest !== "function") return false;
    if (target.closest(CHROME_SEL)) return true;
    return kindHit(target);
  }

  function wheelFactor(deltaY, deltaMode) {
    var unit = deltaMode === 1 ? 16 : deltaMode === 2 ? 400 : 1;
    return Math.exp(-(Number(deltaY) * unit) * 0.0012);
  }

  function hideBlankProps() {
    var fn = typeof closePropsPanel === "function"
      ? closePropsPanel
      : (typeof globalThis !== "undefined" && typeof globalThis.closePropsPanel === "function"
        ? globalThis.closePropsPanel
        : null);
    if (fn) fn();
  }

  function leaveBlank() {
    hideBlankProps();
    var rec = kinds[activeKindId()];
    if (rec && rec.clear) rec.clear();
  }

  function openBlankProps() {
    var fn = typeof openPropsPanel === "function"
      ? openPropsPanel
      : (typeof globalThis !== "undefined" && typeof globalThis.openPropsPanel === "function"
        ? globalThis.openPropsPanel
        : null);
    if (fn) fn();
  }

  function onDblClick(event) {
    if (isBlockedTarget(event.target)) return;
    openBlankProps();
  }

  function onWheel(event) {
    event.preventDefault();
    var factor = wheelFactor(event.deltaY, event.deltaMode);
    if (typeof setCanvasZoom === "function") setCanvasZoom(scale * factor);
    if (typeof noteUserCanvasView === "function") noteUserCanvasView();
    if (typeof flashChrome === "function") flashChrome();
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;
    if (isBlockedTarget(event.target)) return;
    event.preventDefault();
    try {
      var sel = window.getSelection && window.getSelection();
      if (sel && sel.removeAllRanges) sel.removeAllRanges();
    } catch (_e) {}
    panning = true;
    panMoved = false;
    if (boundStage && boundStage.classList) boundStage.classList.add("panning");
    panOrigin = {
      x: event.clientX - panX,
      y: event.clientY - panY,
      startX: event.clientX,
      startY: event.clientY,
    };
    if (boundStage && typeof boundStage.setPointerCapture === "function") {
      boundStage.setPointerCapture(event.pointerId);
    }
  }

  function onPointerMove(event) {
    if (!panning || !panOrigin) return;
    if (!panMoved && panOrigin.startX != null) {
      var dx0 = event.clientX - panOrigin.startX;
      var dy0 = event.clientY - panOrigin.startY;
      if (dx0 * dx0 + dy0 * dy0 >= 25) panMoved = true;
    }
    panX = event.clientX - panOrigin.x;
    panY = event.clientY - panOrigin.y;
    if (typeof applyTransform === "function") applyTransform();
  }

  function endPan(leaveIfStill) {
    var wasPanning = panning;
    var moved = panMoved;
    panning = false;
    panOrigin = null;
    panMoved = false;
    if (boundStage && boundStage.classList) boundStage.classList.remove("panning");
    try {
      var sel = window.getSelection && window.getSelection();
      if (sel && sel.removeAllRanges) sel.removeAllRanges();
    } catch (_e) {}
    if (wasPanning && moved && typeof noteUserCanvasView === "function") noteUserCanvasView();
    if (wasPanning && !moved && leaveIfStill) leaveBlank();
  }

  function onPointerUp() {
    endPan(true);
  }

  function onPointerCancel() {
    endPan(false);
  }

  function onSelectStart(event) {
    if (panning) event.preventDefault();
  }

  function bind(stage) {
    if (!stage || boundStage === stage) return;
    boundStage = stage;
    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerup", onPointerUp);
    stage.addEventListener("pointercancel", onPointerCancel);
    stage.addEventListener("selectstart", onSelectStart);
    stage.addEventListener("dblclick", onDblClick);
  }

  if (typeof stageEl !== "undefined" && stageEl) bind(stageEl);

  return {
    CHROME_SEL: CHROME_SEL,
    registerKind: registerKind,
    activeKindId: activeKindId,
    isBlockedTarget: isBlockedTarget,
    wheelFactor: wheelFactor,
    leaveBlank: leaveBlank,
    openBlankProps: openBlankProps,
    bind: bind,
  };
});
