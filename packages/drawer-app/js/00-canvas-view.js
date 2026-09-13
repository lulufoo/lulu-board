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
  var mode = document.documentElement.dataset.drawerMode;
  var content = mode === "board"
    ? previewEl.querySelector(".board-render")
    : previewEl.querySelector("svg");
  if (!content) return null;
  var wrap = stageEl.getBoundingClientRect();
  var box = content.getBoundingClientRect();
  if (!wrap.width || !wrap.height || !box.width || !box.height) return null;
  return { x: box.left - wrap.left, y: box.top - wrap.top };
}

function readDocumentView() {
  try {
    if (document.documentElement.dataset.drawerMode === "board") {
      if (!boardSourceEl || typeof BoardRender === "undefined" || typeof BoardRender.parse !== "function") return null;
      var boardText = boardSourceEl.value;
      try { boardText = splitDocument(boardText).body; } catch (_e) {}
      var board = BoardRender.parse(boardText);
      return normalizeDocumentView(board.style && (board.style.viewport || board.style.view));
    }
    if (!sourceEl || typeof DrawerStyleLine === "undefined" || typeof BoardRender === "undefined") return null;
    var body = sourceEl.value;
    try { body = splitDocument(body).body; } catch (_e) {}
    var styled = DrawerStyleLine.splitRendererStyle(body);
    if (!styled.token) return null;
    var raw = BoardRender.decodeStylePayload(styled.token);
    return normalizeDocumentView(raw && (raw.viewport || raw.view));
  } catch (_err) {
    return null;
  }
}

function persistDocumentView(view) {
  var next = view ? normalizeDocumentView(view) : null;
  if (next && _skipDocumentViewPersist) return;
  if (next && typeof _drawerUiRestoreLock !== "undefined" && _drawerUiRestoreLock) return;
  var patch = { viewport: next, view: null };
  if (document.documentElement.dataset.drawerMode === "board") {
    if (typeof persistBoardStyle === "function") persistBoardStyle(patch);
    return;
  }
  if (typeof persistMermaidStyle === "function") persistMermaidStyle(patch);
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
  if (document.documentElement.dataset.drawerMode === "board") {
    if (typeof fitBoardView === "function") fitBoardView({ persist: true });
  } else if (typeof centerView === "function") {
    centerView();
  }
  return false;
}

window.addEventListener("pagehide", flushDocumentViewSave);
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "hidden") flushDocumentViewSave();
});
