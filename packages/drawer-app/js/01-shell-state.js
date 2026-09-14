
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
  var raw = document.documentElement.dataset.drawerMode === "board"
    ? (boardSourceEl && boardSourceEl.value)
    : (sourceEl && sourceEl.value);
  try {
    var v = splitDocument(raw).meta.version;
    if (Number.isFinite(v) && v > 0) return v;
  } catch (_e) {}
  var fallback = document.documentElement.dataset.drawerMode === "board" ? boardLocalRev : localRev;
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
}

function wrapEditorApi(api) {
  if (!api) return;
  Object.keys(api).forEach(function(key) {
    var fn = api[key];
    if (typeof fn !== "function") return;
    api[key] = function(text) {
      if (typeof text !== "string") return fn.apply(api, arguments);
      if (!/^\s*(?:%%\s*)?meta\s+/.test(text)) return fn.apply(api, arguments);
      var doc = splitDocument(text);
      var body = doc.body;
      var styleToken = "";
      if (typeof DrawerStyleLine !== "undefined" && !DrawerStyleLine.bodyIsBoard(body)) {
        var styled = DrawerStyleLine.splitRendererStyle(body);
        styleToken = styled.token;
        body = styled.body;
      }
      var args = Array.prototype.slice.call(arguments);
      args[0] = body;
      var out = fn.apply(api, args);
      if (key === "render" || key === "parse" || key === "isIdTaken" || key === "findNode" || key === "getLinkRouteStyle") return out;
      function rejoin(nextBody) {
        var merged = styleToken ? DrawerStyleLine.joinRendererStyle(styleToken, nextBody) : nextBody;
        return joinDocument(doc.meta, merged);
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
const sourceEl = $('#source');
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
  // Mermaid: Props allowed; Layout still deferred (tab hidden + blocked here).
  if (document.documentElement.dataset.drawerMode === "mermaid" && next === "layout") next = "";
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
  try { MermaidInspect.clearPropsShown(); } catch (_e) {}
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
const errorBox = $('#errorBox');
const emptyHtml = `<div class="empty" id="emptyState"><h2>Canvas is ready</h2><p>Use <kbd>set-source</kbd> from the skill, or open Source and paste.</p></div>`;
const SVG_CACHE_KEY = 'lulu-drawer:last-svg';
const boardSelectionObserver = new MutationObserver(() => { const key = boardSourceEl.dataset.boardSelectionKey; if (!key) return; const selected = Array.from(previewEl.querySelectorAll("[data-board-key]")).find((el) => el.dataset.boardKey === key); if (selected) selected.classList.add("board-selection"); });
boardSelectionObserver.observe(previewEl, { childList: true, subtree: true });


function cacheRenderedSvg(svg) {
  if (!svg) return;
  try {
    sessionStorage.setItem(SVG_CACHE_KEY, JSON.stringify({
      rev: localRev,
      svg: svg.outerHTML,
      at: Date.now(),
    }));
  } catch (_) {}
}

function restoreCachedSvg() {
  if (document.documentElement.dataset.drawerMode === 'board') return false;
  try {
    const raw = sessionStorage.getItem(SVG_CACHE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || typeof data.svg !== 'string' || !data.svg.includes('<svg')) return false;
    previewEl.innerHTML = data.svg;
    const svg = previewEl.querySelector('svg');
    if (!svg) return false;
    fixSvgIntrinsic(svg);
    // Document style.viewport is applied after boot; do not use the global drawer.ui zoom here.
    setStatus(Number.isFinite(data.rev) ? `Restoring r${data.rev}…` : 'Restoring…');
    return true;
  } catch (_) {
    return false;
  }
}


let localRev = 0;
let boardLocalRev = 0;
let boardDirty = false;
let boardSaveSeq = 0;
let boardRenderTimer = null;
let selectedBoardNode = null;
let selectedBoardEdge = null;
let boardInspectGesture = null;
let boardLinkMode = false;
let boardLinkStart = null;
let boardSaveTimer = null;
let liveLabel = "";
let liveArchiveName = "";
let liveDiagramId = "";
let liveBoardId = "";
let liveBoardTitle = "";
let liveBoardArchive = "";
let liveBoardPath = "";
let liveDiagramTitle = "";
let liveDiagramVia = "";
let liveArchive = "";
let liveDiagramPath = "";
let dirty = false; // local edits not yet acknowledged
let saveSeq = 0;
let renderNo = 0;
let scale = 0.9, panX = 0, panY = 0;

/* ── Drawer UI persistence (`localStorage["drawer.ui"]`) ─────────────────
 * Persist list (refresh restores these). Add a field here when wiring a new one:
 *   mode             "board" | "mermaid"
 *   sheetCollapsed   boolean   — left Source sheet (Mermaid)
 *   propsOpen        boolean   — right Props panel (legacy)
 *   dockTab          "" | "props" | "layout" | "source"
 *   dockWidth        number   — open sidebar width (px)
 *   scale, panX, panY number   — canvas zoom/pan
 *   boardViewId      string    — board record id that last owned scale/pan
 *   diagramType      string    — last Mermaid diagram keyword (toolbar Type pill)
 *   mermaidFlowchart boolean   — show flowchart edit tools
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
  { key: "mode", kind: "enum:board|mermaid" },
  { key: "sheetCollapsed", kind: "boolean" },
  { key: "propsOpen", kind: "boolean" },
  { key: "dockTab", kind: "enum:|props|layout|source" },
  { key: "dockWidth", kind: "number" },
  { key: "scale", kind: "number" },
  { key: "panX", kind: "number" },
  { key: "panY", kind: "number" },
  { key: "boardViewId", kind: "string" },
  { key: "diagramType", kind: "string" },
  { key: "mermaidFlowchart", kind: "boolean" },
  { key: "mindmapLayout", kind: "enum:radial|logic" }
];
function defaultDrawerUi() {
  return { v: DRAWER_UI_VERSION, mode: "mermaid", sheetCollapsed: true, propsOpen: false, dockTab: "", dockWidth: 400, scale: 0.9, panX: 0, panY: 0, boardViewId: "", diagramType: "", mermaidFlowchart: true, mindmapLayout: "radial" };
}
function loadDrawerUi() {
  var out = defaultDrawerUi();
  try {
    var raw = localStorage.getItem(DRAWER_UI_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        if (parsed.mode === "board" || parsed.mode === "mermaid") out.mode = parsed.mode;
        if (typeof parsed.sheetCollapsed === "boolean") out.sheetCollapsed = parsed.sheetCollapsed;
        if (typeof parsed.propsOpen === "boolean") out.propsOpen = parsed.propsOpen;
        if (parsed.dockTab === "" || parsed.dockTab === "props" || parsed.dockTab === "layout" || parsed.dockTab === "source") out.dockTab = parsed.dockTab;
        else if (out.propsOpen) out.dockTab = "props";
        if (typeof parsed.dockWidth === "number" && isFinite(parsed.dockWidth)) out.dockWidth = clampDockWidth(parsed.dockWidth);
        if (typeof parsed.scale === "number" && isFinite(parsed.scale)) out.scale = Math.min(3, Math.max(0.2, parsed.scale));
        if (typeof parsed.panX === "number" && isFinite(parsed.panX)) out.panX = parsed.panX;
        if (typeof parsed.panY === "number" && isFinite(parsed.panY)) out.panY = parsed.panY;
        if (typeof parsed.boardViewId === "string") out.boardViewId = parsed.boardViewId;
        if (typeof parsed.diagramType === "string") out.diagramType = parsed.diagramType;
        if (typeof parsed.mermaidFlowchart === "boolean") out.mermaidFlowchart = parsed.mermaidFlowchart;
        if (parsed.mindmapLayout === "radial" || parsed.mindmapLayout === "logic") out.mindmapLayout = parsed.mindmapLayout;
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
    mode: document.documentElement.dataset.drawerMode === "board" ? "board" : (document.documentElement.dataset.drawerMode === "mermaid" ? "mermaid" : prev.mode),
    sheetCollapsed: !!(app && app.classList.contains("sheet-collapsed")),
    propsOpen: currentDockTab() === "props",
    dockTab: currentDockTab(),
    dockWidth: currentDockWidth(),
    scale: scale,
    panX: panX,
    panY: panY,
    boardViewId: document.documentElement.dataset.drawerMode === "board" ? (liveBoardId || "") : prev.boardViewId,
    diagramType: prev.diagramType || "",
    mermaidFlowchart: document.documentElement.dataset.mermaidFlowchart === "1",
    mindmapLayout: (typeof currentMindmapLayout === "function") ? currentMindmapLayout() : (prev.mindmapLayout || "radial")
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

let renderTimer = null;
let saveTimer = null;
let panning = false, panOrigin = null, panMoved = false, panBlankMindmap = false;

if (!window.mermaid) {
  setStatus('Renderer failed to load', true);
  throw new Error('renderer missing');
}
function mermaidTheme() {
  const raw = document.documentElement.dataset.diagramTheme || localStorage.getItem('drawer.diagramTheme') || 'default';
  const diagram = (window.BoardThemes && BoardThemes.resolveId) ? BoardThemes.resolveId(raw) : raw;
  if (diagram === 'classic') return 'base';
  if (diagram === 'pastel') return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'neutral';
  // default: keep original Drawer default (neutral in light)
  return document.documentElement.dataset.theme === 'light' ? 'neutral' : 'dark';
}
window.mermaid.initialize({
  startOnLoad: false,
  theme: mermaidTheme(),
  securityLevel: 'loose',
  fontFamily: 'Inter, SF Pro Text, system-ui, sans-serif',
  flowchart: { useMaxWidth: false },
  sequence: {
    useMaxWidth: false,
    diagramMarginX: 48,
    diagramMarginY: 24,
    actorMargin: 64,
    boxMargin: 12,
    boxTextMargin: 6,
    noteMargin: 12,
    messageMargin: 40,
    mirrorActors: true,
    bottomMarginAdj: 8,
  },
  class: { useMaxWidth: false },
  state: { useMaxWidth: false },
  er: { useMaxWidth: false },
  mindmap: { useMaxWidth: false, padding: 18 },
});

function unoverlapTipLabels(svg) {
  if (!svg) return;
  // Edge-bound tip placement: candidate search along nearest connector
  // (t × normal-offset × flip), then tip↔tip MTV. Best-effort shove if no
  // free slot. Does not change Mermaid layout / zoom / Fit / theme.

  const nodeBoxes = [];
  for (const el of svg.querySelectorAll('rect')) {
    try {
      const bb = el.getBBox();
      if (bb.width < 36 || bb.height < 20) continue;
      if (bb.width > 420 || bb.height > 280) continue;
      nodeBoxes.push(bb);
    } catch (_) {}
  }

  const edges = [];
  for (const el of svg.querySelectorAll('path, line')) {
    try {
      const bb = el.getBBox();
      if (Math.hypot(bb.width, bb.height) < 36) continue;
      const stroke = (el.getAttribute('stroke') || '').trim();
      const fill = (el.getAttribute('fill') || '').trim();
      if (!(el.tagName === 'line' || (stroke && stroke !== 'none') || fill === 'none' || fill === '')) continue;
      if (el.tagName === 'line') {
        const x1 = Number(el.getAttribute('x1'));
        const y1 = Number(el.getAttribute('y1'));
        const x2 = Number(el.getAttribute('x2'));
        const y2 = Number(el.getAttribute('y2'));
        const len = Math.hypot(x2 - x1, y2 - y1) || 1;
        edges.push({
          at(t) {
            return {
              x: x1 + (x2 - x1) * t,
              y: y1 + (y2 - y1) * t,
              tx: (x2 - x1) / len,
              ty: (y2 - y1) / len,
            };
          },
        });
      } else if (typeof el.getTotalLength === 'function') {
        const len = el.getTotalLength();
        if (!len) continue;
        edges.push({
          at(t) {
            const clamped = Math.max(0, Math.min(1, t));
            const a = el.getPointAtLength(clamped * len);
            const b = el.getPointAtLength(Math.max(0, Math.min(1, clamped + 0.02)) * len);
            let tx = b.x - a.x, ty = b.y - a.y;
            const n = Math.hypot(tx, ty) || 1;
            return { x: a.x, y: a.y, tx: tx / n, ty: ty / n };
          },
        });
      }
    } catch (_) {}
  }

  const center = (bb) => ({ x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 });
  const overlaps = (a, b, pad = 1) => !(
    a.x + a.width + pad < b.x ||
    b.x + b.width + pad < a.x ||
    a.y + a.height + pad < b.y ||
    b.y + b.height + pad < a.y
  );
  const deepInsideNode = (bb, inset = 10) => {
    const c = center(bb);
    return nodeBoxes.some((n) =>
      c.x > n.x + inset && c.x < n.x + n.width - inset &&
      c.y > n.y + inset && c.y < n.y + n.height - inset
    );
  };
  const hitNode = (bb, pad = 2) => nodeBoxes.find((n) => overlaps(bb, n, pad)) || null;
  const hitPlaced = (bb, placed, pad = 3) => placed.find((n) => overlaps(bb, n, pad)) || null;

  const nearestOnEdge = (px, py, edge) => {
    let best = null;
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      const p = edge.at(t);
      const d = Math.hypot(px - p.x, py - p.y);
      if (!best || d < best.dist) best = { t, dist: d, ...p };
    }
    return best;
  };

  const bindEdge = (cx, cy) => {
    let best = null;
    for (const edge of edges) {
      const hit = nearestOnEdge(cx, cy, edge);
      if (!hit) continue;
      if (!best || hit.dist < best.dist) best = { edge, ...hit };
    }
    if (best && best.dist <= 72) return best;
    return null;
  };

  const isStereotype = (s) => s.startsWith('<<') && s.endsWith('>>');
  const isDiagramTitle = (s, bb) => {
    if (s.length < 8) return false;
    try {
      const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
      if (vb.length === 4 && bb.y < vb[1] + 40) return true;
    } catch (_) {}
    return false;
  };

  const mtvOutOfBox = (bb, box) => {
    const c = center(bb);
    const dxL = (bb.x + bb.width) - box.x;
    const dxR = (box.x + box.width) - bb.x;
    const dyT = (bb.y + bb.height) - box.y;
    const dyB = (box.y + box.height) - bb.y;
    const penX = Math.min(dxL, dxR);
    const penY = Math.min(dyT, dyB);
    if (penX < penY) {
      const dir = c.x < box.x + box.width / 2 ? -1 : 1;
      return { x: dir * (penX + 4), y: 0 };
    }
    const dir = c.y < box.y + box.height / 2 ? -1 : 1;
    return { x: 0, y: dir * (penY + 4) };
  };

  const tips = [];
  for (const el of svg.querySelectorAll('text')) {
    const raw = (el.textContent || '').trim();
    if (!raw || isStereotype(raw)) continue;
    let bb0;
    try { bb0 = el.getBBox(); } catch { continue; }
    if (!bb0.width || !bb0.height) continue;
    if (isDiagramTitle(raw, bb0)) continue;
    if (deepInsideNode(bb0, 10)) continue;
    tips.push({ el, bb0, c0: center(bb0) });
  }
  tips.sort((a, b) => (b.bb0.width * b.bb0.height) - (a.bb0.width * a.bb0.height));

  const tLadder = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.12, 0.88];
  const offsetLadder = [14, 20, 28, 38, 50, 64, 80, 100];
  const placed = [];

  const needsMove = (bb0, bind) => {
    if (hitNode(bb0, 2)) return true;
    if (bind && bind.dist < Math.max(10, bb0.height * 0.6)) return true;
    return false;
  };

  for (const tip of tips) {
    const { el, bb0, c0 } = tip;
    const bind0 = bindEdge(c0.x, c0.y);
    if (!needsMove(bb0, bind0)) {
      placed.push({ x: bb0.x, y: bb0.y, width: bb0.width, height: bb0.height });
      continue;
    }

    let best = null; // {ox,oy,bb,s,clear}
    const consider = (ox, oy, s, requireClear) => {
      const bb = { x: bb0.x + ox, y: bb0.y + oy, width: bb0.width, height: bb0.height };
      const node = hitNode(bb, 2);
      const other = hitPlaced(bb, placed, 3);
      if (requireClear && (node || other)) return;
      let score = s + Math.hypot(ox, oy) * 0.04;
      if (node) score += 400;
      if (other) score += 200;
      if (!best || score < best.s) best = { ox, oy, bb, s: score, clear: !node && !other };
    };

    if (bind0) {
      for (const t of tLadder) {
        const p = bind0.edge.at(t);
        let nx = -p.ty, ny = p.tx;
        const nlen = Math.hypot(nx, ny) || 1;
        nx /= nlen; ny /= nlen;
        const flips = ny <= 0 ? [false, true] : [true, false];
        for (const flip of flips) {
          const sx = flip ? -nx : nx;
          const sy = flip ? -ny : ny;
          for (const off of offsetLadder) {
            const ox = (p.x + sx * off) - c0.x;
            const oy = (p.y + sy * off) - c0.y;
            consider(ox, oy, Math.abs(t - 0.5) * 5 + off * 0.12, true);
          }
        }
      }
    }

    // Cardinal / diagonal shove from original if edge search failed.
    if (!best || !best.clear) {
      for (const dist of [16, 28, 40, 56, 72, 96]) {
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          consider(dx * dist, dy * dist, dist * 0.2, true);
        }
      }
    }

    // Best-effort: MTV out of overlapping nodes / tips even if not fully clear.
    if (!best || !best.clear) {
      let ox = 0, oy = 0;
      for (let i = 0; i < 14; i++) {
        const bb = { x: bb0.x + ox, y: bb0.y + oy, width: bb0.width, height: bb0.height };
        const blocker = hitNode(bb, 2) || hitPlaced(bb, placed, 3);
        if (!blocker) break;
        const m = mtvOutOfBox(bb, blocker);
        ox += m.x;
        oy += m.y;
      }
      consider(ox, oy, Math.hypot(ox, oy) * 0.3, false);
    }

    if (!best) {
      placed.push({ x: bb0.x, y: bb0.y, width: bb0.width, height: bb0.height });
      continue;
    }

    const ox = Math.round(best.ox);
    const oy = Math.round(best.oy);
    if (ox || oy) {
      el.setAttribute('transform', `translate(${ox} ${oy})`);
      el.setAttribute('data-tip-nudged', '1');
    }
    placed.push(best.bb);
  }

  // Tip↔tip MTV settle.
  for (let pass = 0; pass < 5; pass++) {
    let moved = false;
    for (let i = 0; i < tips.length; i++) {
      for (let j = i + 1; j < tips.length; j++) {
        const a = tips[i], b = tips[j];
        const parse = (el) => {
          const tr = el.getAttribute('transform');
          const m = tr && /translate\(([-\d.]+)\s+([-\d.]+)\)/.exec(tr);
          return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 0, y: 0 };
        };
        const pa = parse(a.el), pb = parse(b.el);
        const ra = { x: a.bb0.x + pa.x, y: a.bb0.y + pa.y, width: a.bb0.width, height: a.bb0.height };
        const rb = { x: b.bb0.x + pb.x, y: b.bb0.y + pb.y, width: b.bb0.width, height: b.bb0.height };
        if (!overlaps(ra, rb, 2)) continue;
        const m = mtvOutOfBox(ra, rb);
        const nax = Math.round(pa.x + m.x / 2), nay = Math.round(pa.y + m.y / 2);
        const nbx = Math.round(pb.x - m.x / 2), nby = Math.round(pb.y - m.y / 2);
        const ra2 = { x: a.bb0.x + nax, y: a.bb0.y + nay, width: a.bb0.width, height: a.bb0.height };
        const rb2 = { x: b.bb0.x + nbx, y: b.bb0.y + nby, width: b.bb0.width, height: b.bb0.height };
        if (!hitNode(ra2, 1)) {
          a.el.setAttribute('transform', `translate(${nax} ${nay})`);
          a.el.setAttribute('data-tip-nudged', '1');
          moved = true;
        }
        if (!hitNode(rb2, 1)) {
          b.el.setAttribute('transform', `translate(${nbx} ${nby})`);
          b.el.setAttribute('data-tip-nudged', '1');
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
}

function diagramType(text) {
  // Skip Mermaid frontmatter (%%{init: ...}%%) and blanks.
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('meta ') || line.startsWith('%%') || line.startsWith('#') || /^---/.test(line)) continue;
    if (typeof DrawerStyleLine !== 'undefined' && DrawerStyleLine.isRendererStyleLine(line)) continue;
    const m = line.match(/^(C4Context|C4Container|C4Component|flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|gitGraph|pie|mindmap|timeline|quadrantChart|xychart-beta|block-beta)\b/i);
    return m ? m[1] : (line.split(/\s+/, 1)[0] || '—');
  }
  return '—';
}
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

function applyLiveMeta(meta = {}) {
  if (meta && meta.label) liveLabel = String(meta.label);
  if (meta && meta.id) liveDiagramId = String(meta.id);
  if (meta && meta.title) liveDiagramTitle = String(meta.title);
  if (meta && meta.via) liveDiagramVia = String(meta.via);
  // Protocol: meta.current → history/mermaid record. Legacy archive treated as current.
  var curPath = "";
  if (meta && meta.current) curPath = String(meta.current);
  else if (meta && meta.archive) curPath = String(meta.archive);
  if (curPath) {
    liveArchive = curPath;
    try { liveArchiveName = liveArchive.split(/[/\\]/).pop() || ""; }
    catch (_e) { liveArchiveName = liveArchive; }
  }
  if (meta && meta.path) liveDiagramPath = String(meta.path);
  else if (curPath && curPath.startsWith("/")) liveDiagramPath = curPath;
  if (meta && Number.isFinite(Number(meta.version != null ? meta.version : meta.rev))) {
    if (!Number.isFinite(localRev) || localRev <= 0) localRev = Number(meta.version != null ? meta.version : meta.rev);
  }
  if (typeof syncSourceIdChrome === "function") syncSourceIdChrome();
  if (typeof syncSourceDockLabel === "function") syncSourceDockLabel(typeof diagramType === "function" && sourceEl ? diagramType(sourceEl.value) : "");
}
function setSyncUI(state = 'ok') {
  const pill = $('#syncPill');
  if (pill) {
    const map = {
      ok: 'ok',
      saving: 'warn',
      error: 'warn',
      conflict: 'warn',
    };
    pill.className = 'pill ' + (map[state] || 'ok');
    const label = state === 'saving' ? 'saving' : state === 'conflict' ? 'conflict' : state === 'error' ? 'error' : 'ok';
    pill.innerHTML = `${label} <b>${localRev}</b>`;
  }
  applyLiveMeta();
}
function currentMindmapLayout() {
  try {
    if (typeof MindmapEdit !== "undefined" && MindmapEdit.normalizeLayout) {
      return MindmapEdit.normalizeLayout(loadDrawerUi().mindmapLayout);
    }
  } catch (_e) {}
  var ui = loadDrawerUi();
  return ui.mindmapLayout === "logic" ? "logic" : "radial";
}
function syncMindmapLayoutSeg() {
  var layout = currentMindmapLayout();
  document.querySelectorAll("#mindmapLayoutSeg [data-mindmap-layout]").forEach(function(btn) {
    var on = btn.getAttribute("data-mindmap-layout") === layout;
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.classList.toggle("is-active", on);
  });
}
function setMindmapLayout(layout) {
  var next = (typeof MindmapEdit !== "undefined" && MindmapEdit.normalizeLayout)
    ? MindmapEdit.normalizeLayout(layout)
    : (layout === "logic" ? "logic" : "radial");
  saveDrawerUi({ mindmapLayout: next });
  syncMindmapLayoutSeg();
  if (document.documentElement.dataset.drawerMode === "mermaid" && sourceEl && sourceEl.value.trim()) {
    void renderDiagram({ fit: false });
  }
}
function syncStyleLayoutSections() {
  var mode = document.documentElement.dataset.drawerMode || "mermaid";
  var mm = document.getElementById("mindmapLayoutSection");
  var board = document.getElementById("boardLayoutSection");
  var typeName = "";
  try {
    if (mode === "mermaid" && sourceEl && sourceEl.value.trim() && typeof diagramType === "function") {
      typeName = String(diagramType(sourceEl.value) || "").toLowerCase();
    }
  } catch (_e) {}
  // Exclusive: mindmap → Radial/Logic only; board → Trunk/Stagger/Straight only; never both.
  var showMm = mode === "mermaid" && (typeName === "mindmap" || document.documentElement.dataset.mermaidMindmap === "1");
  var showBoard = mode === "board";
  if (mm) {
    mm.hidden = !showMm;
    if (showMm && typeof syncMindmapLayoutSeg === "function") syncMindmapLayoutSeg();
  }
  if (board) board.hidden = !showBoard;
  var capSec = document.getElementById("boardItemCapSection");
  if (capSec) capSec.hidden = !showBoard;
  var typeSec = document.getElementById("boardFontSizeSection");
  if (typeSec) typeSec.hidden = !showBoard;
}

function formatDockTypeLabel(typeName) {
  var t = String(typeName || "").trim();
  if (!t) return "Source";
  var low = t.toLowerCase();
  var map = {
    sequencediagram: "sequence",
    "statediagram-v2": "state",
    statediagram: "state",
    "architecture-beta": "architecture",
    "xychart-beta": "xychart",
    "block-beta": "block",
    "packet-beta": "packet",
    "sankey-beta": "sankey",
    erdiagram: "er",
    classdiagram: "class",
    gitgraph: "git",
    quadrantchart: "quadrant",
    c4context: "C4",
    c4container: "C4",
    c4component: "C4",
    graph: "flowchart",
  };
  if (map[low]) return map[low];
  return t;
}
function syncSourceDockLabel(typeName) {
  // Rail tab: fixed "Source" (no dynamic type — kills refresh flicker).
  // Panel title: keep prior dynamic behavior.
  var tab = document.getElementById("sourceDockTabLabel");
  var title = document.getElementById("sourceDockTitle");
  var btn = document.getElementById("btnDockSource");
  var boardMode = document.documentElement.dataset.drawerMode === "board";
  var label = boardMode ? "Board" : formatDockTypeLabel(typeName);
  if (tab && tab.textContent !== "Source") tab.textContent = "Source";
  if (btn && btn.title !== "Source") btn.title = "Source";
  var version = typeof liveDocumentVersion === "function" ? liveDocumentVersion() : 0;
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
  return document.documentElement.dataset.drawerMode === "board"
    ? String(typeof liveBoardId !== "undefined" ? liveBoardId : "")
    : String(typeof liveDiagramId !== "undefined" ? liveDiagramId : "");
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

function setTypeUI(text, opts) {
  opts = opts || {};
  const typePill = $('#typePill');
  const raw = String(text == null ? '' : text);
  var boardMode = document.documentElement.dataset.drawerMode === 'board';
  var typeName = boardMode ? 'Board' : (raw.trim() ? diagramType(raw) : '');
  if (typeof syncSourceDockLabel === 'function') syncSourceDockLabel(boardMode ? 'Board' : typeName);
  if (typePill) typePill.innerHTML = `<b>${typeName || '—'}</b>`;
  var hint = $('#exportTypeHint');
  if (hint) {
    hint.textContent = boardMode
      ? 'Board mode · Copy Path below.'
      : (typeName ? (typeName + ' diagram · Copy Path below.') : 'No diagram type yet.');
  }
  setCharsLabel($('#charsPill'), [...raw].length);
  if (boardMode) {
    if (typeof syncMermaidDeleteButton === 'function') syncMermaidDeleteButton();
    try { saveDrawerUi({ diagramType: 'Board', mermaidFlowchart: false }); } catch (_e) {}
    if (typeof syncStyleLayoutSections === 'function') syncStyleLayoutSections();
    return;
  }
  // Empty source during boot/theme init must NOT hide toolbar or wipe drawer.ui.
  if (!raw.trim()) {
    if (opts.clearTools) {
      document.documentElement.dataset.mermaidFlowchart = '0';
      document.documentElement.dataset.mermaidMindmap = '0';
      document.documentElement.dataset.mermaidState = '0';
      if (typeof setMermaidLinkMode === 'function') setMermaidLinkMode(false);
      try { saveDrawerUi({ diagramType: '', mermaidFlowchart: false }); } catch (_e) {}
    }
    if (typeof syncMermaidDeleteButton === 'function') syncMermaidDeleteButton();
    if (typeof syncStyleLayoutSections === 'function') syncStyleLayoutSections();
    return;
  }
  var t = String(typeName || '').toLowerCase();
  var flowchart = (t === 'flowchart' || t === 'graph');
  var mindmap = (t === 'mindmap');
  var stateDiag = (t === 'statediagram' || t === 'statediagram-v2');
  document.documentElement.dataset.mermaidFlowchart = flowchart ? '1' : '0';
  document.documentElement.dataset.mermaidMindmap = mindmap ? '1' : '0';
  document.documentElement.dataset.mermaidState = stateDiag ? '1' : '0';
  if (!flowchart && typeof setMermaidLinkMode === 'function') setMermaidLinkMode(false);
  if (typeof syncMermaidDeleteButton === 'function') syncMermaidDeleteButton();
  try {
    saveDrawerUi({ diagramType: typeName || '', mermaidFlowchart: flowchart });
  } catch (_e) {}
  if (typeof syncStyleLayoutSections === 'function') syncStyleLayoutSections();
}
function applyTransform() {
  if (document.documentElement.dataset.drawerMode === "board") {
    previewEl.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    var zr = document.querySelector("#btnZoomReset");
    if (zr) zr.textContent = Math.round(scale * 100) + "%";
    scheduleDrawerUiSave();
    return;
  }
  previewEl.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  $('#btnZoomReset').textContent = `${Math.round(scale * 100)}%`;
  scheduleDrawerUiSave();
}
function boardContentOnStage() {
  var content = previewEl && previewEl.querySelector(".board-render");
  if (!content || !stageEl) return false;
  var wrap = stageEl.getBoundingClientRect();
  var box = content.getBoundingClientRect();
  if (!wrap.width || !wrap.height || !box.width || !box.height) return false;
  return box.right > wrap.left && box.left < wrap.right && box.bottom > wrap.top && box.top < wrap.bottom;
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
  if (document.documentElement.dataset.drawerMode !== "board") return;
  previewEl.style.transform = "none";
  pinBoardTitle();
  const content = previewEl.querySelector(".board-render");
  if (!content) return;
  requestAnimationFrame(() => {
    const wrap = stageEl.getBoundingClientRect(), box = content.getBoundingClientRect();
    if (!wrap.width || !wrap.height || !box.width || !box.height) return;
    /* Board title is document.title — do not reserve a canvas band for it */
    var topBand = 12;
    const pad = 24;
    scale = Math.max(0.2, Math.min(1, (wrap.width - pad) / box.width, (wrap.height - topBand - pad) / Math.max(1, box.height)));
    panX = Math.max(12, (wrap.width - box.width * scale) / 2);
    panY = Math.max(topBand, (wrap.height - box.height * scale) / 2);
    applyTransform();
    if (opts.persist) snapshotDrawerUi();
    var key = boardSourceEl.dataset.boardSelectionKey;
    var retained = key && Array.from(previewEl.querySelectorAll("[data-board-key]")).find(function(el) { return el.dataset.boardKey === key; });
    if (retained) retained.classList.add("board-selection");
  });
}
function showEmpty() {
  if (document.documentElement.dataset.drawerMode === 'board') return;
  previewEl.classList.remove("board-preview");
  previewEl.innerHTML = emptyHtml || '<div class="empty"><h2>Canvas is ready</h2></div>';
  errorBox.classList.remove('show');
  errorBox.textContent = '';
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
}
function updateBoardChars() {
  setCharsLabel($('#boardCharsPill'), [...boardSourceEl.value].length);
}
function showBoardError(message) { boardError.textContent = message || ''; boardError.classList.toggle('show', !!message); }

wrapEditorApi(typeof BoardRender !== "undefined" ? BoardRender : null);
wrapEditorApi(typeof FlowchartEdit !== "undefined" ? FlowchartEdit : null);
wrapEditorApi(typeof MindmapEdit !== "undefined" ? MindmapEdit : null);
wrapEditorApi(typeof StateEdit !== "undefined" ? StateEdit : null);
