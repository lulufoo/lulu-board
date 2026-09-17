/* Document camera: one style.viewport { scale, cx, cy }.
 * (cx, cy) is the world point shown at the stage centre; scale is the zoom.
 * Node coordinates live in the world (.board-canvas origin) and never change
 * when the camera pans or zooms. */
var _documentViewTimer = 0;
var _skipDocumentViewPersist = false;

function normalizeDocumentView(raw) {
  if (typeof BoardRender !== "undefined" && typeof BoardRender.authoredViewport === "function") {
    return BoardRender.authoredViewport(raw);
  }
  if (typeof DrawerStyleLine !== "undefined" && typeof DrawerStyleLine.authoredViewport === "function") {
    return DrawerStyleLine.authoredViewport(raw);
  }
  return null;
}

/* Pure camera math. `stage` = { w, h } in screen px; `origin` = layout-px
 * offset of the world origin from the untransformed #preview corner. */
function cameraToPan(cam, stage, origin) {
  return {
    x: stage.w / 2 - (cam.cx + origin.x) * cam.scale,
    y: stage.h / 2 - (cam.cy + origin.y) * cam.scale,
  };
}

function panToCamera(panX0, panY0, scale0, stage, origin) {
  if (!(scale0 > 0)) return null;
  return {
    scale: scale0,
    cx: (stage.w / 2 - panX0) / scale0 - origin.x,
    cy: (stage.h / 2 - panY0) / scale0 - origin.y,
  };
}

function stageSize() {
  if (!stageEl) return null;
  var r = stageEl.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return { w: r.width, h: r.height };
}

/* Where the world origin sits inside #preview before pan/zoom (root padding etc.). */
function worldOriginLayout() {
  if (!previewEl || !stageEl || !(scale > 0)) return null;
  var canvas = previewEl.querySelector(".board-canvas");
  if (!canvas) return null;
  var s = stageEl.getBoundingClientRect();
  var c = canvas.getBoundingClientRect();
  return { x: (c.left - s.left - panX) / scale, y: (c.top - s.top - panY) / scale };
}

function readCamera() {
  var stage = stageSize();
  var origin = worldOriginLayout();
  if (!stage || !origin) return null;
  return panToCamera(panX, panY, scale, stage, origin);
}

function applyCamera(cam) {
  var stage = stageSize();
  var origin = worldOriginLayout();
  if (!stage || !origin || !cam || !(cam.scale > 0)) return false;
  var pan = cameraToPan(cam, stage, origin);
  scale = cam.scale;
  panX = pan.x;
  panY = pan.y;
  applyTransform();
  return true;
}

function readDocumentView() {
  try {
    if (!boardSourceEl || typeof BoardRender === "undefined" || typeof BoardRender.parse !== "function") return null;
    var boardText = boardSourceEl.value;
    try { boardText = splitDocument(boardText).body; } catch (_e) {}
    var board = BoardRender.parse(boardText);
    return normalizeDocumentView(board.style && (board.style.viewport || board.style.view));
  } catch (_err) {
    return null;
  }
}

function persistDocumentView(view) {
  var next = view ? normalizeDocumentView(view) : null;
  if (next && _skipDocumentViewPersist) return;
  if (next && typeof _drawerUiRestoreLock !== "undefined" && _drawerUiRestoreLock) return;
  var patch = { viewport: next, view: null };
  if (typeof persistBoardStyle === "function") persistBoardStyle(patch);
}

function snapshotDocumentView() {
  var cam = readCamera();
  if (!cam) return null;
  return normalizeDocumentView(cam);
}

function scheduleDocumentViewSave() {
  if (_skipDocumentViewPersist) return;
  if (typeof _drawerUiRestoreLock !== "undefined" && _drawerUiRestoreLock) return;
  clearTimeout(_documentViewTimer);
  _documentViewTimer = setTimeout(function () {
    _documentViewTimer = 0;
    var next = snapshotDocumentView();
    if (next) persistDocumentView(next);
  }, 280);
}

function flushDocumentViewSave() {
  clearTimeout(_documentViewTimer);
  _documentViewTimer = 0;
  if (_skipDocumentViewPersist) return;
  if (typeof _drawerUiRestoreLock !== "undefined" && _drawerUiRestoreLock) return;
  var next = snapshotDocumentView();
  if (next) persistDocumentView(next);
}

function noteUserCanvasView() {
  _skipDocumentViewPersist = false;
  scheduleDocumentViewSave();
}

function forgetDocumentView() {
  _skipDocumentViewPersist = true;
  clearTimeout(_documentViewTimer);
  _documentViewTimer = 0;
  persistDocumentView(null);
}

function applyDocumentView(view, done) {
  var next = normalizeDocumentView(view);
  if (!next) {
    if (typeof done === "function") done(false);
    return false;
  }
  var prevSkip = _skipDocumentViewPersist;
  _skipDocumentViewPersist = true;
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      var ok = applyCamera(next);
      _skipDocumentViewPersist = prevSkip;
      if (typeof done === "function") done(ok);
    });
  });
  return true;
}

function restoreOrFitDocumentView() {
  var view = readDocumentView();
  if (applyDocumentView(view)) return true;
  if (typeof fitBoardView === "function") fitBoardView({ persist: true });
  return false;
}

window.addEventListener("pagehide", flushDocumentViewSave);
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "hidden") flushDocumentViewSave();
});
