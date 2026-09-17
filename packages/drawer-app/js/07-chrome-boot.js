/* drawer-app/07-chrome-boot.js — Board chrome + boot */
let chromeTimer = null;
function flashChrome(ms = 900) {
  const shell = $('#canvasShell') || document.querySelector('.canvas-shell');
  if (!shell) return;
  shell.classList.add('show-chrome');
  clearTimeout(chromeTimer);
  chromeTimer = setTimeout(() => shell.classList.remove('show-chrome'), ms);
}

stageEl.addEventListener('wheel', (e) => {
  e.preventDefault();
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
  const factor = Math.exp(-(e.deltaY * unit) * 0.0012);
  setCanvasZoom(scale * factor);
  flushDrawerUiSave();
  if (typeof noteUserCanvasView === "function") noteUserCanvasView();
  flashChrome();
}, { passive: false });


(function wireBoardTitlePin() {
  var pin = boardTitlePinEl();
  if (!pin || pin.dataset.wired === "1") return;
  pin.dataset.wired = "1";
  pin.addEventListener("pointerdown", function(event) {
    var title = event.target.closest && event.target.closest(".board-title-node, .board-html-header");
    if (!title) return;
    event.stopPropagation();
    try {
      var board = BoardRender.parse(boardSourceEl.value);
      var root = previewEl.querySelector(".board-render");
      pickBoardElement(title, root || previewEl, board);
    } catch (err) {}
  });
  pin.addEventListener("click", function(event) {
    var title = event.target.closest && event.target.closest(".board-title-node, .board-html-header");
    if (!title) return;
    if (consumeInspectClick("title:board")) inspectBoardSelection();
  });
  pin.addEventListener("dblclick", function(event) {
    var title = event.target.closest && event.target.closest(".board-title-node, .board-html-header");
    if (!title) return;
    event.stopPropagation();
    inspectBoardSelection();
    if (boardTitleEditor) { boardTitleEditor.focus(); boardTitleEditor.select(); }
  });
})();

stageEl.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  // Pan only on blank stage/canvas — not boxes, items, title, edges, or chrome.
  if (e.target.closest && e.target.closest("#boardTitlePin, .board-title-node, .board-zone, .board-item, .board-edge, .board-edge-label, .board-slot.is-link, .board-inspector, .board-dock, .props-panel, .top-float, .zoom-float, .menu, .sheet, button, input, select, textarea, label")) return;
  if (boardLinkMode) setBoardLinkMode(false);
  else clearBoardSelection();
  e.preventDefault();
  try { var sel = window.getSelection && window.getSelection(); if (sel && sel.removeAllRanges) sel.removeAllRanges(); } catch (_) {}
  panning = true;
  panMoved = false;
  stageEl.classList.add('panning');
  panOrigin = { x: e.clientX - panX, y: e.clientY - panY, startX: e.clientX, startY: e.clientY };
  stageEl.setPointerCapture(e.pointerId);
});
stageEl.addEventListener('pointermove', (e) => {
  if (!panning || !panOrigin) return;
  if (!panMoved && panOrigin.startX != null) {
    var dx0 = e.clientX - panOrigin.startX;
    var dy0 = e.clientY - panOrigin.startY;
    if (dx0 * dx0 + dy0 * dy0 >= 25) panMoved = true;
  }
  panX = e.clientX - panOrigin.x;
  panY = e.clientY - panOrigin.y;
  applyTransform();
});
stageEl.addEventListener('pointerup', () => {
  var wasPanning = panning;
  var moved = panMoved;
  panning = false; panOrigin = null; panMoved = false;
  stageEl.classList.remove('panning');
  try { var sel = window.getSelection && window.getSelection(); if (sel && sel.removeAllRanges) sel.removeAllRanges(); } catch (_) {}
  if (wasPanning && moved) {
    flushDrawerUiSave();
    if (typeof noteUserCanvasView === "function") noteUserCanvasView();
  } else if (wasPanning) {
    flushDrawerUiSave();
  }
});
stageEl.addEventListener('selectstart', (e) => {
  if (panning) e.preventDefault();
});

boardSourceEl.addEventListener('input', () => {
  if (typeof updateBoardChars === "function") updateBoardChars();
  scheduleBoardRender();
  scheduleBoardSave();
});

if (boardIdEditor) {
  boardIdEditor.addEventListener("input", filterBoardIdEditor);
  boardIdEditor.addEventListener("change", commitBoardId);
  boardIdEditor.addEventListener("keydown", function(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commitBoardId();
  });
}
if (boardIdCopy) boardIdCopy.addEventListener("click", function() {
  var value = boardIdEditor ? String(boardIdEditor.value || "").trim() : "";
  if (!value) return;
  copyText(value, "ID");
  markBoardIdCopied(true);
});
if (boardTypeEditor) boardTypeEditor.addEventListener("change", commitBoardType);
if (boardCapEditor) boardCapEditor.addEventListener("change", commitBoardCap);
if (boardShapeField) boardShapeField.addEventListener("click", function(event) {
  var btn = event.target && event.target.closest ? event.target.closest("[data-shape]") : null;
  if (!btn || btn.disabled) return;
  commitBoardShape(btn.getAttribute("data-shape"));
});
if (boardArrowEditor) boardArrowEditor.addEventListener("change", commitBoardArrow);
if (boardArrowReverse) boardArrowReverse.addEventListener("click", commitBoardReverse);
if (boardDirEditor) boardDirEditor.addEventListener("change", commitBoardDir);
if (boardAlignEditor) boardAlignEditor.addEventListener("change", commitBoardAlign);
if (boardJustifyEditor) boardJustifyEditor.addEventListener("change", commitBoardJustify);
if (boardIconList) boardIconList.addEventListener("click", function(event) {
  var btn = event.target && event.target.closest ? event.target.closest(".props-icon-btn") : null;
  if (!btn) return;
  var n = Number(btn.dataset.icon);
  if (selectedBoardNode && selectedBoardNode.kind === "box" && Number(boardIconPick) === n) {
    commitBoardIcon(null);
    return;
  }
  commitBoardIcon(n);
});
if (boardIconSec) boardIconSec.addEventListener("click", function(event) {
  var btn = event.target && event.target.closest ? event.target.closest("[data-sec]") : null;
  if (!btn) return;
  var sec = btn.dataset.sec;
  if (boardIconSecId === sec) {
    var Icons = window.BoardIcons;
    var owner = Icons && Icons.sectionOf && boardIconPick != null ? Icons.sectionOf(boardIconPick) : "";
    boardIconSecId = "";
    fillBoardIconList();
    if (selectedBoardNode && selectedBoardNode.kind === "box" && owner === sec) commitBoardIcon(null);
    else markBoardIconPick(boardIconPick);
    return;
  }
  boardIconSecId = sec;
  fillBoardIconList();
  markBoardIconPick(boardIconPick);
});

(function(){
  if (boardDock) {
    boardDock.querySelectorAll("[data-dock]").forEach(function(btn) {
      btn.addEventListener("click", function() { toggleDock(btn.getAttribute("data-dock")); });
    });
  }
  try { openDock(""); } catch (_) {}
})();
boardTitleEditor.addEventListener("change", commitBoardTitle); boardTitleEditor.addEventListener("keydown", function(event) {
  if (event.key !== "Enter") return;
  if (boardTitleEditor.classList.contains("is-multiline") && !event.metaKey && !event.ctrlKey) return;
  event.preventDefault();
  commitBoardTitle();
});
function closeExportMenu() {}

$('#btnZoomIn').onclick = () => { setCanvasZoom(scale * 1.08); flushDrawerUiSave(); if (typeof noteUserCanvasView === "function") noteUserCanvasView(); };
$('#btnZoomOut').onclick = () => { setCanvasZoom(scale / 1.08); flushDrawerUiSave(); if (typeof noteUserCanvasView === "function") noteUserCanvasView(); };
$('#btnZoomReset').onclick = () => { centerView(); if (typeof forgetDocumentView === "function") forgetDocumentView(); };
window.addEventListener("resize", () => { applyTransform(); });
$('#btnFit').onclick = fitView;
/* $('#btnTheme') removed */

// —— Canvas toolbar: diagram theme + export + UI theme ——

// —— Canvas toolbar: diagram theme + export + UI theme ——

const DIAGRAM_THEME_KEY = 'drawer.diagramTheme';
function currentDiagramTheme() {
  const legacy = localStorage.getItem('drawer.boardTheme');
  const v = localStorage.getItem(DIAGRAM_THEME_KEY) || legacy || 'default';
  if (window.BoardThemes && typeof BoardThemes.resolveId === 'function') return BoardThemes.resolveId(v);
  const allowed = ['default', 'classic', 'pastel', 'kami'];
  return allowed.includes(v) ? v : 'default';
}
const ITEM_CAP_KEY = 'drawer.boardItemCap';
const ITEM_CAP_MIN = 8;
const ITEM_CAP_MAX = 24;
const ITEM_CAP_DEFAULT = 16;
let boardItemCapTimer = 0;
function paintStyleRange(el) {
  if (!el) return;
  var min = Number(el.min);
  var max = Number(el.max);
  var val = Number(el.value);
  var span = max - min;
  el.style.setProperty('--cap-fill', (span === 0 ? 0 : ((val - min) / span) * 100) + '%');
}
function currentBoardItemCap() {
  const raw = localStorage.getItem(ITEM_CAP_KEY);
  if (raw == null || raw === '') return ITEM_CAP_DEFAULT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return ITEM_CAP_DEFAULT;
  return Math.min(ITEM_CAP_MAX, Math.max(ITEM_CAP_MIN, Math.round(n)));
}
function applyBoardItemCap(rem, rerender, persist) {
  const n = rem == null
    ? currentBoardItemCap()
    : Math.min(ITEM_CAP_MAX, Math.max(ITEM_CAP_MIN, Math.round(Number(rem) || ITEM_CAP_DEFAULT)));
  localStorage.setItem(ITEM_CAP_KEY, String(n));
  const css = n + 'rem';
  document.documentElement.style.setProperty('--board-item-cap', css);
  if (boardItemCapSlider) boardItemCapSlider.value = String(n);
  paintStyleRange(boardItemCapSlider);
  if (persist && typeof persistBoardStyle === 'function') persistBoardStyle({ item_cap: n });
  if (rerender && document.documentElement.dataset.drawerMode === 'board'
    && typeof renderBoard === 'function' && boardSourceEl && boardSourceEl.value.trim()) {
    renderBoard({ fit: false });
  }
}
function applyBoardThemeToPreview() {
  const t = (typeof currentDiagramTheme === 'function') ? currentDiagramTheme() : (localStorage.getItem('drawer.diagramTheme') || 'default');
  document.querySelectorAll('.board-render').forEach((el) => {
    if (window.BoardThemes && typeof BoardThemes.applyTo === 'function') BoardThemes.applyTo(el, t);
    else el.dataset.boardTheme = t;
  });
}
function applyDiagramTheme(theme, opts) {
  const t = (window.BoardThemes && typeof BoardThemes.resolveId === 'function')
    ? BoardThemes.resolveId(theme)
    : ((['default', 'classic', 'pastel', 'kami'].includes(theme) ? theme : 'default'));
  localStorage.setItem(DIAGRAM_THEME_KEY, t);
  localStorage.setItem('drawer.boardTheme', t); // back-compat
  document.querySelectorAll('#diagramThemeMenu .theme-item').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.theme === t);
  });
  document.documentElement.dataset.diagramTheme = t;
  document.querySelectorAll('.board-render').forEach((el) => {
    if (window.BoardThemes && typeof BoardThemes.applyTo === 'function') BoardThemes.applyTo(el, t);
    else el.dataset.boardTheme = t;
  });
  if (opts && opts.persist && typeof persistBoardStyle === 'function') {
    persistBoardStyle({ theme: t });
  }
  if (opts && opts.skipRender) return;
  if (typeof renderBoard === 'function' && boardSourceEl && boardSourceEl.value.trim()) renderBoard({ fit: false });
}
const btnDiagramTheme = $('#btnDiagramTheme');
const diagramThemeMenu = $('#diagramThemeMenu');

// Keep dropdown panels from covering the left Lulu Drawer sheet
function placeMenuPanel(wrap) {
  if (!wrap) return;
  const panel = wrap.querySelector('.menu-panel');
  const sheet = $('#sheet');
  if (!panel || !sheet) return;
  panel.style.left = '0px';
  panel.style.right = 'auto';
  requestAnimationFrame(() => {
    const pr = panel.getBoundingClientRect();
    const sr = sheet.getBoundingClientRect();
    const app = $('#app');
    const sheetOpen = app && !app.classList.contains('sheet-collapsed') && getComputedStyle(sheet).display !== 'none';
    if (sheetOpen && pr.left < sr.right + 4) {
      const dx = Math.ceil(sr.right + 4 - pr.left);
      panel.style.left = dx + 'px';
    }
    // also keep inside viewport right edge
    const pr2 = panel.getBoundingClientRect();
    if (pr2.right > window.innerWidth - 8) {
      const shift = Math.ceil(pr2.right - (window.innerWidth - 8));
      const cur = parseFloat(panel.style.left || '0') || 0;
      panel.style.left = (cur - shift) + 'px';
    }
  });
}

function closeDiagramThemeMenu() {
  /* Theme lives in Style dock — no popup. */
}

try { syncStyleLayoutSections(); } catch (_e) {}

document.querySelectorAll('#diagramThemeMenu .theme-item').forEach((btn) => {
  btn.addEventListener('click', () => { applyDiagramTheme(btn.dataset.theme, { persist: true }); });
});
const _themeMo = new MutationObserver(() => {
  const t = currentDiagramTheme();
  document.querySelectorAll('.board-render').forEach((el) => { el.dataset.boardTheme = t; });
});
const _themeStage = $('#preview');
if (_themeStage) _themeMo.observe(_themeStage, { childList: true, subtree: true });
applyDiagramTheme(currentDiagramTheme());
applyBoardItemCap();
if (boardItemCapSlider) {
  boardItemCapSlider.addEventListener('input', function() {
    applyBoardItemCap(boardItemCapSlider.value, false, false);
    clearTimeout(boardItemCapTimer);
    boardItemCapTimer = setTimeout(function() { applyBoardItemCap(boardItemCapSlider.value, true, true); }, 160);
  });
}
let boardFontSizeTimer = 0;
function applyBoardTypeStep(raw, persist, rerender) {
  const n = (window.BoardTypeScale && typeof BoardTypeScale.clampStep === 'function')
    ? BoardTypeScale.clampStep(raw)
    : Math.min(3, Math.max(-3, Math.round(Number(raw) || 0)));
  document.documentElement.dataset.boardTypeStep = String(n);
  if (boardFontSizeSlider) boardFontSizeSlider.value = String(n);
  paintStyleRange(boardFontSizeSlider);
  if (persist && typeof persistBoardStyle === 'function') persistBoardStyle({ type_step: n });
  if (rerender && document.documentElement.dataset.drawerMode === 'board'
    && typeof renderBoard === 'function' && boardSourceEl && boardSourceEl.value.trim()) {
    renderBoard({ fit: false });
  }
}
if (boardFontSizeSlider) {
  boardFontSizeSlider.addEventListener('input', function() {
    applyBoardTypeStep(boardFontSizeSlider.value, false, false);
    clearTimeout(boardFontSizeTimer);
    boardFontSizeTimer = setTimeout(function() { applyBoardTypeStep(boardFontSizeSlider.value, true, true); }, 160);
  });
}


const canvasExportMenu = $('#canvasExportMenu');
const canvasExportBtn = $('#btnCanvasExport');
function closeCanvasExport() {
  if (canvasExportMenu) canvasExportMenu.classList.remove('open');
  if (canvasExportBtn) canvasExportBtn.setAttribute('aria-expanded', 'false');
}
if (canvasExportBtn && canvasExportMenu) {
  canvasExportBtn.onclick = (e) => {
    e.stopPropagation();
    const open = !canvasExportMenu.classList.contains('open');
    document.querySelectorAll('.menu.open').forEach((m) => m.classList.remove('open'));
    canvasExportMenu.classList.toggle('open', open);
    canvasExportBtn.setAttribute('aria-expanded', String(open));
    if (open) placeMenuPanel(canvasExportMenu);
  };
  document.addEventListener('click', (e) => {
    if (!canvasExportMenu.contains(e.target)) closeCanvasExport();
  });
}
function activeSourceText() {
  return boardSourceEl ? boardSourceEl.value : '';
}
function activeSourcePath() {
  return (typeof liveBoardPath === 'string' && liveBoardPath) ? liveBoardPath : '';
}
$('#btnSourceCopyId') && ($('#btnSourceCopyId').onclick = () => {
  var id = typeof liveRecordId === "function" ? liveRecordId() : "";
  if (!id) { showCopyTip("No ID"); return; }
  void copyText(id, "ID");
});
$('#btnSourceCopy') && ($('#btnSourceCopy').onclick = () => {
  void copyText(activeSourceText(), "Source");
});
$('#btnHistoryOpenFile') && ($('#btnHistoryOpenFile').onclick = () => { void openBoardFile(); });
$('#btnCanvasCopySrc') && ($('#btnCanvasCopySrc').onclick = () => { void exportBoardFile(); closeCanvasExport(); });
$('#btnCanvasDlPng') && ($('#btnCanvasDlPng').onclick = () => { void exportPng(); closeCanvasExport(); });
/* UI light/dark toggle removed for now */

function syncSheetCssVar() {
  const sheet = $('#sheet');
  if (!sheet) return;
  const w = sheet.getBoundingClientRect().width;
  if (w > 0) document.documentElement.style.setProperty('--sheet-w', w + 'px');
}
syncSheetCssVar();
window.addEventListener('resize', syncSheetCssVar);

function setSheetCollapsed(collapsed, persist) {
  var app = $('#app');
  if (!app) return;
  app.classList.toggle('sheet-collapsed', !!collapsed);
  requestAnimationFrame(syncSheetCssVar);
  if (persist !== false) saveDrawerUi({ sheetCollapsed: !!collapsed });
}
function toggleSheetCollapsed() {
  setSheetCollapsed(true);
}
function toggleSourceEntry() {
  toggleDock('source');
}
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    renderBoard();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
    e.preventDefault();
    toggleSourceEntry();
  }
});

function centerView() {
  fitBoardView();
  flushDrawerUiSave();
}
function fitView() {
  fitBoardView();
}

function setMode(mode, opts) {
  opts = opts || {};
  document.documentElement.dataset.drawerMode = "board";
  if (opts.persist !== false) saveDrawerUi({ mode: "board" });
  try { setTypeUI(boardSourceEl && boardSourceEl.value); } catch (_e) {}
  closeExportMenu();
  if (opts.restore) _drawerUiRestoreLock = true;
  var hasBoard = !!(previewEl && previewEl.querySelector(".board-render"));
  var skipBoard = !!(opts.restore && hasBoard);
  if (!skipBoard) {
    renderBoard({ fit: false, restoreView: true });
    if (typeof refreshBoardHistory === "function") void refreshBoardHistory();
  } else {
    applyRestoredBoardView();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { clearDrawerBoot(); });
    });
  }
  if (!opts.restore) openDock("");
  if (opts.restore) {
    requestAnimationFrame(function() {
      requestAnimationFrame(function() { _drawerUiRestoreLock = false; });
    });
  }
  syncBoardLinkRouteButton();
  setStatus("Board mode");
}

(function applyDrawerUiChrome() {
  var ui = loadDrawerUi();
  setSheetCollapsed(!!ui.sheetCollapsed, false);
})();
applyTransform();
function restoreDrawerMode() {
  var ui = loadDrawerUi();
  document.documentElement.dataset.drawerMode = "board";
  saveDrawerUi({ mode: "board" });
  setMode("board", { restore: true, persist: false });
  try {
    var tab = ui.dockTab || "";
    if (tab === "export" || tab === "style" || tab === "source" || tab === "props" || tab === "layout") {
      openDock(tab);
    }
  } catch (_e) {}
}
await bootstrapBoard();
restoreDrawerMode();
if (typeof boardPersistMode !== "function" || boardPersistMode() !== "hash") {
  setInterval(() => { void loadBoardPolled(); }, 1500);
} else {
  window.addEventListener("hashchange", function() {
    // Never drop a navigation: flush the outgoing cloud board first, then load the new one.
    var pending = Promise.resolve();
    if (boardDirty || boardSaveTimer) {
      clearTimeout(boardSaveTimer);
      boardSaveTimer = null;
      var outgoingId = "";
      try { outgoingId = String(splitDocument(boardSourceEl.value).meta.id || ""); } catch (_e) {}
      if (boardDirty && outgoingId && typeof saveBoardToCloud === "function") {
        pending = saveBoardToCloud({ explicit: false }).catch(function() { return false; });
      }
      boardDirty = false;
    }
    void pending.then(function() { return bootstrapBoard(); }).then(function() {
      if (typeof renderBoard === "function" && boardSourceEl && boardSourceEl.value.trim()) {
        renderBoard({ fit: false, restoreView: true });
      }
    });
  });
}

(function wireBoardHistory() {
  if (typeof boardPersistMode === "function" && boardPersistMode() === "hash") {
    var cloudRefresh = document.getElementById("btnBoardHistoryRefresh");
    if (cloudRefresh) cloudRefresh.addEventListener("click", function() { void refreshBoardHistory(); });
    void refreshBoardHistory();
    return;
  }
  var btn = document.getElementById("btnBoardHistoryRefresh");
  if (btn) btn.addEventListener("click", function() { void refreshBoardHistory(); });
  void refreshBoardHistory();
})();

