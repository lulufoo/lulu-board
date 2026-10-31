/* drawer-app shell state. Live camera and chrome refs. */
import BoxesRender from '../../../boxes/index.js';
import FlowchartEdit from '../../../mermaid-ext/flowchart/index.js';
import { emit, call } from '../core/hooks.js';
import { stripDocumentMeta } from '../core/document-meta.js';
import DrawerStyleLine from '../core/style-line.js';

/** HTTP header values must be ISO-8859-1; encode anything else (e.g. Chinese titles). */
function headerByteString(value) {
  var s = String(value == null ? "" : value);
  if (!s) return "";
  for (var i = 0; i < s.length; i += 1) {
    if (s.charCodeAt(i) > 255) return "utf8''" + encodeURIComponent(s);
  }
  return s;
}

function formatVersionLabel(version) {
  var v = Number(version);
  return Number.isFinite(v) && v > 0 ? ("v" + v) : "";
}
function setCharsLabel(el, n) {
  if (!el) return;
  el.textContent = "";
  var num = document.createElement("b");
  num.textContent = Number(n).toLocaleString("en-US");
  el.appendChild(num);
  el.appendChild(document.createTextNode(" chars"));
}
function liveDocumentVersion() {
  return Number.isFinite(diagramLocalRev) && diagramLocalRev > 0 ? diagramLocalRev : 0;
}

function wrapEditorApi(api) {
  if (!api) return;
  Object.keys(api).forEach(function(key) {
    var fn = api[key];
    if (typeof fn !== "function") return;
    api[key] = function(text) {
      if (typeof text !== "string") return fn.apply(api, arguments);
      var body = stripDocumentMeta(text);
      if (body === text) return fn.apply(api, arguments);
      var args = Array.prototype.slice.call(arguments);
      args[0] = body;
      return fn.apply(api, args);
    };
  });
}

/* drawer-app/01-shell-state.js — lines 1-699 of former inline module */
const $ = (s) => (typeof document !== "undefined" ? document.querySelector(s) : null);
const diagramSourceEl = $('#diagramSource');
const diagramError = $("#diagramError");
const diagramDock = $("#diagramDock");
const propsPanel = $("#propsPanel");
const propsEmpty = $("#propsEmpty");
const propsFields = $("#propsFields");
const propsKindLabel = $("#propsKindLabel");
const propsHint = $("#propsHint");
const boardTitleEditor = $("#boardTitleEditor");
const boardTypeEditor = $("#boardTypeEditor");
const boardShapeEditor = $("#boardShapeEditor");
const boardTitleLabel = $("#boardTitleLabel");
const boardTypeLabel = $("#boardTypeLabel");
const boardShapeLabel = $("#boardShapeLabel");
const boardMaxWidthField = $("#board-max-width-field");
const boardMaxWidthInput = $("#board-max-width-input");
const boardMaxWidthLabel = $("#board-max-width-label");
const boardMaxWidthTip = $("#board-max-width-tip");
const boardMaxWidthReset = $("#board-max-width-reset");
const boardMaxWidthSlider = $("#board-max-width-slider");
const boardFontSizeSlider = $("#boardFontSizeSlider");
const boardNodeFontField = $("#boardNodeFontField");
const boardNodeFontSlider = $("#boardNodeFontSlider");
const boardNodeFontLabel = $("#boardNodeFontLabel");
const boardNodeFontTip = $("#boardNodeFontTip");
const boardIdLabel = $("#boardIdLabel");
const boardIdField = $("#boardIdField");
const boardIdEditor = $("#boardIdEditor");
const boardIdCopy = $("#boardIdCopy");
const boardIdDup = $("#boardIdDup");
// Drawer lists. Top-level code in 06-* (e.g. syncShareChrome) reads them before 09-shell-drawer.js runs,
// and a `var` is hoisted but not yet assigned, so they are initialised here, at the front of the bundle.
var shellGroups = [];
var shellShares = [];
var shellMineTotal = null;
var shellMineCursor = null;
var boardIdCopiedTimer = 0;
const boardDirEditor = $("#boardDirEditor");
const boardDirLabel = $("#boardDirLabel");
const boardDirTip = $("#boardDirTip");
const boardAlignEditor = $("#boardAlignEditor");
const boardAlignLabel = $("#boardAlignLabel");
const boardAlignTip = $("#boardAlignTip");
const boardJustifyEditor = $("#boardJustifyEditor");
const boardJustifyLabel = $("#boardJustifyLabel");
const boardJustifyTip = $("#boardJustifyTip");
const boardOrderField = $("#board-order-field");
const boardOrderLabel = $("#board-order-label");
const boardOrderPrev = $("#btn-board-order-prev");
const boardOrderNext = $("#btn-board-order-next");
const boardArrowEditor = $("#boardArrowEditor");
const boardArrowLabel = $("#boardArrowLabel");
const boardArrowField = $("#boardArrowField");
const boardArrowReverse = $("#boardArrowReverse");


const boardIconField = $("#boardIconField");
const boardIconLabel = $("#boardIconLabel");
const boardIconTrigger = $("#board-icon-trigger");
const boardIconTriggerGlyph = $("#board-icon-trigger-glyph");
const boardIconTriggerName = $("#board-icon-trigger-name");
const boardIconPop = $("#board-icon-pop");
const boardIconCurrent = $("#board-icon-current");
const boardIconList = $("#board-icon-list");
var boardIconPick = 1;
function currentDockTab() {
  return (diagramDock && diagramDock.getAttribute("data-open")) || "";
}
function openDock(tab) {
  if (!diagramDock) return;
  var next = tab || "";
  if (next !== "props" && next !== "layout" && next !== "source" && next !== "export" && next !== "style") next = "";
  diagramDock.setAttribute("data-open", next);
  if (propsPanel) propsPanel.setAttribute("data-collapsed", next === "props" ? "false" : "true");
  Array.from(diagramDock.querySelectorAll("[data-dock]")).forEach(function(btn) {
    var on = btn.getAttribute("data-dock") === next && next !== "";
    btn.setAttribute("aria-selected", on ? "true" : "false");
    btn.classList.toggle("is-active", on);
  });
  saveDrawerUi({ dockTab: next, propsOpen: next === "props" });
}
function openPropsPanel() { openDock("props"); }
function closePropsPanel() {
  openDock("");
}
function toggleDock(tab) {
  if (currentDockTab() === tab) openDock("");
  else openDock(tab);
}
const boardInspector = {
  get hidden() { return !(propsFields && !propsFields.hidden); },
  set hidden(v) {
    if (!propsPanel) return;
    if (v) {
      if (propsEmpty) propsEmpty.hidden = false;
      if (propsFields) propsFields.hidden = true;
      if (propsKindLabel) propsKindLabel.textContent = "—";
      if (propsHint) propsHint.textContent = "";
      emit("setBoardIdField", false);
    } else {
      if (propsEmpty) propsEmpty.hidden = true;
      if (propsFields) propsFields.hidden = false;
    }
  }
};
const boardAddBoxButton = $("#btnBoardAddBox");
const boardAddItemButton = $("#btnBoardAddItem");
const boardDeleteButton = $("#btnBoardDelete");
const boardLinkButton = $("#btnBoardLink");
const previewEl = $('#preview');
const stageEl = $('#preview-stage');
const boardSelectionObserver = typeof MutationObserver === "function" ? new MutationObserver(() => { var key = diagramSourceEl.dataset.boardSelectionKey; if (!key) return; if (key.indexOf("tree:") === 0) key = "box:" + key.slice(5); const selected = Array.from(previewEl.querySelectorAll("[data-board-key]")).find((el) => el.dataset.boardKey === key); if (selected) selected.classList.add("board-selection", "canvas-selected"); }) : null;
if (previewEl && boardSelectionObserver) boardSelectionObserver.observe(previewEl, { childList: true, subtree: true });

let diagramLocalRev = 0;
let diagramServerRev = 0;
let diagramDirty = false;
let diagramSaveSeq = 0;
let diagramRenderTimer = null;
let selectedBoardNode = null;
let selectedBoardEdge = null;
let boardInspectGesture = null;
let boardLinkMode = false;
let boardLinkStart = null;
let diagramSaveTimer = null;
let liveDiagramId = "";
let liveDiagramArchive = "";
let liveDiagramPath = "";
/* Live camera only. The per-board source of truth is the document's style.viewport
 * (00-canvas-view.js); nothing here is persisted or carried across boards. */
let scale = 1, panX = 0, panY = 0;

/* ── Drawer UI persistence (`localStorage["drawer.ui"]`) ─────────────────
 * Persist list (refresh restores these). Add a field here when wiring a new one:
 *   mode             "board"
 *   sheetCollapsed   boolean
 *   propsOpen        boolean   — right Props panel (legacy)
 *   dockTab          "" | "props" | "layout" | "source" | "style" | "export"
 *   dockWidth        number   — open sidebar width (px)
 * Canvas zoom/pan is NOT stored here: it lives only in the board document's style.viewport.
 * Other already-persistent keys (unchanged): drawer.kindTheme, drawer.boardLinkRoute, drawer.boardMaxWidth
 * Board documents also persist those in `style <base64>` when not default.
 */
var DRAWER_UI_KEY = "drawer.ui";
var DRAWER_UI_VERSION = 1;
var DOCK_WIDTH_MIN = 280;
var DOCK_WIDTH_MAX = 720;
function clampDockWidth(n) {
  var maxPx = Math.min(DOCK_WIDTH_MAX, Math.max(DOCK_WIDTH_MIN, Math.floor((typeof window !== "undefined" ? window.innerWidth : 1280) * 0.8)));
  var w = Number(n);
  if (!isFinite(w)) w = 400;
  return Math.min(maxPx, Math.max(DOCK_WIDTH_MIN, Math.round(w)));
}
function applyDockWidth(n, persist) {
  var w = clampDockWidth(n);
  if (diagramDock) diagramDock.style.setProperty("--dock-open-width", w + "px");
  if (persist) saveDrawerUi({ dockWidth: w });
  return w;
}
function currentDockWidth() {
  if (diagramDock) {
    var raw = diagramDock.style.getPropertyValue("--dock-open-width");
    var n = parseInt(raw, 10);
    if (isFinite(n) && n > 0) return clampDockWidth(n);
  }
  return clampDockWidth(loadDrawerUi().dockWidth);
}
var DRAWER_UI_PERSIST_LIST = [
  { key: "mode", kind: "enum:board" },
  { key: "sheetCollapsed", kind: "boolean" },
  { key: "propsOpen", kind: "boolean" },
  { key: "dockTab", kind: "enum:|props|layout|source|style|export" },
  { key: "dockWidth", kind: "number" }
];
function defaultDrawerUi() {
  return { v: DRAWER_UI_VERSION, mode: "board", sheetCollapsed: true, propsOpen: false, dockTab: "", dockWidth: 400 };
}
function loadDrawerUi() {
  var out = defaultDrawerUi();
  try {
    var raw = localStorage.getItem(DRAWER_UI_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        out.mode = "board";
        if (typeof parsed.sheetCollapsed === "boolean") out.sheetCollapsed = parsed.sheetCollapsed;
        if (typeof parsed.propsOpen === "boolean") out.propsOpen = parsed.propsOpen;
        if (parsed.dockTab === "" || parsed.dockTab === "props" || parsed.dockTab === "layout" || parsed.dockTab === "source" || parsed.dockTab === "style" || parsed.dockTab === "export") out.dockTab = parsed.dockTab;
        else if (out.propsOpen) out.dockTab = "props";
        if (typeof parsed.dockWidth === "number" && isFinite(parsed.dockWidth)) out.dockWidth = clampDockWidth(parsed.dockWidth);
      }
    } else {
      try { if (localStorage.getItem("drawer.propsOpen") === "1") out.propsOpen = true; } catch (_e) {}
    }
  } catch (_e) {}
  return out;
}
function saveDrawerUi(patch) {
  var next = Object.assign(loadDrawerUi(), patch || {}, { v: DRAWER_UI_VERSION });
  try { localStorage.setItem(DRAWER_UI_KEY, JSON.stringify(next)); } catch (_e) {}
  try { localStorage.setItem("drawer.propsOpen", next.propsOpen ? "1" : "0"); } catch (_e) {}
  return next;
}
function snapshotDrawerUi() {
  var app = $("#app");
  return saveDrawerUi({
    mode: "board",
    sheetCollapsed: !!(app && app.classList.contains("sheet-collapsed")),
    propsOpen: currentDockTab() === "props",
    dockTab: currentDockTab(),
    dockWidth: currentDockWidth()
  });
}
var _drawerUiRestoreLock = false;
function flushDrawerUiSave() {
  if (_drawerUiRestoreLock) return;
  snapshotDrawerUi();
}
if (typeof window !== "undefined") window.addEventListener("pagehide", flushDrawerUiSave);
if (typeof document !== "undefined") document.addEventListener("visibilitychange", function() {
  if (document.visibilityState === "hidden") flushDrawerUiSave();
});
(function hydrateDrawerUiView() {
  if (typeof document === "undefined") return;
  applyDockWidth(loadDrawerUi().dockWidth, false);
})();
(function wireDockResize() {
  if (typeof document === "undefined") return;
  var handle = document.getElementById("diagramDockResize");
  if (!handle || !diagramDock) return;
  var drag = null;
  handle.addEventListener("pointerdown", function(e) {
    if (!diagramDock.getAttribute("data-open")) return;
    e.preventDefault();
    try { handle.setPointerCapture(e.pointerId); } catch (_e) {}
    drag = { x: e.clientX, w: currentDockWidth() };
    diagramDock.classList.add("is-resizing");
  });
  handle.addEventListener("pointermove", function(e) {
    if (!drag) return;
    applyDockWidth(drag.w + (drag.x - e.clientX), false);
  });
  function endDrag() {
    if (!drag) return;
    drag = null;
    diagramDock.classList.remove("is-resizing");
    saveDrawerUi({ dockWidth: currentDockWidth() });
  }
  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);
})();

function setStatus(msg, isError = false) {
  const el = $('#statusFloat');
  if (!el) return; // status chrome removed — keep API for callers
  el.textContent = msg;
  el.classList.toggle('err', !!isError);
}

function applyDiagramLiveMeta(meta = {}) {
  if (meta && meta.id) liveDiagramId = String(meta.id);
  else if (meta && meta.id === "") liveDiagramId = "";
  // Protocol: meta.current points at the editable history record (SSOT).
  // Legacy clients may still send archive — treat it as current.
  if (meta && Object.prototype.hasOwnProperty.call(meta, "current")) {
    liveDiagramArchive = meta.current ? String(meta.current).split("/").pop() : "";
  } else if (meta && Object.prototype.hasOwnProperty.call(meta, "archive")) {
    liveDiagramArchive = meta.archive ? String(meta.archive).split("/").pop() : "";
  }
  if (meta && meta.path) liveDiagramPath = String(meta.path);
  else if (meta && meta.current && String(meta.current).startsWith("/")) liveDiagramPath = String(meta.current);
  if (meta && Number.isFinite(Number(meta.version != null ? meta.version : meta.rev))) {
    if (!Number.isFinite(diagramLocalRev) || diagramLocalRev <= 0) diagramLocalRev = Number(meta.version != null ? meta.version : meta.rev);
  }
  if (typeof syncSourceIdChrome === "function") syncSourceIdChrome();
  if (typeof syncSourceDockLabel === "function") syncSourceDockLabel();
}

function syncStyleLayoutSections() {
  var kind = document.documentElement && document.documentElement.dataset.kind;
  var mermaid = DrawerStyleLine.isMermaidKind
    ? DrawerStyleLine.isMermaidKind(kind)
    : (kind === "flowchart" || kind === "mindmap" || kind === "mermaid-unsupported");
  var flowchart = kind === "flowchart";
  var design = DrawerStyleLine.isDesignKind && DrawerStyleLine.isDesignKind(kind);
  var capLocked = flowchart || design;
  var board = document.getElementById("boardLayoutSection");
  if (board) board.hidden = mermaid;
  var typeSec = document.getElementById("boardFontSizeSection");
  if (typeSec) typeSec.hidden = kind === "mermaid-unsupported" || kind === "mindmap";
  var capSec = document.getElementById("board-max-width-section");
  var capSlider = document.getElementById("board-max-width-slider");
  if (capSec) {
    capSec.hidden = kind === "mermaid-unsupported" || kind === "mindmap";
    capSec.classList.toggle("is-disabled", capLocked);
  }
  if (capSlider) {
    capSlider.disabled = capLocked;
    if (capLocked) capSlider.setAttribute("aria-disabled", "true");
    else capSlider.removeAttribute("aria-disabled");
  }
}

function liveKindLabel() {
  var text = diagramSourceEl ? diagramSourceEl.value : "";
  if (DrawerStyleLine.bodyKindLabel) {
    return DrawerStyleLine.bodyKindLabel(text);
  }
  return "Boxes";
}
function syncSourceDockLabel() {
  var tab = document.getElementById("sourceDockTabLabel");
  var title = document.getElementById("sourceDockTitle");
  var btn = document.getElementById("btnDockSource");
  if (tab && tab.textContent !== "Source") tab.textContent = "Source";
  if (btn && btn.title !== "Source") btn.title = "Source";
  var version = typeof liveDocumentVersion === "function" ? liveDocumentVersion() : 0;
  var label = liveKindLabel();
  if (title && title.textContent !== label) title.textContent = label;
  var verEl = document.getElementById("sourceDockVersion");
  var verText = formatVersionLabel(version);
  if (verEl) {
    verEl.textContent = verText;
    verEl.hidden = !verText;
  }
  if (typeof syncSourceIdChrome === "function") syncSourceIdChrome();
}
function liveRecordId() {
  return String(typeof liveDiagramId !== "undefined" ? liveDiagramId : "");
}
function syncSourceIdChrome() {
  var id = liveRecordId();
  var copyId = document.getElementById("btnSourceCopyId");
  var copySrc = document.getElementById("btnSourceCopy");
  if (copyId) {
    copyId.textContent = "ID";
    copyId.title = id ? ("Copy ID " + id) : "Copy ID";
    copyId.disabled = !id;
  }
  if (copySrc) {
    copySrc.textContent = "Source";
    copySrc.title = "Copy Source";
  }
}

function setKindUI() {
  const kindPill = $('#kindPill');
  var label = liveKindLabel();
  if (typeof syncSourceDockLabel === 'function') syncSourceDockLabel();
  if (kindPill) {
    kindPill.replaceChildren();
    var bold = document.createElement("b");
    bold.textContent = label;
    kindPill.appendChild(bold);
  }
  var hint = $('#exportKindHint');
  if (hint) hint.textContent = label + ' mode · Export File below.';
  var zoomType = document.getElementById("zoom-kind-label");
  var zoomSep = document.getElementById("zoom-type-sep");
  var showZoomType = !!(label && label !== "Source");
  if (zoomType) {
    zoomType.textContent = showZoomType ? label : "";
    zoomType.hidden = !showZoomType;
  }
  if (zoomSep) zoomSep.hidden = !showZoomType;
  if (typeof syncStyleLayoutSections === 'function') syncStyleLayoutSections();
}
function setCameraPan(x, y) {
  panX = x;
  panY = y;
}
function setDiagramLocalRev(n) { diagramLocalRev = n; }
function setDiagramServerRev(n) { diagramServerRev = n; }
function setDiagramDirty(v) { diagramDirty = !!v; }
function setDiagramSaveTimer(t) { diagramSaveTimer = t; }
function setDiagramSaveSeq(n) { diagramSaveSeq = n; }
function bumpDiagramSaveSeq() { diagramSaveSeq += 1; return diagramSaveSeq; }
function setDiagramRenderTimer(t) { diagramRenderTimer = t; }
function setSelectedBoardNode(v) { selectedBoardNode = v; }
function setSelectedBoardEdge(v) { selectedBoardEdge = v; }
function setBoardInspectGesture(v) { boardInspectGesture = v; }
function setBoardLinkModeFlag(v) { boardLinkMode = !!v; }
function setBoardLinkStart(v) { boardLinkStart = v; }
function setBoardIconPick(v) { boardIconPick = v; }
function setBoardIdCopiedTimer(v) { boardIdCopiedTimer = v; }
function setShellGroups(v) { shellGroups = v; }
function setShellShares(v) { shellShares = v; }
function setShellMineTotal(v) { shellMineTotal = v; }
function setShellMineCursor(v) { shellMineCursor = v; }
function setLiveDiagramId(v) { liveDiagramId = v == null ? "" : String(v); }
function setDrawerUiRestoreLock(v) { _drawerUiRestoreLock = !!v; }
function setLiveCamera(nextScale, x, y) {
  scale = nextScale;
  panX = x;
  panY = y;
}

function applyTransform() {
  if (!previewEl || !previewEl.style) return;
  previewEl.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  var zr = typeof document !== "undefined" ? document.querySelector("#btnZoomReset") : null;
  if (zr) zr.textContent = Math.round(scale * 100) + "%";
}
/* Zoom the stage about its centre: the camera's world point stays put. */
function setCanvasZoom(nextScale) {
  nextScale = Math.min(3, Math.max(0.2, Number(nextScale)));
  if (!isFinite(nextScale)) return;
  var cam = call("readCamera");
  if (cam && nextScale !== cam.scale) {
    cam.scale = nextScale;
    if (call("applyCamera", cam)) return;
  }
  scale = nextScale;
  applyTransform();
}
function applyRestoredDiagramView() {
  call("pinDiagramTitle");
  call("restoreOrFit");
}
function fitDiagramView() {
  if (!previewEl) return;
  call("pinDiagramTitle");
  call("fitWorld");
  requestAnimationFrame(function () {
    if (!previewEl || !diagramSourceEl) return;
    var key = diagramSourceEl.dataset.boardSelectionKey;
    if (key && key.indexOf("tree:") === 0) key = "box:" + key.slice(5);
    var retained = key && Array.from(previewEl.querySelectorAll("[data-board-key]")).find(function(el) { return el.dataset.boardKey === key; });
    if (retained) retained.classList.add("board-selection", "canvas-selected");
  });
}
function updateDiagramChars() {
  setCharsLabel($('#diagramCharsPill'), [...diagramSourceEl.value].length);
}
function showDiagramError(message) { diagramError.textContent = message || ''; diagramError.classList.toggle('show', !!message); }

wrapEditorApi(typeof BoxesRender !== "undefined" ? BoxesRender : null);
wrapEditorApi(typeof FlowchartEdit !== "undefined" ? FlowchartEdit : null);

export {
  headerByteString,
  formatVersionLabel,
  setCharsLabel,
  liveDocumentVersion,
  wrapEditorApi,
  $,
  diagramSourceEl,
  diagramError,
  diagramDock,
  propsPanel,
  propsEmpty,
  propsFields,
  propsKindLabel,
  propsHint,
  boardTitleEditor,
  boardTypeEditor,
  boardShapeEditor,
  boardTitleLabel,
  boardTypeLabel,
  boardShapeLabel,
  boardMaxWidthField,
  boardMaxWidthInput,
  boardMaxWidthLabel,
  boardMaxWidthTip,
  boardMaxWidthReset,
  boardMaxWidthSlider,
  boardFontSizeSlider,
  boardNodeFontField,
  boardNodeFontSlider,
  boardNodeFontLabel,
  boardNodeFontTip,
  boardIdLabel,
  boardIdField,
  boardIdEditor,
  boardIdCopy,
  boardIdDup,
  shellGroups,
  shellShares,
  shellMineTotal,
  shellMineCursor,
  boardIdCopiedTimer,
  boardDirEditor,
  boardDirLabel,
  boardDirTip,
  boardAlignEditor,
  boardAlignLabel,
  boardAlignTip,
  boardJustifyEditor,
  boardJustifyLabel,
  boardJustifyTip,
  boardOrderField,
  boardOrderLabel,
  boardOrderPrev,
  boardOrderNext,
  boardArrowEditor,
  boardArrowLabel,
  boardArrowField,
  boardArrowReverse,
  boardIconField,
  boardIconLabel,
  boardIconTrigger,
  boardIconTriggerGlyph,
  boardIconTriggerName,
  boardIconPop,
  boardIconCurrent,
  boardIconList,
  boardIconPick,
  currentDockTab,
  openDock,
  openPropsPanel,
  closePropsPanel,
  toggleDock,
  boardInspector,
  boardAddBoxButton,
  boardAddItemButton,
  boardDeleteButton,
  boardLinkButton,
  previewEl,
  stageEl,
  diagramLocalRev,
  diagramServerRev,
  diagramDirty,
  diagramSaveSeq,
  diagramRenderTimer,
  selectedBoardNode,
  selectedBoardEdge,
  boardInspectGesture,
  boardLinkMode,
  boardLinkStart,
  diagramSaveTimer,
  liveDiagramId,
  liveDiagramArchive,
  liveDiagramPath,
  scale,
  panX,
  panY,
  DRAWER_UI_KEY,
  DRAWER_UI_VERSION,
  DOCK_WIDTH_MIN,
  DOCK_WIDTH_MAX,
  clampDockWidth,
  applyDockWidth,
  currentDockWidth,
  DRAWER_UI_PERSIST_LIST,
  defaultDrawerUi,
  loadDrawerUi,
  saveDrawerUi,
  snapshotDrawerUi,
  _drawerUiRestoreLock,
  flushDrawerUiSave,
  setStatus,
  applyDiagramLiveMeta,
  syncStyleLayoutSections,
  liveKindLabel,
  syncSourceDockLabel,
  liveRecordId,
  syncSourceIdChrome,
  setKindUI,
  applyTransform,
  setCameraPan,
  setDiagramLocalRev,
  setDiagramServerRev,
  setDiagramDirty,
  setDiagramSaveTimer,
  setDiagramSaveSeq,
  bumpDiagramSaveSeq,
  setDiagramRenderTimer,
  setSelectedBoardNode,
  setSelectedBoardEdge,
  setBoardInspectGesture,
  setBoardLinkModeFlag,
  setBoardLinkStart,
  setBoardIconPick,
  setBoardIdCopiedTimer,
  setShellGroups,
  setShellShares,
  setShellMineTotal,
  setShellMineCursor,
  setLiveDiagramId,
  setDrawerUiRestoreLock,
  setLiveCamera,
  setCanvasZoom,
  applyRestoredDiagramView,
  fitDiagramView,
  updateDiagramChars,
  showDiagramError,
};
