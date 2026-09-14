/* === 00-style-line.js === */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DrawerStyleLine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var RENDERER_STYLE_RE = /^(?:%%\s*)?style\s+(\S+)\s*$/i;
  var DIAGRAM_START_RE = /^(C4Context|C4Container|C4Component|flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|gitGraph|pie|mindmap|timeline|quadrantChart|xychart-beta|block-beta|architecture-beta|packet-beta|kanban|sankey-beta)\b/i;
  var STYLE_THEMES = { default: 1, classic: 1, pastel: 1, kami: 1 };

  function isRendererStyleLine(line) {
    return RENDERER_STYLE_RE.test(String(line || "").trim());
  }

  function firstRealLine(body) {
    var lines = String(body == null ? "" : body).split(/\r?\n/);
    for (var i = 0; i < lines.length; i += 1) {
      var line = String(lines[i] || "").trim();
      if (!line || line.charAt(0) === "#" || line.indexOf("//") === 0) continue;
      return line;
    }
    return "";
  }

  function bodyIsBoard(body) {
    return /^board\s+/i.test(firstRealLine(body));
  }

  function splitRendererStyle(body) {
    var lines = String(body == null ? "" : body).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    var token = "";
    var out = [];
    var afterDiagram = false;
    for (var i = 0; i < lines.length; i += 1) {
      var trim = String(lines[i] || "").trim();
      if (!afterDiagram) {
        var hit = RENDERER_STYLE_RE.exec(trim);
        if (hit) {
          token = hit[1];
          continue;
        }
        if (DIAGRAM_START_RE.test(trim)) afterDiagram = true;
      }
      out.push(lines[i]);
    }
    return { token: token, body: out.join("\n") };
  }

  function joinRendererStyle(token, body) {
    var rest = String(body == null ? "" : body);
    var t = String(token || "").trim();
    if (!t) return rest;
    var line = (bodyIsBoard(rest) ? "style " : "%% style ") + t;
    if (!rest) return line + "\n";
    if (rest.charAt(0) === "\n") return line + rest;
    return line + "\n" + rest;
  }

  function authoredViewport(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    var scale = Number(raw.scale);
    var x = Number(raw.x);
    var y = Number(raw.y);
    if (!isFinite(scale) || !isFinite(x) || !isFinite(y)) return null;
    return {
      scale: Math.min(3, Math.max(0.2, scale)),
      x: Math.round(x),
      y: Math.round(y),
    };
  }

  function authoredMermaidStyle(raw) {
    var src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    var out = {};
    if (STYLE_THEMES[src.theme] && src.theme !== "default") out.theme = src.theme;
    var viewport = authoredViewport(src.viewport || src.view);
    if (viewport) out.viewport = viewport;
    return out;
  }

  function applyMermaidStylePatch(token, patch, encode, decode) {
    var raw = {};
    try { raw = typeof decode === "function" ? decode(token) : {}; } catch (_e) { raw = {}; }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) raw = {};
    Object.keys(patch || {}).forEach(function (key) {
      if (patch[key] == null) delete raw[key];
      else raw[key] = patch[key];
    });
    var authored = authoredMermaidStyle(raw);
    if (!Object.keys(authored).length) return "";
    return encode(authored);
  }

  return {
    RENDERER_STYLE_RE: RENDERER_STYLE_RE,
    isRendererStyleLine: isRendererStyleLine,
    bodyIsBoard: bodyIsBoard,
    splitRendererStyle: splitRendererStyle,
    joinRendererStyle: joinRendererStyle,
    authoredViewport: authoredViewport,
    authoredMermaidStyle: authoredMermaidStyle,
    applyMermaidStylePatch: applyMermaidStylePatch,
  };
});

/* === 00-document-meta.js === */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DrawerDocumentMeta = api;
  root.splitDocument = api.splitDocument;
  root.joinDocument = api.joinDocument;
  root.sourceBody = api.sourceBody;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var META_LINE = /^(?:%%\s*)?meta\s+(\S+|{.*})\s*$/;
  var ID_RE = /^[bm]_[0-9a-f]{8}$/;

  function encodeMetaPayload(meta) {
    var json = JSON.stringify({ id: String(meta.id), version: Number(meta.version) });
    if (typeof Buffer !== "undefined") return Buffer.from(json, "utf8").toString("base64");
    return btoa(unescape(encodeURIComponent(json)));
  }

  function decodeMetaPayload(token) {
    var text = String(token == null ? "" : token).trim();
    if (!text) throw new Error("document meta required");
    var json;
    if (text.charAt(0) === "{") {
      json = text;
    } else {
      var compact = text.replace(/\s+/g, "");
      try {
        json = typeof Buffer !== "undefined"
          ? Buffer.from(compact, "base64").toString("utf8")
          : decodeURIComponent(escape(atob(compact)));
      } catch (_e) {
        throw new Error("document meta required");
      }
    }
    var data;
    try { data = JSON.parse(json); } catch (_e) { throw new Error("document meta required"); }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("document meta required");
    var id = data.id != null ? String(data.id).trim() : "";
    var version = data.version;
    if (!ID_RE.test(id) || !Number.isInteger(version) || version < 1) throw new Error("document meta required");
    return { id: id, version: version };
  }

  function splitDocument(text) {
    var raw = String(text == null ? "" : text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    var lines = raw.split("\n");
    var i = 0;
    while (i < lines.length && !String(lines[i] || "").trim()) i += 1;
    var found = [];
    while (i < lines.length) {
      var hit = String(lines[i]).trim().match(META_LINE);
      if (!hit) break;
      try { found.push(decodeMetaPayload(hit[1])); } catch (_e) {}
      i += 1;
      while (i < lines.length && !String(lines[i] || "").trim()) i += 1;
    }
    if (!found.length) throw new Error("document meta required");
    var meta = found[0];
    for (var n = 1; n < found.length; n += 1) {
      if (found[n].version > meta.version) meta = found[n];
    }
    return { meta: meta, body: lines.slice(i).join("\n") };
  }

  function joinDocument(meta, body) {
    var id = String(meta.id);
    var prefix = /^m_[0-9a-f]{8}$/.test(id) ? "%% " : "";
    var rest = String(body == null ? "" : body);
    if (prefix && typeof DrawerStyleLine !== "undefined") {
      var styled = DrawerStyleLine.splitRendererStyle(rest);
      rest = DrawerStyleLine.joinRendererStyle(styled.token, styled.body);
    }
    var line = prefix + "meta " + encodeMetaPayload({ id: id, version: Number(meta.version) });
    if (rest.charAt(0) === "\n") return line + rest;
    if (rest) return line + "\n" + rest;
    return line + "\n";
  }

  function sourceBody(text) {
    var raw = String(text == null ? "" : text);
    if (!raw.trim()) return "";
    return splitDocument(raw).body;
  }

  return {
    encodeMetaPayload: encodeMetaPayload,
    decodeMetaPayload: decodeMetaPayload,
    splitDocument: splitDocument,
    joinDocument: joinDocument,
    sourceBody: sourceBody,
  };
});
var splitDocument = globalThis.splitDocument;
var joinDocument = globalThis.joinDocument;
var sourceBody = globalThis.sourceBody;

/* === 00-canvas-view.js === */
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

/* === 01-shell-state.js === */

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

/* === 02-board.js === */
/* drawer-app/02-board.js — lines 700-1719 of former inline module */
function boardNodeForSelection(board, selection) {
  if (!board || !selection) return null;
  if (typeof BoardRender !== "undefined" && typeof BoardRender.findNode === "function") {
    return BoardRender.findNode(board, selection);
  }
  var found = null;
  var visit = function(box) {
    if (selection.kind === "box" && box.id === selection.id) found = box;
    if (selection.kind === "item" && box.id === selection.boxId) found = (box.items || [])[selection.index] || null;
    (box.boxes || []).forEach(visit);
  };
  (board.boxes || []).forEach(visit);
  return found;
}
function boardLinkTargetForElement(el) {
  if (!el || !el.closest) return null;
  var item = el.closest(".board-item");
  if (item && item.classList.contains("board-root-item") && item.dataset.boardId) return item.dataset.boardId;
  if (item && item.dataset.boardBoxId != null && item.dataset.boardItemIndex != null) {
    if (item.dataset.boardId) return item.dataset.boardId;
    return { boxId: item.dataset.boardBoxId, index: Number(item.dataset.boardItemIndex) };
  }
  var zone = el.closest(".board-zone");
  if (zone && zone.dataset.boardId) return zone.dataset.boardId;
  return null;
}
function boardLinkRefKey(ref) {
  if (ref && typeof ref === "object") return "item:" + ref.boxId + ":" + ref.index;
  return String(ref || "");
}
function boardLinkSourceEl(root, ref) {
  if (!root) return null;
  if (ref && typeof ref === "object") return root.querySelector('[data-board-key="item:' + ref.boxId + ':' + ref.index + '"]');
  return root.querySelector('[data-board-id="' + ref + '"]');
}
function boardLinkPickFromEvent(event, root, board) {
  if (!boardLinkMode) return false;
  var hit = event.target && event.target.closest ? event.target.closest(".board-item, .board-zone") : null;
  var endpoint = boardLinkTargetForElement(hit || event.target);
  if (!endpoint) {
    setBoardLinkMode(false);
    return true;
  }
  if (!boardLinkStart) {
    boardLinkStart = endpoint;
    document.querySelectorAll(".board-link-source").forEach(function(el) { el.classList.remove("board-link-source"); });
    var srcEl = boardLinkSourceEl(root, endpoint);
    if (srcEl) srcEl.classList.add("board-link-source");
    setStatus("Source " + boardLinkRefKey(endpoint) + " · click target");
    return true;
  }
  var from = boardLinkStart, to = endpoint;
  if (boardLinkRefKey(from) === boardLinkRefKey(to)) {
    setStatus("Target cannot match source", true);
    return true;
  }
  try {
    var result = BoardRender.addLink(boardSourceEl.value, from, to, boardLinkTitleValue(), boardLinkTypeValue(), boardLinkArrowValue());
    applyBoardEditResult(result);
    setBoardLinkMode(false);
    setStatus("Linked " + boardLinkRefKey(from) + " → " + boardLinkRefKey(to));
  } catch (err) {
    showBoardError(err instanceof Error ? err.message : String(err));
  }
  return true;
}
function setBoardLinkMode(active) {
  boardLinkMode = !!active; boardLinkStart = null;
  if (boardLinkButton) boardLinkButton.classList.toggle("is-active", boardLinkMode);
  document.documentElement.classList.toggle("board-link-mode", boardLinkMode);
  document.querySelectorAll(".board-link-source").forEach(function(el) { el.classList.remove("board-link-source"); });
  if (boardLinkMode) {
    selectedBoardEdge = null;
    delete boardSourceEl.dataset.boardEdgeSelectionKey;
    clearBoardSelection();
    closePropsPanel();
    showPropsForLinkMode();
    setStatus("Link mode · type and title, then click source / target box or item");
  } else {
    hidePropsLinkOnlyChrome();
    clearBoardSelection();
    if (document.documentElement.dataset.drawerMode === "board") setStatus("Board mode");
  }
}
function boardLinkTitleValue() {
  var value = boardTitleEditor ? String(boardTitleEditor.value || "").trim() : "";
  return value ? value.slice(0, 48) : "";
}
function boardLinkTypeValue() {
  return boardTypeEditor && String(boardTypeEditor.value || "").toLowerCase() === "dashed" ? "dashed" : "solid";
}
function boardLinkArrowValue() {
  return boardArrowEditor && String(boardArrowEditor.value || "").toLowerCase() === "both" ? "both" : "forward";
}
function setBoardArrowField(show, cur) {
  if (boardArrowField) boardArrowField.hidden = !show;
  if (boardArrowEditor) boardArrowEditor.hidden = !show;
  if (boardArrowLabel) boardArrowLabel.hidden = !show;
  if (boardArrowReverse) boardArrowReverse.hidden = !show;
  if (show) fillLinkArrowEditor(cur);
}
function fillLinkArrowEditor(cur) {
  if (!boardArrowEditor) return;
  var arrow = String(cur || "forward").toLowerCase();
  if (arrow !== "both") arrow = "forward";
  boardArrowEditor.innerHTML = "<option value=\"forward\">-&gt;</option><option value=\"both\">&lt;-&gt;</option>";
  boardArrowEditor.value = arrow;
  boardArrowEditor.hidden = false;
  boardArrowEditor.disabled = false;
  if (boardArrowLabel) { boardArrowLabel.hidden = false; boardArrowLabel.textContent = "Arrow"; }
  if (boardArrowField) boardArrowField.hidden = false;
  if (boardArrowReverse) {
    boardArrowReverse.hidden = false;
    boardArrowReverse.disabled = false;
  }
}
function fillLinkTypeEditor(cur) {
  if (!boardTypeEditor) return;
  var opts = ["solid", "dashed"];
  var type = String(cur || "solid");
  if (opts.indexOf(type) < 0) type = "solid";
  boardTypeEditor.innerHTML = opts.map(function(v){ return "<option value=\"" + v + "\">" + v + "</option>"; }).join("");
  boardTypeEditor.value = type;
  boardTypeEditor.hidden = false;
  boardTypeEditor.disabled = false;
  if (boardTypeLabel) { boardTypeLabel.hidden = false; boardTypeLabel.textContent = "Type"; }
}
function showPropsForLinkMode() {
  if (propsEmpty) propsEmpty.hidden = true;
  if (propsFields) propsFields.hidden = false;
  if (propsKindLabel) propsKindLabel.textContent = "link";
  fillLinkTypeEditor("solid");
  setBoardArrowField(true, "forward");
  if (boardTitleEditor) { boardTitleEditor.hidden = false; boardTitleEditor.value = ""; }
  if (boardTitleLabel) { boardTitleLabel.hidden = false; boardTitleLabel.textContent = "Title"; }
  if (boardDirEditor) boardDirEditor.hidden = true;
  if (boardDirLabel) boardDirLabel.hidden = true;
  setBoardDirTip(false);
  setBoardAlignJustifyFields(false);
  setBoardIconField(false);
  setBoardIdField(false);
  setBoardShapeField(false);
  setBoardCapField(false);
  if (propsHint) propsHint.textContent = "Type, arrow, and optional title; then click source / target";
}
function showPropsForLinkEdge(title, type, arrow) {
  if (propsEmpty) propsEmpty.hidden = true;
  if (propsFields) propsFields.hidden = false;
  if (propsKindLabel) propsKindLabel.textContent = "link";
  fillLinkTypeEditor(type);
  setBoardArrowField(true, arrow);
  if (boardTitleEditor) { boardTitleEditor.hidden = false; boardTitleEditor.value = String(title || ""); }
  if (boardTitleLabel) { boardTitleLabel.hidden = false; boardTitleLabel.textContent = "Title"; }
  if (boardDirEditor) boardDirEditor.hidden = true;
  if (boardDirLabel) boardDirLabel.hidden = true;
  setBoardDirTip(false);
  setBoardAlignJustifyFields(false);
  setBoardIconField(false);
  setBoardIdField(false);
  if (propsHint) propsHint.textContent = "Type, arrow, and title write back to DSL";
  setBoardShapeField(false);
  setBoardCapField(false);
}
function setBoardShapeField(show, shape) {
  var cur = shape === "diamond" ? "diamond" : "rect";
  if (boardShapeField) {
    boardShapeField.hidden = !show;
    Array.from(boardShapeField.querySelectorAll("[data-shape]")).forEach(function(btn) {
      btn.disabled = !show;
      btn.setAttribute("aria-pressed", btn.getAttribute("data-shape") === cur ? "true" : "false");
    });
  }
  if (boardShapeLabel) boardShapeLabel.hidden = !show;
}
function setBoardCapField(show, cap) {
  var authored = cap === "off";
  var cur = authored ? "off" : "on";
  if (boardCapField) boardCapField.hidden = !show;
  if (boardCapEditor) {
    boardCapEditor.hidden = !show;
    if (show) boardCapEditor.value = cur;
  }
  if (boardCapLabel) boardCapLabel.hidden = !show;
  setAuthoredTip(boardCapTip, show, authored);
}
function setAuthoredTip(el, show, authored) {
  if (!el) return;
  var unset = !!show && !authored;
  el.hidden = !unset;
  el.textContent = unset ? "default · not in source" : "";
}
function setBoardDirTip(show, authored) {
  setAuthoredTip(boardDirTip, show, authored);
}
function setBoardAlignJustifyFields(show, align, justify) {
  var authoredA = align === "start" || align === "center" || align === "stretch";
  var authoredJ = justify === "start" || justify === "center" || justify === "stretch";
  var a = authoredA ? align : "stretch";
  var j = authoredJ ? justify : "start";
  if (boardAlignEditor) {
    boardAlignEditor.hidden = !show;
    if (show) boardAlignEditor.value = a;
  }
  if (boardAlignLabel) boardAlignLabel.hidden = !show;
  setAuthoredTip(boardAlignTip, show, authoredA);
  if (boardJustifyEditor) {
    boardJustifyEditor.hidden = !show;
    if (show) boardJustifyEditor.value = j;
  }
  if (boardJustifyLabel) boardJustifyLabel.hidden = !show;
  setAuthoredTip(boardJustifyTip, show, authoredJ);
}
function setBoardOrderField(show, info) {
  if (boardOrderField) boardOrderField.hidden = !show;
  if (boardOrderLabel) boardOrderLabel.hidden = !show;
  var row = !!(show && info && info.direction === "row");
  var atStart = !info || info.index <= 0;
  var atEnd = !info || info.index >= info.count - 1 || info.count < 2;
  if (boardOrderPrev) {
    boardOrderPrev.hidden = !show;
    boardOrderPrev.disabled = !show || atStart;
    boardOrderPrev.textContent = row ? "Left" : "Up";
    boardOrderPrev.title = row ? "Option+Left" : "Option+Up";
    boardOrderPrev.setAttribute("aria-label", row ? "Move left" : "Move up");
  }
  if (boardOrderNext) {
    boardOrderNext.hidden = !show;
    boardOrderNext.disabled = !show || atEnd;
    boardOrderNext.textContent = row ? "Right" : "Down";
    boardOrderNext.title = row ? "Option+Right" : "Option+Down";
    boardOrderNext.setAttribute("aria-label", row ? "Move right" : "Move down");
  }
}
function hidePropsLinkOnlyChrome() {
  if (boardTypeEditor) { boardTypeEditor.hidden = false; boardTypeEditor.disabled = false; }
  if (boardTypeLabel) boardTypeLabel.hidden = false;
  if (boardTitleEditor) boardTitleEditor.hidden = false;
  if (boardTitleLabel) boardTitleLabel.hidden = false;
  if (boardDirEditor) boardDirEditor.hidden = false;
  if (boardDirLabel) boardDirLabel.hidden = false;
  setBoardAlignJustifyFields(false);
  setBoardOrderField(false);
  setBoardArrowField(false);
  setBoardShapeField(false);
  setBoardCapField(false);
}
function fillBoardIconSec() {
  var Icons = window.BoardIcons;
  if (!boardIconSec || !Icons || !Icons.sections) return;
  boardIconSec.innerHTML = Icons.sections.map(function(sec) {
    var on = sec.id === boardIconSecId;
    return "<button type=\"button\" class=\"props-seg-btn\" data-sec=\"" + sec.id + "\" aria-pressed=\"" + (on ? "true" : "false") + "\">" + sec.label + "</button>";
  }).join("");
}
function fillBoardIconList() {
  var Icons = window.BoardIcons;
  if (!boardIconList || !Icons || !Icons.glyph || !Icons.sections) return;
  var spec = boardIconSecId ? Icons.sections.filter(function(sec) { return sec.id === boardIconSecId; })[0] : null;
  if (!spec) {
    var first = Icons.sections[0];
    if (first && first.id) {
      boardIconSecId = first.id;
      spec = first;
    } else {
      boardIconSecId = "";
      boardIconList.innerHTML = "";
      fillBoardIconSec();
      return;
    }
  }
  var html = "";
  (spec.icons || []).forEach(function(n) {
    var num = String(n).padStart(3, "0");
    var gloss = (Icons.gloss && Icons.gloss[n]) || "";
    html += "<button type=\"button\" class=\"props-icon-btn\" role=\"option\" data-icon=\"" + n + "\" title=\"" + num + (gloss ? " " + gloss : "") + "\">" +
      "<span class=\"props-icon-glyph\" aria-hidden=\"true\">" + (Icons.glyph(n) || "") + "</span>" +
      "<span class=\"props-icon-num\">" + num + "</span>" +
      (gloss ? "<span class=\"props-icon-gloss\">" + gloss + "</span>" : "") + "</button>";
  });
  boardIconList.innerHTML = html;
  fillBoardIconSec();
}
function markBoardIconPick(icon) {
  if (!boardIconList) return;
  Array.from(boardIconList.querySelectorAll(".props-icon-btn")).forEach(function(btn) {
    var on = Number(btn.dataset.icon) === Number(icon);
    btn.classList.toggle("is-selected", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  var selected = boardIconList.querySelector(".props-icon-btn.is-selected");
  if (selected && selected.scrollIntoView) selected.scrollIntoView({ block: "nearest" });
}
function normalizeBoardIdInput(raw) {
  return String(raw == null ? "" : raw).replace(/[^A-Za-z]/g, "").toUpperCase();
}
function boardSelectionWithId(selection, nextId) {
  var id = nextId ? String(nextId) : null;
  if (!selection) return selection;
  if (selection.kind === "box") return { kind: "box", key: "box:" + id, id: id };
  if (selection.kind !== "item") return selection;
  if (selection.boxId == null || selection.boxId === "") {
    return { kind: "item", key: id ? "item:" + id : selection.key, id: id, boxId: null, index: -1 };
  }
  return { kind: "item", key: selection.key, id: id, boxId: selection.boxId, index: selection.index };
}
function markBoardIdCopied(on) {
  if (!boardIdCopy) return;
  boardIdCopy.classList.toggle("is-copied", !!on);
  if (boardIdCopiedTimer) clearTimeout(boardIdCopiedTimer);
  boardIdCopiedTimer = 0;
  if (on) boardIdCopiedTimer = setTimeout(function() { markBoardIdCopied(false); }, 1200);
}
function syncBoardIdDup() {
  var draft = boardIdEditor ? normalizeBoardIdInput(boardIdEditor.value) : "";
  var taken = false;
  if (draft && selectedBoardNode && typeof BoardRender !== "undefined" && typeof BoardRender.isIdTaken === "function") {
    try { taken = !!BoardRender.isIdTaken(boardSourceEl.value, selectedBoardNode, draft); }
    catch (_) { taken = false; }
  }
  if (boardIdEditor) boardIdEditor.classList.toggle("is-dup", taken);
  if (boardIdDup) boardIdDup.hidden = !taken;
  return taken;
}
function setBoardIdField(show, id) {
  var value = show ? String(id == null ? "" : id).trim() : "";
  if (boardIdLabel) boardIdLabel.hidden = !show;
  if (boardIdField) boardIdField.hidden = !show;
  if (boardIdEditor) {
    boardIdEditor.value = value;
    boardIdEditor.classList.remove("is-dup");
  }
  if (boardIdDup) boardIdDup.hidden = true;
  if (boardIdCopy) {
    boardIdCopy.disabled = !value;
    boardIdCopy.setAttribute("aria-label", value ? "Copy node ID " + value : "Copy node ID");
  }
  markBoardIdCopied(false);
}
function filterBoardIdEditor() {
  if (!boardIdEditor) return "";
  var start = boardIdEditor.selectionStart;
  var raw = String(boardIdEditor.value || "");
  var next = normalizeBoardIdInput(raw);
  if (next !== raw) {
    var caret = normalizeBoardIdInput(raw.slice(0, start)).length;
    boardIdEditor.value = next;
    if (typeof boardIdEditor.setSelectionRange === "function") boardIdEditor.setSelectionRange(caret, caret);
  }
  if (boardIdCopy) {
    boardIdCopy.disabled = !next;
    boardIdCopy.setAttribute("aria-label", next ? "Copy node ID " + next : "Copy node ID");
  }
  markBoardIdCopied(false);
  syncBoardIdDup();
  return next;
}
function commitBoardId() {
  if (document.documentElement.dataset.drawerMode === "mermaid" && selectedMermaid) {
    commitMermaidPropsFromId();
    return;
  }
  if (!boardIdEditor || !selectedBoardNode) return;
  if (selectedBoardNode.kind !== "box" && selectedBoardNode.kind !== "item") return;
  if (typeof BoardRender === "undefined" || typeof BoardRender.updateId !== "function") return;
  var current = String(selectedBoardNode.id || "").trim();
  var raw = String(boardIdEditor.value || "").trim();
  if (raw === current) return;
  var next = filterBoardIdEditor();
  if (next === current) return;
  if (syncBoardIdDup()) return;
  var keepSelection = boardSelectionWithId(selectedBoardNode, next);
  try {
    var source = BoardRender.updateId(boardSourceEl.value, selectedBoardNode, next);
    if (source !== boardSourceEl.value) {
      boardSourceEl.value = source;
      selectedBoardNode = keepSelection;
      boardSourceEl.dataset.boardSelectionKey = selectedBoardNode.key;
      updateBoardChars();
      renderBoard();
      scheduleBoardSave();
    }
  } catch (err) {
    showBoardError(err instanceof Error ? err.message : String(err));
  }
}
function setBoardIconField(show, icon) {
  var Icons = window.BoardIcons;
  if (boardIconField) boardIconField.hidden = !show;
  if (!show || !boardIconList) return;
  var n = Number(icon);
  var ok = Number.isInteger(n) && n > 0 && Icons && Icons.glyph && Icons.glyph(n);
  boardIconPick = ok ? n : null;
  boardIconSecId = ok && Icons.sectionOf ? Icons.sectionOf(n) : "";
  fillBoardIconList();
  markBoardIconPick(boardIconPick);
}
function commitBoardIcon(nextIcon) {
  if (!selectedBoardNode || (selectedBoardNode.kind !== "item" && selectedBoardNode.kind !== "box") || typeof BoardRender.updateIcon !== "function") return;
  var keepSelection = Object.assign({}, selectedBoardNode);
  try {
    var next = BoardRender.updateIcon(boardSourceEl.value, selectedBoardNode, nextIcon);
    if (next !== boardSourceEl.value) {
      boardSourceEl.value = next;
      selectedBoardNode = keepSelection;
      updateBoardChars();
      renderBoard();
      scheduleBoardSave();
      setStatus(nextIcon == null ? "Icon cleared" : "Icon · " + nextIcon);
    }
  } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}


function parseCssColor(raw) {
  var s = String(raw || "").trim();
  if (!s || s === "none" || s === "transparent") return null;
  var m = s.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 1 };
  m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) {
    var h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  return null;
}
function formatCssColor(c) {
  if (!c) return "";
  if (c.a != null && c.a < 1) return "rgba(" + Math.round(c.r) + ", " + Math.round(c.g) + ", " + Math.round(c.b) + ", " + c.a + ")";
  return "rgb(" + Math.round(c.r) + ", " + Math.round(c.g) + ", " + Math.round(c.b) + ")";
}
/** Darken toward black; hue stays from live theme stroke (Mermaid link select parity). */
function darkenCssColor(raw, amount) {
  var c = parseCssColor(raw);
  if (!c) return raw;
  var f = 1 - (amount == null ? 0.4 : amount);
  return formatCssColor({ r: c.r * f, g: c.g * f, b: c.b * f, a: c.a });
}
function readBoardEdgePaint(el, attr) {
  if (!el) return "";
  var direct = (el.getAttribute && el.getAttribute(attr)) || "";
  if (direct && direct !== "none" && direct !== "currentColor" && direct !== "context-stroke") return direct;
  try {
    var cs = window.getComputedStyle(el);
    if (attr === "stroke" && cs && cs.stroke && cs.stroke !== "none") return cs.stroke;
    if (attr === "fill" && cs && cs.fill && cs.fill !== "none") return cs.fill;
  } catch (_e) {}
  return direct || "";
}
function restoreBoardEdgePaint(el) {
  if (!el) return;
  if (el.hasAttribute("data-board-sel-stroke")) {
    var prevStroke = el.getAttribute("data-board-sel-stroke");
    var prevWidth = el.getAttribute("data-board-sel-width");
    var prevStyleStroke = el.getAttribute("data-board-sel-style-stroke");
    var prevStyleWidth = el.getAttribute("data-board-sel-style-width");
    if (prevStroke === "") el.removeAttribute("stroke");
    else el.setAttribute("stroke", prevStroke);
    if (prevWidth === "") el.removeAttribute("stroke-width");
    else el.setAttribute("stroke-width", prevWidth);
    if (el.style) {
      if (prevStyleStroke === "") el.style.removeProperty("stroke");
      else el.style.stroke = prevStyleStroke;
      if (prevStyleWidth === "") el.style.removeProperty("stroke-width");
      else el.style.strokeWidth = prevStyleWidth;
    }
    el.removeAttribute("data-board-sel-stroke");
    el.removeAttribute("data-board-sel-width");
    el.removeAttribute("data-board-sel-style-stroke");
    el.removeAttribute("data-board-sel-style-width");
  }
  if (el.hasAttribute("data-board-sel-fill")) {
    var prevFill = el.getAttribute("data-board-sel-fill");
    var prevStyleFill = el.getAttribute("data-board-sel-style-fill");
    if (prevFill === "") el.removeAttribute("fill");
    else el.setAttribute("fill", prevFill);
    if (el.style) {
      if (prevStyleFill === "") el.style.removeProperty("fill");
      else el.style.fill = prevStyleFill;
    }
    el.removeAttribute("data-board-sel-fill");
    el.removeAttribute("data-board-sel-style-fill");
  }
  if (el.dataset.boardMarker) {
    el.setAttribute("marker-end", el.dataset.boardMarker);
    delete el.dataset.boardMarker;
  }
}
function restoreBoardEdgeMarker(el) {
  restoreBoardEdgePaint(el);
}
function applyBoardEdgeSelection(root) {
  document.querySelectorAll(".board-edge-selected").forEach(function(el) {
    el.classList.remove("board-edge-selected");
    restoreBoardEdgePaint(el);
  });
  if (!selectedBoardEdge && boardSourceEl.dataset.boardEdgeSelectionKey) {
    var index = Number(String(boardSourceEl.dataset.boardEdgeSelectionKey).split(":")[1]);
    if (Number.isInteger(index)) selectedBoardEdge = { kind: "link", key: "link:" + index, index: index };
  }
  if (!selectedBoardEdge || !root) return;
  Array.from(root.querySelectorAll("[data-board-edge-key]")).forEach(function(el) {
    if (el.dataset.boardEdgeKey !== selectedBoardEdge.key) return;
    if (el.classList.contains("board-slot")) return;
    el.classList.add("board-edge-selected");
    if (el.classList.contains("board-edge-visible")) {
      // Keep theme marker; context-stroke follows darkened path stroke (no black arrow swap).
      if (!el.hasAttribute("data-board-sel-stroke")) {
        el.setAttribute("data-board-sel-stroke", el.getAttribute("stroke") || "");
        el.setAttribute("data-board-sel-width", el.getAttribute("stroke-width") || "");
        el.setAttribute("data-board-sel-style-stroke", (el.style && el.style.stroke) || "");
        el.setAttribute("data-board-sel-style-width", (el.style && el.style.strokeWidth) || "");
      }
      var base = readBoardEdgePaint(el, "stroke") || "#2563eb";
      var accent = darkenCssColor(base, 0.4);
      el.setAttribute("stroke", accent);
      el.setAttribute("stroke-width", "2.6");
      if (el.style) {
        el.style.stroke = accent;
        el.style.strokeWidth = "2.6px";
      }
    }
    if (el.classList.contains("board-edge-label")) {
      if (!el.hasAttribute("data-board-sel-fill")) {
        el.setAttribute("data-board-sel-fill", el.getAttribute("fill") || "");
        el.setAttribute("data-board-sel-style-fill", (el.style && el.style.fill) || "");
      }
      var labelBase = readBoardEdgePaint(el, "fill") || readBoardEdgePaint(el, "stroke") || "#2563eb";
      var labelAccent = darkenCssColor(labelBase, 0.4);
      el.setAttribute("fill", labelAccent);
      if (el.style) el.style.fill = labelAccent;
    }
    if (el.parentNode) el.parentNode.appendChild(el);
  });
}
function selectBoardEdge(root, index) {
  var nextKey = "link:" + index;
  var alreadySelected = !!(selectedBoardEdge && selectedBoardEdge.key === nextKey);
  if (!alreadySelected && !boardLinkMode) closePropsPanel();
  selectedBoardNode = null; selectedBoardEdge = { kind: "link", key: nextKey, index: index };
  delete boardSourceEl.dataset.boardSelectionKey; boardSourceEl.dataset.boardEdgeSelectionKey = selectedBoardEdge.key;
  var title = "control";
  var type = "solid";
  var arrow = "forward";
  try {
    var board = BoardRender.parse(boardSourceEl.value);
    var link = (board.links || [])[index];
    if (link && (link.title || link.label)) title = link.title || link.label;
    if (link && link.type) type = link.type;
    if (link && link.arrow === "both") arrow = "both";
  } catch (_) {}
  showPropsForLinkEdge(title, type, arrow);
  applyBoardEdgeSelection(root); syncBoardEditControls();
}
function syncBoardEditControls() {
  var hasSelection = (!!selectedBoardNode && selectedBoardNode.kind !== "title") || !!selectedBoardEdge;
  // Item can add into a selected box OR as a top-level item (BoardRender.addItem) — keep enabled.
  if (boardAddItemButton) boardAddItemButton.disabled = false;
  if (boardDeleteButton) boardDeleteButton.disabled = !hasSelection;
}
function currentBoardSelectionKey() {
  if (selectedBoardEdge) return selectedBoardEdge.key;
  if (selectedBoardNode) return selectedBoardNode.key;
  return boardSourceEl.dataset.boardSelectionKey || boardSourceEl.dataset.boardEdgeSelectionKey || "";
}
function selectionKeyFromEl(el) {
  if (!el) return "";
  if (el.classList.contains("board-edge") || el.classList.contains("board-edge-hit") || el.classList.contains("board-edge-visible") || el.classList.contains("board-edge-label") || el.classList.contains("board-slot")) {
    return el.dataset.boardEdgeKey || (el.dataset.boardEdgeIndex != null ? "link:" + el.dataset.boardEdgeIndex : "");
  }
  if (el.classList.contains("board-title-node") || el.classList.contains("board-html-header") || el.dataset.boardKind === "title" || (el.dataset.boardKey || "") === "title:board") {
    return "title:board";
  }
  if (el.classList.contains("board-item") || el.dataset.boardKind === "item" || String(el.dataset.boardKey || "").indexOf("item:") === 0) {
    var item = boardItemSelectionFromEl(el);
    return (item && item.key) || "";
  }
  return el.dataset.boardKey || (el.dataset.boardId ? "box:" + el.dataset.boardId : "");
}
function beginInspectGesture(key) {
  boardInspectGesture = { key: key || "", already: !!(key && key === currentBoardSelectionKey()), moved: false };
}
function markInspectGestureMoved() {
  if (boardInspectGesture) boardInspectGesture.moved = true;
}
function consumeInspectClick(key) {
  var gesture = boardInspectGesture;
  boardInspectGesture = null;
  return !!(gesture && !gesture.moved && gesture.already && gesture.key && gesture.key === key);
}
function inspectBoardSelection() {
  if (boardLinkMode) return;
  openPropsPanel();
}
function clearBoardSelection() {
  boardInspectGesture = null;
  selectedBoardNode = null;
  selectedBoardEdge = null;
  delete boardSourceEl.dataset.boardSelectionKey;
  delete boardSourceEl.dataset.boardEdgeSelectionKey;
  document.querySelectorAll(".board-selection").forEach(function(el) { el.classList.remove("board-selection"); });
  document.querySelectorAll(".board-edge-selected").forEach(function(el) {
    el.classList.remove("board-edge-selected");
    restoreBoardEdgeMarker(el);
  });
  if (!boardLinkMode) {
    hidePropsLinkOnlyChrome();
    if (boardInspector) boardInspector.hidden = true;
    closePropsPanel();
  }
  syncBoardEditControls();
}
function boardItemSelectionFromKey(key) {
  var parts = String(key || "").split(":");
  if (parts[0] !== "item") return null;
  if (parts.length >= 3) return { kind: "item", key: key, boxId: parts[1], index: Number(parts[2]) };
  return { kind: "item", key: key, id: parts.slice(1).join(":"), boxId: null, index: -1 };
}
function boardItemSelectionFromEl(el) {
  var boxId = el && el.dataset ? el.dataset.boardBoxId : "";
  var rootItem = !boxId || (el && el.classList && el.classList.contains("board-root-item"));
  return {
    kind: "item",
    key: el.dataset.boardKey,
    id: el.dataset.boardId || null,
    boxId: rootItem ? null : boxId,
    index: Number(el.dataset.boardItemIndex)
  };
}
function applyBoardSelection(root, board, restoreFromDataset) { applyBoardEdgeSelection(root); if (selectedBoardEdge) { if (boardInspector) boardInspector.hidden = true; syncBoardEditControls(); return; } document.querySelectorAll(".board-selection").forEach(function(el) { el.classList.remove("board-selection"); }); if (restoreFromDataset && !selectedBoardNode && boardSourceEl.dataset.boardSelectionKey) { var parts = boardSourceEl.dataset.boardSelectionKey.split(":"); selectedBoardNode = parts[0] === "title" ? { kind: "title", key: "title:board" } : parts[0] === "box" ? { kind: "box", key: boardSourceEl.dataset.boardSelectionKey, id: parts.slice(1).join(":") } : boardItemSelectionFromKey(boardSourceEl.dataset.boardSelectionKey); } if (!selectedBoardNode || !root) { if (boardInspector) boardInspector.hidden = true; syncBoardEditControls(); return; } var match = Array.from(root.querySelectorAll("[data-board-key]")).find(function(el) { return el.dataset.boardKey === selectedBoardNode.key; });
  if (!match && selectedBoardNode.kind === "title") {
    match = (typeof boardPinnedTitleNode === "function" && boardPinnedTitleNode())
      || document.querySelector("#boardTitlePin [data-board-key=\"title:board\"]")
      || document.querySelector("#boardTitlePin .board-title-node, #boardTitlePin .board-html-header");
  }
  if (!match) { clearBoardSelection(); return; }
  match.classList.add("board-selection");
  if (boardTitleEditor && selectedBoardNode) {
    var isTitle = selectedBoardNode.kind === "title";
    var isItem = selectedBoardNode.kind === "item";
    var node = isTitle ? { title: (board && board.title) || "", type: "board" } : boardNodeForSelection(board, selectedBoardNode);
    if (!node && !isTitle) { clearBoardSelection(); return; }
    boardInspector.hidden = false;
    hidePropsLinkOnlyChrome();
    if (propsEmpty) propsEmpty.hidden = true;
    if (propsFields) propsFields.hidden = false;
    if (propsKindLabel) propsKindLabel.textContent = isTitle ? "board" : (isItem ? "item" : "box");
    var itemType = isItem ? String((node && node.type) || "chip") : "";
    var isNote = itemType === "note";
    var isChipItem = itemType === "chip";
    var isTextItem = itemType === "text";
    var isMd = isNote || isChipItem || isTextItem;
    var isIcon = itemType === "icon";
    var isBoxIcon = !isTitle && !isItem;
    if (boardTitleLabel) boardTitleLabel.textContent = (isTitle || isItem) ? "Text" : "Title";
    boardTitleEditor.value = isItem ? (node.text || "") : (node.title || "");
    boardTitleEditor.rows = isMd ? 6 : 1;
    boardTitleEditor.classList.toggle("is-multiline", !!isMd);
    if (boardTypeEditor) {
      var opts = isTitle ? ["board"] : (isItem ? ["chip", "text", "note", "icon"] : ["card", "container", "layout"]);
      var cur = isTitle ? "board" : (isItem ? (node.type || "chip") : (node.type || node.kind || "card"));
      boardTypeEditor.innerHTML = opts.map(function(v){ return "<option value=\"" + v + "\">" + v + "</option>"; }).join("");
      boardTypeEditor.value = opts.indexOf(cur) >= 0 ? cur : opts[0];
      boardTypeEditor.disabled = !!isTitle;
      boardTypeEditor.hidden = false;
      if (boardTypeLabel) { boardTypeLabel.hidden = false; boardTypeLabel.textContent = "Type"; }
    }
    var protoId = "";
    if (!isTitle) protoId = (node && node.id) || (match && match.dataset && match.dataset.boardId) || selectedBoardNode.id || "";
    if (isTitle) setBoardIdField(false);
    else setBoardIdField(true, protoId);
    var boxType = (!isTitle && !isItem) ? String((node && (node.type || node.kind)) || "card").toLowerCase() : "";
    var isLayoutBox = boxType === "layout";
    if (isLayoutBox) {
      boardTitleEditor.value = "";
      boardTitleEditor.disabled = true;
      if (boardTitleLabel) boardTitleLabel.hidden = true;
      boardTitleEditor.hidden = true;
    } else {
      boardTitleEditor.disabled = false;
      boardTitleEditor.hidden = false;
      if (boardTitleLabel) boardTitleLabel.hidden = false;
    }
    setBoardShapeField(!!isChipItem, node && node.shape);
    setBoardCapField(!!isMd, node && node.cap);
    setBoardIconField((isIcon || isBoxIcon) && !isLayoutBox, ((isIcon || isBoxIcon) && !isLayoutBox) ? (node && node.icon) : null);
    if (boardDirEditor) {
      var showDir = !isItem;
      boardDirEditor.hidden = !showDir;
      if (boardDirLabel) boardDirLabel.hidden = !showDir;
      if (showDir) {
        var layout = (board && board.layout) || {};
        var authored = isTitle
          ? (layout.board && layout.board.direction)
          : (((layout.boxes || {})[selectedBoardNode.id] || {}).direction);
        var curDir = (authored === "row" || authored === "column")
          ? authored
          : (isTitle ? "row" : "column");
        boardDirEditor.value = curDir;
        setBoardDirTip(true, authored === "row" || authored === "column");
      } else {
        setBoardDirTip(false);
      }
    }
    if (!isTitle && !isItem) {
      var boxProps = (((board && board.layout && board.layout.boxes) || {})[selectedBoardNode.id] || {});
      setBoardAlignJustifyFields(true, boxProps.align, boxProps.justify);
    } else {
      setBoardAlignJustifyFields(false);
    }
    var orderInfo = null;
    if (!isTitle && typeof BoardRender !== "undefined" && typeof BoardRender.reorderInfo === "function") {
      try { orderInfo = BoardRender.reorderInfo(boardSourceEl.value, selectedBoardNode); } catch (_) { orderInfo = null; }
    }
    setBoardOrderField(!!orderInfo, orderInfo);
    if (propsHint) propsHint.textContent = isTitle
      ? "Board document · edit text; Direction = top-level box flow (default row)"
      : (isItem
        ? (isIcon
          ? "Icon · pick a category, then an icon number; Text is optional"
          : (isMd
          ? "Markdown · headings / lists / bold / italic / code; Enter = new line, ⌘/Ctrl+Enter saves"
          : (selectedBoardNode.boxId ? "Leaf inside a box · arrows select siblings · drag to reorder" : "Top-level item · Shape on chip; drag to place")))
        : (isLayoutBox
          ? "Layout · Direction / Align / Justify for children; no title/icon; +Box nests a child"
          : (boxType === "container"
            ? "Container · Direction / Align / Justify for children; Icon on title row; +Box nests a child"
            : "Box · Direction / Align / Justify for children; +Box nests a child")));
  } syncBoardEditControls(); }
function selectBoardElement(el, root, board) {
  if (!el) return clearBoardSelection();
  var isTitle = el.classList.contains("board-title-node") || el.classList.contains("board-html-header") || el.dataset.boardKind === "title" || (el.dataset.boardKey || "") === "title:board";
  var isItem = !isTitle && (el.classList.contains("board-item") || el.dataset.boardKind === "item" || (el.dataset.boardKey || "").indexOf("item:") === 0);
  var next = isTitle ? { kind: "title", key: "title:board" } : (isItem ? boardItemSelectionFromEl(el) : { kind: "box", key: el.dataset.boardKey, id: el.dataset.boardId });
  if (next.key !== currentBoardSelectionKey() && !boardLinkMode) closePropsPanel();
  selectedBoardEdge = null;
  selectedBoardNode = next;
  delete boardSourceEl.dataset.boardEdgeSelectionKey;
  boardSourceEl.dataset.boardSelectionKey = selectedBoardNode.key;
  applyBoardSelection(root, board);
}
function pickBoardElement(el, root, board) {
  beginInspectGesture(selectionKeyFromEl(el));
  selectBoardElement(el, root, board);
}
// Top-level drag moves pins. Nested drag reorders kids in the parent box.
function boardBoxIsTopLevel(board, id) {
  if (!id) return false;
  if (typeof BoardView !== "undefined" && BoardView.topLevel) {
    return BoardView.topLevel(board).some(function(node) { return node.id === id; });
  }
  return ((board.views || board.boxes || [])).some(function(node) { return node.id === id; });
}
function boardCanvasPoint(canvas, event) { var rect = canvas.getBoundingClientRect(), sx = canvas.clientWidth ? canvas.clientWidth / rect.width : 1, sy = canvas.clientHeight ? canvas.clientHeight / rect.height : 1; return { x: (event.clientX - rect.left) * sx, y: (event.clientY - rect.top) * sy }; }

function boardTitlePinEl() {
  return document.getElementById("boardTitlePin");
}
function clearDrawerBoot() {
  document.documentElement.removeAttribute('data-drawer-boot');
}
function pinBoardTitle() {
  var pin = boardTitlePinEl();
  if (pin) { pin.hidden = true; pin.innerHTML = ""; }
  if (document.documentElement.dataset.drawerMode !== "board") {
    if (document.title !== "Lulu Drawer") document.title = "Lulu Drawer";
    return;
  }
  var title = "";
  try {
    title = String((BoardRender.parse(boardSourceEl.value) || {}).title || "").trim();
  } catch (_) {}
  if (!title) {
    var heading = previewEl && previewEl.querySelector(".board-title-node h2, .board-html-header h2");
    title = heading ? String(heading.textContent || "").trim() : "";
  }
  var next = title || "Lulu Drawer";
  if (document.title !== next) document.title = next;
}
function boardPinnedTitleNode() {
  var pin = boardTitlePinEl();
  return (pin && pin.querySelector(".board-title-node, .board-html-header"))
    || (previewEl && previewEl.querySelector(".board-title-node, .board-html-header"))
    || null;
}
function boardTitleBottomLimit(canvas) {
  // Boxes must stay below the (pinned) board title with a stable margin.
  var margin = 20;
  if (!canvas) return margin;
  var title = typeof boardPinnedTitleNode === "function" ? boardPinnedTitleNode() : null;
  if (!title) {
    var root = canvas.closest(".board-render") || canvas.parentElement;
    title = root && root.querySelector(".board-title-node, .board-html-header");
  }
  if (!title) return margin;
  var cr = canvas.getBoundingClientRect();
  var tr = title.getBoundingClientRect();
  var sy = canvas.clientHeight && cr.height ? canvas.clientHeight / cr.height : 1;
  // Map the fixed title's bottom into canvas local coordinates (accounts for pan/zoom).
  var bottomInCanvas = (tr.bottom - cr.top) * sy;
  if (!Number.isFinite(bottomInCanvas)) return margin;
  return Math.max(margin, Math.ceil(bottomInCanvas + margin));
}
function clampBoardDragPosition(canvas, x, y) {
  // Unbounded like blank-canvas pan / grid — no title or origin floor.
  // (boardTitleBottomLimit kept for optional callers; drag must not fight the stage.)
  return { x: x, y: y };
}

function boardParentContent(el) {
  if (!el) return null;
  if (el.parentElement && el.parentElement.classList.contains("box-content")) return el.parentElement;
  return el.closest ? el.closest(".box-content") : null;
}
function boardReorderKids(content) {
  return Array.from((content && content.children) || []).filter(function(el) {
    return el.classList && (el.classList.contains("board-zone") || el.classList.contains("board-item"));
  });
}
function boardPointInRect(el, event) {
  if (!el) return false;
  var r = el.getBoundingClientRect();
  return event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
}
function boardContentScale(el) {
  var r = el.getBoundingClientRect();
  return {
    x: r.width ? el.offsetWidth / r.width : 1,
    y: r.height ? el.offsetHeight / r.height : 1
  };
}
function boardReorderInsertBefore(content, event) {
  var kids = boardReorderKids(content);
  var row = content.classList.contains("board-dir-row");
  var p = row ? event.clientX : event.clientY;
  for (var i = 0; i < kids.length; i += 1) {
    var r = kids[i].getBoundingClientRect();
    var mid = row ? (r.left + r.right) / 2 : (r.top + r.bottom) / 2;
    if (p < mid) return i;
  }
  return kids.length;
}
function clearBoardReorderCaret(content) {
  if (!content) return;
  var caret = content.querySelector(":scope > .board-reorder-caret");
  if (caret) caret.remove();
}
function boardReorderGapRect(prevEl, nextEl, row, prev, next) {
  var node = prevEl && prevEl.nextElementSibling;
  while (node && node !== nextEl) {
    if (node.classList && node.classList.contains("board-slot")) return node.getBoundingClientRect();
    node = node.nextElementSibling;
  }
  if (row) {
    return {
      left: prev.right,
      right: next.left,
      top: Math.min(prev.top, next.top),
      bottom: Math.max(prev.bottom, next.bottom),
      width: next.left - prev.right,
      height: Math.max(prev.bottom, next.bottom) - Math.min(prev.top, next.top)
    };
  }
  return {
    left: Math.min(prev.left, next.left),
    right: Math.max(prev.right, next.right),
    top: prev.bottom,
    bottom: next.top,
    width: Math.max(prev.right, next.right) - Math.min(prev.left, next.left),
    height: next.top - prev.bottom
  };
}
function placeBoardReorderCaret(content, insertBefore) {
  var kids = boardReorderKids(content);
  if (!content || !kids.length) return;
  var caret = content.querySelector(":scope > .board-reorder-caret");
  if (!caret) {
    caret = document.createElement("span");
    caret.className = "board-reorder-caret";
    caret.setAttribute("aria-hidden", "true");
    content.appendChild(caret);
  }
  var row = content.classList.contains("board-dir-row");
  var origin = content.getBoundingClientRect();
  var scale = boardContentScale(content);
  var cs = getComputedStyle(content);
  var innerLeft = origin.left + (content.clientLeft + (parseFloat(cs.paddingLeft) || 0)) / scale.x;
  var innerTop = origin.top + (content.clientTop + (parseFloat(cs.paddingTop) || 0)) / scale.y;
  var innerRight = origin.right - ((parseFloat(cs.borderRightWidth) || 0) + (parseFloat(cs.paddingRight) || 0)) / scale.x;
  var innerBottom = origin.bottom - ((parseFloat(cs.borderBottomWidth) || 0) + (parseFloat(cs.paddingBottom) || 0)) / scale.y;
  var seam;
  var crossStart;
  var crossSize;
  if (insertBefore > 0 && insertBefore < kids.length) {
    var prevEl = kids[insertBefore - 1];
    var nextEl = kids[insertBefore];
    var prev = prevEl.getBoundingClientRect();
    var next = nextEl.getBoundingClientRect();
    var gap = boardReorderGapRect(prevEl, nextEl, row, prev, next);
    seam = row ? (gap.left + gap.right) / 2 : (gap.top + gap.bottom) / 2;
    crossStart = row ? gap.top : gap.left;
    crossSize = row ? gap.height : gap.width;
  } else if (insertBefore <= 0) {
    var first = kids[0].getBoundingClientRect();
    seam = row ? (innerLeft + first.left) / 2 : (innerTop + first.top) / 2;
    crossStart = row ? first.top : first.left;
    crossSize = row ? first.height : first.width;
  } else {
    var last = kids[kids.length - 1].getBoundingClientRect();
    seam = row ? (last.right + innerRight) / 2 : (last.bottom + innerBottom) / 2;
    crossStart = row ? last.top : last.left;
    crossSize = row ? last.height : last.width;
  }
  var bar = row ? Math.max(2, 2 * scale.x) : Math.max(2, 2 * scale.y);
  if (row) {
    caret.style.left = ((seam - origin.left) * scale.x - bar / 2) + "px";
    caret.style.top = ((crossStart - origin.top) * scale.y) + "px";
    caret.style.width = bar + "px";
    caret.style.height = Math.max(crossSize * scale.y, 16) + "px";
  } else {
    caret.style.left = ((crossStart - origin.left) * scale.x) + "px";
    caret.style.top = ((seam - origin.top) * scale.y - bar / 2) + "px";
    caret.style.width = Math.max(crossSize * scale.x, 16) + "px";
    caret.style.height = bar + "px";
  }
}
function startBoardReorderDrag(dragEl, event) {
  var content = boardParentContent(dragEl);
  if (!content) return null;
  return {
    hit: dragEl,
    content: content,
    parentZone: content.closest(".board-zone"),
    pointerId: event.pointerId,
    moved: false,
    mode: "reorder",
    insertBefore: null,
    startClientX: event.clientX,
    startClientY: event.clientY
  };
}
function wireBoardDrag(root, board) {
  var canvas = root && root.querySelector(".board-canvas"); if (!canvas || canvas.dataset.boardDragWired === "1") return; canvas.dataset.boardDragWired = "1"; var drag = null;
  canvas.addEventListener("pointerdown", function(event) {
    if (event.button !== 0) return;
    if (boardLinkMode) {
      boardLinkPickFromEvent(event, root, board);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    var edgeHit = event.target.closest ? event.target.closest(".board-edge-hit, .board-edge-label, .board-slot.is-link") : null;
    if (edgeHit && canvas.contains(edgeHit)) {
      var edgeIndex = Number(edgeHit.dataset.boardEdgeIndex);
      if (Number.isInteger(edgeIndex)) {
        var edgeKey = edgeHit.dataset.boardEdgeKey || ("link:" + edgeIndex);
        beginInspectGesture(edgeKey);
        selectBoardEdge(root, edgeIndex);
        if (boardInspectGesture && boardInspectGesture.already) inspectBoardSelection();
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    var itemHit = event.target.closest ? event.target.closest(".board-item") : null;
    var zoneHit = event.target.closest ? event.target.closest(".board-zone") : null;
    if (itemHit && !canvas.contains(itemHit)) itemHit = null;
    if (zoneHit && !canvas.contains(zoneHit)) zoneHit = null;
    var titleHit = event.target.closest ? event.target.closest(".board-title-node") : null;
    if (titleHit && canvas.contains(titleHit)) {
      pickBoardElement(titleHit, root, board);
      event.stopPropagation();
      return;
    }
    var nestedItem = itemHit && !itemHit.classList.contains("board-root-item");
    var nestedBox = zoneHit && !boardBoxIsTopLevel(board, zoneHit.dataset.boardId);
    if (nestedItem || (nestedBox && !itemHit)) {
      var reorderEl = nestedItem ? itemHit : zoneHit;
      pickBoardElement(reorderEl, root, board);
      drag = startBoardReorderDrag(reorderEl, event);
      if (!drag) { event.stopPropagation(); return; }
      reorderEl.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    var hit = (itemHit && itemHit.classList.contains("board-root-item")) ? itemHit : zoneHit;
    if (!hit) return;
    var zone = hit.classList.contains("board-zone") ? hit : hit.closest(".board-zone");
    var rootItem = hit.classList.contains("board-root-item");
    if (!rootItem && (!zone || !boardBoxIsTopLevel(board, zone.dataset.boardId))) {
      pickBoardElement(hit, root, board);
      event.stopPropagation();
      return;
    }
    pickBoardElement(hit, root, board);
    var dragEl = rootItem ? hit : zone;
    var point = boardCanvasPoint(canvas, event), x = Number.parseFloat(dragEl.style.left), y = Number.parseFloat(dragEl.style.top);
    drag = { hit: dragEl, pointerId: event.pointerId, start: point, x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0, moved: false, mode: "position", dropTarget: null, startClientX: event.clientX, startClientY: event.clientY };
    dragEl.setPointerCapture(event.pointerId); event.preventDefault(); event.stopPropagation();
  });
  canvas.addEventListener("pointermove", function(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (drag.mode === "reorder") {
      drag.moved = drag.moved || Math.abs(event.clientX - drag.startClientX) > 3 || Math.abs(event.clientY - drag.startClientY) > 3;
      if (drag.moved) markInspectGestureMoved();
      if (!drag.moved) { event.preventDefault(); return; }
      drag.hit.classList.add("board-reorder-dragging");
      if (drag.parentZone && boardPointInRect(drag.parentZone, event)) {
        drag.insertBefore = boardReorderInsertBefore(drag.content, event);
        placeBoardReorderCaret(drag.content, drag.insertBefore);
      } else {
        drag.insertBefore = null;
        clearBoardReorderCaret(drag.content);
      }
      event.preventDefault();
      return;
    }
    var point = boardCanvasPoint(canvas, event), rawX = Math.round(drag.x + point.x - drag.start.x), rawY = Math.round(drag.y + point.y - drag.start.y);
    var clamped = clampBoardDragPosition(canvas, rawX, rawY), x = clamped.x, y = clamped.y;
    drag.moved = drag.moved || Math.abs(x - drag.x) > 1 || Math.abs(y - drag.y) > 1;
    if (drag.moved) markInspectGestureMoved();
    drag.hit.style.left = x + "px"; drag.hit.style.top = y + "px"; event.preventDefault();
  });
  var finish = function(event, cancelled) {
    if (!drag || event.pointerId !== drag.pointerId) return; var done = drag; drag = null; try { done.hit.releasePointerCapture(event.pointerId); } catch (_) {}
    done.hit.classList.remove("board-reorder-dragging");
    if (done.content) clearBoardReorderCaret(done.content);
    if (cancelled || !done.moved) {
      if (!cancelled && boardInspectGesture && boardInspectGesture.already && !boardInspectGesture.moved) inspectBoardSelection();
      boardInspectGesture = null;
    }
    if (done.mode === "reorder") {
      if (cancelled || !done.moved || done.insertBefore == null) return;
      var fromIndex = boardReorderKids(done.content).indexOf(done.hit);
      var toIndex = BoardRender.reorderFinalIndex(fromIndex, done.insertBefore);
      if (fromIndex < 0 || toIndex === fromIndex) return;
      var reorderKeep = Object.assign({}, selectedBoardNode);
      try { var reordered = BoardRender.reorderNode(boardSourceEl.value, reorderKeep, toIndex); applyBoardEditResult(reordered); setStatus("Reordered · saved"); } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
      event.preventDefault(); event.stopPropagation(); return;
    }
    if (cancelled || !done.moved) return;
    var x = Number.parseFloat(done.hit.style.left), y = Number.parseFloat(done.hit.style.top);
    var clampedEnd = clampBoardDragPosition(canvas, x, y); x = clampedEnd.x; y = clampedEnd.y;
    done.hit.style.left = x + "px"; done.hit.style.top = y + "px";
    var keep = Object.assign({}, selectedBoardNode);
    try {
      boardSourceEl.value = BoardRender.updatePosition(boardSourceEl.value, keep, x, y);
      selectedBoardNode = keep;
      boardSourceEl.dataset.boardSelectionKey = keep.key || boardSourceEl.dataset.boardSelectionKey || "";
      updateBoardChars();
      scheduleBoardSave();
      // Avoid full remount flash: keep live DOM positions, only refresh edges.
      var liveRoot = previewEl.querySelector(".board-render");
      if (liveRoot && typeof BoardRender.refreshEdges === "function") {
        BoardRender.refreshEdges(liveRoot, BoardRender.parse(boardSourceEl.value));
        applyBoardSelection(liveRoot, BoardRender.parse(boardSourceEl.value));
        done.hit.classList.add("board-selection");
      }
      setStatus("Moved · saved layout");
    } catch (err) { done.hit.style.left = done.x + "px"; done.hit.style.top = done.y + "px"; showBoardError(err instanceof Error ? err.message : String(err)); }
    event.preventDefault(); event.stopPropagation();
  };
  canvas.addEventListener("pointerup", function(event) { finish(event, false); }); canvas.addEventListener("pointercancel", function(event) { finish(event, true); });
}
function wireBoardCanvas(root, board) { var canvas = root && root.querySelector(".board-canvas"); if (!canvas || canvas.dataset.boardClickWired === "1") return; canvas.dataset.boardClickWired = "1"; canvas.addEventListener("click", function(event) { var edge = event.target.closest ? event.target.closest(".board-edge, .board-edge-label, .board-slot.is-link") : null; var hit = event.target.closest ? event.target.closest(".board-title-node, .board-item, .board-zone") : null; if (boardLinkMode) { event.preventDefault(); event.stopPropagation(); return; } /* pick happens on pointerdown */
      if (edge) { var edgeKey = edge.dataset.boardEdgeKey || (edge.dataset.boardEdgeIndex != null ? "link:" + edge.dataset.boardEdgeIndex : ""); if (consumeInspectClick(edgeKey)) inspectBoardSelection(); event.preventDefault(); event.stopPropagation(); if (event.stopImmediatePropagation) event.stopImmediatePropagation(); return; } }, true); canvas.addEventListener("click", function(event) { if (boardLinkMode) return; if (event.target.closest && event.target.closest(".board-edge, .board-edge-label, .board-slot.is-link")) return; var hit = event.target.closest(".board-title-node, .board-item, .board-zone"); if (!hit || !canvas.contains(hit)) { clearBoardSelection(); return; } var key = selectionKeyFromEl(hit); selectBoardElement(hit, root, board); if (consumeInspectClick(key)) inspectBoardSelection(); }); canvas.addEventListener("dblclick", function(event) { var hit = event.target.closest(".board-title-node, .board-item, .board-zone"); if (!hit || !canvas.contains(hit)) return; selectBoardElement(hit, root, board); inspectBoardSelection(); if (boardTitleEditor) { boardTitleEditor.focus(); boardTitleEditor.select(); } }); }

function commitBoardArrow() {
  if (!boardArrowEditor || !selectedBoardEdge || typeof BoardRender.updateLinkArrow !== "function") return;
  try {
    var nextLink = BoardRender.updateLinkArrow(boardSourceEl.value, selectedBoardEdge, boardArrowEditor.value);
    if (nextLink !== boardSourceEl.value) {
      boardSourceEl.value = nextLink;
      updateBoardChars();
      renderBoard();
      scheduleBoardSave();
      setStatus("Link arrow · " + (boardArrowEditor.value === "both" ? "<->" : "->"));
    }
  } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}
function commitBoardReverse() {
  if (!selectedBoardEdge || typeof BoardRender.reverseLink !== "function") return;
  try {
    var nextLink = BoardRender.reverseLink(boardSourceEl.value, selectedBoardEdge);
    if (nextLink !== boardSourceEl.value) {
      boardSourceEl.value = nextLink;
      updateBoardChars();
      renderBoard();
      scheduleBoardSave();
      setStatus("Link reversed");
    }
  } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}
function commitBoardShape(shape) {
  var nextShape = shape === "diamond" ? "diamond" : "rect";
  if (!selectedBoardNode || selectedBoardNode.kind !== "item") return;
  if (typeof BoardRender.updateShape !== "function") return;
  var keepSelection = Object.assign({}, selectedBoardNode);
  try {
    var next = BoardRender.updateShape(boardSourceEl.value, selectedBoardNode, nextShape);
    if (next !== boardSourceEl.value) {
      boardSourceEl.value = next;
      selectedBoardNode = keepSelection;
      updateBoardChars();
      renderBoard();
      scheduleBoardSave();
      setStatus("Shape · " + nextShape);
    }
    setBoardShapeField(true, nextShape);
  } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}
function persistBoardStyle(patch) {
  if (!boardSourceEl || !boardSourceEl.value.trim()) return;
  if (document.documentElement.dataset.drawerMode !== "board") return;
  if (typeof BoardRender === "undefined" || typeof BoardRender.updateStyle !== "function") return;
  try {
    var raw = boardSourceEl.value;
    var meta = null;
    var body = raw;
    try {
      var doc = splitDocument(raw);
      meta = doc.meta;
      body = doc.body;
    } catch (_e) {}
    var nextBody = BoardRender.updateStyle(body, patch || {});
    var next = meta ? joinDocument(meta, nextBody) : nextBody;
    if (next !== boardSourceEl.value) {
      boardSourceEl.value = next;
      updateBoardChars();
      scheduleBoardSave();
    }
  } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}
function syncBoardStyleChrome(board) {
  if (typeof BoardRender === "undefined" || typeof BoardRender.resolveStyle !== "function") return;
  var next = BoardRender.resolveStyle(board || {});
  if (typeof applyBoardItemCap === "function") applyBoardItemCap(next.item_cap, false, false);
  if (typeof applyBoardTypeStep === "function") applyBoardTypeStep(next.type_step, false, false);
  if (typeof syncBoardLinkRouteButton === "function") {
    if (typeof BoardRender.setLinkRouteStyle === "function") BoardRender.setLinkRouteStyle(next.link_route);
    syncBoardLinkRouteButton();
  }
  document.querySelectorAll("#diagramThemeMenu .theme-item").forEach(function(btn) {
    btn.classList.toggle("is-active", btn.dataset.theme === next.theme);
  });
}
function commitBoardCap() {
  if (!boardCapEditor || !selectedBoardNode || selectedBoardNode.kind !== "item") return;
  if (typeof BoardRender.updateCap !== "function") return;
  var nextCap = boardCapEditor.value === "off" ? "off" : "on";
  var keepSelection = Object.assign({}, selectedBoardNode);
  try {
    var next = BoardRender.updateCap(boardSourceEl.value, selectedBoardNode, nextCap);
    if (next !== boardSourceEl.value) {
      boardSourceEl.value = next;
      selectedBoardNode = keepSelection;
      updateBoardChars();
      renderBoard();
      scheduleBoardSave();
      setStatus("Width Cap · " + nextCap);
    }
    setBoardCapField(true, nextCap);
  } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}
function commitBoardType() {
  if (!boardTypeEditor) return;
  if (document.documentElement.dataset.drawerMode === "mermaid" && selectedMermaid) {
    commitMermaidPropsFromType();
    return;
  }
  if (selectedBoardEdge && typeof BoardRender.updateLinkType === "function") {
    try {
      var nextLink = BoardRender.updateLinkType(boardSourceEl.value, selectedBoardEdge, boardTypeEditor.value);
      if (nextLink !== boardSourceEl.value) {
        boardSourceEl.value = nextLink;
        updateBoardChars();
        renderBoard();
        scheduleBoardSave();
        setStatus("Link type · " + boardTypeEditor.value);
      }
    } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
    return;
  }
  if (!selectedBoardNode || selectedBoardNode.kind === "title" || typeof BoardRender.updateType !== "function") return;
  var keepSelection = Object.assign({}, selectedBoardNode);
  try {
    var next = BoardRender.updateType(boardSourceEl.value, selectedBoardNode, boardTypeEditor.value);
    if (next !== boardSourceEl.value) {
      boardSourceEl.value = next;
      selectedBoardNode = keepSelection;
      updateBoardChars();
      renderBoard();
      scheduleBoardSave();
      setStatus("Type · " + boardTypeEditor.value);
      // Refresh props so layout hides title/icon immediately
      try {
        var b = typeof BoardRender !== "undefined" ? BoardRender.parse(boardSourceEl.value) : null;
        var root = previewEl && previewEl.querySelector(".board-render");
        if (b && root) applyBoardSelection(root, b);
      } catch (_e) {}
    }
  } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}
function commitBoardDir() {
  if (!selectedBoardNode || selectedBoardNode.kind === "item" || !boardDirEditor || typeof BoardRender.updateDir !== "function") return;
  var keepSelection = Object.assign({}, selectedBoardNode);
  try {
    var next = BoardRender.updateDir(boardSourceEl.value, selectedBoardNode, boardDirEditor.value);
    if (next !== boardSourceEl.value) {
      boardSourceEl.value = next;
      selectedBoardNode = keepSelection;
      updateBoardChars();
      renderBoard();
      scheduleBoardSave();
      setStatus("Direction · " + boardDirEditor.value);
    }
  } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}
function commitBoardBoxFlex(kind, editor, updateFn) {
  if (!selectedBoardNode || selectedBoardNode.kind !== "box" || !editor || typeof updateFn !== "function") return;
  var keepSelection = Object.assign({}, selectedBoardNode);
  try {
    var next = updateFn(boardSourceEl.value, selectedBoardNode, editor.value);
    if (next !== boardSourceEl.value) {
      boardSourceEl.value = next;
      selectedBoardNode = keepSelection;
      updateBoardChars();
      renderBoard();
      scheduleBoardSave();
      setStatus(kind + " · " + editor.value);
    }
  } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}
function commitBoardAlign() {
  commitBoardBoxFlex("Align", boardAlignEditor, BoardRender.updateAlign);
}
function commitBoardJustify() {
  commitBoardBoxFlex("Justify", boardJustifyEditor, BoardRender.updateJustify);
}
function commitMermaidPropsFromTitle() {
  if (!selectedMermaid) return false;
  var value = boardTitleEditor ? boardTitleEditor.value : "";
  try {
    var result;
    if (selectedMermaid.kind === "topic") {
      if (typeof MindmapEdit === "undefined") return false;
      result = MindmapEdit.updateTopicLabel(sourceEl.value, selectedMermaid.id, value);
    } else if (selectedMermaid.kind === "state" || selectedMermaid.kind === "composite") {
      if (typeof StateEdit === "undefined") return false;
      result = StateEdit.updateStateLabel(sourceEl.value, selectedMermaid, value);
    } else if (selectedMermaid.kind === "transition") {
      if (typeof StateEdit === "undefined") return false;
      result = StateEdit.updateTransitionLabel(sourceEl.value, selectedMermaid, value);
    } else if (typeof FlowchartEdit === "undefined") return false;
    else if (selectedMermaid.kind === "node") result = FlowchartEdit.updateNodeLabel(sourceEl.value, selectedMermaid, value);
    else if (selectedMermaid.kind === "link") result = FlowchartEdit.updateLinkLabel(sourceEl.value, selectedMermaid, value);
    else if (selectedMermaid.kind === "subgraph") result = FlowchartEdit.updateSubgraphTitle(sourceEl.value, selectedMermaid, value);
    else return false;
    applyMermaidEditResult(result);
    setStatus("Saved " + selectedMermaid.kind + " label");
    return true;
  } catch (err) { showMermaidError(err instanceof Error ? err.message : String(err)); return true; }
}
function commitMermaidPropsFromType() {
  if (!selectedMermaid || !boardTypeEditor) return false;
  if (selectedMermaid.kind !== "topic" && typeof FlowchartEdit === "undefined") return false;
  var value = boardTypeEditor.value;
  try {
    var result;
    if (selectedMermaid.kind === "topic") {
      // Mindmap shape UI removed.
      return false;
    } else if (selectedMermaid.kind === "node") {
      // UI kind → Mermaid shape. Do not invent protocol keywords.
      if (typeof FlowchartEdit.updateNodeKind === "function") result = FlowchartEdit.updateNodeKind(sourceEl.value, selectedMermaid, value);
      else result = FlowchartEdit.updateNodeShape(sourceEl.value, selectedMermaid, value);
    } else if (selectedMermaid.kind === "link") result = FlowchartEdit.updateLinkStroke(sourceEl.value, selectedMermaid, value);
    else return false;
    applyMermaidEditResult(result);
    setStatus("Saved " + selectedMermaid.kind + " type · " + value);
    return true;
  } catch (err) { showMermaidError(err instanceof Error ? err.message : String(err)); return true; }
}
function commitMermaidPropsFromId() {
  if (!selectedMermaid || !boardIdEditor) return false;
  var next = String(boardIdEditor.value || "").trim();
  try {
    var result;
    if (selectedMermaid.kind === "state" || selectedMermaid.kind === "composite") {
      if (typeof StateEdit === "undefined") return false;
      result = StateEdit.updateStateId(sourceEl.value, selectedMermaid, next);
    } else if (typeof FlowchartEdit === "undefined") return false;
    else if (selectedMermaid.kind === "node") result = FlowchartEdit.updateNodeId(sourceEl.value, selectedMermaid, next);
    else if (selectedMermaid.kind === "subgraph") result = FlowchartEdit.updateSubgraphId(sourceEl.value, selectedMermaid, next);
    else return false;
    applyMermaidEditResult(result);
    setStatus("Saved id · " + next);
    return true;
  } catch (err) { showMermaidError(err instanceof Error ? err.message : String(err)); return true; }
}
function commitBoardTitle() {
  if (!boardTitleEditor) return;
  if (document.documentElement.dataset.drawerMode === "mermaid" && selectedMermaid) {
    commitMermaidPropsFromTitle();
    return;
  }
  if (selectedBoardEdge && typeof BoardRender.updateLinkTitle === "function") {
    try {
      var nextLink = BoardRender.updateLinkTitle(boardSourceEl.value, selectedBoardEdge, boardLinkTitleValue());
      if (nextLink !== boardSourceEl.value) {
        boardSourceEl.value = nextLink;
        updateBoardChars();
        renderBoard();
        scheduleBoardSave();
        setStatus("Link title · saved");
      }
    } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
    return;
  }
  if (!selectedBoardNode) return;
  var keepSelection = Object.assign({}, selectedBoardNode);
  try {
    var next = BoardRender.updateTitle(boardSourceEl.value, selectedBoardNode, boardTitleEditor.value);
    if (next !== boardSourceEl.value) {
      boardSourceEl.value = next;
      selectedBoardNode = keepSelection;
      updateBoardChars();
      renderBoard();
      scheduleBoardSave();
    }
  } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}
function applyBoardEditResult(result) {
  boardSourceEl.value = result.source;
  selectedBoardNode = result.selection && result.selection.kind !== "link" ? result.selection : null; selectedBoardEdge = result.selection && result.selection.kind === "link" ? result.selection : null;
  if (selectedBoardNode) boardSourceEl.dataset.boardSelectionKey = selectedBoardNode.key;
  else delete boardSourceEl.dataset.boardSelectionKey; if (selectedBoardEdge) boardSourceEl.dataset.boardEdgeSelectionKey = selectedBoardEdge.key; else delete boardSourceEl.dataset.boardEdgeSelectionKey;
  updateBoardChars();
  renderBoard();
  scheduleBoardSave();
}
function boardEditAction(action) {
  try { applyBoardEditResult(action()); }
  catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}

function syncBoardLinkRouteButton() {
  if (typeof BoardRender.getLinkRouteStyle !== "function") return;
  var style = BoardRender.getLinkRouteStyle();
  var trunkBtn = $("#btnRouteTrunk");
  var staggerBtn = $("#btnRouteStagger");
  var straightBtn = $("#btnRouteStraight");
  if (trunkBtn) trunkBtn.setAttribute("aria-pressed", style === "trunk" ? "true" : "false");
  if (staggerBtn) staggerBtn.setAttribute("aria-pressed", style === "stagger" ? "true" : "false");
  if (straightBtn) straightBtn.setAttribute("aria-pressed", style === "straight" ? "true" : "false");
}
function applyBoardLinkRouteStyle(style, persist) {
  if (typeof BoardRender === "undefined" || typeof BoardRender.setLinkRouteStyle !== "function") {
    setStatus("Link route API missing — hard refresh (cache)");
    return;
  }
  BoardRender.setLinkRouteStyle(style);
  syncBoardLinkRouteButton();
  if (persist !== false) {
    try { localStorage.setItem("drawer.boardLinkRoute", BoardRender.getLinkRouteStyle()); } catch (_) {}
    persistBoardStyle({ link_route: BoardRender.getLinkRouteStyle() });
  }
  // Re-route without resetting zoom/pan.
  try {
    var root = previewEl && previewEl.querySelector(".board-render");
    if (root && boardSourceEl && boardSourceEl.value.trim()) {
      BoardRender.refreshEdges(root, BoardRender.parse(boardSourceEl.value));
      setStatus("Link route · " + BoardRender.getLinkRouteStyle());
    }
  } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}
(function wireBoardLinkRouteSeg() {
  var trunkBtn = $("#btnRouteTrunk");
  var staggerBtn = $("#btnRouteStagger");
  var straightBtn = $("#btnRouteStraight");
  if (trunkBtn) trunkBtn.onclick = function() { applyBoardLinkRouteStyle("trunk"); };
  if (staggerBtn) staggerBtn.onclick = function() { applyBoardLinkRouteStyle("stagger"); };
  if (straightBtn) straightBtn.onclick = function() { applyBoardLinkRouteStyle("straight"); };
})();
(function initBoardLinkRoute() {
  var saved = "stagger";
  try { saved = localStorage.getItem("drawer.boardLinkRoute") || "stagger"; } catch (_) {}
  if (typeof BoardRender !== "undefined" && BoardRender.setLinkRouteStyle) {
    applyBoardLinkRouteStyle(saved, false);
  }
})();

if (boardAddBoxButton) boardAddBoxButton.onclick = function() { boardEditAction(function() { return BoardRender.addBox(boardSourceEl.value, selectedBoardNode && selectedBoardNode.kind === "box" ? selectedBoardNode : null); }); };
if (boardAddItemButton) boardAddItemButton.onclick = function() { boardEditAction(function() { return BoardRender.addItem(boardSourceEl.value, selectedBoardNode); }); };
if (boardDeleteButton) boardDeleteButton.onclick = function() { boardEditAction(function() { return selectedBoardEdge ? BoardRender.deleteLink(boardSourceEl.value, selectedBoardEdge) : BoardRender.deleteNode(boardSourceEl.value, selectedBoardNode); }); };
if (boardLinkButton) boardLinkButton.onclick = function() { setBoardLinkMode(!boardLinkMode); };
document.addEventListener("keydown", function(event) {
  if (document.documentElement.dataset.drawerMode !== "board" || (event.key !== "Delete" && event.key !== "Backspace") || (!selectedBoardNode && !selectedBoardEdge)) return;
  var target = event.target;
  if (target === boardSourceEl || target === boardTitleEditor || target === boardTypeEditor || (target && target.closest && target.closest("#boardIconField")) || (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
  event.preventDefault();
  boardEditAction(function() { return selectedBoardEdge ? BoardRender.deleteLink(boardSourceEl.value, selectedBoardEdge) : BoardRender.deleteNode(boardSourceEl.value, selectedBoardNode); });
});
function boardNudgeOrder(delta) {
  if (!selectedBoardNode || typeof BoardRender.reorderInfo !== "function") return;
  var info;
  try { info = BoardRender.reorderInfo(boardSourceEl.value, selectedBoardNode); } catch (_) { return; }
  if (!info || info.count < 2) return;
  var next = info.index + delta;
  if (next < 0 || next >= info.count) return;
  boardEditAction(function() { return BoardRender.reorderNode(boardSourceEl.value, selectedBoardNode, next); });
}
if (boardOrderPrev) boardOrderPrev.onclick = function() { boardNudgeOrder(-1); };
if (boardOrderNext) boardOrderNext.onclick = function() { boardNudgeOrder(1); };
function boardNudgeSelection(delta) {
  var root = previewEl && previewEl.querySelector(".board-render");
  if (!root || !selectedBoardNode || selectedBoardNode.kind === "title") return false;
  var el = root.querySelector("[data-board-key=\"" + selectedBoardNode.key + "\"]");
  var content = boardParentContent(el);
  if (!content) return false;
  var kids = boardReorderKids(content);
  var from = kids.indexOf(el);
  var next = from + delta;
  if (from < 0 || next < 0 || next >= kids.length) return false;
  selectBoardElement(kids[next], root, BoardRender.parse(boardSourceEl.value));
  return true;
}
var BOARD_NUDGE_STEPS = [1, 2, 4, 8, 16, 32];
var BOARD_NUDGE_HOLD = 2;
var boardNudgeSlide = { key: "", n: 0 };
function boardNudgeResetSlide() {
  boardNudgeSlide = { key: "", n: 0 };
}
function boardNudgeStepPx(key, isRepeat) {
  if (!isRepeat || boardNudgeSlide.key !== key) {
    boardNudgeSlide = { key: key, n: 0 };
    return BOARD_NUDGE_STEPS[0];
  }
  boardNudgeSlide.n += 1;
  var tier = Math.min(BOARD_NUDGE_STEPS.length - 1, Math.floor(boardNudgeSlide.n / BOARD_NUDGE_HOLD));
  return BOARD_NUDGE_STEPS[tier];
}
function boardWriteLivePosition(el, x, y) {
  var keep = Object.assign({}, selectedBoardNode);
  boardSourceEl.value = BoardRender.updatePosition(boardSourceEl.value, keep, x, y);
  selectedBoardNode = keep;
  boardSourceEl.dataset.boardSelectionKey = keep.key || boardSourceEl.dataset.boardSelectionKey || "";
  updateBoardChars();
  scheduleBoardSave();
  var liveRoot = previewEl.querySelector(".board-render");
  if (liveRoot && typeof BoardRender.refreshEdges === "function") {
    BoardRender.refreshEdges(liveRoot, BoardRender.parse(boardSourceEl.value));
    applyBoardSelection(liveRoot, BoardRender.parse(boardSourceEl.value));
    el.classList.add("board-selection");
  }
}
function boardNudgeTopLevel(dx, dy) {
  if (!selectedBoardNode || selectedBoardNode.kind === "title") return false;
  if (selectedBoardNode.kind === "item" && selectedBoardNode.boxId) return false;
  var root = previewEl && previewEl.querySelector(".board-render");
  if (!root) return false;
  var el = root.querySelector("[data-board-key=\"" + selectedBoardNode.key + "\"]");
  if (!el || boardParentContent(el)) return false;
  var canvas = previewEl.querySelector(".board-canvas");
  var x = Number.parseFloat(el.style.left);
  var y = Number.parseFloat(el.style.top);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  var next = clampBoardDragPosition(canvas, Math.round(x + dx), Math.round(y + dy));
  var prevX = x, prevY = y;
  el.style.left = next.x + "px";
  el.style.top = next.y + "px";
  try {
    boardWriteLivePosition(el, next.x, next.y);
    setStatus("Moved · saved layout");
  } catch (err) {
    el.style.left = prevX + "px";
    el.style.top = prevY + "px";
    showBoardError(err instanceof Error ? err.message : String(err));
  }
  return true;
}
document.addEventListener("keydown", function(event) {
  if (document.documentElement.dataset.drawerMode !== "board" || event.altKey || event.metaKey || event.ctrlKey) return;
  if (!selectedBoardNode || selectedBoardNode.kind === "title" || selectedBoardEdge) return;
  var delta = 0;
  if (event.key === "ArrowUp" || event.key === "ArrowLeft") delta = -1;
  else if (event.key === "ArrowDown" || event.key === "ArrowRight") delta = 1;
  if (!delta) return;
  var target = event.target;
  if (target === boardSourceEl || target === boardTitleEditor || (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
  if (target && target.closest && target.closest("#boardIconField")) return;
  if (boardNudgeSelection(delta)) {
    event.preventDefault();
    return;
  }
  var step = boardNudgeStepPx(event.key, event.repeat);
  var dx = 0, dy = 0;
  if (event.key === "ArrowLeft") dx = -step;
  else if (event.key === "ArrowRight") dx = step;
  else if (event.key === "ArrowUp") dy = -step;
  else dy = step;
  if (!boardNudgeTopLevel(dx, dy)) return;
  event.preventDefault();
});
document.addEventListener("keyup", function(event) {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown" && event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  boardNudgeResetSlide();
});
window.addEventListener("blur", boardNudgeResetSlide);
document.addEventListener("keydown", function(event) {
  if (document.documentElement.dataset.drawerMode !== "board" || !event.altKey || event.metaKey || event.ctrlKey) return;
  if (!selectedBoardNode || selectedBoardNode.kind === "title") return;
  var target = event.target;
  if (target === boardSourceEl || target === boardTitleEditor || (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
  if (typeof BoardRender.reorderInfo !== "function") return;
  var info;
  try { info = BoardRender.reorderInfo(boardSourceEl.value, selectedBoardNode); } catch (_) { return; }
  if (!info || info.count < 2) return;
  var row = info.direction === "row";
  var delta = 0;
  if (row) {
    if (event.key === "ArrowLeft") delta = -1;
    else if (event.key === "ArrowRight") delta = 1;
  } else if (event.key === "ArrowUp") delta = -1;
  else if (event.key === "ArrowDown") delta = 1;
  if (!delta) return;
  event.preventDefault();
  boardNudgeOrder(delta);
});

function boardClickIsOnNode(event) {
  return !!(event.target.closest && event.target.closest(".board-title-node, .board-item, .board-zone, .board-edge, .board-edge-label, .board-slot.is-link, .board-inspector, .board-dock, .top-float, .menu, .sheet, button, input, select, textarea, label"));
}
// Blank click anywhere in the preview/canvas clears selection (grid, padding, svg empty).
// Board-only — Mermaid has its own clear on miss / stage blank (must not steal mermaid clicks).
previewEl.addEventListener("pointerdown", function(event) {
  if (document.documentElement.dataset.drawerMode !== "board") return;
  if (event.button !== 0) return;
  if (boardClickIsOnNode(event)) return;
  if (boardLinkMode) { setBoardLinkMode(false); return; }
  clearBoardSelection();
}, true);
previewEl.addEventListener("click", function(event) {
  if (document.documentElement.dataset.drawerMode !== "board") return;
  if (boardLinkMode) return;
  if (event.target.closest && event.target.closest(".board-edge, .board-edge-label, .board-slot.is-link")) return;
  var canvas = event.target.closest(".board-canvas");
  var root = event.target.closest(".board-render");
  var hit = event.target.closest(".board-title-node, .board-item, .board-zone");
  if (hit && canvas && canvas.contains(hit)) return;
  if (!boardClickIsOnNode(event)) clearBoardSelection();
});
previewEl.addEventListener("dblclick", function(event) {
  var canvas = event.target.closest(".board-canvas"); if (!canvas) return;
  var root = canvas.closest(".board-render");
  var hit = event.target.closest(".board-title-node, .board-item, .board-zone");
  if (!hit || !canvas.contains(hit)) return;
  selectBoardElement(hit, root, BoardRender.parse(boardSourceEl.value));
  inspectBoardSelection();
  if (boardTitleEditor) { boardTitleEditor.focus(); boardTitleEditor.select(); }
});
function renderBoard(opts) {
  opts = opts || {};
  syncBoardEditControls();
  previewEl.classList.add('board-preview');
  const text = boardSourceEl.value.trim(); updateBoardChars();
  if (!text) { previewEl.innerHTML = ''; if (typeof pinBoardTitle === "function") pinBoardTitle(); showBoardError(''); setStatus('No Board source'); clearDrawerBoot(); return; }
  BoardRender.render(text, previewEl).then((rendered) => {
    try {
      syncBoardLinkRouteButton(); wireBoardCanvas(rendered.root, rendered.board); wireBoardDrag(rendered.root, rendered.board); applyBoardSelection(rendered.root, rendered.board, true); var retained = Array.from(rendered.root.querySelectorAll("[data-board-key]")).find(function(el) { return el.dataset.boardKey === boardSourceEl.dataset.boardSelectionKey; }); if (retained) retained.classList.add("board-selection");
      // Repaint the live root after any mode/bootstrap render race.
      if (rendered && rendered.root && rendered.root.isConnected && rendered.frames) rendered.frames.forEach((frame, id) => { const el = rendered.root.querySelector("[data-board-id=\"" + id + "\"]"); if (!el || el.dataset.boardNested === "1") return; el.style.left = frame.x + "px"; el.style.top = frame.y + "px"; el.style.width = frame.w + "px"; var grow = el.dataset.boardType === "note" || el.dataset.boardType === "layout" || el.dataset.boardType === "container"; if (grow) { el.style.minHeight = frame.h + "px"; el.style.height = "auto"; } else { el.style.minHeight = ""; el.style.height = frame.h + "px"; } });
      showBoardError(''); setStatus(`Board rendered · ${new Date().toLocaleTimeString()}`);
      syncBoardStyleChrome(rendered.board);
      applyBoardThemeToPreview();
      if (opts.fit) {
        fitBoardView({ persist: true });
      } else if (opts.restoreView) {
        applyRestoredBoardView();
      } else {
        applyTransform();
      }
    } finally {
      pinBoardTitle();
      // Two frames: let pin/title + item frame rects settle while stage still opacity:0.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { clearDrawerBoot(); });
      });
    }
  }).catch((err) => {
    pinBoardTitle();
    clearDrawerBoot();
    showBoardError(err instanceof Error ? err.message : String(err)); setStatus('Invalid Board source', true);
  });
}
function scheduleBoardRender() { clearTimeout(boardRenderTimer); boardRenderTimer = setTimeout(renderBoard, 220); }
function setBoardSyncUI(state = 'ok') { const pill = $('#boardSyncPill'); if (!pill) return; const label = state === 'saving' ? 'saving' : state === 'error' ? 'error' : state === 'conflict' ? 'conflict' : 'rev'; pill.className = 'pill ' + (state === 'ok' ? 'ok' : 'warn'); pill.innerHTML = `${label} <b>${boardLocalRev}</b>`; }
function scheduleBoardSave() { boardDirty = true; clearTimeout(boardSaveTimer); setBoardSyncUI('saving'); boardSaveTimer = setTimeout(() => void saveBoardToFile(), 350); }
function flushBoardSave() {
  if (!boardDirty && !boardSaveTimer) return Promise.resolve();
  clearTimeout(boardSaveTimer);
  boardSaveTimer = null;
  return saveBoardToFile();
}
window.addEventListener("pagehide", function() { void flushBoardSave(); });
document.addEventListener("visibilitychange", function() {
  if (document.visibilityState === "hidden") void flushBoardSave();
});
async function saveBoardToFile() {
  boardSaveTimer = null;
  const text = boardSourceEl.value, seq = ++boardSaveSeq, baseRev = boardLocalRev;
  try {
    const headers = {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Board-Rev': String(baseRev),
      'X-Board-Via': 'ui',
      'X-Board-Label': 'docker-sbx-board',
    };
    if (typeof liveBoardId !== 'undefined' && liveBoardId) headers['X-Board-Id'] = liveBoardId;
    if (typeof liveBoardTitle !== 'undefined' && liveBoardTitle) headers['X-Board-Title'] = headerByteString(liveBoardTitle);
    const res = await fetch('./board.bmd', { method: 'PUT', headers, body: text });
    if (seq !== boardSaveSeq) return;
    if (res.status === 409) { const payload = await res.json(); boardLocalRev = Number(payload.version != null ? payload.version : payload.rev) || boardLocalRev; boardDirty = false; if (typeof payload.source === 'string') { boardSourceEl.value = payload.source; renderBoard(); } setBoardSyncUI('conflict'); setStatus(`Board version conflict → loaded v ${boardLocalRev}`, true); return; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    boardLocalRev = Number(res.headers.get('X-Board-Rev')) || baseRev + 1; boardDirty = false; setBoardSyncUI('ok');
    try { var saved = splitDocument(text); boardSourceEl.value = joinDocument({ id: saved.meta.id, version: boardLocalRev }, saved.body); } catch (_e) {}
    setStatus(`Board saved v ${boardLocalRev}`);
    try {
      const metaRes = await fetch(`./board.meta.json?ts=${Date.now()}`, { cache: 'no-store' });
      if (metaRes.ok && typeof applyBoardLiveMeta === 'function') applyBoardLiveMeta(await metaRes.json());
    } catch (_e) {}
  } catch (err) { setBoardSyncUI('error'); setStatus(err instanceof Error ? err.message : String(err), true); }
}
async function loadBoardPolled() {
  if (boardDirty || boardSaveTimer) return;
  try {
    const metaRes = await fetch(`./board.meta.json?ts=${Date.now()}`, { cache: 'no-store' }); if (!metaRes.ok) return;
    const meta = await metaRes.json(), remoteRev = Number(meta.version != null ? meta.version : meta.rev) || 0;
    if (typeof applyBoardLiveMeta === 'function') applyBoardLiveMeta(meta);
    if (remoteRev <= boardLocalRev) { setBoardSyncUI('ok'); return; }
    // Mermaid (or other) must not replace in-memory Board source; switch-back remounts from the textarea.
    if (document.documentElement.dataset.drawerMode !== 'board') return;
    const res = await fetch(`./board.bmd?ts=${Date.now()}`, { cache: 'no-store' }); if (!res.ok) return;
    const text = await res.text(); boardLocalRev = Number(res.headers.get('X-Board-Rev')) || remoteRev; boardDirty = false;
    if (boardSourceEl.value !== text) { boardSourceEl.value = text; renderBoard({ fit: false }); setStatus(`Board loaded r${boardLocalRev}`); }
    setBoardSyncUI('ok');
  } catch (_) {}
}
async function bootstrapBoard() {
  try { const res = await fetch('./board.bmd', { cache: 'no-store' }); if (res.ok) { boardSourceEl.value = await res.text(); boardLocalRev = Number(res.headers.get('X-Board-Rev')) || 0; } else boardSourceEl.value = ''; }
  catch (_) { boardSourceEl.value = ''; }
  try {
    const metaRes = await fetch(`./board.meta.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (metaRes.ok && typeof applyBoardLiveMeta === 'function') applyBoardLiveMeta(await metaRes.json());
  } catch (_e) {}
  boardDirty = false; updateBoardChars(); setBoardSyncUI('ok');
  // If we boot into Board mode, paint once here with saved view so setMode(restore) can skip a second render (item flash).
  if (document.documentElement.dataset.drawerMode === "board" && boardSourceEl.value.trim()) {
    await new Promise(function (resolve) {
      var done = false;
      var finish = function () { if (done) return; done = true; resolve(); };
      try {
        renderBoard({ fit: false, restoreView: true });
        // renderBoard is async via promise; wait for board-render or timeout
        var turns = 0;
        (function wait() {
          if (previewEl && previewEl.querySelector(".board-render")) return finish();
          if (++turns > 120) return finish();
          requestAnimationFrame(wait);
        })();
      } catch (_e) { finish(); }
    });
  }
}


/* ---- Mermaid flowchart edit (source SSOT → mermaid.render) ---- */
const mermaidAddNodeButton = $("#btnMermaidAddNode");
const mermaidAddSubgraphButton = $("#btnMermaidAddSubgraph");
const mermaidLinkButton = $("#btnMermaidLink");
const mermaidDeleteButton = $("#btnMermaidDelete");
let mermaidLinkMode = false;
let mermaidLinkStart = null;
let selectedMermaid = null;
/* mermaidInspectGesture / mermaidPropsShownKey → 03-mermaid-inspect.js */


/* === 03-mermaid-inspect.js === */
/* drawer-app/03-mermaid-inspect.js — Mermaid-common select / open-Props gesture.
 * Shared by flowchart, mindmap, and future diagram kinds (e.g. state). Board stays separate.
 *
 * Rules:
 * 1) pointerdown captures `already` BEFORE select.
 * 2) First click → select only (do not open Props on that click's trailing events).
 * 3) Re-click same selected target → open Props.
 * 4) Props open + already showing that key → noop; open but other target → refresh fill.
 * 5) Pan (moved) cancels Props open.
 */
var mermaidInspectGesture = null;
var mermaidPropsShownKey = "";

var MermaidInspect = (function () {
  function getSelectionKey() {
    return selectedMermaid && selectedMermaid.key ? selectedMermaid.key : "";
  }

  function begin(key) {
    var k = key || "";
    mermaidInspectGesture = {
      key: k,
      already: !!(k && k === getSelectionKey()),
      moved: false,
    };
    return mermaidInspectGesture;
  }

  function markMoved() {
    if (mermaidInspectGesture) mermaidInspectGesture.moved = true;
  }

  function clearGesture() {
    mermaidInspectGesture = null;
  }

  /** Consume gesture: true iff re-press on same key without pan. */
  function consumeClick(key) {
    var gesture = mermaidInspectGesture;
    mermaidInspectGesture = null;
    return !!(gesture && !gesture.moved && gesture.already && gesture.key && gesture.key === key);
  }

  function clearPropsShown() {
    mermaidPropsShownKey = "";
  }

  /**
   * Open or refresh Props for key.
   * @param {string} key
   * @param {{ fill?: function, blocked?: boolean }} opts fill() loads fields; blocked skips (e.g. link mode)
   */
  function wantProps(key, opts) {
    opts = opts || {};
    if (!key || opts.blocked) return false;
    if (typeof currentDockTab === "function" && currentDockTab() === "props" && mermaidPropsShownKey === key) {
      return false;
    }
    if (typeof opts.fill === "function") opts.fill();
    if (typeof openPropsPanel === "function") openPropsPanel();
    mermaidPropsShownKey = key;
    return true;
  }

  /** Open Props for current selection (inspect). */
  function inspect(opts) {
    opts = opts || {};
    if (opts.blocked) return false;
    if (typeof opts.fill === "function") opts.fill();
    if (typeof openPropsPanel === "function") openPropsPanel();
    mermaidPropsShownKey = getSelectionKey() || "";
    return true;
  }

  return {
    begin: begin,
    markMoved: markMoved,
    clearGesture: clearGesture,
    consumeClick: consumeClick,
    wantProps: wantProps,
    inspect: inspect,
    clearPropsShown: clearPropsShown,
    getSelectionKey: getSelectionKey,
  };
})();

/* === 03-mermaid.js === */
/* drawer-app/03-mermaid.js — lines 1720-2296 of former inline module */
function currentMermaidSelectionKey() {
  return MermaidInspect.getSelectionKey();
}
function beginMermaidInspectGesture(key) {
  return MermaidInspect.begin(key);
}
function consumeMermaidInspectClick(key) {
  return MermaidInspect.consumeClick(key);
}
function inspectMermaidSelection() {
  if (mermaidLinkMode) return;
  MermaidInspect.inspect({
    blocked: false,
    fill: function() {
      if (selectedMermaid && selectedMermaid.kind === "topic") fillMindmapProps();
      else if (typeof isStateMode === "function" && isStateMode() && typeof fillStateProps === "function") fillStateProps();
      else fillMermaidProps();
    },
  });
}

function showMermaidError(message) {
  if (errorBox) {
    errorBox.textContent = message;
    errorBox.classList.add("show");
  }
  setStatus(message, true);
}

function syncMermaidDeleteButton() {
  if (!mermaidDeleteButton) return;
  var on = document.documentElement.dataset.drawerMode === "mermaid" && document.documentElement.dataset.mermaidFlowchart === "1" && !!selectedMermaid;
  mermaidDeleteButton.disabled = !on;
}


function installMermaidEdgeHits(root) {
  if (!root) return;
  root.querySelectorAll("path.mermaid-edge-hit").forEach(function(el) { el.remove(); });
  function addHit(path) {
    if (!path) return;
    var hit = path.cloneNode(false);
    hit.removeAttribute("id");
    hit.removeAttribute("marker-end");
    hit.removeAttribute("marker-start");
    hit.removeAttribute("style");
    hit.setAttribute("class", "mermaid-edge-hit");
    if (path.id) hit.setAttribute("data-edge-dom-id", path.id);
    hit.setAttribute("fill", "none");
    hit.setAttribute("stroke", "transparent");
    hit.setAttribute("stroke-width", "14");
    hit.setAttribute("pointer-events", "stroke");
    if (path.parentNode) path.parentNode.insertBefore(hit, path);
  }
  root.querySelectorAll("path.flowchart-link").forEach(function(path) {
    if (!path.id) return;
    addHit(path);
  });
  // State diagram transitions (incl. short [*] edges) — index-aligned with path.transition.
  root.querySelectorAll("path.transition").forEach(function(path) {
    addHit(path);
  });
}

/* Color helpers live in 02-board.js (loaded first); keep defs only if absent. */
if (typeof parseCssColor !== "function") {
function parseCssColor(raw) {
  var s = String(raw || "").trim();
  if (!s || s === "none" || s === "transparent") return null;
  var m = s.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 1 };
  m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) {
    var h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  return null;
}
}
if (typeof formatCssColor !== "function") {
function formatCssColor(c) {
  if (!c) return "";
  if (c.a != null && c.a < 1) return "rgba(" + Math.round(c.r) + ", " + Math.round(c.g) + ", " + Math.round(c.b) + ", " + c.a + ")";
  return "rgb(" + Math.round(c.r) + ", " + Math.round(c.g) + ", " + Math.round(c.b) + ")";
}
}
if (typeof darkenCssColor !== "function") {
/** Darken toward black (Board-like emphasis); hue stays from live theme stroke. */
function darkenCssColor(raw, amount) {
  var c = parseCssColor(raw);
  if (!c) return raw;
  var f = 1 - (amount == null ? 0.4 : amount);
  return formatCssColor({ r: c.r * f, g: c.g * f, b: c.b * f, a: c.a });
}
}
function readMermaidEdgeStroke(el) {
  if (!el) return "#333333";
  var direct = (el.getAttribute && el.getAttribute("stroke")) || "";
  if (direct && direct !== "none" && direct !== "currentColor") return direct;
  try {
    var cs = window.getComputedStyle(el);
    if (cs && cs.stroke && cs.stroke !== "none") return cs.stroke;
  } catch (_e) {}
  try {
    var svg = el.ownerSVGElement || (previewEl && previewEl.querySelector("svg"));
    if (svg) {
      var gcs = window.getComputedStyle(svg);
      if (gcs && gcs.color) return gcs.color;
    }
  } catch (_e2) {}
  return "#333333";
}
function clearMermaidLinkSelectStyle(root) {
  var scope = root || previewEl;
  if (!scope) return;
  // Board-like: hit strokes are never painted; force-clear any leftover glow from older builds.
  scope.querySelectorAll("path.mermaid-edge-hit").forEach(function(h) {
    h.classList.remove("mermaid-selection");
    h.classList.remove("mermaid-link-selected");
    h.setAttribute("stroke", "transparent");
    h.setAttribute("fill", "none");
    if (h.style) {
      h.style.removeProperty("stroke");
      h.style.removeProperty("stroke-width");
      h.style.removeProperty("filter");
      h.style.removeProperty("opacity");
    }
  });
  scope.querySelectorAll(".mermaid-link-selected, [data-mermaid-sel-stroke], [data-mermaid-sel-fill]").forEach(function(el) {
    el.classList.remove("mermaid-link-selected");
    if (el.hasAttribute("data-mermaid-sel-stroke")) {
      var prevStroke = el.getAttribute("data-mermaid-sel-stroke");
      var prevWidth = el.getAttribute("data-mermaid-sel-width");
      var prevStyleStroke = el.getAttribute("data-mermaid-sel-style-stroke");
      var prevStyleWidth = el.getAttribute("data-mermaid-sel-style-width");
      if (prevStroke === "") el.removeAttribute("stroke");
      else el.setAttribute("stroke", prevStroke);
      if (prevWidth === "") el.removeAttribute("stroke-width");
      else el.setAttribute("stroke-width", prevWidth);
      if (el.style) {
        if (prevStyleStroke === "") el.style.removeProperty("stroke");
        else el.style.stroke = prevStyleStroke;
        if (prevStyleWidth === "") el.style.removeProperty("stroke-width");
        else el.style.strokeWidth = prevStyleWidth;
        el.style.removeProperty("filter");
        el.style.removeProperty("opacity");
      }
      el.removeAttribute("data-mermaid-sel-stroke");
      el.removeAttribute("data-mermaid-sel-width");
      el.removeAttribute("data-mermaid-sel-style-stroke");
      el.removeAttribute("data-mermaid-sel-style-width");
    }
    if (el.hasAttribute("data-mermaid-sel-fill")) {
      var prevFill = el.getAttribute("data-mermaid-sel-fill");
      var prevStyleFill = el.getAttribute("data-mermaid-sel-style-fill");
      var prevStyleColor = el.getAttribute("data-mermaid-sel-style-color");
      if (prevFill === "") el.removeAttribute("fill");
      else el.setAttribute("fill", prevFill);
      if (el.style) {
        if (prevStyleFill === "") el.style.removeProperty("fill");
        else el.style.fill = prevStyleFill;
        if (prevStyleColor === "") el.style.removeProperty("color");
        else el.style.color = prevStyleColor;
      }
      el.removeAttribute("data-mermaid-sel-fill");
      el.removeAttribute("data-mermaid-sel-style-fill");
      el.removeAttribute("data-mermaid-sel-style-color");
    }
  });
}
function applyMermaidLinkSelectStyle(pathEl) {
  if (!pathEl) return null;
  var base = readMermaidEdgeStroke(pathEl);
  var accent = darkenCssColor(base, 0.4);
  if (!pathEl.hasAttribute("data-mermaid-sel-stroke")) {
    pathEl.setAttribute("data-mermaid-sel-stroke", pathEl.getAttribute("stroke") || "");
    pathEl.setAttribute("data-mermaid-sel-width", pathEl.getAttribute("stroke-width") || "");
    pathEl.setAttribute("data-mermaid-sel-style-stroke", (pathEl.style && pathEl.style.stroke) || "");
    pathEl.setAttribute("data-mermaid-sel-style-width", (pathEl.style && pathEl.style.strokeWidth) || "");
  }
  pathEl.classList.add("mermaid-selection");
  pathEl.classList.add("mermaid-link-selected");
  pathEl.style.stroke = accent;
  pathEl.style.strokeWidth = "2.6px";
  pathEl.style.removeProperty("filter");
  pathEl.style.removeProperty("opacity");
  pathEl.setAttribute("stroke", accent);
  pathEl.setAttribute("stroke-width", "2.6");
  return { base: base, accent: accent };
}
function applyMermaidLinkLabelSelectStyle(labelEl, accent) {
  if (!labelEl || !accent) return;
  labelEl.classList.add("mermaid-selection");
  labelEl.classList.add("mermaid-link-selected");
  if (!labelEl.hasAttribute("data-mermaid-sel-fill")) {
    labelEl.setAttribute("data-mermaid-sel-fill", labelEl.getAttribute("fill") || "");
    labelEl.setAttribute("data-mermaid-sel-style-fill", (labelEl.style && labelEl.style.fill) || "");
    labelEl.setAttribute("data-mermaid-sel-style-color", (labelEl.style && labelEl.style.color) || "");
  }
  labelEl.style.color = accent;
  labelEl.style.fill = accent;
  labelEl.querySelectorAll("span, p, text, tspan").forEach(function(n) {
    if (!n.hasAttribute("data-mermaid-sel-fill")) {
      n.setAttribute("data-mermaid-sel-fill", n.getAttribute("fill") || "");
      n.setAttribute("data-mermaid-sel-style-fill", (n.style && n.style.fill) || "");
      n.setAttribute("data-mermaid-sel-style-color", (n.style && n.style.color) || "");
      n.classList.add("mermaid-link-selected");
    }
    n.style.color = accent;
    if (n.tagName && /text|tspan/i.test(n.tagName)) n.setAttribute("fill", accent);
  });
}

function clearMermaidSelectionVisual() {
  if (!previewEl) return;
  clearMermaidLinkSelectStyle(previewEl);
  previewEl.querySelectorAll(".mermaid-selection, .mermaid-link-source, .mermaid-link-selected").forEach(function(el) {
    el.classList.remove("mermaid-selection");
    el.classList.remove("mermaid-link-source");
    el.classList.remove("mermaid-link-selected");
  });
}

function applyMermaidSelectionVisual() {
  clearMermaidSelectionVisual();
  if (!selectedMermaid || !previewEl) return;
  var sel = selectedMermaid;
  if (sel.domId) {
    var byId = previewEl.querySelector("#" + CSS.escape(sel.domId));
    if (byId) byId.classList.add("mermaid-selection");
  }
  if (sel.kind === "link") {
    var linkSel = sel;
    var prefix = (linkSel.from && linkSel.to) ? ("L_" + linkSel.from + "_" + linkSel.to + "_") : "";
    var accent = null;
    previewEl.querySelectorAll("path.flowchart-link, g.edgePath").forEach(function(el) {
      var path = el;
      if (el.tagName && el.tagName.toLowerCase() === "g") {
        path = el.querySelector("path.flowchart-link, path.path, path") || el;
      }
      var eid = path.id || el.id || "";
      var ok = !!(linkSel.domId && (eid === linkSel.domId || el.id === linkSel.domId));
      if (!ok && prefix && (eid.indexOf(prefix) === 0 || String(el.id || "").indexOf(prefix) === 0)) ok = true;
      if (!ok) return;
      var painted = applyMermaidLinkSelectStyle(path);
      if (painted) accent = painted.accent;
      // Keep hit paths transparent (Board board-edge-hit parity) — no halo/shadow.
    });
    if (typeof FlowchartEdit !== "undefined" && FlowchartEdit.getLink) {
      var info = FlowchartEdit.getLink(sourceEl && sourceEl.value, linkSel.from, linkSel.to);
      var lab = info && info.label ? String(info.label).trim() : "";
      if (lab && accent) {
        previewEl.querySelectorAll("g.edgeLabel").forEach(function(g) {
          if (String(g.textContent || "").replace(/\s+/g, " ").trim() === lab) {
            applyMermaidLinkLabelSelectStyle(g, accent);
          }
        });
      }
    }
  }

  if (sel.kind === "node" && sel.id) {
    previewEl.querySelectorAll("g.node").forEach(function(g) {
      if (g.id && g.id.indexOf("flowchart-" + sel.id + "-") === 0) g.classList.add("mermaid-selection");
    });
  }
  if (sel.kind === "subgraph" && sel.id) {
    previewEl.querySelectorAll("g.cluster").forEach(function(g) {
      var gid = g.id || "";
      if (
        gid === sel.id ||
        gid.indexOf("flowchart-" + sel.id + "-") === 0 ||
        gid === "cluster-" + sel.id ||
        gid.indexOf(sel.id) >= 0
      ) g.classList.add("mermaid-selection");
    });
    previewEl.querySelectorAll("g.cluster-label").forEach(function(g) {
      var gid = g.id || "";
      if (gid.indexOf(sel.id) >= 0) g.classList.add("mermaid-selection");
    });
    // Empty subgraph stand-in is a g.node with id === subgraph id
    previewEl.querySelectorAll("g.node").forEach(function(g) {
      var gid = g.id || "";
      if (gid === sel.id || gid.indexOf("flowchart-" + sel.id + "-") === 0) {
        g.classList.add("mermaid-selection");
      }
    });
  }
  syncMermaidDeleteButton();
}

function clearMermaidSelection() {
  MermaidInspect.clearGesture();
  selectedMermaid = null;
  try { if (sourceEl) delete sourceEl.dataset.mermaidSelectionKey; } catch (_e) {}
  clearMermaidSelectionVisual();
  if (previewEl) previewEl.querySelectorAll("g.mindmap-node.mermaid-selection").forEach(function(el) { el.classList.remove("mermaid-selection"); });
  syncMermaidDeleteButton();
  if (typeof syncMindmapEditButtons === "function") syncMindmapEditButtons();
  else if (typeof syncMindmapDeleteButton === "function") syncMindmapDeleteButton();
  if (typeof syncStateDeleteButton === "function") syncStateDeleteButton();
  if (document.documentElement.dataset.drawerMode === "mermaid" && !mermaidLinkMode) {
    if (propsEmpty) { propsEmpty.hidden = false; propsEmpty.textContent = "Select a node, link, or subgraph"; }
    if (propsFields) propsFields.hidden = true;
    if (propsKindLabel) propsKindLabel.textContent = "—";
    closePropsPanel();
  }
}

function applyMermaidEditResult(result) {
  if (!result || typeof result.source !== "string") return;
  sourceEl.value = result.source;
  selectedMermaid = result.selection || null;
  mermaidLinkStart = null;
  setTypeUI(sourceEl.value);
  void renderDiagram().then(function() {
    if (selectedMermaid && selectedMermaid.kind === "topic") {
      if (typeof applyMindmapSelectionVisual === "function") applyMindmapSelectionVisual();
      if (typeof fillMindmapProps === "function") fillMindmapProps();
      if (typeof syncMindmapEditButtons === "function") syncMindmapEditButtons();
    } else if (typeof isStateMode === "function" && isStateMode()) {
      if (typeof applyStateSelectionVisual === "function") applyStateSelectionVisual();
      if (selectedMermaid && typeof fillStateProps === "function") fillStateProps();
    } else {
      applyMermaidSelectionVisual();
      if (selectedMermaid) fillMermaidProps();
    }
  });
  scheduleSave();
}

function mermaidEditAction(action) {
  try {
    if (typeof FlowchartEdit === "undefined") failMissingFlowchartEdit();
    applyMermaidEditResult(action());
  } catch (err) {
    showMermaidError(err instanceof Error ? err.message : String(err));
  }
}

function failMissingFlowchartEdit() {
  throw new Error("FlowchartEdit missing — hard refresh (cache)");
}

function setMermaidLinkMode(active) {
  mermaidLinkMode = !!active;
  mermaidLinkStart = null;
  if (mermaidLinkButton) mermaidLinkButton.classList.toggle("is-active", mermaidLinkMode);
  document.documentElement.classList.toggle("mermaid-link-mode", mermaidLinkMode);
  clearMermaidSelectionVisual();
  if (mermaidLinkMode) setStatus("Link mode · click source node, then target");
  else setStatus("Link mode off");
}

function mermaidLinkPick(selection) {
  if (!mermaidLinkMode || !selection || selection.kind !== "node") return false;
  if (!mermaidLinkStart) {
    mermaidLinkStart = selection;
    selectedMermaid = selection;
    applyMermaidSelectionVisual();
    previewEl.querySelectorAll("g.node").forEach(function(g) {
      if (g.id && g.id.indexOf("flowchart-" + selection.id + "-") === 0) g.classList.add("mermaid-link-source");
    });
    setStatus("Source " + selection.id + " · click target");
    return true;
  }
  if (mermaidLinkStart.id === selection.id) {
    setStatus("Pick a different target node", true);
    return true;
  }
  mermaidEditAction(function() {
    return FlowchartEdit.addLink(sourceEl.value, mermaidLinkStart.id, selection.id);
  });
  setMermaidLinkMode(false);
  return true;
}

if (mermaidAddNodeButton) mermaidAddNodeButton.onclick = function() {
  if (document.documentElement.dataset.mermaidFlowchart !== "1") return;
  var opts = {};
  if (selectedMermaid && selectedMermaid.kind === "subgraph" && selectedMermaid.id) {
    opts.parent = selectedMermaid.id;
  }
  mermaidEditAction(function() {
    var result = FlowchartEdit.addNode(sourceEl.value, opts);
    // Keep subgraph selected so Node can be added repeatedly into the same group.
    if (opts.parent) {
      result.selection = { kind: "subgraph", id: opts.parent, key: "subgraph:" + opts.parent };
    }
    return result;
  });
};
if (mermaidAddSubgraphButton) mermaidAddSubgraphButton.onclick = function() {
  if (document.documentElement.dataset.mermaidFlowchart !== "1") return;
  mermaidEditAction(function() { return FlowchartEdit.addSubgraph(sourceEl.value); });
};
if (mermaidLinkButton) mermaidLinkButton.onclick = function() {
  if (document.documentElement.dataset.mermaidFlowchart !== "1") return;
  setMermaidLinkMode(!mermaidLinkMode);
};
if (mermaidDeleteButton) mermaidDeleteButton.onclick = function() {
  if (!selectedMermaid) return;
  mermaidEditAction(function() { return FlowchartEdit.deleteSelection(sourceEl.value, selectedMermaid); });
};

document.addEventListener("keydown", function(event) {
  if (document.documentElement.dataset.drawerMode !== "mermaid") return;
  if (document.documentElement.dataset.mermaidFlowchart !== "1") return;
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  if (!selectedMermaid) return;
  var target = event.target;
  if (target === sourceEl || (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
  event.preventDefault();
  mermaidEditAction(function() { return FlowchartEdit.deleteSelection(sourceEl.value, selectedMermaid); });
});

function fillMermaidProps() {
  if (!selectedMermaid || typeof FlowchartEdit === "undefined") return;
  if (propsEmpty) propsEmpty.hidden = true;
  if (propsFields) propsFields.hidden = false;
  if (boardIconField) boardIconField.hidden = true;
  if (boardDirEditor) boardDirEditor.hidden = true;
  if (boardDirLabel) boardDirLabel.hidden = true;
  if (boardDirTip) boardDirTip.hidden = true;
  if (typeof setBoardAlignJustifyFields === "function") setBoardAlignJustifyFields(false);
  if (typeof setBoardCapField === "function") setBoardCapField(false);
  if (typeof setBoardArrowField === "function") setBoardArrowField(false);
  else {
    if (boardArrowField) boardArrowField.hidden = true;
    if (boardArrowEditor) boardArrowEditor.hidden = true;
    if (boardArrowLabel) boardArrowLabel.hidden = true;
    if (boardArrowReverse) boardArrowReverse.hidden = true;
  }
  var kind = selectedMermaid.kind;
  if (propsKindLabel) propsKindLabel.textContent = kind;
  if (kind === "node") {
    var node = FlowchartEdit.getNode(sourceEl.value, selectedMermaid.id) || { id: selectedMermaid.id, label: selectedMermaid.id, shape: "rect", nodeKind: "default" };
    if (boardTitleLabel) { boardTitleLabel.hidden = false; boardTitleLabel.textContent = "Label"; }
    if (boardTitleEditor) {
      boardTitleEditor.hidden = false;
      boardTitleEditor.value = node.label || "";
      boardTitleEditor.rows = 1;
      boardTitleEditor.classList.remove("is-multiline");
    }
    if (boardTypeLabel) { boardTypeLabel.hidden = false; boardTypeLabel.textContent = "Type"; }
    if (boardTypeEditor) {
      var kinds = [
        { value: "default", label: "default" },
        { value: "start", label: "start" },
        { value: "end", label: "end" },
        { value: "judgment", label: "judgment" },
      ];
      var curKind = node.nodeKind || (typeof FlowchartEdit.kindFromShape === "function" ? FlowchartEdit.kindFromShape(node.shape, node.label) : "default");
      if (curKind === "node") curKind = "default";
      if (typeof FlowchartEdit.normalizeNodeKind === "function") curKind = FlowchartEdit.normalizeNodeKind(curKind);
      boardTypeEditor.hidden = false;
      boardTypeEditor.disabled = false;
      boardTypeEditor.innerHTML = kinds.map(function(k){ return "<option value=\"" + k.value + "\">" + k.label + "</option>"; }).join("");
      boardTypeEditor.value = kinds.some(function(k){ return k.value === curKind; }) ? curKind : "default";
    }
    if (typeof setBoardIdField === "function") setBoardIdField(true, node.id || selectedMermaid.id);
    if (propsHint) propsHint.textContent = "Type changes the shape: default box, start/end rounded, judgment diamond";
  } else if (kind === "link") {
    var link = FlowchartEdit.getLink(sourceEl.value, selectedMermaid.from, selectedMermaid.to) || { label: "", stroke: "solid" };
    if (boardTitleLabel) { boardTitleLabel.hidden = false; boardTitleLabel.textContent = "Title"; }
    if (boardTitleEditor) {
      boardTitleEditor.hidden = false;
      boardTitleEditor.value = link.label || "";
      boardTitleEditor.rows = 1;
      boardTitleEditor.classList.remove("is-multiline");
    }
    if (boardTypeLabel) { boardTypeLabel.hidden = false; boardTypeLabel.textContent = "Stroke"; }
    if (boardTypeEditor) {
      boardTypeEditor.hidden = false;
      boardTypeEditor.disabled = false;
      boardTypeEditor.innerHTML = '<option value="solid">solid</option><option value="dotted">dotted</option>';
      boardTypeEditor.value = (link.stroke === "dotted" || link.stroke === "dashed") ? "dotted" : "solid";
    }
    if (typeof setBoardIdField === "function") setBoardIdField(false);
    if (propsHint) propsHint.textContent = "Edit the link title and stroke; shown on the connector between the two nodes";
  } else if (kind === "subgraph") {
    var sg = FlowchartEdit.getSubgraph(sourceEl.value, selectedMermaid.id) || { id: selectedMermaid.id, title: selectedMermaid.id };
    if (boardTitleLabel) { boardTitleLabel.hidden = false; boardTitleLabel.textContent = "Title"; }
    if (boardTitleEditor) {
      boardTitleEditor.hidden = false;
      boardTitleEditor.value = sg.title || "";
      boardTitleEditor.rows = 1;
    }
    if (boardTypeEditor) boardTypeEditor.hidden = true;
    if (boardTypeLabel) boardTypeLabel.hidden = true;
    if (typeof setBoardIdField === "function") setBoardIdField(true, sg.id || selectedMermaid.id);
    if (propsHint) propsHint.textContent = "Group selected · Node adds inside this group; edit title or id";
  }
}

function selectMermaidHit(sel, openInspect) {
  if (!sel) { clearMermaidSelection(); return; }
  var key = sel.key;
  var already = key && key === currentMermaidSelectionKey();
  if (!already && !mermaidLinkMode) closePropsPanel();
  selectedMermaid = sel;
  try { if (sourceEl) sourceEl.dataset.mermaidSelectionKey = key || ""; } catch (_e) {}
  applyMermaidSelectionVisual();
  syncMermaidDeleteButton();
  fillMermaidProps();
  setStatus("Selected " + sel.kind + (sel.id ? (" " + sel.id) : (sel.from && sel.to ? (" " + sel.from + "→" + sel.to) : "")));
  if (openInspect) inspectMermaidSelection();
}

/** Board pickBoardElement parity: record gesture + select, never open Props here. */
function pickMermaidHit(sel) {
  if (!sel) { clearMermaidSelection(); return; }
  beginMermaidInspectGesture(sel.key);
  selectMermaidHit(sel, false);
}

/**
 * Mermaid Props UX (Board re-press):
 * 1) First click → select only.
 * 2) Re-click same selected target → open Props.
 * 3) Props open and already showing that target → noop.
 * 4) Props open but showing another target → refresh fill, keep open.
 *
 * Critical: do NOT open on the trailing `click` of a first-select.
 * Board uses gesture.already captured on pointerdown BEFORE select;
 * the same physical click's `click` event must not treat "now selected" as re-press.
 */
function mermaidWantPropsForKey(key) {
  MermaidInspect.wantProps(key, {
    blocked: !!mermaidLinkMode,
    fill: function() { fillMermaidProps(); },
  });
}

function mermaidHitSelect(event) {
  if (document.documentElement.dataset.drawerMode !== "mermaid") return false;
  if (document.documentElement.dataset.mermaidMindmap === "1") return false;
  if (document.documentElement.dataset.mermaidFlowchart !== "1") return false;
  if (typeof FlowchartEdit === "undefined" || typeof FlowchartEdit.selectionFromDom !== "function") return false;
  if (event.target.closest && event.target.closest(".top-float, .menu, .sheet, .board-dock, .zoom-float, button, input, textarea, select")) return false;
  var sel = FlowchartEdit.selectionFromDom(event.target, sourceEl && sourceEl.value);
  if (mermaidLinkMode) {
    event.preventDefault();
    event.stopPropagation();
    if (sel && sel.kind === "node") mermaidLinkPick(sel);
    else if (!sel) setMermaidLinkMode(false);
    return true;
  }
  if (event.type !== "pointerdown" && event.type !== "click" && event.type !== "dblclick") {
    return !!sel;
  }
  if (!sel) {
    if (event.type === "pointerdown") {
      MermaidInspect.clearGesture();
      clearMermaidSelection();
    }
    return false;
  }
  var key = sel.key || "";
  if (event.type === "pointerdown") {
    // Capture already BEFORE select (Board beginInspectGesture).
    pickMermaidHit(sel);
    if (mermaidInspectGesture && mermaidInspectGesture.already) {
      mermaidWantPropsForKey(key);
      MermaidInspect.clearGesture();
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  if (event.type === "click") {
    // Only re-press if pointerdown marked already (never first-select's click).
    if (consumeMermaidInspectClick(key)) mermaidWantPropsForKey(key);
    event.stopPropagation();
    return true;
  }
  if (event.type === "dblclick") {
    pickMermaidHit(sel);
    mermaidWantPropsForKey(key);
    MermaidInspect.clearGesture();
    if (boardTitleEditor && !boardTitleEditor.hidden) { boardTitleEditor.focus(); boardTitleEditor.select(); }
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  return true;
}
previewEl.addEventListener("pointerdown", function(event) {
  if (event.button !== 0) return;
  mermaidHitSelect(event);
}, true);
previewEl.addEventListener("click", function(event) {
  if (document.documentElement.dataset.drawerMode !== "mermaid") return;
  if (mermaidLinkMode) return;
  mermaidHitSelect(event);
}, true);
previewEl.addEventListener("dblclick", function(event) {
  if (document.documentElement.dataset.drawerMode !== "mermaid") return;
  mermaidHitSelect(event);
}, true);


/* ── Mindmap edit: hover + to add child; Delete; select / Props ─ */
const mindmapDeleteButton = $("#btnMindmapDelete");


/* === 04-mindmap.js === */
/* drawer-app/04-mindmap.js — lines 2297-2625 of former inline module */
function isMindmapMode() {
  return document.documentElement.dataset.drawerMode === "mermaid"
    && document.documentElement.dataset.mermaidMindmap === "1";
}

function syncMindmapDeleteButton() {
  if (!mindmapDeleteButton) return;
  var on = isMindmapMode() && selectedMermaid && selectedMermaid.kind === "topic";
  var isRoot = false;
  try {
    if (on && typeof MindmapEdit !== "undefined" && MindmapEdit.getTopic) {
      var info = MindmapEdit.getTopic(sourceEl.value, selectedMermaid.id);
      isRoot = !!(info && info.isRoot);
    }
  } catch (_e) {}
  mindmapDeleteButton.disabled = !on || isRoot;
}

function applyMindmapSelectionVisual() {
  if (!previewEl) return;
  previewEl.querySelectorAll("g.mindmap-node.mermaid-selection").forEach(function(el) {
    el.classList.remove("mermaid-selection");
  });
  if (!selectedMermaid || selectedMermaid.kind !== "topic") return;
  var g = previewEl.querySelector('g.mindmap-node[data-id="' + selectedMermaid.id + '"]');
  if (g) g.classList.add("mermaid-selection");
}

function selectMindmapTopic(sel, openInspect) {
  if (!sel) { clearMermaidSelection(); return; }
  var key = sel.key || ("topic:" + sel.id);
  var already = key && key === currentMermaidSelectionKey();
  if (!already && !mermaidLinkMode) closePropsPanel();
  selectedMermaid = {
    kind: "topic",
    id: sel.id,
    key: key,
    label: sel.label || "",
    shape: sel.shape || "default",
  };
  try { if (sourceEl) sourceEl.dataset.mermaidSelectionKey = key; } catch (_e) {}
  applyMindmapSelectionVisual();
  fillMindmapProps();
  syncMindmapEditButtons();
  setStatus("Selected topic " + (selectedMermaid.label || selectedMermaid.id));
  if (openInspect) inspectMermaidSelection();
}


function mindmapSelectionMeta() {
  if (!selectedMermaid || selectedMermaid.kind !== "topic") return null;
  var info = null;
  try {
    if (typeof MindmapEdit !== "undefined" && MindmapEdit.getTopic) {
      info = MindmapEdit.getTopic(sourceEl.value, selectedMermaid.id);
    }
  } catch (_e) {}
  var isRoot = !!(info && info.isRoot) || (selectedMermaid.depth === 0);
  return { info: info, isRoot: isRoot };
}

function syncMindmapEditButtons() {
  syncMindmapDeleteButton();
}

function fillMindmapProps() {
  if (!selectedMermaid || selectedMermaid.kind !== "topic") return;
  hidePropsLinkOnlyChrome();
  if (propsEmpty) propsEmpty.hidden = true;
  if (propsFields) propsFields.hidden = false;
  if (typeof setBoardIconField === "function") setBoardIconField(false);
  else if (boardIconField) boardIconField.hidden = true;
  if (typeof setBoardIdField === "function") setBoardIdField(false);
  if (boardDirLabel) boardDirLabel.hidden = true;
  if (boardDirEditor) boardDirEditor.hidden = true;
  if (boardDirTip) boardDirTip.hidden = true;
  if (typeof setBoardAlignJustifyFields === "function") setBoardAlignJustifyFields(false);
  if (typeof setBoardCapField === "function") setBoardCapField(false);
  if (typeof setBoardArrowField === "function") setBoardArrowField(false);

  var meta = mindmapSelectionMeta() || { info: null, isRoot: false };
  var info = meta.info;
  var isRoot = !!meta.isRoot;
  if (propsKindLabel) propsKindLabel.textContent = isRoot ? "Root" : "Node";

  var label = (info && info.label) || selectedMermaid.label || "";
  if (boardTitleLabel) { boardTitleLabel.hidden = false; boardTitleLabel.textContent = "Text"; }
  if (boardTitleEditor) {
    boardTitleEditor.hidden = false;
    boardTitleEditor.value = label;
    boardTitleEditor.rows = 1;
    boardTitleEditor.classList.remove("is-multiline");
  }

  // Shape removed — all mindmap nodes share one pill; Topic stays larger via layout measure.
  if (boardTypeLabel) {
    boardTypeLabel.hidden = true;
    boardTypeLabel.textContent = "Shape";
  }
  if (boardTypeEditor) {
    boardTypeEditor.hidden = true;
    boardTypeEditor.innerHTML = "";
  }

  if (propsHint) {
    propsHint.textContent = isRoot
      ? "Root · hover any node and click + to add a child"
      : "Node · hover and click + to add a child";
  }
  syncMindmapEditButtons();
}

function mindmapEditAction(mutator) {
  if (typeof MindmapEdit === "undefined") throw new Error("MindmapEdit missing — hard refresh");
  var out = mutator();
  if (!out || typeof out.source !== "string") return;
  sourceEl.value = out.source;
  selectedMermaid = out.selection || null;
  setTypeUI(sourceEl.value);
  void renderDiagram({ fit: false }).then(function() {
    if (selectedMermaid && selectedMermaid.kind === "topic") {
      applyMindmapSelectionVisual();
      fillMindmapProps();
    }
    syncMindmapEditButtons();
    applyMindmapAddSuppress();
  });
  scheduleSave();
}

function mindmapWantPropsForKey(key) {
  MermaidInspect.wantProps(key, {
    blocked: !isMindmapMode(),
    fill: function() { fillMindmapProps(); },
  });
}


var mindmapPointerPress = null;
var MINDMAP_PAN_SLOP = 5;

var mindmapAddSuppressId = null;

function applyMindmapAddSuppress() {
  if (!previewEl) return;
  previewEl.querySelectorAll(".mindmap-add-zone.is-suppressed").forEach(function(el) {
    el.classList.remove("is-suppressed");
  });
  if (mindmapAddSuppressId == null || !isMindmapMode()) return;
  var node = previewEl.querySelector('g.mindmap-node[data-id="' + mindmapAddSuppressId + '"]');
  var zone = node && node.querySelector(".mindmap-add-zone");
  if (zone) zone.classList.add("is-suppressed");
}

function clearMindmapAddSuppress() {
  mindmapAddSuppressId = null;
  if (!previewEl) return;
  previewEl.querySelectorAll(".mindmap-add-zone.is-suppressed").forEach(function(el) {
    el.classList.remove("is-suppressed");
  });
}

function mindmapAddChildUnder(parentId) {
  if (typeof MindmapEdit === "undefined" || !MindmapEdit.addChild) throw new Error("MindmapEdit.addChild missing — hard refresh");
  // Pointer is still in the right-side zone after click — suppress + until leave.
  mindmapAddSuppressId = Number(parentId);
  mindmapEditAction(function() { return MindmapEdit.addChild(sourceEl.value, parentId, "Node"); });
}

function mindmapHitSelect(event) {
  if (!isMindmapMode()) return false;
  if (typeof MindmapEdit === "undefined" || typeof MindmapEdit.selectionFromDom !== "function") return false;
  if (event.target.closest && event.target.closest(".top-float, .menu, .sheet, .board-dock, .zoom-float, button, input, textarea, select")) return false;
  // Hover + control: add child under that node (Mermaid has no Branch/Leaf).
  var addEl = event.target.closest ? event.target.closest(".mindmap-add") : null;
  if (addEl && (event.type === "pointerdown" || event.type === "click")) {
    var pid = addEl.getAttribute("data-add-parent");
    if (pid != null && pid !== "") {
      event.preventDefault();
      event.stopPropagation();
      if (event.type === "pointerdown") mindmapAddChildUnder(Number(pid));
      return true;
    }
  }
  var sel = MindmapEdit.selectionFromDom(event.target);
  if (event.type !== "pointerdown" && event.type !== "click" && event.type !== "dblclick") return !!sel;
  if (!sel) {
    // Blank inside SVG: let stage pan handle (keeps selection while dragging).
    return false;
  }
  var key = sel.key || ("topic:" + sel.id);
  if (event.type === "pointerdown") {
    beginMermaidInspectGesture(key);
    var already = !!(mermaidInspectGesture && mermaidInspectGesture.already);
    selectMindmapTopic(sel, false);
    mindmapPointerPress = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      key: key,
      already: already,
      panning: false,
    };
    event.preventDefault();
    event.stopPropagation();
    try { previewEl.setPointerCapture(event.pointerId); } catch (_e) {}
    return true;
  }
  if (event.type === "click") {
    // Props / re-press handled on pointerup if the press did not become a pan.
    event.stopPropagation();
    return true;
  }
  if (event.type === "dblclick") {
    selectMindmapTopic(sel, false);
    mindmapWantPropsForKey(key);
    MermaidInspect.clearGesture();
    mindmapPointerPress = null;
    if (boardTitleEditor && !boardTitleEditor.hidden) { boardTitleEditor.focus(); boardTitleEditor.select(); }
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  return true;
}

function mindmapPointerDrag(event) {
  if (!mindmapPointerPress || event.pointerId !== mindmapPointerPress.pointerId) return;
  var dx = event.clientX - mindmapPointerPress.x;
  var dy = event.clientY - mindmapPointerPress.y;
  if (!mindmapPointerPress.panning) {
    if (dx * dx + dy * dy < MINDMAP_PAN_SLOP * MINDMAP_PAN_SLOP) return;
    mindmapPointerPress.panning = true;
    MermaidInspect.clearGesture();
    panning = true;
    panMoved = true;
    panBlankMindmap = false;
    stageEl.classList.add("panning");
    panOrigin = { x: mindmapPointerPress.x - panX, y: mindmapPointerPress.y - panY, startX: mindmapPointerPress.x, startY: mindmapPointerPress.y };
  }
  if (mindmapPointerPress.panning && panOrigin) {
    panX = event.clientX - panOrigin.x;
    panY = event.clientY - panOrigin.y;
    applyTransform();
  }
}

function mindmapPointerEnd(event) {
  if (!mindmapPointerPress || event.pointerId !== mindmapPointerPress.pointerId) return;
  var press = mindmapPointerPress;
  mindmapPointerPress = null;
  try { previewEl.releasePointerCapture(event.pointerId); } catch (_e) {}
  if (press.panning) {
    panning = false;
    panOrigin = null;
    stageEl.classList.remove("panning");
    flushDrawerUiSave();
    if (typeof noteUserCanvasView === "function") noteUserCanvasView();
    return;
  }
  // Click without drag: re-press opens Props.
  if (press.already) {
    mindmapWantPropsForKey(press.key);
    MermaidInspect.clearGesture();
  }
}

previewEl.addEventListener("pointerout", function(event) {
  if (!isMindmapMode()) return;
  var zone = event.target && event.target.closest ? event.target.closest(".mindmap-add-zone") : null;
  if (!zone || !zone.classList.contains("is-suppressed")) return;
  var next = event.relatedTarget;
  if (next && zone.contains(next)) return;
  // Left the suppressed right-side zone — allow + again on next enter.
  zone.classList.remove("is-suppressed");
  var node = zone.closest("g.mindmap-node");
  var id = node && node.getAttribute("data-id");
  if (id != null && Number(id) === mindmapAddSuppressId) mindmapAddSuppressId = null;
}, true);
previewEl.addEventListener("pointerdown", function(event) {
  if (event.button !== 0) return;
  if (!isMindmapMode()) return;
  mindmapHitSelect(event);
}, true);
previewEl.addEventListener("pointermove", function(event) {
  if (!isMindmapMode()) return;
  mindmapPointerDrag(event);
}, true);
previewEl.addEventListener("pointerup", function(event) {
  if (!isMindmapMode()) return;
  mindmapPointerEnd(event);
}, true);
previewEl.addEventListener("pointercancel", function(event) {
  if (!isMindmapMode()) return;
  mindmapPointerEnd(event);
}, true);
previewEl.addEventListener("click", function(event) {
  if (!isMindmapMode()) return;
  mindmapHitSelect(event);
}, true);
previewEl.addEventListener("dblclick", function(event) {
  if (!isMindmapMode()) return;
  mindmapHitSelect(event);
}, true);

if (mindmapDeleteButton) mindmapDeleteButton.onclick = function() {
  if (!isMindmapMode() || !selectedMermaid || selectedMermaid.kind !== "topic") return;
  mindmapEditAction(function() { return MindmapEdit.deleteTopic(sourceEl.value, selectedMermaid.id); });
};
document.addEventListener("keydown", function(event) {
  if (!isMindmapMode()) return;
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  if (!selectedMermaid || selectedMermaid.kind !== "topic") return;
  var tag = (event.target && event.target.tagName) || "";
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
  event.preventDefault();
  try { mindmapEditAction(function() { return MindmapEdit.deleteTopic(sourceEl.value, selectedMermaid.id); }); }
  catch (err) { setStatus(err instanceof Error ? err.message : String(err), true); }
});


/* === 04-state.js === */
/* drawer-app/04-state.js — state diagram select / Props (S4+). */

function isStateMode() {
  return document.documentElement.dataset.drawerMode === "mermaid"
    && document.documentElement.dataset.mermaidState === "1";
}

function applyStateSelectionVisual() {
  clearMermaidSelectionVisual();
  if (!selectedMermaid || !previewEl || !isStateMode()) return;
  var sel = selectedMermaid;
  if (sel.domId) {
    try {
      var byId = previewEl.querySelector("#" + CSS.escape(sel.domId));
      if (byId) byId.classList.add("mermaid-selection");
    } catch (_e) {}
  }
  if (sel.kind === "state" && sel.id) {
    previewEl.querySelectorAll("g.node.statediagram-state, g.node").forEach(function(g) {
      var gid = g.id || "";
      if (gid.indexOf("state-" + sel.id + "-") === 0) g.classList.add("mermaid-selection");
    });
  }
  if (sel.kind === "composite" && sel.id) {
    previewEl.querySelectorAll("g.statediagram-cluster").forEach(function(g) {
      if (g.id === sel.id) {
        g.classList.add("mermaid-selection");
        var lab = g.querySelector(":scope > g.cluster-label");
        if (lab) lab.classList.add("mermaid-selection");
      }
    });
    // classic
    previewEl.querySelectorAll("g.stateGroup").forEach(function(g) {
      if (g.id === sel.id) g.classList.add("mermaid-selection");
    });
  }
  if (sel.kind === "pseudostate") {
    if (sel.domId) {
      try {
        var ps = previewEl.querySelector("#" + CSS.escape(sel.domId));
        if (ps) ps.classList.add("mermaid-selection");
      } catch (_e2) {}
    }
  }
  if (sel.kind === "transition") {
    var accent = null;
    var list = (typeof StateEdit !== "undefined" && StateEdit.listTransitions)
      ? StateEdit.listTransitions(sourceEl && sourceEl.value)
      : [];
    var idx = -1;
    // Prefer exact line / key so duplicate [*]-->X edges don't share selection chrome.
    if (sel.line != null && sel.line >= 0) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].line === sel.line) { idx = i; break; }
      }
    }
    if (idx < 0 && sel.key) {
      for (var k = 0; k < list.length; k++) {
        if (list[k].key === sel.key) { idx = k; break; }
      }
    }
    if (idx < 0) {
      for (var j = 0; j < list.length; j++) {
        if (list[j].from === sel.from && list[j].to === sel.to) { idx = j; break; }
      }
    }
    var paths = previewEl.querySelectorAll("path.transition");
    if (idx >= 0 && paths[idx]) {
      var painted = typeof applyMermaidLinkSelectStyle === "function"
        ? applyMermaidLinkSelectStyle(paths[idx])
        : null;
      if (painted) accent = painted.accent;
      paths[idx].classList.add("mermaid-selection");
      var hits = previewEl.querySelectorAll("path.mermaid-edge-hit");
      if (hits[idx]) hits[idx].classList.add("mermaid-selection");
    } else if (sel.domId) {
      try {
        var p = previewEl.querySelector("#" + CSS.escape(sel.domId));
        if (p) {
          if (typeof applyMermaidLinkSelectStyle === "function") {
            var painted2 = applyMermaidLinkSelectStyle(p);
            if (painted2) accent = painted2.accent;
          }
          p.classList.add("mermaid-selection");
        }
      } catch (_e3) {}
    }
    // Style only the matching edgeLabel at the same index (not every duplicate "create").
    if (idx >= 0 && accent && typeof applyMermaidLinkLabelSelectStyle === "function") {
      var labels = previewEl.querySelectorAll("g.edgeLabel");
      if (labels[idx]) applyMermaidLinkLabelSelectStyle(labels[idx], accent);
    }
  }
}

/** Minimal Props for S4 (S6 expands fields). */
function fillStateProps() {
  if (!isStateMode() || !selectedMermaid) return;
  var sel = selectedMermaid;
  var info = null;
  try {
    if ((sel.kind === "state" || sel.kind === "composite" || sel.kind === "pseudostate") && typeof StateEdit !== "undefined" && StateEdit.getState) {
      info = StateEdit.getState(sourceEl.value, sel.id);
    } else if (sel.kind === "transition" && typeof StateEdit !== "undefined" && StateEdit.getTransition) {
      info = StateEdit.getTransition(sourceEl.value, sel.from, sel.to);
    }
  } catch (_e) { info = null; }

  if (propsEmpty) propsEmpty.hidden = true;
  if (propsFields) propsFields.hidden = false;
  if (propsKindLabel) propsKindLabel.textContent = sel.kind || "state";
  // State transitions have no stroke/direction UI (flowchart-only).
  if (boardDirEditor) boardDirEditor.hidden = true;
  if (boardDirLabel) boardDirLabel.hidden = true;
  if (boardDirTip) boardDirTip.hidden = true;
  if (typeof setBoardAlignJustifyFields === "function") setBoardAlignJustifyFields(false);
  if (typeof setBoardCapField === "function") setBoardCapField(false);
  if (typeof setBoardArrowField === "function") setBoardArrowField(false);

  if (sel.kind === "transition") {
    if (boardTitleLabel) { boardTitleLabel.hidden = false; boardTitleLabel.textContent = "Label"; }
    if (boardTitleEditor) {
      boardTitleEditor.hidden = false;
      boardTitleEditor.readOnly = false;
      boardTitleEditor.value = (info && info.label != null) ? info.label : (sel.label || "");
      boardTitleEditor.rows = 1;
    }
    if (boardTypeEditor) boardTypeEditor.hidden = true;
    if (boardTypeLabel) boardTypeLabel.hidden = true;
    if (typeof setBoardIdField === "function") setBoardIdField(false);
    if (propsHint) propsHint.textContent = (sel.from || "") + " → " + (sel.to || "") + " · edit label";
  } else if (sel.kind === "pseudostate") {
    if (boardTitleLabel) { boardTitleLabel.hidden = false; boardTitleLabel.textContent = "Label"; }
    if (boardTitleEditor) {
      boardTitleEditor.hidden = false;
      boardTitleEditor.readOnly = true;
      boardTitleEditor.value = "[*]";
      boardTitleEditor.rows = 1;
    }
    if (boardTypeEditor) boardTypeEditor.hidden = true;
    if (boardTypeLabel) boardTypeLabel.hidden = true;
    if (typeof setBoardIdField === "function") setBoardIdField(true, "[*]");
    if (boardIdEditor) boardIdEditor.readOnly = true;
    if (propsHint) propsHint.textContent = (sel.parent ? ("Inside " + sel.parent + " · ") : "") + "Start/end · read-only";
  } else {
    // state | composite
    if (boardTitleLabel) {
      boardTitleLabel.hidden = false;
      boardTitleLabel.textContent = sel.kind === "composite" ? "Title" : "Label";
    }
    if (boardTitleEditor) {
      boardTitleEditor.hidden = false;
      boardTitleEditor.readOnly = false;
      boardTitleEditor.value = (info && info.label != null) ? info.label : (sel.label || sel.id || "");
      boardTitleEditor.rows = 1;
    }
    if (boardTypeEditor) boardTypeEditor.hidden = true;
    if (boardTypeLabel) boardTypeLabel.hidden = true;
    if (typeof setBoardIdField === "function") setBoardIdField(true, (info && info.id) || sel.id || "");
    if (boardIdEditor) boardIdEditor.readOnly = false;
    if (propsHint) {
      propsHint.textContent = sel.kind === "composite"
        ? "Composite · edit title or id; Node/State adds can nest later"
        : "State · edit label or id";
    }
  }
  syncStateDeleteButton();
}

function selectStateHit(sel, openInspect) {
  if (!sel) { clearMermaidSelection(); return; }
  var key = sel.key;
  var already = key && key === currentMermaidSelectionKey();
  if (!already) closePropsPanel();
  selectedMermaid = sel;
  try { if (sourceEl) sourceEl.dataset.mermaidSelectionKey = key || ""; } catch (_e) {}
  applyStateSelectionVisual();
  fillStateProps();
  var statusBits = sel.kind;
  if (sel.id) statusBits += " " + sel.id;
  else if (sel.from && sel.to) statusBits += " " + sel.from + "→" + sel.to;
  setStatus("Selected " + statusBits);
  if (openInspect) {
    MermaidInspect.inspect({
      fill: function() { fillStateProps(); },
    });
  }
}

function stateWantPropsForKey(key) {
  MermaidInspect.wantProps(key, {
    blocked: !isStateMode(),
    fill: function() { fillStateProps(); },
  });
}

function stateHitSelect(event) {
  if (!isStateMode()) return false;
  if (typeof StateEdit === "undefined" || typeof StateEdit.selectionFromDom !== "function") return false;
  if (event.target.closest && event.target.closest(".top-float, .menu, .sheet, .board-dock, .zoom-float, button, input, textarea, select")) return false;
  var sel = StateEdit.selectionFromDom(event.target, sourceEl && sourceEl.value);
  if (mermaidLinkMode) {
    event.preventDefault();
    event.stopPropagation();
    if (sel && (sel.kind === "state" || sel.kind === "composite")) stateLinkPick(sel);
    else if (!sel) setMermaidLinkMode(false);
    return true;
  }
  if (event.type !== "pointerdown" && event.type !== "click" && event.type !== "dblclick") return !!sel;
  if (!sel) {
    if (event.type === "pointerdown") {
      MermaidInspect.clearGesture();
      clearMermaidSelection();
    }
    return false;
  }
  var key = sel.key || "";
  if (event.type === "pointerdown") {
    beginMermaidInspectGesture(key);
    selectStateHit(sel, false);
    if (mermaidInspectGesture && mermaidInspectGesture.already) {
      stateWantPropsForKey(key);
      MermaidInspect.clearGesture();
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  if (event.type === "click") {
    if (consumeMermaidInspectClick(key)) stateWantPropsForKey(key);
    event.stopPropagation();
    return true;
  }
  if (event.type === "dblclick") {
    selectStateHit(sel, false);
    stateWantPropsForKey(key);
    MermaidInspect.clearGesture();
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  return true;
}


function stateEditAction(fn) {
  if (typeof StateEdit === "undefined") throw new Error("StateEdit missing — hard refresh");
  var result = fn();
  if (!result || typeof result.source !== "string") return;
  sourceEl.value = result.source;
  selectedMermaid = result.selection || null;
  setTypeUI(sourceEl.value);
  void renderDiagram().then(function() {
    if (selectedMermaid) {
      applyStateSelectionVisual();
      fillStateProps();
    }
  });
  scheduleSave();
}


function syncStateDeleteButton() {
  var btn = document.getElementById("btnStateDelete");
  if (!btn) return;
  var on = isStateMode() && selectedMermaid && selectedMermaid.kind !== "pseudostate";
  btn.disabled = !on;
  syncStateStartButton();
}

function stateLinkPick(selection) {
  if (!mermaidLinkMode || !selection) return false;
  if (selection.kind !== "state" && selection.kind !== "composite") return false;
  if (!mermaidLinkStart) {
    mermaidLinkStart = selection;
    selectedMermaid = selection;
    applyStateSelectionVisual();
    if (selection.domId) {
      try {
        var el = previewEl.querySelector("#" + CSS.escape(selection.domId));
        if (el) el.classList.add("mermaid-link-source");
      } catch (_e) {}
    }
    setStatus("Source " + selection.id + " · click target");
    return true;
  }
  if (mermaidLinkStart.id === selection.id) {
    setStatus("Pick a different target state", true);
    return true;
  }
  try {
    stateEditAction(function() {
      return StateEdit.addTransition(sourceEl.value, mermaidLinkStart.id, selection.id, "");
    });
  } catch (err) {
    showMermaidError(err instanceof Error ? err.message : String(err));
  }
  setMermaidLinkMode(false);
  return true;
}

function stateAddState() {
  if (!isStateMode()) return;
  var parent = (selectedMermaid && selectedMermaid.kind === "composite") ? selectedMermaid.id : "";
  try {
    stateEditAction(function() {
      return StateEdit.addState(sourceEl.value, { label: "state", parent: parent || undefined });
    });
  } catch (err) {
    showMermaidError(err instanceof Error ? err.message : String(err));
  }
}

function stateAddComposite() {
  if (!isStateMode()) return;
  var parent = (selectedMermaid && selectedMermaid.kind === "composite") ? selectedMermaid.id : "";
  try {
    stateEditAction(function() {
      return StateEdit.addComposite(sourceEl.value, { label: "Group", parent: parent || undefined });
    });
  } catch (err) {
    showMermaidError(err instanceof Error ? err.message : String(err));
  }
}

/** Group for Start: selected state's rendered composite (bbox), else canvas. */
function startGroupForSelection(sel) {
  if (!sel || sel.kind !== "state") return null;
  if (sel.parent) return String(sel.parent);
  var node = null;
  if (previewEl && sel.domId) {
    try { node = previewEl.querySelector("#" + CSS.escape(sel.domId)); } catch (_e) {}
  }
  if (!node && previewEl && sel.id) {
    previewEl.querySelectorAll("g.node").forEach(function(g) {
      if (node) return;
      var gid = g.id || "";
      if (gid.indexOf("state-" + sel.id + "-") === 0) node = g;
    });
  }
  if (node) {
    if (typeof StateEdit !== "undefined" && StateEdit.clusterParentFromDom) {
      return StateEdit.clusterParentFromDom(node) || "";
    }
    try {
      var cluster = node.closest && node.closest("g.statediagram-cluster");
      if (cluster && cluster.id) return cluster.id;
    } catch (_e2) {}
  }
  return "";
}

function syncStateStartButton() {
  var btn = document.getElementById("btnStateAddStart");
  if (!btn) return;
  if (!isStateMode() || typeof StateEdit === "undefined" || !StateEdit.hasStart || !StateEdit.addStart) {
    btn.disabled = true;
    return;
  }
  var sel = selectedMermaid;
  if (!sel || sel.kind !== "state" || !sel.id || sel.id === "[*]") {
    btn.disabled = true;
    btn.title = "Select a state, then add start [*] → it";
    return;
  }
  var parent = startGroupForSelection(sel);
  if (parent == null) {
    btn.disabled = true;
    btn.title = "Select a state, then add start [*] → it";
    return;
  }
  var src = sourceEl && sourceEl.value;
  var blocked = false;
  var reason = "";
  try {
    if (StateEdit.hasStart(src, parent)) {
      blocked = true;
      reason = "Start already exists in " + (parent || "canvas");
    } else if (StateEdit.getTransition && StateEdit.getTransition(src, "[*]", sel.id)) {
      blocked = true;
      reason = "A start already points to " + sel.id;
    }
  } catch (_e2) {
    blocked = true;
    reason = "Cannot add start";
  }
  btn.disabled = !!blocked;
  btn.title = blocked
    ? reason
    : ("Add [*] → " + sel.id + " in " + (parent || "canvas"));
}

function stateAddStart() {
  if (!isStateMode()) return;
  var sel = selectedMermaid;
  if (!sel || sel.kind !== "state" || !sel.id) {
    showMermaidError("Select a state first, then add Start");
    return;
  }
  var parent = startGroupForSelection(sel);
  if (parent == null) {
    showMermaidError("Select a state first, then add Start");
    return;
  }
  try {
    stateEditAction(function() {
      return StateEdit.addStart(sourceEl.value, {
        to: sel.id,
        parent: parent || undefined,
      });
    });
  } catch (err) {
    showMermaidError(err instanceof Error ? err.message : String(err));
  }
}

function stateDeleteSelection() {
  if (!isStateMode() || !selectedMermaid) return;
  if (selectedMermaid.kind === "pseudostate") return;
  try {
    stateEditAction(function() {
      return StateEdit.deleteSelection(sourceEl.value, selectedMermaid);
    });
  } catch (err) {
    showMermaidError(err instanceof Error ? err.message : String(err));
  }
}

(function wireStateTools() {
  var addBtn = document.getElementById("btnStateAdd");
  var groupBtn = document.getElementById("btnStateAddGroup");
  var linkBtn = document.getElementById("btnStateLink");
  var delBtn = document.getElementById("btnStateDelete");
  if (addBtn) addBtn.onclick = function() { stateAddState(); };
  if (groupBtn) groupBtn.onclick = function() { stateAddComposite(); };
  var startBtn = document.getElementById("btnStateAddStart");
  if (startBtn) startBtn.onclick = function() { stateAddStart(); };
  if (linkBtn) {
    linkBtn.onclick = function() { setMermaidLinkMode(!mermaidLinkMode); };
    if (!setMermaidLinkMode._stateLinkHooked) {
      var _set = setMermaidLinkMode;
      setMermaidLinkMode = function(active) {
        _set(active);
        var b = document.getElementById("btnStateLink");
        if (b) b.classList.toggle("is-active", !!mermaidLinkMode);
      };
      setMermaidLinkMode._stateLinkHooked = true;
    }
  }
  if (delBtn) delBtn.onclick = function() { stateDeleteSelection(); };
  syncStateDeleteButton();
})();

if (previewEl) {
  previewEl.addEventListener("pointerdown", function(event) {
    if (event.button !== 0) return;
    stateHitSelect(event);
  }, true);
  previewEl.addEventListener("click", function(event) {
    if (!isStateMode()) return;
    stateHitSelect(event);
  }, true);
  previewEl.addEventListener("dblclick", function(event) {
    if (!isStateMode()) return;
    stateHitSelect(event);
  }, true);
}

document.addEventListener("keydown", function(event) {
  if (!isStateMode()) return;
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  if (!selectedMermaid || selectedMermaid.kind === "pseudostate") return;
  var tag = (event.target && event.target.tagName) || "";
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
  event.preventDefault();
  stateDeleteSelection();
});


/* === 05-render-io.js === */
/* drawer-app/05-render-io.js — lines 2626-2898 of former inline module */
async function renderDiagram(opts) {
  opts = opts || {};
  if (document.documentElement.dataset.drawerMode === 'board') return;
  if (typeof pinBoardTitle === "function") pinBoardTitle();
  previewEl.classList.remove("board-preview");
  const text = sourceEl.value;
  var mermaidText = text;
  try { mermaidText = splitDocument(text).body; } catch (_e) {
    if (text.trim()) {
      errorBox.textContent = "document meta required";
      errorBox.classList.add("show");
      setStatus("document meta required", true);
      return;
    }
  }
  if (typeof applyMermaidDocumentStyle === 'function') mermaidText = applyMermaidDocumentStyle(mermaidText);
  else if (typeof applyMermaidSiteConfig === 'function') applyMermaidSiteConfig();
  setTypeUI(text);
  if (!mermaidText.trim()) {
    showEmpty();
    setStatus('No diagram source');
    return;
  }
  // Keep current zoom/pan across edits (Board parity). `drawer.ui` already persists scale/panX/panY.
  const keepView = opts.fit !== true;
  const kept = keepView ? { scale: scale, panX: panX, panY: panY } : null;
  const id = `dv_${++renderNo}_${Date.now()}`;
  try {
    const dtypeEarly = String(diagramType(mermaidText) || '').toLowerCase();
    let svg;
    if (dtypeEarly === 'mindmap' && typeof MindmapEdit !== 'undefined' && MindmapEdit.render) {
      const layout = currentMindmapLayout();
      const mm = MindmapEdit.render(mermaidText.trim(), { layout: layout, id: id, theme: (typeof currentDiagramTheme === 'function' ? currentDiagramTheme() : 'default') });
      if (mm.errors && mm.errors.length && !mm.svg) throw new Error(mm.errors.join('; '));
      previewEl.innerHTML = mm.svg;
      svg = previewEl.querySelector('svg');
      fixSvgIntrinsic(svg);
      if (typeof applyMindmapSelectionVisual === "function") applyMindmapSelectionVisual();
      if (typeof syncMindmapDeleteButton === "function") syncMindmapDeleteButton();
    } else {
      const result = await window.mermaid.render(id, mermaidText.trim());
      previewEl.innerHTML = result.svg;
      if (typeof result.bindFunctions === 'function') result.bindFunctions(previewEl);
      svg = previewEl.querySelector('svg');
      const dtype = dtypeEarly;
      if (dtype === 'sequencediagram') {
        tuneSequenceFrames(svg);
        clearSequenceFrameActorOverlap(svg);
        styleSequenceLoopLines(svg);
        lowerSequenceFramesBehindActors(svg);
        styleSequenceNotes(svg);
        polishSequenceActors(svg);
      }
      if (dtype === 'statediagram' || dtype === 'statediagram-v2') {
        // ELK already orthogonal; keep path polish only as fallback if no ELK.
        if (typeof polishStateTransitions === 'function' && !globalThis.__drawerLayoutElkReady) {
          polishStateTransitions(svg);
        }
        if (typeof polishStateDiagram === 'function') polishStateDiagram(svg);
      }
      fixSvgIntrinsic(svg);
      if (dtype === 'flowchart' || dtype === 'graph') {
        pinClusterTitlesTopLeft(svg);
        unoverlapTipLabels(svg);
      }
    }
    errorBox.classList.remove('show');
    errorBox.textContent = '';
    if (opts.fit) {
      centerView();
    } else if (opts.restoreView) {
      if (typeof restoreOrFitDocumentView === "function") restoreOrFitDocumentView();
      else applyTransform();
    } else if (kept) {
      scale = kept.scale; panX = kept.panX; panY = kept.panY;
      applyTransform();
    } else {
      applyTransform();
    }
    cacheRenderedSvg(svg);
    if (typeof installMermaidEdgeHits === 'function') installMermaidEdgeHits(previewEl);
    if (typeof isStateMode === 'function' && isStateMode() && typeof applyStateSelectionVisual === 'function') applyStateSelectionVisual();
    else if (typeof applyMermaidSelectionVisual === 'function') applyMermaidSelectionVisual();
    setStatus(`Rendered ${diagramType(mermaidText)} · ${new Date().toLocaleTimeString()}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errorBox.textContent = message;
    errorBox.classList.add('show');
    setStatus(message, true);
  }
}
function scheduleRender() {
  clearTimeout(renderTimer);
  // Source typing: keep zoom/pan like Board scheduleBoardRender → renderBoard() without fit.
  renderTimer = setTimeout(() => void renderDiagram({ fit: false }), 280);
}
function scheduleSave() {
  dirty = true;
  clearTimeout(saveTimer);
  setSyncUI('saving');
  saveTimer = setTimeout(() => void saveToFile(), 350);
}
async function saveToFile() {
  const text = sourceEl.value;
  const seq = ++saveSeq;
  const baseRev = localRev;
  try {
    const res = await fetch('./diagram.mmd', {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Diagram-Rev': String(baseRev),
        'X-Diagram-Via': 'ui',
      },
      body: text,
    });
    if (seq !== saveSeq) return; // newer keystrokes pending
    if (res.status === 409) {
      const payload = await res.json();
      // Someone else advanced the version. Adopt remote SSOT.
      localRev = Number(payload.version != null ? payload.version : payload.rev) || localRev;
      dirty = false;
      if (typeof payload.source === 'string' && sourceEl.value !== payload.source) {
        sourceEl.value = payload.source;
        await renderDiagram();
      }
      setSyncUI('conflict');
      setStatus(`Version conflict → loaded v ${localRev} (${payload.via || 'remote'})`, true);
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const newRev = Number(res.headers.get('X-Diagram-Rev'));
    if (Number.isFinite(newRev)) localRev = newRev;
    else localRev = baseRev + 1;
    dirty = false;
    try {
      const metaRes = await fetch(`./diagram.meta.json?ts=${Date.now()}`, { cache: 'no-store' });
      if (metaRes.ok) applyLiveMeta(await metaRes.json());
    } catch (_) {}
    setSyncUI('ok');
    try {
      var saved = splitDocument(text);
      sourceEl.value = joinDocument({ id: saved.meta.id, version: localRev }, saved.body);
    } catch (_e) {}
    setStatus(`Saved v ${localRev}`);
    if (typeof refreshMermaidHistory === 'function') void refreshMermaidHistory();
  } catch (err) {
    setSyncUI('error');
    setStatus(err instanceof Error ? err.message : String(err), true);
  }
}
async function loadPolled() {
  // Never clobber in-flight local edits; version gate handles the rest.
  if (dirty || saveTimer) return;
  try {
    const metaRes = await fetch(`./diagram.meta.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (!metaRes.ok) return;
    const meta = await metaRes.json();
    const remoteRev = Number(meta.version != null ? meta.version : meta.rev) || 0;
    if (remoteRev < localRev) return;
    if (remoteRev === localRev) {
      applyLiveMeta(meta);
      return;
    }

    const res = await fetch(`./diagram.mmd?ts=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const text = await res.text();
    const headerRev = Number(res.headers.get('X-Diagram-Rev'));
    localRev = Number.isFinite(headerRev) ? headerRev : remoteRev;
    dirty = false;
    applyLiveMeta(meta);
    if (sourceEl.value !== text) {
      sourceEl.value = text;
      await renderDiagram();
      setStatus(`Loaded r${localRev} (${meta.via || 'remote'})`);
    }
    setSyncUI('ok');
  } catch (_) {}
}
async function bootstrap() {
  try {
    try {
      const metaRes = await fetch('./diagram.meta.json', { cache: 'no-store' });
      if (metaRes.ok) applyLiveMeta(await metaRes.json());
    } catch (_) {}
    const res = await fetch('./diagram.mmd', { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      const rev = Number(res.headers.get('X-Diagram-Rev'));
      localRev = Number.isFinite(rev) ? rev : 0;
      sourceEl.value = text;
      dirty = false;
      setTypeUI(text);
      if (!text.trim()) {
        try { sessionStorage.removeItem(SVG_CACHE_KEY); } catch (_) {}
        showEmpty();
        setSyncUI('ok');
        setStatus('Ready');
        return;
      }
      await renderDiagram({ fit: false, restoreView: true });
      setSyncUI('ok');
      setStatus(`Loaded r${localRev}`);
      return;
    }
  } catch (_) {}
  localRev = 0;
  setSyncUI('ok');
  if (!previewEl.querySelector('svg')) showEmpty();
}
function exportStem(raw, fallback) {
  const stem = String(raw || '').replace(/[^\w\-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[-._]+|[-._]+$/g, '');
  return stem.slice(0, 48) || fallback || 'diagram';
}
var copyTipTimer = 0;
function showCopyTip(msg) {
  var el = $('#copyTip');
  if (!el) return;
  el.textContent = msg || 'Copied successfully';
  el.hidden = false;
  if (copyTipTimer) clearTimeout(copyTipTimer);
  copyTipTimer = setTimeout(function() { el.hidden = true; }, 2000);
}
function copyTextFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = String(text ?? '');
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } finally { ta.remove(); }
  return ok;
}
async function copyText(text, label) {
  const value = String(text ?? '');
  const fallback = () => copyTextFallback(value);
  let copied = false;
  try {
    copied = await Promise.race([
      navigator.clipboard.writeText(value).then(() => true, () => false),
      new Promise((resolve) => setTimeout(() => resolve(false), 200)),
    ]);
  } catch {
    copied = false;
  }
  if (!copied) copied = fallback();
  if (copied) {
    setStatus(`${label} copied`);
    showCopyTip('Copied successfully');
    return true;
  }
  setStatus(`Copy ${label} failed`, true);
  return false;
}




/* —— Mermaid history list (reload without new archive) —— */
function formatHistoryWhen(created) {
  var s = String(created || "");
  // YYYYMMDD-HHMMSS → MM-DD HH:MM:SS
  var m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(s);
  if (m) return m[2] + "-" + m[3] + " " + m[4] + ":" + m[5];
  return s || "";
}
function historyDisplayTitle(item, fallback) {
  var raw = String((item && (item.title || item.label)) || fallback || "");
  var t = raw.replace(/^[\'"\u2018\u2019\u201c\u201d\s]+/, "").replace(/[\'"\u2018\u2019\u201c\u201d\s]+$/, "");
  return t || fallback || "untitled";
}
function appendHistoryMetaLine(meta, item) {
  if (!meta) return;
  if (item && item.id) {
    var idEl = document.createElement("span");
    idEl.className = "history-id";
    idEl.textContent = item.id;
    meta.appendChild(idEl);
  }
  var ver = typeof formatVersionLabel === "function" ? formatVersionLabel(item && item.version) : "";
  if (ver) {
    if (meta.childNodes.length) meta.appendChild(document.createTextNode(" · "));
    var vEl = document.createElement("span");
    vEl.className = "doc-ver";
    vEl.textContent = ver;
    meta.appendChild(vEl);
  }
  var when = formatHistoryWhen(item && item.created_at);
  if (when) {
    if (meta.childNodes.length) meta.appendChild(document.createTextNode(" · "));
    meta.appendChild(document.createTextNode(when));
  }
}
function historyPop(combo) {
  return combo && combo.querySelector(".history-pop");
}
function filterHistoryCombo(combo) {
  if (!combo) return;
  var input = combo.querySelector(".history-search");
  var q = String(input && input.value || "").trim().toLowerCase();
  var list = combo.querySelector(".history-list");
  if (!list) return;
  list.querySelectorAll(".history-item").forEach(function(li) {
    if (!q) { li.hidden = false; return; }
    var hay = [
      li.dataset.historyTitle,
      li.dataset.historyId,
      li.dataset.historyKind,
      li.dataset.historyName,
      li.textContent
    ].join(" ").toLowerCase();
    li.hidden = hay.indexOf(q) < 0;
  });
  list.scrollTop = 0;
}
function closeHistoryCombo(combo) {
  if (!combo) return;
  combo.classList.remove("is-open");
  var btn = combo.querySelector(".history-combo-btn");
  var pop = historyPop(combo);
  var input = combo.querySelector(".history-search");
  if (btn) btn.setAttribute("aria-expanded", "false");
  if (pop) pop.hidden = true;
  if (input) input.value = "";
  filterHistoryCombo(combo);
}
function closeAllHistoryCombos() {
  document.querySelectorAll(".history-combo.is-open").forEach(closeHistoryCombo);
}
function openHistoryCombo(combo) {
  if (!combo) return;
  document.querySelectorAll(".history-combo.is-open").forEach(function(other) {
    if (other !== combo) closeHistoryCombo(other);
  });
  combo.classList.add("is-open");
  var btn = combo.querySelector(".history-combo-btn");
  var pop = historyPop(combo);
  var list = combo.querySelector(".history-list");
  var input = combo.querySelector(".history-search");
  if (btn) btn.setAttribute("aria-expanded", "true");
  if (pop) pop.hidden = false;
  filterHistoryCombo(combo);
  if (input) requestAnimationFrame(function() { input.focus(); input.select(); });
  var active = list && list.querySelector(".history-item.is-active:not([hidden])");
  if (active && active.scrollIntoView) {
    void list.offsetHeight;
    active.scrollIntoView({ block: "center" });
  }
}
function setHistoryComboFace(combo, item, fallbackKind) {
  var face = combo && combo.querySelector(".history-combo-face");
  var btn = combo && combo.querySelector(".history-combo-btn");
  if (!face) return;
  face.textContent = "";
  if (!item) {
    face.textContent = "No snapshots yet";
    if (btn) btn.disabled = true;
    return;
  }
  if (btn) btn.disabled = false;
  var top = document.createElement("div");
  top.className = "history-item-top";
  var kind = document.createElement("span");
  kind.className = "history-kind";
  var kindLabel = item.kind || fallbackKind || "";
  if (typeof formatDockTypeLabel === "function" && kindLabel && fallbackKind !== "board") {
    kindLabel = formatDockTypeLabel(kindLabel);
  }
  if (fallbackKind === "board") kindLabel = "board";
  kind.textContent = kindLabel || fallbackKind || "diagram";
  var title = document.createElement("span");
  title.className = "history-item-title";
  title.textContent = historyDisplayTitle(item, fallbackKind || "diagram");
  top.appendChild(kind);
  top.appendChild(title);
  var meta = document.createElement("div");
  meta.className = "history-item-meta";
  appendHistoryMetaLine(meta, item);
  face.appendChild(top);
  face.appendChild(meta);
}
function wireHistoryCombos() {
  if (wireHistoryCombos.wired) return;
  wireHistoryCombos.wired = true;
  document.querySelectorAll(".history-combo").forEach(function(combo) {
    var btn = combo.querySelector(".history-combo-btn");
    if (!btn) return;
    btn.addEventListener("click", function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (btn.disabled) return;
      if (combo.classList.contains("is-open")) closeHistoryCombo(combo);
      else openHistoryCombo(combo);
    });
    var search = combo.querySelector(".history-search");
    if (search) {
      search.addEventListener("input", function() { filterHistoryCombo(combo); });
      search.addEventListener("search", function() { filterHistoryCombo(combo); });
      search.addEventListener("click", function(ev) { ev.stopPropagation(); });
    }
  });
  document.addEventListener("click", function(ev) {
    var hit = ev.target && ev.target.closest && ev.target.closest(".history-combo");
    if (hit) return;
    closeAllHistoryCombos();
  });
  document.addEventListener("keydown", function(ev) {
    if (ev.key === "Escape") closeAllHistoryCombos();
  });
}
async function refreshMermaidHistory() {
  var list = document.getElementById("historyList");
  var empty = document.getElementById("historyEmpty");
  var combo = list && list.closest(".history-combo");
  if (!list) return;
  wireHistoryCombos();
  try {
    var res = await fetch("./history.json?ts=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    var data = await res.json();
    var items = (data && data.items) || [];
    if (!items.length) {
      list.innerHTML = "";
      setHistoryComboFace(combo, null, "diagram");
      closeHistoryCombo(combo);
      if (empty) empty.hidden = true;
      return;
    }
    if (empty) empty.hidden = true;
    var frag = document.createDocumentFragment();
    // Only highlight the snapshot whose id is the live diagram id.
    // Do NOT use stale meta.archive (after UI edits it still points at an old tip,
    // which is often the first row and looked "always selected").
    var curId = String(typeof liveDiagramId !== "undefined" ? liveDiagramId : "");
    var activeEl = null;
    var activeItem = null;
    items.forEach(function(item) {
      var li = document.createElement("li");
      li.className = "history-item";
      li.setAttribute("role", "option");
      li.dataset.historyName = item.name || ((item.id || "diagram") + ".mmd");
      li.dataset.historyId = item.id || "";
      li.dataset.historyTitle = item.title || item.label || "diagram";
      li.dataset.historyKind = item.kind || "";
      var isActive = !!(item.current) || !!(curId && item.id && curId === String(item.id));
      if (isActive) {
        li.classList.add("is-active");
        li.setAttribute("aria-selected", "true");
        activeEl = li;
        activeItem = item;
      } else {
        li.setAttribute("aria-selected", "false");
      }

      var main = document.createElement("div");
      main.className = "history-item-main";

      var top = document.createElement("div");
      top.className = "history-item-top";
      var kind = document.createElement("span");
      kind.className = "history-kind";
      var kindLabel = item.kind || "";
      if (typeof formatDockTypeLabel === "function" && kindLabel) kindLabel = formatDockTypeLabel(kindLabel);
      kind.textContent = kindLabel || "diagram";
      var title = document.createElement("span");
      title.className = "history-item-title";
      title.textContent = historyDisplayTitle(item, "diagram");
      top.appendChild(kind);
      top.appendChild(title);

      var meta = document.createElement("div");
      meta.className = "history-item-meta";
      appendHistoryMetaLine(meta, item);

      main.appendChild(top);
      main.appendChild(meta);

      var del = document.createElement("button");
      del.type = "button";
      del.className = "history-item-del";
      del.title = "Delete snapshot";
      del.setAttribute("aria-label", "Delete snapshot");
      del.textContent = "×";

      li.appendChild(main);
      li.appendChild(del);
      li.addEventListener("click", function(ev) {
        if (ev.target && (ev.target === del || del.contains(ev.target))) return;
        closeHistoryCombo(combo);
        void restoreMermaidHistory(li.dataset.historyName, li.dataset.historyId, li.dataset.historyTitle);
      });
      del.addEventListener("click", function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        void deleteMermaidHistory(li.dataset.historyName);
      });
      frag.appendChild(li);
    });
    list.innerHTML = "";
    list.appendChild(frag);
    filterHistoryCombo(combo);
    setHistoryComboFace(combo, activeItem || items[0], "diagram");
    if (combo && combo.classList.contains("is-open") && activeEl && activeEl.scrollIntoView) {
      requestAnimationFrame(function() {
        activeEl.scrollIntoView({ block: "center" });
      });
    }
  } catch (err) {
    if (empty) {
      empty.hidden = false;
      empty.textContent = err instanceof Error ? err.message : String(err);
    }
  }
}
async function restoreMermaidHistory(name, diagramId, diagramTitle) {
  if (!name) return;
  var file = name.indexOf(".mmd") >= 0 ? name : name + ".mmd";
  try {
    setStatus("Switching to diagram record " + file + "…");
    var baseRev = localRev;
    var headers = {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Diagram-Rev": String(baseRev),
      "X-Diagram-Via": "history",
      "X-Diagram-Archive": "0",
      "X-Diagram-History-File": file,
    };
    if (diagramId) headers["X-Diagram-Id"] = diagramId;
    if (diagramTitle) headers["X-Diagram-Title"] = headerByteString(diagramTitle);
    var put = await fetch("./diagram.mmd", {
      method: "PUT",
      headers: headers,
      body: "",
    });
    if (put.status === 409) {
      var payload = await put.json();
      localRev = Number(payload.version != null ? payload.version : payload.rev) || localRev;
      setSyncUI("conflict");
      setStatus("Version conflict while switching — retry", true);
      return;
    }
    if (!put.ok) throw new Error("HTTP " + put.status);
    var newRev = Number(put.headers.get("X-Diagram-Rev"));
    if (Number.isFinite(newRev)) localRev = newRev;
    else localRev = baseRev + 1;
    dirty = false;
    var res = await fetch("./diagram.mmd?ts=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    sourceEl.value = await res.text();
    if (typeof setTypeUI === "function") setTypeUI(sourceEl.value);
    await renderDiagram({ fit: false, restoreView: true });
    try {
      var metaRes = await fetch("./diagram.meta.json?ts=" + Date.now(), { cache: "no-store" });
      if (metaRes.ok) applyLiveMeta(await metaRes.json());
    } catch (_e) {}
    setSyncUI("ok");
    setStatus("Current → " + (diagramTitle || file) + (diagramId ? " [" + diagramId + "]" : "") + " · v " + localRev);
    await refreshMermaidHistory();
  } catch (err) {
    setSyncUI("error");
    setStatus(err instanceof Error ? err.message : String(err), true);
  }
}

async function deleteMermaidHistory(name) {
  if (!name) return;
  var file = name.indexOf(".mmd") >= 0 ? name : name + ".mmd";
  if (!window.confirm("Delete history snapshot\\n" + file + "?")) return;
  try {
    var res = await fetch("./api/history/" + encodeURIComponent(file), { method: "DELETE" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    setStatus("Deleted " + file);
    await refreshMermaidHistory();
    try {
      var metaRes = await fetch("./diagram.meta.json?ts=" + Date.now(), { cache: "no-store" });
      if (metaRes.ok) applyLiveMeta(await metaRes.json());
    } catch (_e) {}
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), true);
  }
}

/* —— Board history list (reload without new archive) —— */
function boardHistoryFile(name) {
  name = String(name || "");
  if (name.indexOf(".bmd") >= 0) return name;
  if (/\.dsl$/.test(name)) return name.replace(/\.dsl$/, ".bmd");
  return name + ".bmd";
}
async function refreshBoardHistory() {
  var list = document.getElementById("boardHistoryList");
  var empty = document.getElementById("boardHistoryEmpty");
  var combo = list && list.closest(".history-combo");
  if (!list) return;
  wireHistoryCombos();
  try {
    var res = await fetch("./board-history.json?ts=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    var data = await res.json();
    var items = (data && data.items) || [];
    if (!items.length) {
      list.innerHTML = "";
      setHistoryComboFace(combo, null, "board");
      closeHistoryCombo(combo);
      if (empty) empty.hidden = true;
      return;
    }
    if (empty) empty.hidden = true;
    var frag = document.createDocumentFragment();
    var curId = String(typeof liveBoardId !== "undefined" ? liveBoardId : "");
    var activeEl = null;
    var activeItem = null;
    items.forEach(function(item) {
      var li = document.createElement("li");
      li.className = "history-item";
      li.setAttribute("role", "option");
      li.dataset.historyName = item.name || ((item.id || "board") + ".bmd");
      li.dataset.historyId = item.id || "";
      li.dataset.historyTitle = item.title || item.label || "board";
      li.dataset.historyKind = item.kind || "board";
      var isActive = !!(item.current) || !!(curId && item.id && curId === String(item.id));
      if (isActive) {
        li.classList.add("is-active");
        li.setAttribute("aria-selected", "true");
        activeEl = li;
        activeItem = item;
      } else {
        li.setAttribute("aria-selected", "false");
      }

      var main = document.createElement("div");
      main.className = "history-item-main";

      var top = document.createElement("div");
      top.className = "history-item-top";
      var kind = document.createElement("span");
      kind.className = "history-kind";
      kind.textContent = "board";
      var title = document.createElement("span");
      title.className = "history-item-title";
      title.textContent = historyDisplayTitle(item, "board");
      top.appendChild(kind);
      top.appendChild(title);

      var meta = document.createElement("div");
      meta.className = "history-item-meta";
      appendHistoryMetaLine(meta, item);

      main.appendChild(top);
      main.appendChild(meta);

      var del = document.createElement("button");
      del.type = "button";
      del.className = "history-item-del";
      del.title = "Delete snapshot";
      del.setAttribute("aria-label", "Delete snapshot");
      del.textContent = "×";

      li.appendChild(main);
      li.appendChild(del);
      li.addEventListener("click", function(ev) {
        if (ev.target && (ev.target === del || del.contains(ev.target))) return;
        closeHistoryCombo(combo);
        void restoreBoardHistory(li.dataset.historyName, li.dataset.historyId, li.dataset.historyTitle);
      });
      del.addEventListener("click", function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        void deleteBoardHistory(li.dataset.historyName);
      });
      frag.appendChild(li);
    });
    list.innerHTML = "";
    list.appendChild(frag);
    filterHistoryCombo(combo);
    setHistoryComboFace(combo, activeItem || items[0], "board");
    if (combo && combo.classList.contains("is-open") && activeEl && activeEl.scrollIntoView) {
      requestAnimationFrame(function() {
        activeEl.scrollIntoView({ block: "center" });
      });
    }
  } catch (err) {
    if (empty) {
      empty.hidden = false;
      empty.textContent = err instanceof Error ? err.message : String(err);
    }
  }
}
async function restoreBoardHistory(name, boardId, boardTitle) {
  if (!name) return;
  var file = boardHistoryFile(name);
  try {
    setStatus("Switching to board record " + file + "…");
    var baseRev = boardLocalRev;
    var headers = {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Board-Rev": String(baseRev),
      "X-Board-Via": "history",
      "X-Board-Archive": "0",
      "X-Board-History-File": file,
    };
    if (boardId) headers["X-Board-Id"] = boardId;
    if (boardTitle) headers["X-Board-Title"] = headerByteString(boardTitle);
    // Empty body: server only retargets meta.current (no copy).
    var put = await fetch("./board.bmd", {
      method: "PUT",
      headers: headers,
      body: "",
    });
    if (put.status === 409) {
      var payload = await put.json();
      boardLocalRev = Number(payload.version != null ? payload.version : payload.rev) || boardLocalRev;
      setBoardSyncUI("conflict");
      setStatus("Board rev conflict while switching — retry", true);
      return;
    }
    if (!put.ok) throw new Error("HTTP " + put.status);
    var newRev = Number(put.headers.get("X-Board-Rev"));
    if (Number.isFinite(newRev)) boardLocalRev = newRev;
    else boardLocalRev = baseRev + 1;
    boardDirty = false;
    var res = await fetch("./board.bmd?ts=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    boardSourceEl.value = await res.text();
    if (typeof updateBoardChars === "function") updateBoardChars();
    if (typeof renderBoard === "function") renderBoard({ fit: false, restoreView: true });
    try {
      var metaRes = await fetch("./board.meta.json?ts=" + Date.now(), { cache: "no-store" });
      if (metaRes.ok && typeof applyBoardLiveMeta === "function") applyBoardLiveMeta(await metaRes.json());
    } catch (_e) {}
    setBoardSyncUI("ok");
    setStatus("Current → " + (boardTitle || file) + (boardId ? " [" + boardId + "]" : "") + " · v " + boardLocalRev);
    await refreshBoardHistory();
  } catch (err) {
    setBoardSyncUI("error");
    setStatus(err instanceof Error ? err.message : String(err), true);
  }
}

async function deleteBoardHistory(name) {
  if (!name) return;
  var file = boardHistoryFile(name);
  if (!window.confirm("Delete history snapshot\n" + file + "?")) return;
  try {
    var res = await fetch("./api/board-history/" + encodeURIComponent(file), { method: "DELETE" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    setStatus("Deleted " + file);
    await refreshBoardHistory();
    try {
      var metaRes = await fetch("./board.meta.json?ts=" + Date.now(), { cache: "no-store" });
      if (metaRes.ok && typeof applyBoardLiveMeta === "function") applyBoardLiveMeta(await metaRes.json());
    } catch (_e) {}
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), true);
  }
}


/* === 05-export-png.js === */
import { snapdom } from './snapdom.mjs';

const PNG_EXPORT_SCALE = 2;
const PNG_EXPORT_PADDING = 24;
const PNG_EXPORT_CAPTURE_BLEED = 64;
const PNG_EXPORT_MAX_EDGE = 16384;
const PNG_EXPORT_MAX_PIXELS = 64_000_000;

function getExportContentTarget() {
  if (document.documentElement.dataset.drawerMode === 'board') {
    return previewEl && previewEl.querySelector('.board-render');
  }
  return previewEl && previewEl.querySelector(':scope > svg');
}

function getExportContentSize(target) {
  const rect = target.getBoundingClientRect();
  const activeScale = Number(scale) > 0 ? Number(scale) : 1;
  const width = target.clientWidth || target.offsetWidth || rect.width / activeScale;
  const height = target.clientHeight || target.offsetHeight || rect.height / activeScale;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Diagram has no exportable size');
  }
  return { width: Math.ceil(width), height: Math.ceil(height) };
}

function stripExportInteractions(root) {
  const interactive = [
    root,
    ...root.querySelectorAll(
      '.board-selection, .mermaid-selection, .mermaid-link-selected, .board-reorder-dragging, .board-reorder-caret'
    ),
  ];
  interactive.forEach((el) => {
    el.classList.remove(
      'board-selection',
      'mermaid-selection',
      'mermaid-link-selected',
      'board-reorder-dragging'
    );
  });
  root.querySelectorAll(
    '.board-edge-hit, .mermaid-edge-hit, .mindmap-node-hit, .mindmap-add-zone-hit, .mindmap-add-hit, .mindmap-add, .board-reorder-caret'
  ).forEach((el) => el.remove());
}

function mountExportClone(target, size) {
  const surfaceSize = {
    width: size.width + PNG_EXPORT_CAPTURE_BLEED * 2,
    height: size.height + PNG_EXPORT_CAPTURE_BLEED * 2,
  };
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = [
    'position:fixed',
    'left:-100000px',
    'top:0',
    `width:${surfaceSize.width}px`,
    `height:${surfaceSize.height}px`,
    'overflow:visible',
    'pointer-events:none',
    'z-index:-1',
  ].join(';');

  const stage = document.createElement('div');
  stage.id = 'preview';
  stage.style.cssText = [
    'position:absolute',
    `left:${PNG_EXPORT_CAPTURE_BLEED}px`,
    `top:${PNG_EXPORT_CAPTURE_BLEED}px`,
    `width:${size.width}px`,
    `height:${size.height}px`,
    'min-width:0',
    'min-height:0',
    'padding:0',
    'transform:none',
  ].join(';');
  const clone = target.cloneNode(true);
  clone.style.width = `${size.width}px`;
  clone.style.height = `${size.height}px`;
  stripExportInteractions(clone);
  stage.appendChild(clone);
  host.appendChild(stage);
  document.body.appendChild(host);
  return { host, surfaceSize };
}

function findExportInkBounds(canvas) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let left = canvas.width;
  let top = canvas.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (pixels[(y * canvas.width + x) * 4 + 3] <= 8) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error('Diagram has no visible content');
  return { left, top, right, bottom };
}

function cropExportCanvas(canvas, surfaceSize) {
  const inkBounds = findExportInkBounds(canvas);
  const pixelRatio = canvas.width / surfaceSize.width;
  const padding = Math.ceil(PNG_EXPORT_PADDING * pixelRatio);
  const left = Math.max(0, inkBounds.left - padding);
  const top = Math.max(0, inkBounds.top - padding);
  const right = Math.min(canvas.width, inkBounds.right + padding + 1);
  const bottom = Math.min(canvas.height, inkBounds.bottom + padding + 1);
  const cropped = document.createElement('canvas');
  cropped.width = right - left;
  cropped.height = bottom - top;
  cropped.getContext('2d').drawImage(
    canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height
  );
  return {
    canvas: cropped,
    surfaceSize: {
      width: cropped.width / pixelRatio,
      height: cropped.height / pixelRatio,
    },
  };
}

function paintExportGrid(ctx, canvas, surfaceSize) {
  const kami = String(document.documentElement.dataset.diagramTheme || '').toLowerCase() === 'kami';
  const background = kami ? '#f5f4ed' : '#f8fafc';
  const line = kami ? 'rgba(80,78,73,.08)' : 'rgba(100,116,139,.12)';
  const spacing = kami ? 24 : 20;
  const pixelRatio = canvas.width / surfaceSize.width;
  const step = spacing * pixelRatio;
  const lineWidth = Math.max(1, Math.round(pixelRatio));

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = line;
  for (let x = 0; x < canvas.width; x += step) ctx.fillRect(Math.round(x), 0, lineWidth, canvas.height);
  for (let y = 0; y < canvas.height; y += step) ctx.fillRect(0, Math.round(y), canvas.width, lineWidth);
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG encoding failed'));
    }, 'image/png');
  });
}

async function writePngExport(blob, stem) {
  const response = await fetch('./export.png', {
    method: 'PUT',
    headers: {
      'Content-Type': 'image/png',
      'X-Export-Stem': stem,
    },
    body: blob,
  });
  if (!response.ok) throw new Error(`PNG export failed (${response.status})`);
  const result = await response.json();
  if (!result || !result.ok || !result.path) throw new Error('PNG export did not return a path');
  return result.path;
}

async function exportPng() {
  const target = getExportContentTarget();
  if (!target) {
    setStatus('Nothing to export', true);
    return;
  }
  const button = $('#btnCanvasDlPng');
  if (button) button.disabled = true;
  let host;
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const size = getExportContentSize(target);
    const surfaceSize = {
      width: size.width + PNG_EXPORT_CAPTURE_BLEED * 2,
      height: size.height + PNG_EXPORT_CAPTURE_BLEED * 2,
    };
    if (
      surfaceSize.width * PNG_EXPORT_SCALE > PNG_EXPORT_MAX_EDGE
      || surfaceSize.height * PNG_EXPORT_SCALE > PNG_EXPORT_MAX_EDGE
      || surfaceSize.width * surfaceSize.height * PNG_EXPORT_SCALE ** 2 > PNG_EXPORT_MAX_PIXELS
    ) {
      throw new Error('Diagram is too large to export');
    }

    ({ host } = mountExportClone(target, size));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const captured = await snapdom.toCanvas(host, {
      backgroundColor: null,
      dpr: 1,
      outerTransforms: false,
      scale: PNG_EXPORT_SCALE,
    });
    const cropped = cropExportCanvas(captured, surfaceSize);
    const output = document.createElement('canvas');
    output.width = cropped.canvas.width;
    output.height = cropped.canvas.height;
    const context = output.getContext('2d');
    paintExportGrid(context, output, cropped.surfaceSize);
    context.drawImage(cropped.canvas, 0, 0);

    const stem = exportStem(activeSourcePath().split('/').pop().replace(/\.[^.]+$/, ''), 'diagram');
    const path = await writePngExport(await canvasToPngBlob(output), stem);
    setStatus('PNG exported');
    if (!await copyText(path, 'PNG path')) showCopyTip('PNG exported');
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'PNG export failed', true);
    showCopyTip('PNG export failed');
  } finally {
    if (host) host.remove();
    if (button) button.disabled = false;
  }
}

/* === 06-view-sequence.js === */
/* drawer-app/06-view-sequence.js — lines 2899-3336 of former inline module */
function pinClusterTitlesTopLeft(svg) {
  if (!svg) return;
  // Mermaid centers subgraph titles; pin each cluster-label to its rect top-left.
  const padX = 10, padY = 2;
  for (const cluster of svg.querySelectorAll('g.cluster')) {
    const rect = cluster.querySelector(':scope > rect');
    const label = cluster.querySelector(':scope > g.cluster-label');
    if (!rect || !label) continue;
    const x = Number(rect.getAttribute('x'));
    const y = Number(rect.getAttribute('y'));
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    label.setAttribute('transform', `translate(${x + padX}, ${y + padY})`);
    label.setAttribute('data-title-corner', '1');
    for (const el of label.querySelectorAll('div, p, span')) {
      el.style.textAlign = 'left';
      if (el.style.maxWidth) el.style.maxWidth = 'none';
    }
  }
}


function tuneSequenceFrames(svg) {
  if (!svg) return;
  // 1) Frame inner padding: grow outer edges away from content.
  // 2) Badge inner padding: size labelBox from measured text (Note-style).
  const FRAME_PAD = { altBottom: 36, loopLeft: 32, loopBottom: 36 };
  const BADGE_PAD = {
    alt:  { left: 10, right: 12, top: 10, bottom: 10 },
    loop: { left: 14, right: 12, top: 10, bottom: 10 },
    _:    { left: 10, right: 10, top: 8, bottom: 8 },
  };
  const near = (a, b) => Math.abs(a - b) < 0.75;
  const parents = new Set([...svg.querySelectorAll('line.loopLine')].map((l) => l.parentElement));
  for (const g of parents) {
    if (!g) continue;
    const lines = [...g.querySelectorAll(':scope > line.loopLine')];
    if (lines.length < 4) continue;

    let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
    for (const l of lines) {
      const a = Number(l.getAttribute('x1'));
      const b = Number(l.getAttribute('x2'));
      const c = Number(l.getAttribute('y1'));
      const d = Number(l.getAttribute('y2'));
      x1 = Math.min(x1, a, b);
      x2 = Math.max(x2, a, b);
      y1 = Math.min(y1, c, d);
      y2 = Math.max(y2, c, d);
    }
    if (!Number.isFinite(x1) || x2 - x1 < 40) continue;

    const poly = g.querySelector(':scope > polygon.labelBox');
    const labelText = g.querySelector(':scope > text.labelText');
    const kind = ((labelText && labelText.textContent) || '').trim().split(/\s+/)[0].toLowerCase();

    let padL = 0;
    let padB = 0;
    if (kind === 'alt') padB = FRAME_PAD.altBottom;
    if (kind === 'loop') {
      padL = FRAME_PAD.loopLeft;
      padB = FRAME_PAD.loopBottom;
    }

    const nx1 = x1 - padL;
    const ny2 = y2 + padB;
    if (padL || padB) {
      for (const l of lines) {
        let lx1 = Number(l.getAttribute('x1'));
        let lx2 = Number(l.getAttribute('x2'));
        let ly1 = Number(l.getAttribute('y1'));
        let ly2 = Number(l.getAttribute('y2'));
        if (padL) {
          if (near(lx1, x1)) lx1 = nx1;
          if (near(lx2, x1)) lx2 = nx1;
        }
        if (padB) {
          if (near(ly1, y2)) ly1 = ny2;
          if (near(ly2, y2)) ly2 = ny2;
        }
        l.setAttribute('x1', String(lx1));
        l.setAttribute('x2', String(lx2));
        l.setAttribute('y1', String(ly1));
        l.setAttribute('y2', String(ly2));
      }
      if (padL && poly) {
        const pts = (poly.getAttribute('points') || '').trim().split(/\s+/).map((pt) => {
          const [px, py] = pt.split(',').map(Number);
          return `${px - padL},${py}`;
        });
        poly.setAttribute('points', pts.join(' '));
      }
      if (padL && labelText) {
        labelText.setAttribute('x', String(Number(labelText.getAttribute('x')) - padL));
      }
      x1 = nx1;
      y2 = ny2;
    }

    const loopTexts = [...g.querySelectorAll(':scope > text.loopText')];
    const titleConds = [];
    const elseConds = [];
    for (const t of loopTexts) {
      const ty = Number(t.getAttribute('y'));
      const onTitleBar = Number.isFinite(ty) && Math.abs(ty - (y1 + 18)) < 28;
      if (onTitleBar) titleConds.push(t);
      else elseConds.push(t);
    }

    if (poly && labelText) {
      if (titleConds.length) {
        const kw = (labelText.textContent || '').trim().split(/\s+/)[0];
        const cond = titleConds.map((t) => (t.textContent || '').trim()).filter(Boolean).join(' ');
        const combined = cond ? `${kw} ${cond}` : kw;
        while (labelText.firstChild) labelText.removeChild(labelText.firstChild);
        labelText.textContent = combined;
        for (const t of titleConds) t.remove();
      }

      const bp = BADGE_PAD[kind] || BADGE_PAD._;
      labelText.setAttribute('text-anchor', 'start');
      labelText.setAttribute('dominant-baseline', 'hanging');
      labelText.setAttribute('alignment-baseline', 'hanging');
      // Park text, measure, then wrap polygon with real padding.
      labelText.setAttribute('x', String(x1 + bp.left));
      labelText.setAttribute('y', String(y1 + bp.top));

      let tb = { x: x1 + bp.left, y: y1 + bp.top, width: Math.max(40, (labelText.textContent || '').length * 7.2), height: 16 };
      try {
        const bb = labelText.getBBox();
        if (bb && bb.width > 0) tb = bb;
      } catch (_) {}

      // Hang baselines often sit above the y attr — nudge so top pad is real.
      const topGap = tb.y - y1;
      if (topGap < bp.top) {
        const dy = bp.top - topGap;
        labelText.setAttribute('y', String(Number(labelText.getAttribute('y')) + dy));
        tb = { x: tb.x, y: tb.y + dy, width: tb.width, height: tb.height };
        try {
          const bb2 = labelText.getBBox();
          if (bb2 && bb2.width > 0) tb = bb2;
        } catch (_) {}
      }

      const bx = x1;
      const by = y1;
      const bw = Math.ceil((tb.x - x1) + tb.width + bp.right);
      const bh = Math.ceil((tb.y - y1) + tb.height + bp.bottom);
      const notch = Math.min(8.4, bh * 0.4);
      poly.setAttribute(
        'points',
        `${bx},${by} ${bx + bw},${by} ${bx + bw},${by + bh - notch} ${bx + bw - notch},${by + bh} ${bx},${by + bh}`
      );
    }

    for (const t of elseConds) {
      t.setAttribute('text-anchor', 'start');
      t.setAttribute('x', String(x1 + 12));
      for (const span of t.querySelectorAll('tspan')) {
        span.setAttribute('x', String(x1 + 12));
      }
      t.setAttribute('data-loop-edge', '1');
    }
  }
}

function clearSequenceFrameActorOverlap(svg) {
  if (!svg) return;
  // If any alt/loop bottom edge cuts through bottom participant boxes, push
  // those actors (and their labels) down and extend vertical lifelines.
  let frameBottom = -Infinity;
  for (const l of svg.querySelectorAll('line.loopLine')) {
    frameBottom = Math.max(frameBottom, Number(l.getAttribute('y1')), Number(l.getAttribute('y2')));
  }
  if (!Number.isFinite(frameBottom)) return;

  const bottoms = [...svg.querySelectorAll('rect.actor-bottom')];
  if (!bottoms.length) return;
  let actorTop = Infinity;
  for (const r of bottoms) actorTop = Math.min(actorTop, Number(r.getAttribute('y')));
  if (!Number.isFinite(actorTop)) return;

  const gap = 12;
  const need = frameBottom + gap;
  if (actorTop >= need) return;
  const shift = need - actorTop;

  const bump = (el, attrs) => {
    for (const a of attrs) {
      const v = Number(el.getAttribute(a));
      if (Number.isFinite(v)) el.setAttribute(a, String(v + shift));
    }
  };

  for (const r of bottoms) bump(r, ['y']);
  // Labels sitting on bottom actors (same vertical band).
  for (const t of svg.querySelectorAll('text.actor, text.actor-box')) {
    const y = Number(t.getAttribute('y'));
    if (Number.isFinite(y) && y >= actorTop - 4) bump(t, ['y']);
  }
  // Extend vertical lifelines that end at/near the old actor top.
  for (const l of svg.querySelectorAll('line')) {
    const cls = l.getAttribute('class') || '';
    if (cls.includes('loopLine')) continue;
    const y1 = Number(l.getAttribute('y1'));
    const y2 = Number(l.getAttribute('y2'));
    if (![y1, y2].every(Number.isFinite)) continue;
    const lo = Math.min(y1, y2);
    const hi = Math.max(y1, y2);
    // Lifeline: tall vertical line ending near bottom actors.
    if (Math.abs(Number(l.getAttribute('x1')) - Number(l.getAttribute('x2'))) < 0.75 && hi >= actorTop - 30) {
      if (y2 >= y1) l.setAttribute('y2', String(y2 + shift));
      else l.setAttribute('y1', String(y1 + shift));
    }
  }
}

function lowerSequenceFramesBehindActors(svg) {
  if (!svg) return;
  const actors = svg.querySelector('g > rect.actor, rect.actor');
  // Insert each loop-frame group before the first actor rect's parent group or first actor.
  let anchor = null;
  for (const el of svg.querySelectorAll('rect.actor, text.actor')) {
    anchor = el;
    break;
  }
  if (!anchor) return;
  const parents = new Set([...svg.querySelectorAll('line.loopLine')].map((l) => l.parentElement));
  for (const g of parents) {
    if (!g || !g.parentNode) continue;
    // Move frame group earlier in DOM so actors/messages paint above the borders.
    g.parentNode.insertBefore(g, g.parentNode.firstChild);
  }
}


function polishSequenceActors(svg) {
  if (!svg) return;
  const theme = (document.documentElement.dataset.diagramTheme || 'default').toLowerCase();
  const r = theme === 'kami' ? 3 : 8;
  for (const rect of svg.querySelectorAll('rect.actor')) {
    rect.setAttribute('rx', String(r));
    rect.setAttribute('ry', String(r));
  }
}

function styleSequenceLoopLines(svg) {
  if (!svg) return;
  let solid = '#8a8a8e';
  let dashed = '#5c5c60';
  try {
    const tid = (typeof currentDiagramTheme === 'function')
      ? currentDiagramTheme()
      : (document.documentElement.dataset.diagramTheme || 'default');
    if (window.MermaidSequenceThemes && typeof MermaidSequenceThemes.frameColors === 'function') {
      const f = MermaidSequenceThemes.frameColors(tid);
      if (f && f.solid) solid = f.solid;
      if (f && f.dashed) dashed = f.dashed;
    }
  } catch (_e) {}
  for (const l of svg.querySelectorAll('line.loopLine')) {
    const dash = l.style.strokeDasharray || l.getAttribute('stroke-dasharray') || '';
    const color = dash && dash !== 'none' ? dashed : solid;
    l.setAttribute('stroke', color);
    l.style.stroke = color;
  }
}

function styleSequenceNotes(svg) {
  if (!svg) return;
  // Sticky note: size box from real text bounds + L/R padding, then dog-ear.
  const fold = 14;
  const padX = 14; // half of prior 28
  for (const rect of [...svg.querySelectorAll('rect.note')]) {
    const g = rect.parentElement;
    if (!g || rect.getAttribute('data-dogear') === '1') continue;
    const y = Number(rect.getAttribute('y'));
    const h = Number(rect.getAttribute('height'));
    if (![y, h].every(Number.isFinite) || h < fold * 2) continue;

    const texts = [...g.querySelectorAll('text.noteText')];
    let minX = Infinity;
    let maxX = -Infinity;
    for (const t of texts) {
      try {
        const bb = t.getBBox();
        if (bb && bb.width > 0) {
          minX = Math.min(minX, bb.x);
          maxX = Math.max(maxX, bb.x + bb.width);
          continue;
        }
      } catch (_) {}
      // fallback if getBBox fails
      const tx = Number(t.getAttribute('x'));
      const approx = ((t.textContent || '').length * 7.2);
      const anchor = t.getAttribute('text-anchor') || 'middle';
      if (anchor === 'middle') {
        minX = Math.min(minX, tx - approx / 2);
        maxX = Math.max(maxX, tx + approx / 2);
      } else {
        minX = Math.min(minX, tx);
        maxX = Math.max(maxX, tx + approx);
      }
    }
    // If measurement failed, fall back to Mermaid rect + fixed pad.
    let x;
    let w;
    if (Number.isFinite(minX) && maxX > minX) {
      x = minX - padX;
      w = (maxX - minX) + padX * 2;
    } else {
      const x0 = Number(rect.getAttribute('x'));
      const w0 = Number(rect.getAttribute('width'));
      if (![x0, w0].every(Number.isFinite)) continue;
      x = x0 - padX;
      w = w0 + padX * 2;
    }
    if (w < fold * 2) continue;

    const fill = rect.getAttribute('fill') || '#EDF2AE';
    const stroke = rect.getAttribute('stroke') || '#666';
    const cls = rect.getAttribute('class') || 'note';

    const body = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    body.setAttribute('class', cls);
    body.setAttribute('data-dogear', '1');
    body.setAttribute('fill', fill);
    body.setAttribute('stroke', stroke);
    body.setAttribute('stroke-width', rect.getAttribute('stroke-width') || '1');
    body.setAttribute(
      'd',
      `M ${x} ${y} L ${x + w - fold} ${y} L ${x + w} ${y + fold} L ${x + w} ${y + h} L ${x} ${y + h} Z`
    );

    const ear = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    ear.setAttribute('class', 'noteDogear');
    ear.setAttribute('fill', shadeHex(fill, -0.18));
    ear.setAttribute('stroke', stroke);
    ear.setAttribute('stroke-width', '1');
    ear.setAttribute(
      'd',
      `M ${x + w - fold} ${y} L ${x + w} ${y + fold} L ${x + w - fold} ${y + fold} Z`
    );

    const crease = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    crease.setAttribute('class', 'noteDogearCrease');
    crease.setAttribute('fill', 'none');
    crease.setAttribute('stroke', stroke);
    crease.setAttribute('stroke-opacity', '0.45');
    crease.setAttribute('stroke-width', '1');
    crease.setAttribute('d', `M ${x + w - fold} ${y} L ${x + w - fold} ${y + fold} L ${x + w} ${y + fold}`);

    g.insertBefore(body, rect);
    g.insertBefore(ear, rect);
    g.insertBefore(crease, rect);
    rect.remove();
  }
}

function shadeHex(hex, delta) {
  // delta in [-1,1]; negative = darker. Falls back to a muted yellow-gray.
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return '#c9c98a';
  const n = parseInt(m[1], 16);
  const ch = (i) => {
    let v = (n >> (8 * (2 - i))) & 255;
    v = Math.max(0, Math.min(255, Math.round(v + delta * 255)));
    return v;
  };
  return `#${[ch(0), ch(1), ch(2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
function fixSvgIntrinsic(svg) {
  if (!svg) return;
  // Kill width="100%" / max-width stretching (common on sequenceDiagram).
  // Prefer Mermaid viewBox pixel size; fall back to getBBox.
  const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
    svg.setAttribute('width', String(Math.ceil(vb[2])));
    svg.setAttribute('height', String(Math.ceil(vb[3])));
  } else {
    try {
      const bb = svg.getBBox();
      if (bb && bb.width && bb.height) {
        const pad = 8;
        svg.setAttribute('viewBox', `${bb.x - pad} ${bb.y - pad} ${bb.width + pad * 2} ${bb.height + pad * 2}`);
        svg.setAttribute('width', String(Math.ceil(bb.width + pad * 2)));
        svg.setAttribute('height', String(Math.ceil(bb.height + pad * 2)));
      }
    } catch (_) {}
  }
  svg.style.width = 'auto';
  svg.style.height = 'auto';
  svg.style.maxWidth = 'none';
}

function centerView() {
  if (document.documentElement.dataset.drawerMode === 'board') { fitBoardView(); flushDrawerUiSave(); return; }
  // Default adaptive size vs canvas: keep the larger side in [50%, 90%].
  // Too big → shrink to 90%; too small → grow to 50%; else keep intrinsic (1).
  scale = 1;
  panX = 0;
  panY = 0;
  applyTransform();
  requestAnimationFrame(() => {
    const content = previewEl.querySelector('svg, .board-render');
    if (!content) return;
    const wrap = stageEl.getBoundingClientRect();
    const box = content.getBoundingClientRect();
    if (!box.width || !box.height || !wrap.width || !wrap.height) return;
    const rawW = box.width / (scale || 1);
    const rawH = box.height / (scale || 1);
    const dominant = Math.max(rawW / wrap.width, rawH / wrap.height);
    if (dominant > 0.9) scale = 0.9 / dominant;
    else if (dominant < 0.5) scale = 0.5 / dominant;
    else scale = 1;
    scale = Math.max(0.2, Math.min(3, scale));
    applyTransform();
    requestAnimationFrame(() => {
      const box2 = content.getBoundingClientRect();
      panX += (wrap.left + wrap.width / 2) - (box2.left + box2.width / 2);
      panY += (wrap.top + wrap.height / 2) - (box2.top + box2.height / 2);
      applyTransform();
    });
  });
}
function pinTopLeft() { centerView(); } // compat alias
function fitView() {
  if (document.documentElement.dataset.drawerMode === 'board') { fitBoardView(); return; }
  const content = previewEl.querySelector('svg, .board-render');
  if (!content) return;
  const wrap = stageEl.getBoundingClientRect();
  const box = content.getBoundingClientRect();
  const rawW = box.width / (scale || 1);
  const rawH = box.height / (scale || 1);
  if (!rawW || !rawH) return;
  scale = Math.max(0.2, Math.min((wrap.width - 96) / rawW, (wrap.height - 120) / rawH, 2.5));
  panX = 48; panY = 72;
  applyTransform();
}

// resize sheet
(() => {
  const handle = $('#resize');
  let drag = false;
  handle.addEventListener('pointerdown', (e) => {
    drag = true; handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', (e) => {
    if (!drag) return; syncSheetCssVar();
    const x = Math.min(560, Math.max(280, e.clientX));
    document.documentElement.style.setProperty('--side', x + 'px');
  });
  handle.addEventListener('pointerup', () => { drag = false; });
})();


let chromeTimer = null;

/* === 07-chrome-boot.js === */
/* drawer-app/07-chrome-boot.js — lines 3337-3886 of former inline module */
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
  scale = Math.min(3, Math.max(0.2, scale * factor));
  applyTransform();
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
  // Pan only on blank stage/canvas — not boxes, items, title, edges, mermaid hits, or chrome.
  // Mindmap nodes are handled separately (press = select, drag = pan while keeping selection).
  if (e.target.closest && e.target.closest("#boardTitlePin, .board-title-node, .board-zone, .board-item, .board-edge, .board-edge-label, .board-slot.is-link, .board-inspector, .board-dock, .props-panel, .top-float, .zoom-float, .menu, .sheet, button, input, select, textarea, label, g.node, g.cluster, g.cluster-label, g.edgePath, g.edgeLabel, g.flowchart-link, path.flowchart-link, path.mermaid-edge-hit, g.mindmap-node, g.statediagram-state, g.statediagram-cluster, g.stateGroup, path.transition")) return;
  if (document.documentElement.dataset.drawerMode === "mermaid" && document.documentElement.dataset.mermaidMindmap === "1" && typeof MindmapEdit !== "undefined" && MindmapEdit.selectionFromDom && MindmapEdit.selectionFromDom(e.target)) return;
  if (document.documentElement.dataset.drawerMode === "mermaid" && typeof FlowchartEdit !== "undefined" && FlowchartEdit.selectionFromDom && FlowchartEdit.selectionFromDom(e.target, sourceEl && sourceEl.value)) return;
  if (document.documentElement.dataset.drawerMode === "mermaid" && document.documentElement.dataset.mermaidState === "1" && typeof StateEdit !== "undefined" && StateEdit.selectionFromDom && StateEdit.selectionFromDom(e.target, sourceEl && sourceEl.value)) return;
  // Clicks outside the content bbox land on the stage (preview is max-content) — whole stage is canvas.
  panBlankMindmap = false;
  if (document.documentElement.dataset.drawerMode === "board") {
    if (boardLinkMode) setBoardLinkMode(false);
    else clearBoardSelection();
  } else if (document.documentElement.dataset.drawerMode === "mermaid") {
    if (mermaidLinkMode) setMermaidLinkMode(false);
    else if (document.documentElement.dataset.mermaidMindmap === "1") {
      // Mindmap: defer blank deselect until pointerup — drag pan keeps selection.
      panBlankMindmap = true;
    } else {
      clearMermaidSelection();
    }
  } else if (currentDockTab()) {
    openDock("");
    try { MermaidInspect.clearPropsShown(); } catch (_e) {}
  }
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
  var blankMm = panBlankMindmap;
  var moved = panMoved;
  panning = false; panOrigin = null; panBlankMindmap = false; panMoved = false;
  stageEl.classList.remove('panning');
  try { var sel = window.getSelection && window.getSelection(); if (sel && sel.removeAllRanges) sel.removeAllRanges(); } catch (_) {}
  if (blankMm && !moved) clearMermaidSelection();
  if (wasPanning && moved) {
    flushDrawerUiSave();
    if (typeof noteUserCanvasView === "function") noteUserCanvasView();
  } else if (wasPanning && !blankMm) {
    flushDrawerUiSave();
  }
});
stageEl.addEventListener('selectstart', (e) => {
  if (panning) e.preventDefault();
});

sourceEl.addEventListener('input', () => {
  setTypeUI(sourceEl.value);
  scheduleRender();
  scheduleSave();
});
boardSourceEl.addEventListener('input', () => {
  if (typeof updateBoardChars === "function") updateBoardChars();
  scheduleBoardRender();
  scheduleBoardSave();
});

$('#btnRender').onclick = () => void renderDiagram({ fit: false });

$('#btnClear').onclick = () => {
  sourceEl.value = '';
  try { sessionStorage.removeItem(SVG_CACHE_KEY); } catch (_) {}
  showEmpty(); setTypeUI('', { clearTools: true }); setStatus('Cleared');
  scheduleSave();
};

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
const exportMenu = $('#exportMenu');
const exportBtn = $('#btnExportMenu');
function closeExportMenu() {
  exportMenu.classList.remove('open');
  exportBtn.setAttribute('aria-expanded', 'false');
}
exportBtn.onclick = (e) => {
  e.stopPropagation();
  const open = !exportMenu.classList.contains('open');
  exportMenu.classList.toggle('open', open);
  exportBtn.setAttribute('aria-expanded', String(open));
};
document.addEventListener('click', (e) => {
  if (!exportMenu.contains(e.target)) closeExportMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeExportMenu();
});
$('#btnCopySrc').onclick = () => { copyText(sourceEl.value, 'Source'); showCopyTip('Copied successfully'); closeExportMenu(); };

$('#btnZoomIn').onclick = () => { scale = Math.min(3, scale * 1.08); applyTransform(); flushDrawerUiSave(); if (typeof noteUserCanvasView === "function") noteUserCanvasView(); };
$('#btnZoomOut').onclick = () => { scale = Math.max(0.2, scale / 1.08); applyTransform(); flushDrawerUiSave(); if (typeof noteUserCanvasView === "function") noteUserCanvasView(); };
$('#btnZoomReset').onclick = () => { centerView(); if (typeof forgetDocumentView === "function") forgetDocumentView(); };
window.addEventListener("resize", () => { applyTransform(); });
$('#btnFit').onclick = fitView;
/* $('#btnTheme') removed */

function syncModeBtn() {
  const board = document.documentElement.dataset.drawerMode === 'board';
  const tabM = $('#tabMermaid');
  const tabB = $('#tabBoard');
  if (tabM) tabM.setAttribute('aria-selected', String(!board));
  if (tabB) tabB.setAttribute('aria-selected', String(board));
}

// —— Canvas toolbar: diagram theme + export + UI theme (visible in Board & Mermaid) ——

const DIAGRAM_THEME_KEY = 'drawer.diagramTheme';
function currentDiagramTheme() {
  const legacy = localStorage.getItem('drawer.boardTheme');
  const v = localStorage.getItem(DIAGRAM_THEME_KEY) || legacy || 'default';
  if (window.BoardThemes && typeof BoardThemes.resolveId === 'function') return BoardThemes.resolveId(v);
  const allowed = ['default', 'classic', 'pastel', 'kami'];
  return allowed.includes(v) ? v : 'default';
}
function mermaidThemeForDiagram(theme) {
  // Unified diagram themes → Mermaid.js theme ids (keep original neutral as default)
  const id = (window.BoardThemes && typeof BoardThemes.resolveId === 'function') ? BoardThemes.resolveId(theme) : theme;
  if (id === 'pastel') return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'neutral';
  if (id === 'classic') return 'base';
  return 'neutral';
}
function isFlowchartSource(text) {
  const t = String(diagramType(text) || '').toLowerCase();
  return t === 'flowchart' || t === 'graph';
}

/** State diagram: convert curved transition paths to orthogonal polylines (折线). */
function polishStateTransitions(svg) {
  if (!svg) return;
  var paths = svg.querySelectorAll('path.transition');
  if (!paths.length) return;
  function parseEnd(d) {
    // last explicit point: Lx,y or endpoint of final C (last two nums are end)
    var m = String(d || '').trim();
    if (!m) return null;
    var nums = m.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
    if (!nums || nums.length < 2) return null;
    return { x: Number(nums[nums.length - 2]), y: Number(nums[nums.length - 1]) };
  }
  function parseStart(d) {
    var m = /^M\s*(-?\d*\.?\d+(?:e[-+]?\d+)?)\s*,\s*(-?\d*\.?\d+(?:e[-+]?\d+)?)/i.exec(String(d || '').trim());
    if (!m) return null;
    return { x: Number(m[1]), y: Number(m[2]) };
  }
  function orthoPath(a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    if (Math.abs(dx) < 1.5) {
      return 'M' + a.x + ',' + a.y + 'L' + b.x + ',' + b.y;
    }
    if (Math.abs(dy) < 1.5) {
      return 'M' + a.x + ',' + a.y + 'L' + b.x + ',' + b.y;
    }
    // Prefer mid-Y elbow (H then V then H) when mostly horizontal travel; else mid-X.
    var r = 8; // corner radius
    if (Math.abs(dx) >= Math.abs(dy)) {
      var midY = a.y + dy * 0.5;
      var x1 = a.x;
      var y1 = a.y;
      var x2 = b.x;
      var y2 = b.y;
      var sx = dx > 0 ? 1 : -1;
      var sy = (midY >= y1) ? 1 : -1;
      var sy2 = (y2 >= midY) ? 1 : -1;
      // M → vertical toward midY (leave r) → arc → horizontal → arc → vertical to end
      var v1 = midY - sy * r;
      var h2 = x2 - sx * r;
      // keep simple sharp 折线 first (clearer than rounded for review)
      return 'M' + x1 + ',' + y1 + 'L' + x1 + ',' + midY + 'L' + x2 + ',' + midY + 'L' + x2 + ',' + y2;
    }
    var midX = a.x + dx * 0.5;
    return 'M' + a.x + ',' + a.y + 'L' + midX + ',' + a.y + 'L' + midX + ',' + b.y + 'L' + b.x + ',' + b.y;
  }
  Array.prototype.forEach.call(paths, function(p) {
    var d = p.getAttribute('d') || '';
    if (!d || d.indexOf('C') < 0) return; // already line-ish or empty
    var a = parseStart(d);
    var b = parseEnd(d);
    if (!a || !b) return;
    if (Math.hypot(b.x - a.x, b.y - a.y) < 4) return; // degenerate
    p.setAttribute('d', orthoPath(a, b));
  });
}


/** State diagram UI polish — outer shell + title divider; no inner nested box. */
function polishStateDiagram(svg) {
  if (!svg) return;
  var NS = 'http://www.w3.org/2000/svg';

  // Leaf state nodes: round label-container only (skip empty label rects).
  svg.querySelectorAll('g.node.statediagram-state > rect.basic.label-container, g.node.statediagram-state > rect.label-container').forEach(function(r) {
    try {
      r.setAttribute('rx', '8');
      r.setAttribute('ry', '8');
      r.style.strokeWidth = r.style.strokeWidth || '1.25px';
    } catch (_e) {}
  });

  // Composite clusters: keep outer rounded shell; drop inner box; title divider only.
  svg.querySelectorAll('g.statediagram-cluster, g.cluster').forEach(function(cluster) {
    try {
      var outer = cluster.querySelector('rect.outer') || cluster.querySelector('g > rect');
      var inner = cluster.querySelector('rect.inner');
      if (outer) {
        outer.setAttribute('rx', '10');
        outer.setAttribute('ry', '10');
        outer.style.strokeWidth = outer.style.strokeWidth || '1.25px';
      }
      if (inner) {
        // Hide nested content frame (was overlapping outer rounded box).
        inner.setAttribute('visibility', 'hidden');
        inner.style.display = 'none';
        // Divider under title row (inner.y is the title/content split).
        var x = parseFloat(inner.getAttribute('x') || (outer && outer.getAttribute('x')) || '0');
        var y = parseFloat(inner.getAttribute('y') || '0');
        var w = parseFloat(inner.getAttribute('width') || (outer && outer.getAttribute('width')) || '0');
        if (isFinite(x) && isFinite(y) && isFinite(w) && w > 0) {
          var old = cluster.querySelector('line.state-title-divider');
          if (old) old.remove();
          var line = document.createElementNS(NS, 'line');
          line.setAttribute('class', 'state-title-divider');
          line.setAttribute('x1', String(x));
          line.setAttribute('x2', String(x + w));
          line.setAttribute('y1', String(y));
          line.setAttribute('y2', String(y));
          // Insert after outer / before label if possible
          if (inner.parentNode) inner.parentNode.insertBefore(line, inner);
          else cluster.appendChild(line);
        }
      }
    } catch (_e) {}
  });

  // Leaf labels: no clip + vertical center inside the rounded box.
  svg.querySelectorAll('g.node.statediagram-state').forEach(function(node) {
    try {
      var box = node.querySelector('rect.basic.label-container, rect.label-container');
      var label = node.querySelector('g.label');
      var fo = node.querySelector('foreignObject');
      if (!box || !fo) return;
      fo.style.overflow = 'visible';
      var div = fo.querySelector('div');
      if (div) {
        div.style.overflow = 'visible';
        div.style.maxWidth = 'none';
        div.style.lineHeight = '1.25';
        div.style.verticalAlign = 'middle';
      }
      var p = fo.querySelector('p');
      if (p) {
        p.style.margin = '0';
        p.style.overflow = 'visible';
        p.style.lineHeight = '1.25';
      }
      var span = fo.querySelector('.nodeLabel, span, p');
      var needW = 0;
      var needH = 0;
      if (span && span.getBoundingClientRect) {
        var br = span.getBoundingClientRect();
        needW = Math.ceil(br.width) + 4;
        needH = Math.ceil(br.height) + 2;
      }
      var curW = parseFloat(fo.getAttribute('width') || '0');
      var curH = parseFloat(fo.getAttribute('height') || '0');
      if (isFinite(needW) && needW > curW + 1) {
        fo.setAttribute('width', String(needW));
        curW = needW;
      }
      if (isFinite(needH) && needH > curH + 1) {
        fo.setAttribute('height', String(needH));
        curH = needH;
      }
      var bw = parseFloat(box.getAttribute('width') || '0');
      var bh = parseFloat(box.getAttribute('height') || '0');
      var bx = parseFloat(box.getAttribute('x') || '0');
      var by = parseFloat(box.getAttribute('y') || '0');
      var padX = 16;
      var padY = 14;
      var nbw = Math.max(bw, curW + padX);
      var nbh = Math.max(bh, curH + padY);
      if (isFinite(nbw) && isFinite(nbh)) {
        box.setAttribute('width', String(nbw));
        box.setAttribute('height', String(nbh));
        box.setAttribute('x', String(-nbw / 2));
        box.setAttribute('y', String(-nbh / 2));
        if (label) {
          label.setAttribute('transform', 'translate(' + (-curW / 2) + ', ' + (-curH / 2) + ')');
        }
      }
    } catch (_e) {}
  });
  // Cluster title labels: overflow visible only
  svg.querySelectorAll('g.statediagram-cluster foreignObject, g.cluster-label foreignObject').forEach(function(fo) {
    try {
      fo.style.overflow = 'visible';
      var p = fo.querySelector('p');
      if (p) p.style.margin = '0';
    } catch (_e) {}
  });

  // Edge labels: transparent plate + light paint halo (no white box)
  svg.querySelectorAll('g.edgeLabel .labelBkg, g.edgeLabel rect').forEach(function(el) {
    try {
      el.setAttribute('fill', 'transparent');
      el.style.fill = 'transparent';
      el.style.fillOpacity = '0';
      el.style.background = 'transparent';
    } catch (_e) {}
  });
  svg.querySelectorAll('g.edgeLabel foreignObject div, g.edgeLabel foreignObject .labelBkg').forEach(function(el) {
    try {
      el.style.background = 'transparent';
      el.style.backgroundColor = 'transparent';
    } catch (_e) {}
  });
  svg.querySelectorAll('g.edgeLabel text, g.edgeLabel span, .edgeLabel foreignObject div').forEach(function(el) {
    try {
      el.style.paintOrder = 'stroke fill';
      el.style.stroke = 'rgba(255,255,255,0.85)';
      el.style.strokeWidth = '3px';
      el.style.strokeLinejoin = 'round';
    } catch (_e) {}
  });
  // Transition stroke weight
  svg.querySelectorAll('path.transition').forEach(function(p) {
    try {
      var sw = parseFloat(p.style.strokeWidth || p.getAttribute('stroke-width') || '1');
      if (!isFinite(sw) || sw < 1.15) p.style.strokeWidth = '1.35px';
    } catch (_e) {}
  });
  // Start / end markers stay crisp
  svg.querySelectorAll('g.state-start circle, .state-start circle').forEach(function(c) {
    try { c.style.strokeWidth = '0'; } catch (_e) {}
  });
}

function isMindmapSource(text) {
  return String(diagramType(text) || '').toLowerCase() === 'mindmap';
}
function isSequenceSource(text) {
  return String(diagramType(text) || '').toLowerCase() === 'sequencediagram';
}
function isStateSource(text) {
  var t = String(diagramType(text) || '').toLowerCase();
  return t === 'statediagram' || t === 'statediagram-v2';
}
function mermaidSiteOptions(theme, text) {
  const id = (window.BoardThemes && typeof BoardThemes.resolveId === 'function')
    ? BoardThemes.resolveId(theme)
    : theme;
  const options = {
    startOnLoad: false,
    securityLevel: 'loose',
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
      rightAngles: false,
    },
    class: { useMaxWidth: false },
    state: { useMaxWidth: false, padding: 16 },
    er: { useMaxWidth: false },
    mindmap: { useMaxWidth: false, padding: 18 },
  };
  // Flowchart / state: ELK orthogonal edges (Cursor Mermaid Preview parity).
  if (typeof isFlowchartSource === 'function' && isFlowchartSource(text)) {
    options.layout = 'elk';
  }
  if (typeof isStateSource === 'function' && isStateSource(text) && window.MermaidStateThemes) {
    const vars = Object.assign({}, MermaidStateThemes.variables(id), { background: 'transparent' });
    options.theme = 'base';
    options.fontFamily = vars.fontFamily || 'Inter, SF Pro Text, system-ui, sans-serif';
    options.themeVariables = vars;
    options.layout = 'elk';
    return options;
  }
  if (typeof isStateSource === 'function' && isStateSource(text)) {
    options.layout = 'elk';
  }
  if (isFlowchartSource(text) && window.MermaidFlowchartThemes) {
    const vars = Object.assign({}, MermaidFlowchartThemes.variables(id), { background: 'transparent' });
    options.theme = 'base';
    options.fontFamily = vars.fontFamily;
    options.themeVariables = vars;
    return options;
  }
  if (isSequenceSource(text) && window.MermaidSequenceThemes) {
    const vars = Object.assign({}, MermaidSequenceThemes.variables(id), { background: 'transparent' });
    options.theme = 'base';
    options.fontFamily = vars.fontFamily || 'Inter, SF Pro Text, system-ui, sans-serif';
    options.themeVariables = vars;
    return options;
  }
  // Mindmap: avoid Mermaid "neutral" washed edges on the grid — use default (colored sections).
  if (isMindmapSource(text)) {
    options.theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default';
    options.fontFamily = 'Inter, SF Pro Text, system-ui, sans-serif';
    options.themeVariables = { background: 'transparent' };
    return options;
  }
  options.theme = mermaidThemeForDiagram(id);
  options.fontFamily = 'Inter, SF Pro Text, system-ui, sans-serif';
  // All Mermaid diagram types: no solid diagram plate — sit on the shared grid canvas.
  options.themeVariables = Object.assign({}, options.themeVariables || {}, { background: 'transparent' });
  return options;
}
function applyMermaidSiteConfig(theme) {
  const t = theme || currentDiagramTheme();
  const text = sourceEl ? sourceEl.value : '';
  if (!window.mermaid || !window.mermaid.initialize) return;
  window.mermaid.initialize(mermaidSiteOptions(t, text));
}
function reinitMermaidForDiagramTheme(theme) {
  try { applyMermaidSiteConfig(theme); } catch (_) {}
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
function persistMermaidStyle(patch) {
  if (!sourceEl || !sourceEl.value.trim()) return;
  if (document.documentElement.dataset.drawerMode === 'board') return;
  if (typeof DrawerStyleLine === 'undefined' || typeof BoardRender === 'undefined') return;
  if (typeof BoardRender.encodeStylePayload !== 'function' || typeof BoardRender.decodeStylePayload !== 'function') return;
  try {
    var doc = splitDocument(sourceEl.value);
    var styled = DrawerStyleLine.splitRendererStyle(doc.body);
    var token = DrawerStyleLine.applyMermaidStylePatch(
      styled.token,
      patch || {},
      BoardRender.encodeStylePayload,
      BoardRender.decodeStylePayload
    );
    var next = joinDocument(doc.meta, DrawerStyleLine.joinRendererStyle(token, styled.body));
    if (next !== sourceEl.value) {
      sourceEl.value = next;
      if (typeof setTypeUI === 'function') setTypeUI(next);
      if (typeof scheduleSave === 'function') scheduleSave();
    }
  } catch (_e) {}
}
function applyMermaidDocumentStyle(body) {
  var styled = (typeof DrawerStyleLine !== 'undefined')
    ? DrawerStyleLine.splitRendererStyle(body)
    : { token: '', body: body };
  var theme = 'default';
  if (styled.token && typeof BoardRender !== 'undefined' && typeof BoardRender.decodeStylePayload === 'function') {
    var raw = BoardRender.decodeStylePayload(styled.token);
    if (window.BoardThemes && typeof BoardThemes.resolveId === 'function') theme = BoardThemes.resolveId(raw && raw.theme);
    else if (raw && ['default', 'classic', 'pastel', 'kami'].includes(raw.theme)) theme = raw.theme;
  }
  if (typeof applyDiagramTheme === 'function') applyDiagramTheme(theme, { persist: false, skipRender: true });
  else if (typeof applyMermaidSiteConfig === 'function') applyMermaidSiteConfig(theme);
  return styled.body;
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
  reinitMermaidForDiagramTheme(t);
  const mode = document.documentElement.dataset.drawerMode || 'mermaid';
  if (opts && opts.persist && mode === 'board' && typeof persistBoardStyle === 'function') {
    persistBoardStyle({ theme: t });
  }
  if (opts && opts.persist && mode !== 'board' && typeof persistMermaidStyle === 'function') {
    persistMermaidStyle({ theme: t });
  }
  if (opts && opts.skipRender) return;
  if (mode === 'board') {
    // Keep current zoom/pan when switching theme.
    // Skip while source is empty (init runs before bootstrapBoard).
    if (typeof renderBoard === 'function' && boardSourceEl && boardSourceEl.value.trim()) renderBoard({ fit: false });
  } else if (typeof renderDiagram === 'function' && sourceEl && sourceEl.value.trim()) {
    // Never render empty source on init — that called setTypeUI('') and hid Mermaid edit tools (toolbar flash).
    void renderDiagram({ fit: false });
  }
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

document.querySelectorAll("#mindmapLayoutSeg [data-mindmap-layout]").forEach(function(btn) {
  btn.addEventListener("click", function() {
    setMindmapLayout(btn.getAttribute("data-mindmap-layout"));
  });
});
try { syncMindmapLayoutSeg(); syncStyleLayoutSections(); } catch (_e) {}

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
  const mode = document.documentElement.dataset.drawerMode || 'mermaid';
  if (mode === 'board') return boardSourceEl ? boardSourceEl.value : '';
  return sourceEl ? sourceEl.value : '';
}
function activeSourcePath() {
  const mode = document.documentElement.dataset.drawerMode || 'mermaid';
  if (mode === 'board') return (typeof liveBoardPath === 'string' && liveBoardPath) ? liveBoardPath : '';
  if (typeof liveDiagramPath === 'string' && liveDiagramPath) return liveDiagramPath;
  if (typeof liveArchive === 'string' && liveArchive.startsWith('/')) return liveArchive;
  return '';
}
async function copyActiveSourcePath() {
  let path = activeSourcePath();
  if (!path) {
    try {
      const mode = document.documentElement.dataset.drawerMode || 'mermaid';
      const url = mode === 'board' ? './board.meta.json?ts=' + Date.now() : './diagram.meta.json?ts=' + Date.now();
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const meta = await res.json();
        if (mode === 'board' && typeof applyBoardLiveMeta === 'function') applyBoardLiveMeta(meta);
        else if (typeof applyLiveMeta === 'function') applyLiveMeta(meta);
        path = activeSourcePath();
      }
    } catch (_e) {}
  }
  if (!path) { showCopyTip('No file path'); return; }
  await copyText(path, 'Path');
}
$('#btnSourceCopyId') && ($('#btnSourceCopyId').onclick = () => {
  var id = typeof liveRecordId === "function" ? liveRecordId() : "";
  if (!id) { showCopyTip("No ID"); return; }
  void copyText(id, "ID");
});
$('#btnSourceCopy') && ($('#btnSourceCopy').onclick = () => {
  void copyText(activeSourceText(), "Source");
});
$('#btnCanvasCopySrc') && ($('#btnCanvasCopySrc').onclick = () => { void copyActiveSourcePath(); closeCanvasExport(); });
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
syncModeBtn();
if ($('#tabMermaid')) $('#tabMermaid').onclick = () => setMode('mermaid');
if ($('#tabBoard')) $('#tabBoard').onclick = () => setMode('board');

window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    if (document.documentElement.dataset.drawerMode === 'board') renderBoard();
    else void renderDiagram();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
    e.preventDefault();
    toggleSourceEntry();
  }
});


function setMode(mode, opts) {
  opts = opts || {};
  const mermaid = mode === 'mermaid';
  const next = mermaid ? 'mermaid' : 'board';
  if (!opts.restore && document.documentElement.dataset.drawerMode === next) return;
  var prevMode = document.documentElement.dataset.drawerMode || "";
  if (mermaid && prevMode === "board" && typeof flushBoardSave === "function") void flushBoardSave();
  var panelM = $('#panelMermaid');
  if (panelM) panelM.classList.toggle('active', mermaid);
  var panelBoard = $('#panelBoard');
  if (panelBoard) panelBoard.classList.toggle('active', !mermaid);
  document.documentElement.dataset.drawerMode = mermaid ? 'mermaid' : 'board';
  if (opts.persist !== false) saveDrawerUi({ mode: mermaid ? 'mermaid' : 'board' });
  syncModeBtn();
  try {
    if (mermaid) setTypeUI(sourceEl && sourceEl.value);
    else setTypeUI(boardSourceEl && boardSourceEl.value);
  } catch (_e) {}
  if (!mermaid) closeExportMenu();
  if (mermaid) {
    pinBoardTitle();
    if (!opts.restore) openDock("");
    // User switch and refresh → document style.viewport, else Fit.
    if (opts.restore) _drawerUiRestoreLock = true;
    var skipRender = !!(opts.restore && previewEl && previewEl.querySelector("svg"));
    var renderP = skipRender
      ? Promise.resolve()
      : Promise.resolve(renderDiagram({
          fit: false,
          restoreView: true,
        }));
    void renderP.then(function() {
      if (skipRender && typeof restoreOrFitDocumentView === "function") restoreOrFitDocumentView();
      else if (skipRender) applyTransform();
      // Reveal canvas only after transform is applied (kills left-flash on refresh).
      requestAnimationFrame(function () {
        clearDrawerBoot();
        if (opts.restore) {
          requestAnimationFrame(function() { _drawerUiRestoreLock = false; });
        }
      });
    }).catch(function() {
      clearDrawerBoot();
      if (opts.restore) _drawerUiRestoreLock = false;
    });
    setStatus('Mermaid mode');
  } else {
    // User switch and refresh → document style.viewport, else Fit.
    if (opts.restore) _drawerUiRestoreLock = true;
    var hasBoard = !!(previewEl && previewEl.querySelector(".board-render"));
    var skipBoard = !!(opts.restore && hasBoard);
    if (!skipBoard) {
      renderBoard({ fit: false, restoreView: true });
      if (typeof refreshBoardHistory === 'function') void refreshBoardHistory();
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
    setStatus('Board mode');
  }
}

setSyncUI('ok');
(function applyDrawerUiChrome() {
  var ui = loadDrawerUi();
  setSheetCollapsed(!!ui.sheetCollapsed, false);
})();
applyTransform();
restoreCachedSvg(); // mermaid-only; board skips so refresh does not flash Mermaid SVG
function restoreDrawerMode() {
  var ui = loadDrawerUi();
  var urlMode = new URLSearchParams(location.search).get("mode");
  var mode = (urlMode === "board" || urlMode === "mermaid") ? urlMode : (ui.mode || "mermaid");
  if (urlMode === "board" || urlMode === "mermaid") saveDrawerUi({ mode: urlMode });
  document.documentElement.dataset.drawerMode = mode;
  setMode(mode, { restore: true, persist: false });
  // Restore dock after mode chrome is applied (avoid open→close flash on refresh).
  try {
    var tab = ui.dockTab || "";
    if (tab === "export" || tab === "style" || tab === "source" || tab === "props" || (tab === "layout" && mode === "board")) {
      openDock(tab);
    }
  } catch (_e) {}
}
if (document.documentElement.dataset.drawerMode === "board") {
  await bootstrapBoard();
  restoreDrawerMode();
  void bootstrap();
} else {
  await bootstrap();
  await bootstrapBoard();
  restoreDrawerMode();
}
setInterval(() => { void loadPolled(); void loadBoardPolled(); }, 1500);

/* Mermaid history list */
(function wireMermaidHistory() {
  var btn = document.getElementById('btnHistoryRefresh');
  if (btn) btn.addEventListener('click', function() { void refreshMermaidHistory(); });
  // Fill as soon as possible (no 400ms empty→full height jump).
  void refreshMermaidHistory();
})();

/* Board history list */
(function wireBoardHistory() {
  var btn = document.getElementById('btnBoardHistoryRefresh');
  if (btn) btn.addEventListener('click', function() { void refreshBoardHistory(); });
  void refreshBoardHistory();
})();


/* === 08-source-lines.js === */
/* Logical line numbers beside #source and #boardSource. Wrapped display still one number. */
function sourceLineTwin() {
  var el = document.querySelector(".source-line-twin");
  if (el) return el;
  el = document.createElement("textarea");
  el.className = "source-line-twin";
  el.tabIndex = -1;
  el.setAttribute("aria-hidden", "true");
  document.body.appendChild(el);
  return el;
}
function sourceLineHeights(textarea) {
  var cs = getComputedStyle(textarea);
  var padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  var min = parseFloat(cs.lineHeight);
  if (!Number.isFinite(min) || min < 8) min = 19;
  var twin = sourceLineTwin();
  twin.style.boxSizing = cs.boxSizing;
  twin.style.width = textarea.clientWidth + "px";
  twin.style.font = cs.font;
  twin.style.lineHeight = cs.lineHeight;
  twin.style.letterSpacing = cs.letterSpacing;
  twin.style.wordSpacing = cs.wordSpacing;
  twin.style.tabSize = cs.tabSize;
  twin.style.padding = cs.padding;
  twin.style.border = "0";
  twin.style.whiteSpace = cs.whiteSpace;
  twin.style.overflowWrap = cs.overflowWrap;
  twin.style.wordBreak = cs.wordBreak;
  var lines = String(textarea.value).split("\n");
  var heights = [];
  var i;
  for (i = 0; i < lines.length; i++) {
    twin.value = lines[i].length ? lines[i] : " ";
    heights.push(Math.max(min, twin.scrollHeight - padY));
  }
  return heights;
}
function renderSourceGutter(gutter, heights) {
  var inner = gutter.querySelector(".source-gutter-inner");
  if (!inner) {
    inner = document.createElement("div");
    inner.className = "source-gutter-inner";
    gutter.appendChild(inner);
  }
  var n = heights.length;
  var digits = String(Math.max(1, n)).length;
  gutter.style.minWidth = (Math.max(2, digits) + 1.6) + "ch";
  var html = "";
  var i;
  for (i = 0; i < n; i++) {
    html += "<div class=\"source-gutter-line\" style=\"height:" + heights[i] + "px\">" + (i + 1) + "</div>";
  }
  inner.innerHTML = html;
}
function refreshSourceLineEditor(textarea, gutter) {
  if (!textarea || !gutter || textarea.clientWidth < 8) return;
  renderSourceGutter(gutter, sourceLineHeights(textarea));
  gutter.scrollTop = textarea.scrollTop;
}
function wireSourceLineEditor(textarea) {
  if (!textarea || textarea.dataset.sourceLinesWired === "1") return;
  var wrap = textarea.closest(".source-line-editor");
  var gutter = wrap && wrap.querySelector(".source-gutter");
  if (!wrap || !gutter) return;
  textarea.dataset.sourceLinesWired = "1";
  var ticking = false;
  var refresh = function() {
    ticking = false;
    refreshSourceLineEditor(textarea, gutter);
  };
  var schedule = function() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(refresh);
  };
  textarea.addEventListener("input", schedule);
  textarea.addEventListener("scroll", function() { gutter.scrollTop = textarea.scrollTop; });
  if (typeof ResizeObserver === "function") {
    var ro = new ResizeObserver(schedule);
    ro.observe(textarea);
    ro.observe(wrap);
  }
  var desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
  if (desc && desc.set && desc.get) {
    Object.defineProperty(textarea, "value", {
      configurable: true,
      get: function() { return desc.get.call(this); },
      set: function(next) { desc.set.call(this, next); schedule(); }
    });
  }
  schedule();
}
wireSourceLineEditor(typeof sourceEl !== "undefined" ? sourceEl : document.getElementById("source"));
wireSourceLineEditor(typeof boardSourceEl !== "undefined" ? boardSourceEl : document.getElementById("boardSource"));
