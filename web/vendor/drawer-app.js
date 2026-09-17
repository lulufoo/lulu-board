/* === 00-style-line.js === */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DrawerStyleLine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var RENDERER_STYLE_RE = /^style\s+(\S+)\s*$/i;

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
    for (var i = 0; i < lines.length; i += 1) {
      var trim = String(lines[i] || "").trim();
      if (!token) {
        var hit = RENDERER_STYLE_RE.exec(trim);
        if (hit) {
          token = hit[1];
          continue;
        }
      }
      out.push(lines[i]);
    }
    return { token: token, body: out.join("\n") };
  }

  function joinRendererStyle(token, body) {
    var rest = String(body == null ? "" : body);
    var t = String(token || "").trim();
    if (!t) return rest;
    var line = "style " + t;
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

  return {
    RENDERER_STYLE_RE: RENDERER_STYLE_RE,
    isRendererStyleLine: isRendererStyleLine,
    bodyIsBoard: bodyIsBoard,
    splitRendererStyle: splitRendererStyle,
    joinRendererStyle: joinRendererStyle,
    authoredViewport: authoredViewport,
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
  root.newBoardId = api.newBoardId;
  root.blankHashBoardSource = api.blankHashBoardSource;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var META_LINE = /^meta\s+(\S+|{.*})\s*$/;
  var ID_RE = /^b_[0-9a-f]{8}$/;

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
    var rest = String(body == null ? "" : body);
    var line = "meta " + encodeMetaPayload({ id: id, version: Number(meta.version) });
    if (rest.charAt(0) === "\n") return line + rest;
    if (rest) return line + "\n" + rest;
    return line + "\n";
  }

  function sourceBody(text) {
    var raw = String(text == null ? "" : text);
    if (!raw.trim()) return "";
    return splitDocument(raw).body;
  }

  function newBoardId() {
    var bytes;
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      bytes = new Uint8Array(4);
      crypto.getRandomValues(bytes);
    } else {
      bytes = require("crypto").randomBytes(4);
    }
    var hex = "";
    for (var i = 0; i < bytes.length; i += 1) hex += ("0" + bytes[i].toString(16)).slice(-2);
    return "b_" + hex;
  }

  function blankHashBoardSource(title) {
    var name = String(title == null ? "Untitled" : title).replace(/"/g, "");
    if (!name) name = "Untitled";
    return joinDocument({ id: newBoardId(), version: 1 }, "board \"" + name + "\"\n");
  }

  return {
    encodeMetaPayload: encodeMetaPayload,
    decodeMetaPayload: decodeMetaPayload,
    splitDocument: splitDocument,
    joinDocument: joinDocument,
    sourceBody: sourceBody,
    newBoardId: newBoardId,
    blankHashBoardSource: blankHashBoardSource,
  };
});
var splitDocument = globalThis.splitDocument;
var joinDocument = globalThis.joinDocument;
var sourceBody = globalThis.sourceBody;
var newBoardId = globalThis.newBoardId;
var blankHashBoardSource = globalThis.blankHashBoardSource;

/* === 00-hash-persist.js === */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DrawerHashPersist = api;
  root.boardPersistMode = api.boardPersistMode;
  root.encodeBoardHash = api.encodeBoardHash;
  root.decodeBoardHash = api.decodeBoardHash;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function boardPersistMode() {
    var doc = typeof document !== "undefined" ? document.documentElement : null;
    var forced = doc && doc.getAttribute("data-persist");
    if (forced === "hash" || forced === "local") return forced;
    var host = typeof location !== "undefined" ? String(location.hostname || "") : "";
    return host === "127.0.0.1" || host === "localhost" ? "local" : "hash";
  }

  function bytesToBase64Url(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
    var b64 = typeof btoa === "function" ? btoa(bin) : Buffer.from(bytes).toString("base64");
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlToBytes(token) {
    var b64 = String(token || "").replace(/-/g, "+").replace(/_/g, "/");
    var pad = b64.length % 4;
    if (pad) b64 += "====".slice(pad);
    if (typeof atob === "function") {
      var bin = atob(b64);
      var out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new Uint8Array(Buffer.from(b64, "base64"));
  }

  async function compressZlib(bytes) {
    if (typeof CompressionStream === "function") {
      var stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    return new Uint8Array(require("zlib").deflateSync(Buffer.from(bytes)));
  }

  async function decompressZlib(bytes) {
    if (typeof DecompressionStream === "function") {
      var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    return new Uint8Array(require("zlib").inflateSync(Buffer.from(bytes)));
  }

  async function encodeBoardHash(text) {
    var input = new TextEncoder().encode(String(text || ""));
    return "z:" + bytesToBase64Url(await compressZlib(input));
  }

  async function decodeBoardHash(raw) {
    var token = String(raw || "").replace(/^#/, "");
    if (token.indexOf("z:") !== 0) throw new Error("invalid board hash");
    var bytes = base64UrlToBytes(token.slice(2));
    if (!bytes.length) throw new Error("invalid board hash");
    var out = await decompressZlib(bytes);
    return new TextDecoder().decode(out);
  }

  return {
    boardPersistMode: boardPersistMode,
    encodeBoardHash: encodeBoardHash,
    decodeBoardHash: decodeBoardHash,
  };
});
var boardPersistMode = globalThis.boardPersistMode;
var encodeBoardHash = globalThis.encodeBoardHash;
var decodeBoardHash = globalThis.decodeBoardHash;

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
  var content = previewEl.querySelector(".board-render");
  if (!content) return null;
  var wrap = stageEl.getBoundingClientRect();
  var box = content.getBoundingClientRect();
  if (!wrap.width || !wrap.height || !box.width || !box.height) return null;
  return { x: box.left - wrap.left, y: box.top - wrap.top };
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
  var raw = boardSourceEl && boardSourceEl.value;
  try {
    var v = splitDocument(raw).meta.version;
    if (Number.isFinite(v) && v > 0) return v;
  } catch (_e) {}
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
  if (!previewEl) return;
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
function boardBoxScope(selection) {
  return selection && selection.scope === "tree" ? "tree" : "shell";
}
function boardBoxKey(id, scope) {
  return scope === "tree" ? "tree:" + id : "box:" + id;
}
function boardDomSelectionKey(key) {
  if (key && key.indexOf("tree:") === 0) return "box:" + key.slice(5);
  return key || "";
}
function boardWantsTreeSelect(event) {
  return !!(event && (event.metaKey || event.ctrlKey));
}
function boardTreeTargetEl(el) {
  if (!el) return null;
  if (el.classList.contains("board-item") && !el.classList.contains("board-root-item")) return el.closest(".board-zone");
  if (el.classList.contains("board-zone")) return el;
  return null;
}
function boardSelectionFromBoxEl(el, scope) {
  var id = el && el.dataset ? el.dataset.boardId : "";
  var nextScope = scope === "tree" ? "tree" : "shell";
  return { kind: "box", key: boardBoxKey(id, nextScope), id: id, scope: nextScope };
}
function boardSelectionWithId(selection, nextId) {
  var id = nextId ? String(nextId) : null;
  if (!selection) return selection;
  if (selection.kind === "box") return { kind: "box", key: boardBoxKey(id, boardBoxScope(selection)), id: id, scope: boardBoxScope(selection) };
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
/** Darken toward black; hue stays from live theme stroke. */
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
  document.querySelectorAll(".board-selection, .board-selection-tree").forEach(function(el) { el.classList.remove("board-selection", "board-selection-tree"); });
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
function applyBoardSelection(root, board, restoreFromDataset) { applyBoardEdgeSelection(root); if (selectedBoardEdge) { if (boardInspector) boardInspector.hidden = true; syncBoardEditControls(); return; } document.querySelectorAll(".board-selection, .board-selection-tree").forEach(function(el) { el.classList.remove("board-selection", "board-selection-tree"); }); if (restoreFromDataset && !selectedBoardNode && boardSourceEl.dataset.boardSelectionKey) { var parts = boardSourceEl.dataset.boardSelectionKey.split(":"); selectedBoardNode = parts[0] === "title" ? { kind: "title", key: "title:board" } : parts[0] === "tree" ? { kind: "box", key: boardSourceEl.dataset.boardSelectionKey, id: parts.slice(1).join(":"), scope: "tree" } : parts[0] === "box" ? { kind: "box", key: boardSourceEl.dataset.boardSelectionKey, id: parts.slice(1).join(":"), scope: "shell" } : boardItemSelectionFromKey(boardSourceEl.dataset.boardSelectionKey); } if (!selectedBoardNode || !root) { if (boardInspector) boardInspector.hidden = true; syncBoardEditControls(); return; } var matchKey = selectedBoardNode.kind === "box" ? "box:" + selectedBoardNode.id : selectedBoardNode.key; var match = Array.from(root.querySelectorAll("[data-board-key]")).find(function(el) { return el.dataset.boardKey === matchKey; });
  if (!match && selectedBoardNode.kind === "title") {
    match = (typeof boardPinnedTitleNode === "function" && boardPinnedTitleNode())
      || document.querySelector("#boardTitlePin [data-board-key=\"title:board\"]")
      || document.querySelector("#boardTitlePin .board-title-node, #boardTitlePin .board-html-header");
  }
  if (!match) { clearBoardSelection(); return; }
  match.classList.add("board-selection");
  if (selectedBoardNode.kind === "box" && selectedBoardNode.scope === "tree") {
    match.classList.add("board-selection-tree");
    match.querySelectorAll(".board-zone, .board-item").forEach(function(el) { el.classList.add("board-selection"); });
  }
  if (boardTitleEditor && selectedBoardNode) {
    var isTitle = selectedBoardNode.kind === "title";
    var isItem = selectedBoardNode.kind === "item";
    var node = isTitle ? { title: (board && board.title) || "", type: "board" } : boardNodeForSelection(board, selectedBoardNode);
    if (!node && !isTitle) { clearBoardSelection(); return; }
    boardInspector.hidden = false;
    hidePropsLinkOnlyChrome();
    if (propsEmpty) propsEmpty.hidden = true;
    if (propsFields) propsFields.hidden = false;
    if (propsKindLabel) propsKindLabel.textContent = isTitle ? "board" : (isItem ? "item" : (selectedBoardNode.scope === "tree" ? "box tree" : "box"));
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
          ? "Layout · ⌘/Ctrl-click selects the tree; Delete removes the shell, or the tree when the tree is selected"
          : (boxType === "container"
            ? "Container · ⌘/Ctrl-click selects the tree; Delete removes the shell, or the tree when the tree is selected"
            : "Box · ⌘/Ctrl-click selects the tree; Delete removes the shell, or the tree when the tree is selected")));
  } syncBoardEditControls(); }
function selectBoardElement(el, root, board, event) {
  if (!el) return clearBoardSelection();
  var isTitle = el.classList.contains("board-title-node") || el.classList.contains("board-html-header") || el.dataset.boardKind === "title" || (el.dataset.boardKey || "") === "title:board";
  var isItem = !isTitle && (el.classList.contains("board-item") || el.dataset.boardKind === "item" || (el.dataset.boardKey || "").indexOf("item:") === 0);
  var next;
  if (isTitle) next = { kind: "title", key: "title:board" };
  else if (boardWantsTreeSelect(event)) {
    var treeEl = boardTreeTargetEl(el);
    next = (treeEl && treeEl.dataset.boardId) ? boardSelectionFromBoxEl(treeEl, "tree") : (isItem ? boardItemSelectionFromEl(el) : boardSelectionFromBoxEl(el, "shell"));
  } else {
    next = isItem ? boardItemSelectionFromEl(el) : boardSelectionFromBoxEl(el, "shell");
  }
  if (next.key !== currentBoardSelectionKey() && !boardLinkMode) closePropsPanel();
  selectedBoardEdge = null;
  selectedBoardNode = next;
  delete boardSourceEl.dataset.boardEdgeSelectionKey;
  boardSourceEl.dataset.boardSelectionKey = selectedBoardNode.key;
  applyBoardSelection(root, board);
}
function pickBoardElement(el, root, board, event) {
  beginInspectGesture(selectionKeyFromEl(el));
  selectBoardElement(el, root, board, event);
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
    if (document.title !== "Lulu Board") document.title = "Lulu Board";
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
  var next = title || "Lulu Board";
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
      pickBoardElement(titleHit, root, board, event);
      event.stopPropagation();
      return;
    }
    if (boardWantsTreeSelect(event)) {
      var treeHit = itemHit || zoneHit;
      if (treeHit) {
        pickBoardElement(treeHit, root, board, event);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }
    var nestedItem = itemHit && !itemHit.classList.contains("board-root-item");
    var nestedBox = zoneHit && !boardBoxIsTopLevel(board, zoneHit.dataset.boardId);
    if (nestedItem || (nestedBox && !itemHit)) {
      var reorderEl = nestedItem ? itemHit : zoneHit;
      pickBoardElement(reorderEl, root, board, event);
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
      pickBoardElement(hit, root, board, event);
      event.stopPropagation();
      return;
    }
    pickBoardElement(hit, root, board, event);
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
      if (edge) { var edgeKey = edge.dataset.boardEdgeKey || (edge.dataset.boardEdgeIndex != null ? "link:" + edge.dataset.boardEdgeIndex : ""); if (consumeInspectClick(edgeKey)) inspectBoardSelection(); event.preventDefault(); event.stopPropagation(); if (event.stopImmediatePropagation) event.stopImmediatePropagation(); return; } }, true); canvas.addEventListener("click", function(event) { if (boardLinkMode) return; if (event.target.closest && event.target.closest(".board-edge, .board-edge-label, .board-slot.is-link")) return; var hit = event.target.closest(".board-title-node, .board-item, .board-zone"); if (!hit || !canvas.contains(hit)) { clearBoardSelection(); return; } var key = selectionKeyFromEl(hit); selectBoardElement(hit, root, board, event); if (consumeInspectClick(key)) inspectBoardSelection(); }); canvas.addEventListener("dblclick", function(event) { var hit = event.target.closest(".board-title-node, .board-item, .board-zone"); if (!hit || !canvas.contains(hit)) return; selectBoardElement(hit, root, board, event); inspectBoardSelection(); if (boardTitleEditor) { boardTitleEditor.focus(); boardTitleEditor.select(); } }); }

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
function commitBoardTitle() {
  if (!boardTitleEditor) return;
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
      syncBoardLinkRouteButton(); wireBoardCanvas(rendered.root, rendered.board); wireBoardDrag(rendered.root, rendered.board); applyBoardSelection(rendered.root, rendered.board, true); var retained = Array.from(rendered.root.querySelectorAll("[data-board-key]")).find(function(el) { return el.dataset.boardKey === boardDomSelectionKey(boardSourceEl.dataset.boardSelectionKey); }); if (retained) retained.classList.add("board-selection");
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
async function saveBoardToHash() {
  boardSaveTimer = null;
  const text = boardSourceEl.value;
  const seq = ++boardSaveSeq;
  try {
    const token = await encodeBoardHash(text);
    if (seq !== boardSaveSeq) return;
    const next = "#" + token;
    if (location.hash !== next) {
      history.replaceState(null, "", location.pathname + location.search + next);
    }
    boardDirty = false;
    boardLocalRev = (Number(boardLocalRev) || 0) + 1;
    setBoardSyncUI("ok");
    setStatus("Saved in URL");
  } catch (err) {
    setBoardSyncUI("error");
    setStatus(err instanceof Error ? err.message : String(err), true);
  }
}
async function saveBoardToFile() {
  if (typeof boardPersistMode === "function" && boardPersistMode() === "hash") {
    return saveBoardToHash();
  }
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
  if (typeof boardPersistMode === "function" && boardPersistMode() === "hash") return;
  if (boardDirty || boardSaveTimer) return;
  try {
    const metaRes = await fetch(`./board.meta.json?ts=${Date.now()}`, { cache: 'no-store' }); if (!metaRes.ok) return;
    const meta = await metaRes.json(), remoteRev = Number(meta.version != null ? meta.version : meta.rev) || 0;
    if (typeof applyBoardLiveMeta === 'function') applyBoardLiveMeta(meta);
    if (remoteRev <= boardLocalRev) { setBoardSyncUI('ok'); return; }
    const res = await fetch(`./board.bmd?ts=${Date.now()}`, { cache: 'no-store' }); if (!res.ok) return;
    const text = await res.text(); boardLocalRev = Number(res.headers.get('X-Board-Rev')) || remoteRev; boardDirty = false;
    if (boardSourceEl.value !== text) { boardSourceEl.value = text; renderBoard({ fit: false }); setStatus(`Board loaded r${boardLocalRev}`); }
    setBoardSyncUI('ok');
  } catch (_) {}
}
async function bootstrapBoardFromHash() {
  var raw = String(location.hash || "").replace(/^#/, "");
  if (!raw) {
    var blank = typeof blankHashBoardSource === "function"
      ? blankHashBoardSource("Untitled")
      : "board \"Untitled\"\n";
    boardSourceEl.value = blank;
    boardLocalRev = 0;
    try {
      var seeded = splitDocument(blank);
      if (typeof applyBoardLiveMeta === "function") {
        applyBoardLiveMeta({ id: seeded.meta.id, version: seeded.meta.version, title: "Untitled" });
      }
    } catch (_e) {}
    await saveBoardToHash();
    setStatus("New board");
    return;
  }
  try {
    boardSourceEl.value = await decodeBoardHash(raw);
    boardLocalRev = 1;
  } catch (err) {
    boardSourceEl.value = "";
    if (typeof showBoardError === "function") {
      showBoardError(err instanceof Error ? err.message : String(err));
    }
    setStatus("Could not read board from URL", true);
  }
}
async function bootstrapBoard() {
  if (typeof boardPersistMode === "function" && boardPersistMode() === "hash") {
    await bootstrapBoardFromHash();
  } else {
    try { const res = await fetch('./board.bmd', { cache: 'no-store' }); if (res.ok) { boardSourceEl.value = await res.text(); boardLocalRev = Number(res.headers.get('X-Board-Rev')) || 0; } else boardSourceEl.value = ''; }
    catch (_) { boardSourceEl.value = ''; }
    try {
      const metaRes = await fetch(`./board.meta.json?ts=${Date.now()}`, { cache: 'no-store' });
      if (metaRes.ok && typeof applyBoardLiveMeta === 'function') applyBoardLiveMeta(await metaRes.json());
    } catch (_e) {}
  }
  boardDirty = false; updateBoardChars(); setBoardSyncUI('ok');
  if (boardSourceEl.value.trim()) {
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


/* === 05-render-io.js === */
/* drawer-app/05-render-io.js — board copy helpers + board history */
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
  kind.textContent = fallbackKind === "board" ? "board" : (item.kind || fallbackKind || "board");
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
/* —— Board history list (reload without new archive) —— */
function boardHistoryFile(name) {
  name = String(name || "");
  if (name.indexOf(".bmd") >= 0) return name;
  if (/\.dsl$/.test(name)) return name.replace(/\.dsl$/, ".bmd");
  return name + ".bmd";
}
async function refreshBoardHistory() {
  if (typeof boardPersistMode === "function" && boardPersistMode() === "hash") return;
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


/* === 05-board-file.js === */
/* drawer-app/05-board-file.js — open a .bmd into the hash URL */
function boardTitleFromBody(body) {
  var hit = /^\s*board\s+"([^"]*)"/.exec(String(body || ""));
  return hit ? hit[1] : "";
}

function pickBoardSourceFile() {
  return new Promise(function (resolve, reject) {
    if (typeof window !== "undefined" && typeof window.showOpenFilePicker === "function") {
      window.showOpenFilePicker({
        types: [{ description: "Board file", accept: { "text/plain": [".bmd"] } }],
        multiple: false,
      }).then(function (handles) {
        if (!handles || !handles[0]) return resolve(null);
        return handles[0].getFile().then(function (file) {
          return file.text().then(resolve, reject);
        });
      }).catch(function (error) {
        if (error && error.name === "AbortError") resolve(null);
        else reject(error);
      });
      return;
    }
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".bmd,text/plain";
    input.hidden = true;
    var finish = function (text) {
      input.remove();
      resolve(text);
    };
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return finish(null);
      file.text().then(finish, function (error) {
        input.remove();
        reject(error);
      });
    });
    input.addEventListener("cancel", function () { finish(null); });
    document.body.appendChild(input);
    input.click();
  });
}

async function openBoardFile() {
  if (typeof boardPersistMode === "function" && boardPersistMode() !== "hash") return;
  var button = document.getElementById("btnHistoryOpenFile");
  if (button) button.disabled = true;
  try {
    var text = await pickBoardSourceFile();
    if (text == null) return;
    text = String(text);
    if (!text.trim()) throw new Error("Board file is empty");
    var doc = splitDocument(text);
    if (!boardSourceEl) throw new Error("Board source is missing");
    boardSourceEl.value = text;
    boardDirty = false;
    boardLocalRev = Number(doc.meta.version) || 1;
    if (typeof applyBoardLiveMeta === "function") {
      applyBoardLiveMeta({
        id: doc.meta.id,
        version: doc.meta.version,
        title: boardTitleFromBody(doc.body),
      });
    }
    if (typeof updateBoardChars === "function") updateBoardChars();
    if (typeof saveBoardToHash === "function") await saveBoardToHash();
    if (typeof renderBoard === "function") renderBoard({ fit: true });
    setStatus("Opened file");
    showCopyTip("Opened file");
  } catch (error) {
    console.error(error);
    setStatus((error && error.message) || "Open file failed", true);
    showCopyTip("Open file failed");
  } finally {
    if (button) button.disabled = false;
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
  return previewEl && previewEl.querySelector('.board-render');
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
      '.board-selection, .board-reorder-dragging, .board-reorder-caret'
    ),
  ];
  interactive.forEach((el) => {
    el.classList.remove(
      'board-selection',
      'board-reorder-dragging'
    );
  });
  root.querySelectorAll(
    '.board-edge-hit, .board-reorder-caret'
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

function exportBoardStem() {
  const title = typeof liveBoardTitle === "string" ? liveBoardTitle : "";
  const id = typeof liveRecordId === "function"
    ? liveRecordId()
    : (typeof liveBoardId === "string" ? liveBoardId : "");
  const path = typeof activeSourcePath === "function" ? activeSourcePath() : "";
  const fromPath = path ? String(path).split("/").pop().replace(/\.[^.]+$/, "") : "";
  return exportStem(title || fromPath || id, "board");
}

async function saveExportBlob(blob, filename, mime) {
  const name = String(filename || "board");
  const extMatch = name.match(/(\.[A-Za-z0-9]+)$/);
  const ext = extMatch ? extMatch[1] : "";
  if (typeof window !== "undefined" && typeof window.showSaveFilePicker === "function") {
    try {
      const accept = {};
      accept[mime || "application/octet-stream"] = ext ? [ext] : [];
      const handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: ext === ".png" ? "PNG image" : "Board file", accept }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "picker";
    } catch (error) {
      if (error && error.name === "AbortError") return "abort";
    }
  }
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
  return "download";
}

async function exportBoardFile() {
  const text = typeof activeSourceText === "function" ? activeSourceText() : "";
  if (!String(text).trim()) {
    setStatus("Nothing to export", true);
    return;
  }
  const result = await saveExportBlob(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
    exportBoardStem() + ".bmd",
    "text/plain"
  );
  if (result === "abort") return;
  const message = result === "picker" ? "File saved" : "File exported";
  setStatus(message);
  showCopyTip(message);
}

async function writePngExport(blob, stem) {
  return saveExportBlob(blob, String(stem || "board") + ".png", "image/png");
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

    const result = await writePngExport(await canvasToPngBlob(output), exportBoardStem());
    if (result === "abort") return;
    const message = result === "picker" ? "PNG saved" : "PNG exported";
    setStatus(message);
    showCopyTip(message);
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'PNG export failed', true);
    showCopyTip('PNG export failed');
  } finally {
    if (host) host.remove();
    if (button) button.disabled = false;
  }
}

/* === 07-chrome-boot.js === */
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

$('#btnZoomIn').onclick = () => { scale = Math.min(3, scale * 1.08); applyTransform(); flushDrawerUiSave(); if (typeof noteUserCanvasView === "function") noteUserCanvasView(); };
$('#btnZoomOut').onclick = () => { scale = Math.max(0.2, scale / 1.08); applyTransform(); flushDrawerUiSave(); if (typeof noteUserCanvasView === "function") noteUserCanvasView(); };
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
    if (boardDirty || boardSaveTimer) return;
    void bootstrapBoard().then(function() {
      if (typeof renderBoard === "function" && boardSourceEl && boardSourceEl.value.trim()) {
        renderBoard({ fit: false, restoreView: true });
      }
    });
  });
}

(function wireBoardHistory() {
  if (typeof boardPersistMode === "function" && boardPersistMode() === "hash") {
    var head = document.querySelector("#boardHistory .history-head");
    if (head) head.setAttribute("title", "~/.cache/board/history");
    return;
  }
  var btn = document.getElementById("btnBoardHistoryRefresh");
  if (btn) btn.addEventListener("click", function() { void refreshBoardHistory(); });
  void refreshBoardHistory();
})();


/* === 08-source-lines.js === */
/* Logical line numbers beside #boardSource. Wrapped display still one number. */
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
wireSourceLineEditor(typeof boardSourceEl !== "undefined" ? boardSourceEl : document.getElementById("boardSource"));
