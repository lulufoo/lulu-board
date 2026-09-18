
/** HTTP header values must be ISO-8859-1; encode anything else (e.g. Chinese titles). */
function headerByteString(value) {
  var s = String(value == null ? "" : value);
  if (!s) return "";
  for (var i = 0; i < s.length; i += 1) {
    if (s.charCodeAt(i) > 255) return "utf8''" + encodeURIComponent(s);
  }
  return s;
}
function decodeHeaderByteString(value) {
  var s = String(value == null ? "" : value);
  if (s.indexOf("utf8''") === 0) {
    try { return decodeURIComponent(s.slice(5)); } catch (_e) { return s.slice(5); }
  }
  // also accept bare percent-encoding
  if (/%[0-9A-Fa-f]{2}/.test(s)) {
    try { return decodeURIComponent(s); } catch (_e) { return s; }
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
  return Number.isFinite(boardLocalRev) && boardLocalRev > 0 ? boardLocalRev : 0;
}

function wrapEditorApi(api) {
  if (!api) return;
  Object.keys(api).forEach(function(key) {
    var fn = api[key];
    if (typeof fn !== "function") return;
    api[key] = function(text) {
      if (typeof text !== "string") return fn.apply(api, arguments);
      if (!/^\s*meta\s+/.test(text)) return fn.apply(api, arguments);
      var doc = splitDocument(text);
      var args = Array.prototype.slice.call(arguments);
      args[0] = doc.body;
      var out = fn.apply(api, args);
      if (key === "render" || key === "parse" || key === "isIdTaken" || key === "findNode" || key === "getLinkRouteStyle") return out;
      function rejoin(nextBody) {
        return joinDocument(doc.meta, nextBody);
      }
      if (typeof out === "string") return rejoin(out);
      if (out && typeof out.source === "string") {
        out.source = rejoin(out.source);
      }
      return out;
    };
  });
}

/* drawer-app/01-shell-state.js — lines 1-699 of former inline module */
const $ = (s) => document.querySelector(s);
const boardSourceEl = $('#boardSource');
const boardError = $("#boardError");
const boardDock = $("#boardDock");
const propsPanel = $("#propsPanel");
const propsEmpty = $("#propsEmpty");
const propsFields = $("#propsFields");
const propsKindLabel = $("#propsKindLabel");
const propsHint = $("#propsHint");
const boardTitleEditor = $("#boardTitleEditor");
const boardTypeEditor = $("#boardTypeEditor");
const boardShapeField = $("#boardShapeField");
const boardTitleLabel = $("#boardTitleLabel");
const boardTypeLabel = $("#boardTypeLabel");
const boardShapeLabel = $("#boardShapeLabel");
const boardCapField = $("#boardCapField");
const boardCapEditor = $("#boardCapEditor");
const boardCapLabel = $("#boardCapLabel");
const boardCapTip = $("#boardCapTip");
const boardItemCapSlider = $("#boardItemCapSlider");
const boardFontSizeSlider = $("#boardFontSizeSlider");
const boardIdLabel = $("#boardIdLabel");
const boardIdField = $("#boardIdField");
const boardIdEditor = $("#boardIdEditor");
const boardIdCopy = $("#boardIdCopy");
const boardIdDup = $("#boardIdDup");
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
const boardIconList = $("#boardIconList");
const boardIconSec = $("#boardIconSec");
var boardIconPick = 1;
var boardIconSecId = ""; // first section comes from BoardIcons / icons.json
function currentDockTab() {
  return (boardDock && boardDock.getAttribute("data-open")) || "";
}
function openDock(tab) {
  if (!boardDock) return;
  var next = tab || "";
  if (next !== "props" && next !== "layout" && next !== "source" && next !== "export" && next !== "style") next = "";
  boardDock.setAttribute("data-open", next);
  if (propsPanel) propsPanel.setAttribute("data-collapsed", next === "props" ? "false" : "true");
  Array.from(boardDock.querySelectorAll("[data-dock]")).forEach(function(btn) {
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
function closePropsPanelCollapsedOnly() {
  closePropsPanel();
}
function togglePropsPanel() { toggleDock("props"); }
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
      setBoardIdField(false);
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
const boardSelectionObserver = new MutationObserver(() => { var key = boardSourceEl.dataset.boardSelectionKey; if (!key) return; if (key.indexOf("tree:") === 0) key = "box:" + key.slice(5); const selected = Array.from(previewEl.querySelectorAll("[data-board-key]")).find((el) => el.dataset.boardKey === key); if (selected) selected.classList.add("board-selection"); });
boardSelectionObserver.observe(previewEl, { childList: true, subtree: true });

let boardLocalRev = 0;
let boardServerRev = 0;
let boardDirty = false;
let boardSaveSeq = 0;
let boardRenderTimer = null;
let selectedBoardNode = null;
let selectedBoardEdge = null;
let boardInspectGesture = null;
let boardLinkMode = false;
let boardLinkStart = null;
let boardSaveTimer = null;
let liveBoardId = "";
let liveBoardTitle = "";
let liveBoardArchive = "";
let liveBoardPath = "";
let scale = 0.9, panX = 0, panY = 0;

/* ── Drawer UI persistence (`localStorage["drawer.ui"]`) ─────────────────
 * Persist list (refresh restores these). Add a field here when wiring a new one:
 *   mode             "board"
 *   sheetCollapsed   boolean
 *   propsOpen        boolean   — right Props panel (legacy)
 *   dockTab          "" | "props" | "layout" | "source"
 *   dockWidth        number   — open sidebar width (px)
 *   scale, panX, panY number   — canvas zoom/pan
 *   boardViewId      string    — board record id that last owned scale/pan
 * Other already-persistent keys (unchanged): drawer.diagramTheme, drawer.boardLinkRoute, drawer.boardItemCap
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
  if (boardDock) boardDock.style.setProperty("--dock-open-width", w + "px");
  if (persist) saveDrawerUi({ dockWidth: w });
  return w;
}
function currentDockWidth() {
  if (boardDock) {
    var raw = boardDock.style.getPropertyValue("--dock-open-width");
    var n = parseInt(raw, 10);
    if (isFinite(n) && n > 0) return clampDockWidth(n);
  }
  return clampDockWidth(loadDrawerUi().dockWidth);
}
var DRAWER_UI_PERSIST_LIST = [
  { key: "mode", kind: "enum:board" },
  { key: "sheetCollapsed", kind: "boolean" },
  { key: "propsOpen", kind: "boolean" },
  { key: "dockTab", kind: "enum:|props|layout|source" },
  { key: "dockWidth", kind: "number" },
  { key: "scale", kind: "number" },
  { key: "panX", kind: "number" },
  { key: "panY", kind: "number" },
  { key: "boardViewId", kind: "string" }
];
function defaultDrawerUi() {
  return { v: DRAWER_UI_VERSION, mode: "board", sheetCollapsed: true, propsOpen: false, dockTab: "", dockWidth: 400, scale: 0.9, panX: 0, panY: 0, boardViewId: "" };
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
        if (parsed.dockTab === "" || parsed.dockTab === "props" || parsed.dockTab === "layout" || parsed.dockTab === "source") out.dockTab = parsed.dockTab;
        else if (out.propsOpen) out.dockTab = "props";
        if (typeof parsed.dockWidth === "number" && isFinite(parsed.dockWidth)) out.dockWidth = clampDockWidth(parsed.dockWidth);
        if (typeof parsed.scale === "number" && isFinite(parsed.scale)) out.scale = Math.min(3, Math.max(0.2, parsed.scale));
        if (typeof parsed.panX === "number" && isFinite(parsed.panX)) out.panX = parsed.panX;
        if (typeof parsed.panY === "number" && isFinite(parsed.panY)) out.panY = parsed.panY;
        if (typeof parsed.boardViewId === "string") out.boardViewId = parsed.boardViewId;
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
  var prev = loadDrawerUi();
  return saveDrawerUi({
    mode: "board",
    sheetCollapsed: !!(app && app.classList.contains("sheet-collapsed")),
    propsOpen: currentDockTab() === "props",
    dockTab: currentDockTab(),
    dockWidth: currentDockWidth(),
    scale: scale,
    panX: panX,
    panY: panY,
    boardViewId: liveBoardId || prev.boardViewId || ""
  });
}
var _drawerUiSaveTimer = null;
var _drawerUiRestoreLock = false;
function scheduleDrawerUiSave() {
  if (_drawerUiRestoreLock) return;
  clearTimeout(_drawerUiSaveTimer);
  _drawerUiSaveTimer = setTimeout(snapshotDrawerUi, 120);
}
function flushDrawerUiSave() {
  clearTimeout(_drawerUiSaveTimer);
  _drawerUiSaveTimer = null;
  if (_drawerUiRestoreLock) return;
  snapshotDrawerUi();
}
window.addEventListener("pagehide", flushDrawerUiSave);
document.addEventListener("visibilitychange", function() {
  if (document.visibilityState === "hidden") flushDrawerUiSave();
});
(function hydrateDrawerUiView() {
  var ui = loadDrawerUi();
  scale = ui.scale;
  panX = ui.panX;
  panY = ui.panY;
  applyDockWidth(ui.dockWidth, false);
})();
(function wireDockResize() {
  var handle = document.getElementById("boardDockResize");
  if (!handle || !boardDock) return;
  var drag = null;
  handle.addEventListener("pointerdown", function(e) {
    if (!boardDock.getAttribute("data-open")) return;
    e.preventDefault();
    try { handle.setPointerCapture(e.pointerId); } catch (_e) {}
    drag = { x: e.clientX, w: currentDockWidth() };
    boardDock.classList.add("is-resizing");
  });
  handle.addEventListener("pointermove", function(e) {
    if (!drag) return;
    applyDockWidth(drag.w + (drag.x - e.clientX), false);
  });
  function endDrag() {
    if (!drag) return;
    drag = null;
    boardDock.classList.remove("is-resizing");
    saveDrawerUi({ dockWidth: currentDockWidth() });
  }
  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);
})();

let panning = false, panOrigin = null, panMoved = false;

function setStatus(msg, isError = false) {
  const el = $('#statusFloat');
  if (!el) return; // status chrome removed — keep API for callers
  el.textContent = msg;
  el.classList.toggle('err', !!isError);
}
function archiveBase(path) {
  if (!path) return '—';
  const parts = String(path).split(/[/\\]/);
  return parts[parts.length - 1] || '—';
}

function applyBoardLiveMeta(meta = {}) {
  if (meta && meta.id) liveBoardId = String(meta.id);
  else if (meta && meta.id === "") liveBoardId = "";
  if (meta && meta.title != null) liveBoardTitle = String(meta.title || "");
  // Protocol: meta.current points at the editable history record (SSOT).
  // Legacy clients may still send archive — treat it as current.
  if (meta && Object.prototype.hasOwnProperty.call(meta, "current")) {
    liveBoardArchive = meta.current ? String(meta.current).split("/").pop() : "";
  } else if (meta && Object.prototype.hasOwnProperty.call(meta, "archive")) {
    liveBoardArchive = meta.archive ? String(meta.archive).split("/").pop() : "";
  }
  if (meta && meta.path) liveBoardPath = String(meta.path);
  else if (meta && meta.current && String(meta.current).startsWith("/")) liveBoardPath = String(meta.current);
  if (meta && Number.isFinite(Number(meta.version != null ? meta.version : meta.rev))) {
    if (!Number.isFinite(boardLocalRev) || boardLocalRev <= 0) boardLocalRev = Number(meta.version != null ? meta.version : meta.rev);
  }
  if (typeof syncSourceIdChrome === "function") syncSourceIdChrome();
  if (typeof syncSourceDockLabel === "function") syncSourceDockLabel("Board");
}

function syncStyleLayoutSections() {
  var board = document.getElementById("boardLayoutSection");
  if (board) board.hidden = false;
  var capSec = document.getElementById("boardItemCapSection");
  if (capSec) capSec.hidden = false;
  var typeSec = document.getElementById("boardFontSizeSection");
  if (typeSec) typeSec.hidden = false;
}

function syncSourceDockLabel() {
  var tab = document.getElementById("sourceDockTabLabel");
  var title = document.getElementById("sourceDockTitle");
  var btn = document.getElementById("btnDockSource");
  if (tab && tab.textContent !== "Source") tab.textContent = "Source";
  if (btn && btn.title !== "Source") btn.title = "Source";
  var version = typeof liveDocumentVersion === "function" ? liveDocumentVersion() : 0;
  if (title && title.textContent !== "Board") title.textContent = "Board";
  var verEl = document.getElementById("sourceDockVersion");
  var verText = formatVersionLabel(version);
  if (verEl) {
    verEl.textContent = verText;
    verEl.hidden = !verText;
  }
  if (typeof syncSourceIdChrome === "function") syncSourceIdChrome();
}
function liveRecordId() {
  return String(typeof liveBoardId !== "undefined" ? liveBoardId : "");
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

function setTypeUI() {
  const typePill = $('#typePill');
  if (typeof syncSourceDockLabel === 'function') syncSourceDockLabel();
  if (typePill) typePill.innerHTML = '<b>Board</b>';
  var hint = $('#exportTypeHint');
  if (hint) hint.textContent = 'Board mode · Export File below.';
  if (typeof syncStyleLayoutSections === 'function') syncStyleLayoutSections();
}
function applyTransform() {
  previewEl.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  var zr = document.querySelector("#btnZoomReset");
  if (zr) zr.textContent = Math.round(scale * 100) + "%";
  scheduleDrawerUiSave();
}
/* Zoom the stage about its centre: the camera's world point stays put. */
function setCanvasZoom(nextScale) {
  nextScale = Math.min(3, Math.max(0.2, Number(nextScale)));
  if (!isFinite(nextScale)) return;
  var cam = typeof readCamera === "function" ? readCamera() : null;
  if (cam && nextScale !== cam.scale) {
    cam.scale = nextScale;
    if (applyCamera(cam)) return;
  }
  scale = nextScale;
  applyTransform();
}
function boardWorldBounds() {
  var root = previewEl && previewEl.querySelector(".board-render");
  if (!root || typeof BoardRender === "undefined" || typeof BoardRender.worldBounds !== "function") return null;
  return BoardRender.worldBounds(root);
}
/* Does the camera's visible world rect touch any content? */
function boardContentOnStage() {
  var cam = typeof readCamera === "function" ? readCamera() : null;
  var stage = typeof stageSize === "function" ? stageSize() : null;
  var b = boardWorldBounds();
  if (!cam || !stage || !b) return false;
  var halfW = stage.w / 2 / cam.scale, halfH = stage.h / 2 / cam.scale;
  return b.maxX > cam.cx - halfW && b.minX < cam.cx + halfW && b.maxY > cam.cy - halfH && b.minY < cam.cy + halfH;
}
function applyRestoredBoardView() {
  var view = typeof readDocumentView === "function" ? readDocumentView() : null;
  if (view && typeof applyDocumentView === "function") {
    applyDocumentView(view, function (ok) {
      if (!ok || (typeof boardContentOnStage === "function" && !boardContentOnStage())) {
        fitBoardView({ persist: true });
      }
    });
    return;
  }
  fitBoardView({ persist: true });
}
function fitBoardView(opts) {
  opts = opts || {};
  if (!previewEl) return;
  pinBoardTitle();
  const content = previewEl.querySelector(".board-render");
  if (!content) return;
  requestAnimationFrame(() => {
    var stage = typeof stageSize === "function" ? stageSize() : null;
    var b = boardWorldBounds();
    if (!stage || !b) return;
    /* Board title is document.title — do not reserve a canvas band for it */
    var topBand = 12;
    const pad = 24;
    var next = Math.max(0.2, Math.min(1, (stage.w - pad) / Math.max(1, b.width), (stage.h - topBand - pad) / Math.max(1, b.height)));
    if (!applyCamera({ scale: next, cx: b.cx, cy: b.cy })) return;
    if (opts.persist) snapshotDrawerUi();
    var key = boardSourceEl.dataset.boardSelectionKey;
    if (key && key.indexOf("tree:") === 0) key = "box:" + key.slice(5);
    var retained = key && Array.from(previewEl.querySelectorAll("[data-board-key]")).find(function(el) { return el.dataset.boardKey === key; });
    if (retained) retained.classList.add("board-selection");
  });
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
}
function updateBoardChars() {
  setCharsLabel($('#boardCharsPill'), [...boardSourceEl.value].length);
}
function showBoardError(message) { boardError.textContent = message || ''; boardError.classList.toggle('show', !!message); }

wrapEditorApi(typeof BoardRender !== "undefined" ? BoardRender : null);
