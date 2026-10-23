/* drawer-app/07-chrome-boot.js — Board chrome + boot */
let chromeTimer = null;
function flashChrome(ms = 900) {
  const shell = $('#canvasShell') || document.querySelector('.canvas-shell');
  if (!shell) return;
  shell.classList.add('show-chrome');
  clearTimeout(chromeTimer);
  chromeTimer = setTimeout(() => shell.classList.remove('show-chrome'), ms);
}

(function wireBoardTitlePin() {
  var pin = boardTitlePinEl();
  if (!pin || pin.dataset.wired === "1") return;
  pin.dataset.wired = "1";
  pin.addEventListener("pointerdown", function(event) {
    var title = event.target.closest && event.target.closest(".board-title-node, .board-html-header");
    if (!title) return;
    event.stopPropagation();
    try {
      var board = BoxesRender.parse(diagramSourceEl.value);
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

diagramSourceEl.addEventListener('input', () => {
  if (typeof updateDiagramChars === "function") updateDiagramChars();
  scheduleDiagramRender();
  scheduleDiagramSave();
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
if (boardIconSec) boardIconSec.addEventListener("change", function() {
  boardIconSecId = boardIconSec.value;
  fillBoardIconList();
  markBoardIconPick(boardIconPick);
});

(function(){
  if (diagramDock) {
    diagramDock.querySelectorAll("[data-dock]").forEach(function(btn) {
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

$('#btnZoomIn').onclick = () => { setCanvasZoom(scale * 1.08); if (typeof noteUserCanvasView === "function") noteUserCanvasView(); };
$('#btnZoomOut').onclick = () => { setCanvasZoom(scale / 1.08); if (typeof noteUserCanvasView === "function") noteUserCanvasView(); };
$('#btnZoomReset').onclick = () => { centerView(); if (typeof forgetDocumentView === "function") forgetDocumentView(); };
window.addEventListener("resize", () => { applyTransform(); });
var zoomTypeFit = $('#zoom-kind-label');
if (zoomTypeFit) zoomTypeFit.onclick = fitView;
/* $('#btnTheme') removed */

// —— Canvas toolbar: diagram theme + export + UI theme ——

// —— Canvas toolbar: diagram theme + export + UI theme ——

const KIND_THEME_KEY = 'drawer.kindTheme';
function currentKindTheme() {
  const legacy = localStorage.getItem('drawer.diagramTheme') || localStorage.getItem('drawer.boardTheme');
  const v = localStorage.getItem(KIND_THEME_KEY) || legacy || 'default';
  if (window.BoardThemes && typeof BoardThemes.resolveId === 'function') return BoardThemes.resolveId(v);
  const allowed = ['default', 'classic', 'pastel'];
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
  const kind = document.documentElement && document.documentElement.dataset.kind;
  if (typeof DrawerStyleLine !== "undefined" && typeof DrawerStyleLine.isMermaidKind === "function"
    ? DrawerStyleLine.isMermaidKind(kind)
    : (kind === "flowchart" || kind === "mindmap" || kind === "mermaid-unsupported")) {
    if (boardItemCapSlider) {
      var lockCap = kind === "flowchart" || (typeof DrawerStyleLine !== "undefined"
        && typeof DrawerStyleLine.isDesignKind === "function"
        && DrawerStyleLine.isDesignKind(kind));
      boardItemCapSlider.disabled = lockCap;
      if (lockCap) boardItemCapSlider.setAttribute("aria-disabled", "true");
      else boardItemCapSlider.removeAttribute("aria-disabled");
      paintStyleRange(boardItemCapSlider);
    }
    return;
  }
  const n = rem == null
    ? currentBoardItemCap()
    : Math.min(ITEM_CAP_MAX, Math.max(ITEM_CAP_MIN, Math.round(Number(rem) || ITEM_CAP_DEFAULT)));
  localStorage.setItem(ITEM_CAP_KEY, String(n));
  const css = n + 'rem';
  document.documentElement.style.setProperty('--board-item-cap', css);
  if (boardItemCapSlider) {
    boardItemCapSlider.disabled = false;
    boardItemCapSlider.value = String(n);
  }
  paintStyleRange(boardItemCapSlider);
  if (persist && typeof persistBoardStyle === 'function') persistBoardStyle({ item_cap: n });
  if (rerender && document.documentElement.dataset.drawerMode === 'diagram'
    && typeof renderDiagram === 'function' && diagramSourceEl && diagramSourceEl.value.trim()) {
    renderDiagram({ fit: false });
  }
}
function applyPeleThemeVars(theme) {
  if (typeof DrawerPeleTheme === "undefined" || typeof DrawerPeleTheme.applyTo !== "function") return;
  DrawerPeleTheme.applyTo([document.documentElement, document.getElementById("preview")], theme);
}
function applyBoardThemeToPreview() {
  const t = (typeof currentKindTheme === 'function') ? currentKindTheme() : (localStorage.getItem('drawer.kindTheme') || 'default');
  document.querySelectorAll('.board-render').forEach((el) => {
    if (window.BoardThemes && typeof BoardThemes.applyTo === 'function') BoardThemes.applyTo(el, t);
    else el.dataset.boardTheme = t;
  });
  applyPeleThemeVars(t);
}
function applyKindTheme(theme, opts) {
  const t = (window.BoardThemes && typeof BoardThemes.resolveId === 'function')
    ? BoardThemes.resolveId(theme)
    : ((['default', 'classic', 'pastel'].includes(theme) ? theme : 'default'));
  localStorage.setItem(KIND_THEME_KEY, t);
  localStorage.setItem('drawer.boardTheme', t); // back-compat
  const themeSelect = document.getElementById('kindThemeSelect');
  if (themeSelect) themeSelect.value = t;
  document.documentElement.dataset.kindTheme = t;
  document.querySelectorAll('.board-render').forEach((el) => {
    if (window.BoardThemes && typeof BoardThemes.applyTo === 'function') BoardThemes.applyTo(el, t);
    else el.dataset.boardTheme = t;
  });
  applyPeleThemeVars(t);
  if (opts && opts.persist && typeof persistBoardStyle === 'function') {
    persistBoardStyle({ theme: t });
  }
  if (opts && opts.skipRender) return;
  if (typeof renderDiagram === 'function' && diagramSourceEl && diagramSourceEl.value.trim()) renderDiagram({ fit: false });
}
const btnDiagramTheme = $('#btnDiagramTheme');

// Keep dropdown panels from covering the left Lulu Board sheet
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

function closeKindThemeMenu() {
  /* Theme lives in Style dock — no popup. */
}

try { syncStyleLayoutSections(); } catch (_e) {}

const kindThemeSelect = $('#kindThemeSelect');
if (kindThemeSelect) {
  kindThemeSelect.addEventListener('change', () => { applyKindTheme(kindThemeSelect.value, { persist: true }); });
}
const _themeMo = new MutationObserver(() => {
  const t = currentKindTheme();
  document.querySelectorAll('.board-render').forEach((el) => { el.dataset.boardTheme = t; });
});
const _themeStage = $('#preview');
if (_themeStage) _themeMo.observe(_themeStage, { childList: true, subtree: true });
applyKindTheme(currentKindTheme());
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
  if (rerender && document.documentElement.dataset.drawerMode === 'diagram'
    && typeof renderDiagram === 'function' && diagramSourceEl && diagramSourceEl.value.trim()) {
    renderDiagram({ fit: false });
  }
}
if (boardFontSizeSlider) {
  boardFontSizeSlider.addEventListener('input', function() {
    applyBoardTypeStep(boardFontSizeSlider.value, false, false);
    clearTimeout(boardFontSizeTimer);
    boardFontSizeTimer = setTimeout(function() { applyBoardTypeStep(boardFontSizeSlider.value, true, true); }, 160);
  });
}
let boardNodeFontTimer = 0;
if (boardNodeFontSlider) {
  boardNodeFontSlider.addEventListener('input', function() {
    if (typeof commitBoardNodeFont === 'function') commitBoardNodeFont(false, false);
    clearTimeout(boardNodeFontTimer);
    boardNodeFontTimer = setTimeout(function() {
      if (typeof commitBoardNodeFont === 'function') commitBoardNodeFont(true, true);
    }, 160);
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
  return diagramSourceEl ? diagramSourceEl.value : '';
}
function activeSourcePath() {
  return (typeof liveDiagramPath === 'string' && liveDiagramPath) ? liveDiagramPath : '';
}
$('#btnSourceCopyId') && ($('#btnSourceCopyId').onclick = () => {
  var id = typeof liveRecordId === "function" ? liveRecordId() : "";
  if (!id) { showCopyTip("No ID"); return; }
  void copyText(id, "ID");
});
$('#btnSourceCopy') && ($('#btnSourceCopy').onclick = () => {
  void copyText(activeSourceText(), "Source");
});
$('#btnCanvasCopySrc') && ($('#btnCanvasCopySrc').onclick = () => { void exportDiagramFile(); closeCanvasExport(); });
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
    renderDiagram();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
    e.preventDefault();
    toggleSourceEntry();
  }
});

function centerView() {
  fitDiagramView();
}
function fitView() {
  fitDiagramView();
}

function setMode(mode, opts) {
  opts = opts || {};
  document.documentElement.dataset.drawerMode = "diagram";
  if (opts.persist !== false) saveDrawerUi({ mode: "board" });
  try { setKindUI(diagramSourceEl && diagramSourceEl.value); } catch (_e) {}
  closeExportMenu();
  if (opts.restore) _drawerUiRestoreLock = true;
  var hasBoard = !!(previewEl && previewEl.querySelector(".board-render"));
  var skipBoard = !!(opts.restore && hasBoard);
  if (!skipBoard) {
    renderDiagram({ fit: false, restoreView: true });
    if (typeof cloudRefreshGroups === "function") void cloudRefreshGroups();
  } else {
    applyRestoredDiagramView();
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
  document.documentElement.dataset.drawerMode = "diagram";
  saveDrawerUi({ mode: "board" });
  setMode("board", { restore: true, persist: false });
  try {
    var tab = ui.dockTab || "";
    if (tab === "export" || tab === "style" || tab === "source" || tab === "props" || tab === "layout") {
      openDock(tab);
    }
  } catch (_e) {}
}
await bootstrapDiagram();
restoreDrawerMode();
if (typeof diagramPersistMode !== "function" || diagramPersistMode() !== "hash") {
  setInterval(() => { void loadDiagramPolled(); }, 1500);
} else {
  window.addEventListener("hashchange", function() {
    // Never drop a navigation: flush the outgoing cloud board first, then load the new one.
    var pending = Promise.resolve();
    if (diagramDirty || diagramSaveTimer) {
      clearTimeout(diagramSaveTimer);
      diagramSaveTimer = null;
      var outgoingId = "";
      outgoingId = typeof liveDiagramId !== "undefined" ? String(liveDiagramId || "") : "";
      if (diagramDirty && outgoingId && !cloudPlusDraftActive && typeof saveDiagramToCloud === "function" && !(typeof isShareGuest === "function" && isShareGuest())) {
        pending = saveDiagramToCloud({ explicit: false }).catch(function() { return false; });
      }
      diagramDirty = false;
    }
    void pending.then(function() { return bootstrapDiagram(); }).then(function() {
      if (typeof renderDiagram === "function" && diagramSourceEl && diagramSourceEl.value.trim()) {
        renderDiagram({ fit: false, restoreView: true });
      }
    });
  });
}

function applyCreateKindPick(kind, commit) {
  if (typeof commit === "function") commit(kind);
}

(function bootGroups() {
  if (typeof cloudRefreshGroups === "function") void cloudRefreshGroups();
})();

