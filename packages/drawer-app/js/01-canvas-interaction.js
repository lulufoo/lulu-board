/* Shared canvas gestures. Live camera stays scale / panX / panY in 01-shell-state.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CanvasInteraction = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var BLOCK_SEL = [
    "#boardTitlePin",
    ".board-title-node",
    ".board-zone",
    ".board-item",
    ".board-edge",
    ".board-edge-label",
    ".board-slot.is-link",
    ".board-inspector",
    ".board-dock",
    ".board-account",
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
    "g.pele-node",
    "g.pele-cluster",
    "g.pele-cluster-title",
    "g.pele-edge",
    "g.pele-edge-label",
    "path.mermaid-edge-hit",
  ].join(", ");

  var onBlank = null;
  var boundStage = null;
  var panning = false;
  var panOrigin = null;
  var panMoved = false;

  function setOnBlank(fn) {
    onBlank = typeof fn === "function" ? fn : null;
  }

  function isBlockedTarget(target) {
    return !!(target && typeof target.closest === "function" && target.closest(BLOCK_SEL));
  }

  function wheelFactor(deltaY, deltaMode) {
    var unit = deltaMode === 1 ? 16 : deltaMode === 2 ? 400 : 1;
    return Math.exp(-(Number(deltaY) * unit) * 0.0012);
  }

  function leaveBlank() {
    if (typeof onBlank === "function") onBlank();
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
    leaveBlank();
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

  function onPointerUp() {
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
    stage.addEventListener("selectstart", onSelectStart);
  }

  if (typeof stageEl !== "undefined" && stageEl) bind(stageEl);

  return {
    BLOCK_SEL: BLOCK_SEL,
    setOnBlank: setOnBlank,
    isBlockedTarget: isBlockedTarget,
    wheelFactor: wheelFactor,
    leaveBlank: leaveBlank,
    bind: bind,
  };
});
