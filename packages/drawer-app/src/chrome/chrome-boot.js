/* Board chrome + boot. */
import BoxesRender from '../../../boxes/index.js';
import * as BoxesThemes from '../../../boxes/themes/index.js';
import { TypeScale, MaxWidth } from '../../../boxes/themes/index.js';
import { register } from '../core/hooks.js';
import { sentryCount } from '../core/sentry-count.js';
import DrawerPeleTheme from '../core/pele-theme.js';
import DrawerStyleLine from '../core/style-line.js';
import { persistBoardStyle } from '../kinds/board-style.js';
import {
  pickBoardElement,
  inspectBoardSelection,
  consumeInspectClick,
  commitBoardTitle,
  filterBoardIdEditor,
  commitBoardId,
  markBoardIdCopied,
  commitBoardType,
  commitBoardMaxWidth,
  resetBoardMaxWidth,
  commitBoardItemAlign,
  resetBoardItemAlign,
  commitBoardShape,
  commitBoardArrow,
  commitBoardReverse,
  commitBoardDir,
  commitBoardAlignX,
  commitBoardAlignY,
  commitBoardIcon,
  openBoardIconPop,
  closeBoardIconPop,
  placeBoardIconPop,
  commitBoardNodeFont,
  syncBoardLinkRouteButton,
  boardTitlePinEl,
} from '../kinds/board.js';
import {
  scheduleDiagramRender,
  scheduleDiagramSave,
  renderDiagram,
  bootstrapDiagram,
  loadDiagramPolled,
  clearDrawerBoot,
  previewHasPaint,
} from '../kinds/diagram.js';
import { copyText, showCopyTip } from '../export/render-io.js';
import { exportDiagramFile, exportPng } from '../export/export-png.js';
import { noteUserCanvasView, forgetDocumentView } from './canvas-view.js';
import { cloudRefreshGroups, saveDiagramToCloud } from '../cloud/cloud-sync.js';
import { isShareGuest } from '../cloud/cloud-share.js';
import { cloudPlusDraftActive } from '../cloud/cloud-state.js';
import { diagramPersistMode } from '../core/hash-persist.js';
import {
  $,
  diagramSourceEl,
  previewEl,
  boardTitleEditor,
  boardIdEditor,
  boardIdCopy,
  boardTypeEditor,
  boardMaxWidthInput,
  boardMaxWidthReset,
  boardShapeEditor,
  boardArrowEditor,
  boardArrowReverse,
  boardDirEditor,
  boardAlignXEditor,
  boardAlignYEditor,
  boardIconList,
  boardIconTrigger,
  boardIconPop,
  boardIconPick,
  selectedBoardNode,
  diagramDock,
  toggleDock,
  openDock,
  boardMaxWidthSlider,
  boardFontSizeSlider,
  boardNodeFontSlider,
  scale,
  applyTransform,
  setCanvasZoom,
  syncStyleLayoutSections,
  saveDrawerUi,
  loadDrawerUi,
  setKindUI,
  applyRestoredDiagramView,
  fitDiagramView,
  setStatus,
  liveDiagramPath,
  liveRecordId,
  liveDiagramId,
  diagramDirty,
  diagramSaveTimer,
  setDiagramDirty,
  setDiagramSaveTimer,
  setDrawerUiRestoreLock,
  updateDiagramChars,
} from '../state/shell-state.js';

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
if (boardMaxWidthInput) {
  boardMaxWidthInput.addEventListener("change", commitBoardMaxWidth);
  boardMaxWidthInput.addEventListener("keydown", function(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commitBoardMaxWidth();
  });
}
if (boardMaxWidthReset) boardMaxWidthReset.addEventListener("click", resetBoardMaxWidth);
var boardItemAlignEditor = document.getElementById("board-item-align-editor");
var boardItemAlignReset = document.getElementById("board-item-align-reset");
if (boardItemAlignEditor) boardItemAlignEditor.addEventListener("change", commitBoardItemAlign);
if (boardItemAlignReset) boardItemAlignReset.addEventListener("click", resetBoardItemAlign);
if (boardShapeEditor) boardShapeEditor.addEventListener("change", function() {
  commitBoardShape(boardShapeEditor.value);
});
if (boardArrowEditor) boardArrowEditor.addEventListener("change", commitBoardArrow);
if (boardArrowReverse) boardArrowReverse.addEventListener("click", commitBoardReverse);
if (boardDirEditor) boardDirEditor.addEventListener("change", commitBoardDir);
if (boardAlignXEditor) boardAlignXEditor.addEventListener("change", commitBoardAlignX);
if (boardAlignYEditor) boardAlignYEditor.addEventListener("change", commitBoardAlignY);
if (boardIconTrigger) boardIconTrigger.addEventListener("click", function() {
  if (boardIconPop && !boardIconPop.hidden) closeBoardIconPop();
  else openBoardIconPop();
});
if (boardIconList) boardIconList.addEventListener("click", function(event) {
  var btn = event.target && event.target.closest ? event.target.closest(".props-icon-btn") : null;
  if (!btn) return;
  var n = Number(btn.dataset.icon);
  if (selectedBoardNode && selectedBoardNode.kind === "box" && Number(boardIconPick) === n) {
    commitBoardIcon(null);
  } else {
    commitBoardIcon(n);
  }
  closeBoardIconPop();
});
if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", function(event) {
    if (!boardIconPop || boardIconPop.hidden) return;
    var target = event.target;
    if (target && target.closest && (target.closest("#board-icon-pop") || target.closest("#board-icon-trigger"))) return;
    closeBoardIconPop();
  });
  document.addEventListener("keydown", function(event) {
    if (event.key !== "Escape" || !boardIconPop || boardIconPop.hidden) return;
    closeBoardIconPop();
  });
  var iconPropsPanel = document.querySelector("[data-dock-panel=\"props\"]");
  if (iconPropsPanel) iconPropsPanel.addEventListener("scroll", closeBoardIconPop);
  window.addEventListener("resize", function() {
    if (boardIconPop && !boardIconPop.hidden) placeBoardIconPop();
  });
}

(function(){
  if (diagramDock) {
    diagramDock.querySelectorAll("[data-dock]").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var dock = btn.getAttribute("data-dock");
        var names = { props: "canvas.dock_props", style: "canvas.dock_style", export: "canvas.dock_export" };
        if (names[dock] && typeof sentryCount === "function") sentryCount(names[dock]);
        toggleDock(dock);
      });
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
  if (BoxesThemes && typeof BoxesThemes.resolveId === 'function') return BoxesThemes.resolveId(v);
  const allowed = ['default', 'classic', 'pastel'];
  return allowed.includes(v) ? v : 'default';
}
const MAX_WIDTH_KEY = 'drawer.boardMaxWidth';
const MAX_WIDTH_DEFAULT = 0;
let boardMaxWidthTimer = 0;
function paintStyleRange(el) {
  if (!el) return;
  var min = Number(el.min);
  var max = Number(el.max);
  var val = Number(el.value);
  var span = max - min;
  el.style.setProperty('--cap-fill', (span === 0 ? 0 : ((val - min) / span) * 100) + '%');
}
function currentBoardMaxWidth() {
  const raw = localStorage.getItem(MAX_WIDTH_KEY);
  if (raw == null || raw === '') return MAX_WIDTH_DEFAULT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return MAX_WIDTH_DEFAULT;
  return (TypeScale && typeof TypeScale.clampStep === 'function')
    ? TypeScale.clampStep(n)
    : Math.min(3, Math.max(-3, Math.round(n)));
}
function applyBoardMaxWidth(step, rerender, persist) {
  const kind = document.documentElement && document.documentElement.dataset.kind;
  if (typeof DrawerStyleLine !== "undefined" && typeof DrawerStyleLine.isMermaidKind === "function"
    ? DrawerStyleLine.isMermaidKind(kind)
    : (kind === "flowchart" || kind === "mindmap" || kind === "mermaid-unsupported")) {
    if (boardMaxWidthSlider) {
      var lockCap = kind === "flowchart" || (typeof DrawerStyleLine !== "undefined"
        && typeof DrawerStyleLine.isDesignKind === "function"
        && DrawerStyleLine.isDesignKind(kind));
      boardMaxWidthSlider.disabled = lockCap;
      if (lockCap) boardMaxWidthSlider.setAttribute("aria-disabled", "true");
      else boardMaxWidthSlider.removeAttribute("aria-disabled");
      paintStyleRange(boardMaxWidthSlider);
    }
    return;
  }
  const n = step == null
    ? currentBoardMaxWidth()
    : ((TypeScale && typeof TypeScale.clampStep === 'function')
      ? TypeScale.clampStep(step)
      : Math.min(3, Math.max(-3, Math.round(Number(step) || MAX_WIDTH_DEFAULT))));
  localStorage.setItem(MAX_WIDTH_KEY, String(n));
  const itemCss = (MaxWidth && typeof MaxWidth.remCss === 'function')
    ? MaxWidth.remCss(n, 'item')
    : ((16 + 2 * n) + 'rem');
  const boxCss = (MaxWidth && typeof MaxWidth.remCss === 'function')
    ? MaxWidth.remCss(n, 'box')
    : ((20 + 2 * n) + 'rem');
  document.documentElement.style.setProperty('--board-item-cap', itemCss);
  document.documentElement.style.setProperty('--board-box-cap', boxCss);
  if (boardMaxWidthSlider) {
    boardMaxWidthSlider.disabled = false;
    boardMaxWidthSlider.value = String(n);
  }
  paintStyleRange(boardMaxWidthSlider);
  if (persist && typeof persistBoardStyle === 'function') persistBoardStyle({ max_width: n });
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
    if (BoxesThemes && typeof BoxesThemes.applyTo === 'function') BoxesThemes.applyTo(el, t);
    else el.dataset.boardTheme = t;
  });
  applyPeleThemeVars(t);
}
function applyKindTheme(theme, opts) {
  const t = (BoxesThemes && typeof BoxesThemes.resolveId === 'function')
    ? BoxesThemes.resolveId(theme)
    : ((['default', 'classic', 'pastel'].includes(theme) ? theme : 'default'));
  localStorage.setItem(KIND_THEME_KEY, t);
  localStorage.setItem('drawer.boardTheme', t); // back-compat
  const themeSelect = document.getElementById('kindThemeSelect');
  if (themeSelect) themeSelect.value = t;
  document.documentElement.dataset.kindTheme = t;
  document.querySelectorAll('.board-render').forEach((el) => {
    if (BoxesThemes && typeof BoxesThemes.applyTo === 'function') BoxesThemes.applyTo(el, t);
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
applyBoardMaxWidth();
if (boardMaxWidthSlider) {
  boardMaxWidthSlider.addEventListener('input', function() {
    applyBoardMaxWidth(boardMaxWidthSlider.value, false, false);
    clearTimeout(boardMaxWidthTimer);
    boardMaxWidthTimer = setTimeout(function() { applyBoardMaxWidth(boardMaxWidthSlider.value, true, true); }, 160);
  });
}
let boardFontSizeTimer = 0;
function applyBoardTypeStep(raw, persist, rerender) {
  const n = (TypeScale && typeof TypeScale.clampStep === 'function')
    ? TypeScale.clampStep(raw)
    : Math.min(3, Math.max(-3, Math.round(Number(raw) || 0)));
  document.documentElement.dataset.boardTypeStep = String(n);
  if (boardFontSizeSlider) boardFontSizeSlider.value = String(n);
  paintStyleRange(boardFontSizeSlider);
  if (persist && typeof persistBoardStyle === 'function') persistBoardStyle({ font_size: n });
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
  if (opts.restore) setDrawerUiRestoreLock(true);
  var skipBoard = !!(opts.restore && previewHasPaint(previewEl));
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
      requestAnimationFrame(function() { setDrawerUiRestoreLock(false); });
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
      setDiagramSaveTimer(null);
      var outgoingId = "";
      outgoingId = typeof liveDiagramId !== "undefined" ? String(liveDiagramId || "") : "";
      if (diagramDirty && outgoingId && !cloudPlusDraftActive && typeof saveDiagramToCloud === "function" && !(typeof isShareGuest === "function" && isShareGuest())) {
        pending = saveDiagramToCloud({ explicit: false }).catch(function() { return false; });
      }
      setDiagramDirty(false);
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

register("flashChrome", flashChrome);
register("closeExportMenu", closeExportMenu);
register("currentKindTheme", currentKindTheme);
register("paintStyleRange", paintStyleRange);
register("currentBoardMaxWidth", currentBoardMaxWidth);
register("applyBoardMaxWidth", applyBoardMaxWidth);
register("applyPeleThemeVars", applyPeleThemeVars);
register("applyBoardThemeToPreview", applyBoardThemeToPreview);
register("applyKindTheme", applyKindTheme);
register("placeMenuPanel", placeMenuPanel);
register("applyBoardTypeStep", applyBoardTypeStep);
register("closeCanvasExport", closeCanvasExport);
register("activeSourceText", activeSourceText);
register("activeSourcePath", activeSourcePath);
register("syncSheetCssVar", syncSheetCssVar);
register("setSheetCollapsed", setSheetCollapsed);
register("toggleSourceEntry", toggleSourceEntry);
register("centerView", centerView);
register("fitView", fitView);
register("setMode", setMode);
register("restoreDrawerMode", restoreDrawerMode);
register("applyCreateKindPick", applyCreateKindPick);
export {
  flashChrome,
  closeExportMenu,
  currentKindTheme,
  paintStyleRange,
  currentBoardMaxWidth,
  applyBoardMaxWidth,
  applyPeleThemeVars,
  applyBoardThemeToPreview,
  applyKindTheme,
  placeMenuPanel,
  applyBoardTypeStep,
  closeCanvasExport,
  activeSourceText,
  activeSourcePath,
  syncSheetCssVar,
  setSheetCollapsed,
  toggleSourceEntry,
  centerView,
  fitView,
  setMode,
  restoreDrawerMode,
  applyCreateKindPick
};
