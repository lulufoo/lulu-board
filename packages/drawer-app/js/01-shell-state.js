
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
  return Number.isFinite(velaLocalRev) && velaLocalRev > 0 ? velaLocalRev : 0;
}

function wrapEditorApi(api) {
  if (!api) return;
  Object.keys(api).forEach(function(key) {
    var fn = api[key];
    if (typeof fn !== "function") return;
    api[key] = function(text) {
      if (typeof text !== "string") return fn.apply(api, arguments);
      var body = typeof stripDocumentMeta === "function" ? stripDocumentMeta(text) : text;
      if (body === text) return fn.apply(api, arguments);
      var args = Array.prototype.slice.call(arguments);
      args[0] = body;
      return fn.apply(api, args);
    };
  });
}

/* drawer-app/01-shell-state.js — lines 1-699 of former inline module */
const $ = (s) => document.querySelector(s);
const velaSourceEl = $('#velaSource');
const velaError = $("#velaError");
const velaDock = $("#velaDock");
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
  return (velaDock && velaDock.getAttribute("data-open")) || "";
}
function openDock(tab) {
  if (!velaDock) return;
  var next = tab || "";
  if (next !== "props" && next !== "layout" && next !== "source" && next !== "export" && next !== "style") next = "";
  velaDock.setAttribute("data-open", next);
  if (propsPanel) propsPanel.setAttribute("data-collapsed", next === "props" ? "false" : "true");
  Array.from(velaDock.querySelectorAll("[data-dock]")).forEach(function(btn) {
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
const boardSelectionObserver = new MutationObserver(() => { var key = velaSourceEl.dataset.boardSelectionKey; if (!key) return; if (key.indexOf("tree:") === 0) key = "box:" + key.slice(5); const selected = Array.from(previewEl.querySelectorAll("[data-board-key]")).find((el) => el.dataset.boardKey === key); if (selected) selected.classList.add("board-selection", "canvas-selected"); });
boardSelectionObserver.observe(previewEl, { childList: true, subtree: true });

let velaLocalRev = 0;
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
let liveBoardArchive = "";
let liveBoardPath = "";
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
  if (velaDock) velaDock.style.setProperty("--dock-open-width", w + "px");
  if (persist) saveDrawerUi({ dockWidth: w });
  return w;
}
function currentDockWidth() {
  if (velaDock) {
    var raw = velaDock.style.getPropertyValue("--dock-open-width");
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
window.addEventListener("pagehide", flushDrawerUiSave);
document.addEventListener("visibilitychange", function() {
  if (document.visibilityState === "hidden") flushDrawerUiSave();
});
(function hydrateDrawerUiView() {
  applyDockWidth(loadDrawerUi().dockWidth, false);
})();
(function wireDockResize() {
  var handle = document.getElementById("velaDockResize");
  if (!handle || !velaDock) return;
  var drag = null;
  handle.addEventListener("pointerdown", function(e) {
    if (!velaDock.getAttribute("data-open")) return;
    e.preventDefault();
    try { handle.setPointerCapture(e.pointerId); } catch (_e) {}
    drag = { x: e.clientX, w: currentDockWidth() };
    velaDock.classList.add("is-resizing");
  });
  handle.addEventListener("pointermove", function(e) {
    if (!drag) return;
    applyDockWidth(drag.w + (drag.x - e.clientX), false);
  });
  function endDrag() {
    if (!drag) return;
    drag = null;
    velaDock.classList.remove("is-resizing");
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
function archiveBase(path) {
  if (!path) return '—';
  const parts = String(path).split(/[/\\]/);
  return parts[parts.length - 1] || '—';
}

function applyBoardLiveMeta(meta = {}) {
  if (meta && meta.id) liveBoardId = String(meta.id);
  else if (meta && meta.id === "") liveBoardId = "";
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
    if (!Number.isFinite(velaLocalRev) || velaLocalRev <= 0) velaLocalRev = Number(meta.version != null ? meta.version : meta.rev);
  }
  if (typeof syncSourceIdChrome === "function") syncSourceIdChrome();
  if (typeof syncSourceDockLabel === "function") syncSourceDockLabel();
}

function syncStyleLayoutSections() {
  var kind = document.documentElement && document.documentElement.dataset.diagramKind;
  var mermaid = kind === "flowchart" || kind === "mermaid-unsupported";
  var flowchart = kind === "flowchart";
  var board = document.getElementById("boardLayoutSection");
  if (board) board.hidden = mermaid;
  var typeSec = document.getElementById("boardFontSizeSection");
  if (typeSec) typeSec.hidden = kind === "mermaid-unsupported";
  var capSec = document.getElementById("boardItemCapSection");
  var capSlider = document.getElementById("boardItemCapSlider");
  if (capSec) {
    capSec.hidden = kind === "mermaid-unsupported";
    capSec.classList.toggle("is-disabled", flowchart);
  }
  if (capSlider) {
    capSlider.disabled = flowchart;
    if (flowchart) capSlider.setAttribute("aria-disabled", "true");
    else capSlider.removeAttribute("aria-disabled");
  }
}

function liveDiagramTypeLabel() {
  var text = velaSourceEl ? velaSourceEl.value : "";
  if (typeof DrawerStyleLine !== "undefined" && typeof DrawerStyleLine.bodyTypeLabel === "function") {
    return DrawerStyleLine.bodyTypeLabel(text);
  }
  return "Board";
}
function syncSourceDockLabel() {
  var tab = document.getElementById("sourceDockTabLabel");
  var title = document.getElementById("sourceDockTitle");
  var btn = document.getElementById("btnDockSource");
  if (tab && tab.textContent !== "Source") tab.textContent = "Source";
  if (btn && btn.title !== "Source") btn.title = "Source";
  var version = typeof liveDocumentVersion === "function" ? liveDocumentVersion() : 0;
  var label = liveDiagramTypeLabel();
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
  var label = liveDiagramTypeLabel();
  if (typeof syncSourceDockLabel === 'function') syncSourceDockLabel();
  if (typePill) {
    typePill.replaceChildren();
    var bold = document.createElement("b");
    bold.textContent = label;
    typePill.appendChild(bold);
  }
  var hint = $('#exportTypeHint');
  if (hint) hint.textContent = label + ' mode · Export File below.';
  var zoomType = document.getElementById("zoom-type-label");
  var zoomSep = document.getElementById("zoom-type-sep");
  var showZoomType = !!(label && label !== "Source");
  if (zoomType) {
    zoomType.textContent = showZoomType ? label : "";
    zoomType.hidden = !showZoomType;
  }
  if (zoomSep) zoomSep.hidden = !showZoomType;
  if (typeof syncStyleLayoutSections === 'function') syncStyleLayoutSections();
}
function applyTransform() {
  previewEl.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  var zr = document.querySelector("#btnZoomReset");
  if (zr) zr.textContent = Math.round(scale * 100) + "%";
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
function applyRestoredBoardView() {
  if (typeof pinVelaTitle === "function") pinVelaTitle();
  if (typeof Canvas !== "undefined" && typeof Canvas.restoreOrFit === "function") {
    Canvas.restoreOrFit();
    return;
  }
}
function fitBoardView() {
  if (!previewEl) return;
  pinVelaTitle();
  if (typeof Canvas !== "undefined" && typeof Canvas.fitWorld === "function") Canvas.fitWorld();
  requestAnimationFrame(function () {
    if (!previewEl || !velaSourceEl) return;
    var key = velaSourceEl.dataset.boardSelectionKey;
    if (key && key.indexOf("tree:") === 0) key = "box:" + key.slice(5);
    var retained = key && Array.from(previewEl.querySelectorAll("[data-board-key]")).find(function(el) { return el.dataset.boardKey === key; });
    if (retained) retained.classList.add("board-selection", "canvas-selected");
  });
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
}
function updateVelaChars() {
  setCharsLabel($('#velaCharsPill'), [...velaSourceEl.value].length);
}
function showVelaError(message) { velaError.textContent = message || ''; velaError.classList.toggle('show', !!message); }

wrapEditorApi(typeof BoardRender !== "undefined" ? BoardRender : null);
wrapEditorApi(typeof FlowchartEdit !== "undefined" ? FlowchartEdit : null);
