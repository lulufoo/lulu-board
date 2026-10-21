/* Canvas camera: one style.viewport { scale, cx, cy }.
 * (cx, cy) is the world point shown at the stage centre; scale is the zoom.
 * Kind coordinates live in the world and never change when the camera pans or zooms. */
var _documentViewTimer = 0;
var _skipDocumentViewPersist = false;
var _worldRoot = null;
var _worldBoundsFn = null;

function normalizeDocumentView(raw) {
  if (typeof BoardStyleToken !== "undefined" && typeof BoardStyleToken.authoredViewport === "function") {
    return BoardStyleToken.authoredViewport(raw);
  }
  if (typeof DrawerStyleLine !== "undefined" && typeof DrawerStyleLine.authoredViewport === "function") {
    return DrawerStyleLine.authoredViewport(raw);
  }
  return null;
}

function setWorld(rootEl, bounds) {
  _worldRoot = rootEl && typeof rootEl.getBoundingClientRect === "function" ? rootEl : null;
  if (typeof bounds === "function") _worldBoundsFn = bounds;
  else if (bounds && typeof bounds === "object") _worldBoundsFn = function () { return bounds; };
  else _worldBoundsFn = null;
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

/* Where the world origin sits inside #preview before pan/zoom (root padding etc.).
 * With no registered world root, #preview's top-left is the origin. */
function worldOriginLayout() {
  if (!previewEl || !stageEl || !(scale > 0)) return null;
  if (!_worldRoot) return { x: 0, y: 0 };
  var s = stageEl.getBoundingClientRect();
  var c = _worldRoot.getBoundingClientRect();
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

function contentBounds() {
  if (typeof _worldBoundsFn !== "function") return null;
  var b;
  try { b = _worldBoundsFn(); } catch (_err) { return null; }
  if (!b || !(b.width > 0) || !(b.height > 0)) return null;
  if (!isFinite(b.cx) || !isFinite(b.cy)) return null;
  return b;
}

function contentOnStage() {
  var cam = readCamera();
  var stage = stageSize();
  var b = contentBounds();
  if (!cam || !stage || !b) return false;
  var halfW = stage.w / 2 / cam.scale, halfH = stage.h / 2 / cam.scale;
  return b.maxX > cam.cx - halfW && b.minX < cam.cx + halfW && b.maxY > cam.cy - halfH && b.minY < cam.cy + halfH;
}

function readDocumentView() {
  try {
    if (!boardSourceEl || typeof DrawerStyleLine === "undefined") return null;
    var raw = boardSourceEl.value;
    try { raw = splitDocument(raw).body; } catch (_e) {}
    var styled = DrawerStyleLine.splitRendererStyle(raw);
    var data = typeof DrawerStyleLine.decodeStyleTokenJson === "function"
      ? DrawerStyleLine.decodeStyleTokenJson(styled.token)
      : DrawerStyleLine.decodeStylePayload(styled.token);
    if (!data) return null;
    return normalizeDocumentView(data.viewport || data.view);
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

function fitWorld() {
  if (!previewEl) return;
  requestAnimationFrame(function () {
    var stage = stageSize();
    if (!stage) return;
    var b = contentBounds();
    /* Empty world: 100% with the origin at the stage centre. */
    if (!b) { applyCamera({ scale: 1, cx: 0, cy: 0 }); return; }
    var topBand = 12;
    var pad = 24;
    var next = Math.max(0.2, Math.min(1, (stage.w - pad) / Math.max(1, b.width), (stage.h - topBand - pad) / Math.max(1, b.height)));
    applyCamera({ scale: next, cx: b.cx, cy: b.cy });
  });
}

function restoreOrFit() {
  var view = readDocumentView();
  if (view) {
    applyDocumentView(view, function (ok) {
      if (!ok || !contentOnStage()) fitWorld();
    });
    return true;
  }
  fitWorld();
  return false;
}

window.addEventListener("pagehide", flushDocumentViewSave);
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "hidden") flushDocumentViewSave();
});

(function attachCanvasView(root) {
  if (!root) return;
  root.Canvas = Object.assign(root.Canvas || {}, {
    setWorld: setWorld,
    fitWorld: fitWorld,
    restoreOrFit: restoreOrFit,
    cameraToPan: cameraToPan,
    panToCamera: panToCamera,
    stageSize: stageSize,
    readCamera: readCamera,
    applyCamera: applyCamera,
    contentBounds: contentBounds,
    contentOnStage: contentOnStage,
    readDocumentView: readDocumentView,
    persistDocumentView: persistDocumentView,
    snapshotDocumentView: snapshotDocumentView,
    scheduleDocumentViewSave: scheduleDocumentViewSave,
    flushDocumentViewSave: flushDocumentViewSave,
    noteUserCanvasView: noteUserCanvasView,
    forgetDocumentView: forgetDocumentView,
    applyDocumentView: applyDocumentView,
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
