/* Document canvas viewport: one style.viewport { scale, x, y }. x/y = diagram top-left vs stage 0,0. */
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

function measureDiagramOnCanvas() {
  if (!previewEl || !stageEl) return null;
  var content = previewEl.querySelector(".board-render");
  if (!content) return null;
  var wrap = stageEl.getBoundingClientRect();
  var box = content.getBoundingClientRect();
  if (!wrap.width || !wrap.height || !box.width || !box.height) return null;
  return { x: box.left - wrap.left, y: box.top - wrap.top };
}

function measureDiagramCenterOnCanvas() {
  if (!previewEl || !stageEl) return null;
  var content = previewEl.querySelector(".board-render");
  if (!content) return null;
  var wrap = stageEl.getBoundingClientRect();
  var box = content.getBoundingClientRect();
  if (!wrap.width || !wrap.height || !box.width || !box.height) return null;
  return {
    x: (box.left + box.right) / 2 - wrap.left,
    y: (box.top + box.bottom) / 2 - wrap.top,
  };
}

function panAfterScaleAroundPoint(panX0, panY0, oldScale, nextScale, cx, cy) {
  if (!(oldScale > 0) || !isFinite(nextScale) || !isFinite(cx) || !isFinite(cy)) {
    return { x: panX0, y: panY0 };
  }
  var ratio = nextScale / oldScale;
  return {
    x: cx - (cx - panX0) * ratio,
    y: cy - (cy - panY0) * ratio,
  };
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
  var hit = measureDiagramOnCanvas();
  if (!hit) return null;
  return normalizeDocumentView({
    scale: scale,
    x: hit.x,
    y: hit.y,
  });
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
  scale = next.scale;
  applyTransform();
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      var hit = measureDiagramOnCanvas();
      if (hit) {
        panX += next.x - hit.x;
        panY += next.y - hit.y;
        applyTransform();
      }
      _skipDocumentViewPersist = prevSkip;
      if (typeof done === "function") done(!!hit);
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
