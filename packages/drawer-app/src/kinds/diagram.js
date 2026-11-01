/* Opened-document host: kind dispatch, render, hash save. */
import BoxesRender from '../../../boxes/index.js';
import MindmapEdit from '../../../mermaid-ext/mindmap/index.js';
import { register, emit, call } from '../core/hooks.js';
import DrawerStyleLine from '../core/style-line.js';
import { applyGround } from '../core/workspace-ground.js';
import { applyChrome } from '../core/appearance-chrome.js';
import FlowchartTypeScale from '../core/flowchart-type-scale.js';
import DrawerPeleTheme from '../core/pele-theme.js';
import DrawerEarlyHead from '../core/early-head.js';
import { stripDocumentMeta, blankHashBoardSource } from '../core/document-meta.js';
import { diagramPersistMode, encodeDiagramHash, decodeDiagramHash } from '../core/hash-persist.js';
import { cloudDiagramIdFromHash, cloudShareIdFromHash, cloudShortLinkIdFromHash } from '../core/cloud-route.js';
import { renderSketch } from './sketch.js';
import { fillDesignProps } from './design.js';
import { currentMindmapLayout, restoreMindmapSelection, fillMindmapProps } from './mindmap.js';
import { applyMindmapSelectionVisual } from './mindmap-select.js';
import { FlowchartShapes } from './flowchart-shapes.js';
import { restoreFlowchartSelection } from './flowchart.js';
import {
  $,
  previewEl,
  diagramSourceEl,
  propsEmpty,
  setKindUI,
  setStatus,
  showDiagramError,
  updateDiagramChars,
  applyTransform,
  applyRestoredDiagramView,
  fitDiagramView,
  applyDiagramLiveMeta,
  syncSourceDockLabel,
  headerByteString,
  diagramLocalRev,
  diagramServerRev,
  diagramDirty,
  diagramSaveSeq,
  diagramRenderTimer,
  diagramSaveTimer,
  liveDiagramId,
  setDiagramLocalRev,
  setDiagramServerRev,
  setDiagramDirty,
  setDiagramSaveTimer,
  bumpDiagramSaveSeq,
  setDiagramRenderTimer,
} from '../state/shell-state.js';


function clearDrawerBoot() {
  document.documentElement.removeAttribute('data-drawer-boot');
}

var diagramSwapSeq = 0;
var diagramRenderToken = 0;

// Hide the drawing before a whole-diagram replace. The dotted canvas stays.
// No drawing yet (first paint): leave it to the boot hide.
// Every paint bumps the seq so a replaced iframe cannot leave hold stuck.
function holdDiagramSwap(opts) {
  opts = opts || {};
  var html = document.documentElement;
  var preview = typeof previewEl !== "undefined" ? previewEl : null;
  diagramSwapSeq += 1;
  if (!opts.swap || !html || !preview || !preview.childElementCount) {
    if (html && html.dataset.diagramSwap) delete html.dataset.diagramSwap;
    return;
  }
  opts.swapToken = diagramSwapSeq;
  html.dataset.diagramSwap = "hold";
}

// Camera is applied on the second frame. Arm the fade then, and show on the next.
function releaseDiagramSwap(opts) {
  if (!opts || !opts.swapToken) return;
  var token = opts.swapToken;
  opts.swapToken = 0;
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      var html = document.documentElement;
      if (!html || token !== diagramSwapSeq || html.dataset.diagramSwap !== "hold") return;
      html.dataset.diagramSwap = "arm";
      requestAnimationFrame(function () {
        if (token !== diagramSwapSeq || html.dataset.diagramSwap !== "arm") return;
        html.dataset.diagramSwap = "in";
        setTimeout(function () {
          if (token !== diagramSwapSeq) return;
          if (html.dataset.diagramSwap === "in") delete html.dataset.diagramSwap;
        }, 180);
      });
    });
  });
}
function pinDiagramTitle() {
  var pin = call("boardTitlePinEl");
  if (pin) { pin.hidden = true; pin.innerHTML = ""; }
  var kind = document.documentElement.dataset.kind || "";
  if (kind && kind !== "boxes") {
    if (document.title !== "Lulu Board") document.title = "Lulu Board";
    return;
  }
  var title = "";
  try {
    title = String((BoxesRender.parse(diagramSourceEl.value) || {}).title || "").trim();
  } catch (_) {}
  if (!title) {
    var heading = previewEl && previewEl.querySelector(".board-title-node h2, .board-html-header h2");
    title = heading ? String(heading.textContent || "").trim() : "";
  }
  var next = title || "Lulu Board";
  if (document.title !== next) document.title = next;
}

function sourceBodyForKind(text) {
  var raw = String(text == null ? "" : text);
  try { raw = stripDocumentMeta(raw); } catch (_e) {}
  if (DrawerStyleLine.splitRendererStyle) {
    raw = DrawerStyleLine.splitRendererStyle(raw).body;
  }
  return raw;
}

function applyDrawerKind(kind) {
  var html = document.documentElement;
  if (!html) return;
  html.dataset.kind = kind === "empty" ? "" : String(kind || "");
  if (kind === "flowchart" || isDesignKind(kind)) html.dataset.pele = "1";
  else delete html.dataset.pele;
  // Chrome CSS is gated on data-drawer-mode=diagram. Keep that; kind switches tools/render.
  if (!html.dataset.drawerMode) html.dataset.drawerMode = "diagram";
  setKindUI();
  if (propsEmpty) {
    propsEmpty.textContent = kind === "flowchart"
      ? "Select a group, node, or link"
      : (kind === "mindmap" ? "Select a topic" : (kind === "sketch" ? "Sketch" : "Select a title, box, or item"));
  }
  var flowProps = document.getElementById("flowchartPropsFields");
  if (flowProps && kind !== "flowchart") flowProps.hidden = true;
  var flowDir = document.getElementById("flowchartDirField");
  if (flowDir && kind !== "flowchart") flowDir.hidden = true;
  var flowTitle = document.getElementById("flowchartDocTitleField");
  if (flowTitle && kind !== "flowchart") flowTitle.hidden = true;
  var mmProps = document.getElementById("mindmapPropsFields");
  if (mmProps && kind !== "mindmap") mmProps.hidden = true;
  var mmTitle = document.getElementById("mindmapDocTitleField");
  if (mmTitle && kind !== "mindmap") mmTitle.hidden = true;
  var mmLayout = document.getElementById("mindmapLayoutField");
  if (mmLayout && kind !== "mindmap") mmLayout.hidden = true;
  var designTitle = document.getElementById("designDocTitleField");
  if (designTitle && !isDesignKind(kind)) designTitle.hidden = true;
}

var PELE_VIEW_SCALE = 1.5;

function fixSvgIntrinsic(svg, viewScale) {
  if (!svg) return;
  var vb = String(svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
  var k = isFinite(viewScale) && viewScale > 0 ? viewScale : 1;
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
    svg.setAttribute("width", String(Math.ceil(vb[2] * k)));
    svg.setAttribute("height", String(Math.ceil(vb[3] * k)));
  }
  // Do not write svg.style.* — on this host that rebuilds the style
  // attribute and drops Pele's --_s / --_fg aliases (nodes paint black).
}

function bindCanvasWorld(rootEl, boundsFn) {
  call("setWorld", rootEl || null, boundsFn || null);
}

function canvasSvgBounds(svg) {
  if (!svg) return null;
  var w = parseFloat(svg.getAttribute("width") || "");
  var h = parseFloat(svg.getAttribute("height") || "");
  if (!(w > 0 && h > 0) && svg.viewBox && svg.viewBox.baseVal) {
    w = svg.viewBox.baseVal.width;
    h = svg.viewBox.baseVal.height;
  }
  if (!(w > 0 && h > 0)) return null;
  return { minX: 0, minY: 0, maxX: w, maxY: h, width: w, height: h, cx: w / 2, cy: h / 2 };
}

function previewHasPaint(root) {
  return !!(root && root.querySelector(".board-render, iframe.sketch-frame, svg"));
}

function documentAppearance() {
  var token = DrawerStyleLine.splitRendererStyle(diagramSourceEl ? diagramSourceEl.value : "").token;
  return DrawerStyleLine.appearanceFromStyleToken(token);
}

function applyDocumentGround() {
  var appearance = documentAppearance();
  if (typeof applyGround === "function") applyGround(document.documentElement, appearance);
  if (typeof applyChrome === "function") applyChrome(document.documentElement, appearance);
}

function finishCanvasView(opts) {
  opts = opts || {};
  applyDocumentGround();
  try {
    if (opts.fit) {
      fitDiagramView();
    } else if (opts.restoreView) {
      applyRestoredDiagramView();
    } else {
      applyTransform();
    }
    pinDiagramTitle();
  } finally {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { clearDrawerBoot(); });
    });
    releaseDiagramSwap(opts);
  }
}

function syncMermaidStyleChrome(body) {
  if (!DrawerStyleLine) return;
  var styled = DrawerStyleLine.splitRendererStyle(body);
  var theme = DrawerStyleLine.appearanceFromStyleToken(styled.token);
  var step = DrawerStyleLine.typeStepFromStyleToken(styled.token);
  emit("applyKindTheme", theme, { persist: false, skipRender: true });
  emit("applyBoardTypeStep", step, false, false);
}

var PELE_FONT_STACK = '"SF Pro Text", "SF Pro Display", Inter, system-ui, -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", sans-serif';

function isDesignKind(kind) {
  return DrawerStyleLine.isDesignKind ? DrawerStyleLine.isDesignKind(kind) : false;
}

function paintPeleSvg(opts, paint) {
  opts = opts || {};
  paint = paint || {};
  var label = paint.label || "diagram";
  emit("syncBoardEditControls");
  previewEl.classList.remove("board-preview");
  syncMermaidStyleChrome(diagramSourceEl ? diagramSourceEl.value : "");
  var body = sourceBodyForKind(diagramSourceEl.value);
  updateDiagramChars();
  if (!body.trim()) {
    previewEl.innerHTML = "";
    bindCanvasWorld(null, null);
    showDiagramError("");
    setStatus("No " + label + " source");
    finishCanvasView(opts);
    return;
  }
  if (!window.pele || typeof window.pele.render !== "function") {
    previewEl.innerHTML = "";
    bindCanvasWorld(null, null);
    showDiagramError("Pele renderer missing");
    setStatus("Pele renderer missing", true);
    finishCanvasView(opts);
    return;
  }
  try {
    var typeStep = 0;
    if (DrawerStyleLine) {
      typeStep = DrawerStyleLine.typeStepFromStyleToken(
        DrawerStyleLine.splitRendererStyle(diagramSourceEl ? diagramSourceEl.value : "").token
      );
    }
    var peleFont = FlowchartTypeScale
      ? FlowchartTypeScale.px("default", typeStep)
      : 16;
    var result = window.pele.render(body.trim(), {
      fontFamily: PELE_FONT_STACK,
      fontSize: peleFont,
      autoDirection: false,
      responsive: false,
    });
    previewEl.innerHTML = result && result.svg ? result.svg : "";
    var svg = previewEl.querySelector("svg");
    fixSvgIntrinsic(svg, PELE_VIEW_SCALE);
    bindCanvasWorld(svg, function () { return canvasSvgBounds(svg); });
    if (typeof paint.afterPaint === "function") paint.afterPaint(typeStep);
    if (DrawerPeleTheme && typeof DrawerPeleTheme.polishBoxes === "function") {
      DrawerPeleTheme.polishBoxes(previewEl);
    }
    showDiagramError("");
    setStatus((label.charAt(0).toUpperCase() + label.slice(1)) + " rendered · " + new Date().toLocaleTimeString());
  } catch (err) {
    previewEl.innerHTML = "";
    bindCanvasWorld(null, null);
    showDiagramError(err instanceof Error ? err.message : String(err));
    setStatus("Invalid " + label + " source", true);
  }
  finishCanvasView(opts);
}

function renderFlowchart(opts) {
  paintPeleSvg(opts, {
    label: "flowchart",
    afterPaint: function (typeStep) {
      if (FlowchartShapes) FlowchartShapes.polishFlowchartNodeShapes(previewEl);
      if (FlowchartTypeScale) FlowchartTypeScale.applyToRoot(previewEl, typeStep);
      restoreFlowchartSelection();
    },
  });
}

function renderDesignPele(opts) {
  paintPeleSvg(opts, { label: "diagram" });
  fillDesignProps();
}

function refuseUnsupportedMermaid(opts) {
  emit("syncBoardEditControls");
  previewEl.classList.remove("board-preview");
  previewEl.innerHTML = "";
  bindCanvasWorld(null, null);
  updateDiagramChars();
  showDiagramError("This diagram type cannot be rendered.");
  setStatus("This diagram type cannot be rendered.", true);
  finishCanvasView(opts || {});
}

function renderMindmap(opts) {
  opts = opts || {};
  emit("syncBoardEditControls");
  previewEl.classList.remove("board-preview");
  syncMermaidStyleChrome(diagramSourceEl ? diagramSourceEl.value : "");
  var body = sourceBodyForKind(diagramSourceEl.value);
  updateDiagramChars();
  if (!body.trim()) {
    previewEl.innerHTML = "";
    bindCanvasWorld(null, null);
    showDiagramError("");
    setStatus("No mindmap source");
    finishCanvasView(opts);
    return;
  }
  if (typeof MindmapEdit === "undefined" || !MindmapEdit || typeof MindmapEdit.render !== "function") {
    previewEl.innerHTML = "";
    bindCanvasWorld(null, null);
    showDiagramError("Mindmap renderer missing");
    setStatus("Mindmap renderer missing", true);
    finishCanvasView(opts);
    return;
  }
  try {
    var theme = "light";
    if (DrawerStyleLine) {
      theme = DrawerStyleLine.appearanceFromStyleToken(
        DrawerStyleLine.splitRendererStyle(diagramSourceEl ? diagramSourceEl.value : "").token
      ) || "light";
    }
    var layout = currentMindmapLayout();
    var result = MindmapEdit.render(body, { layout: layout, theme: theme, id: "mm" });
    if (result && result.errors && result.errors.length && !result.svg) {
      throw new Error(result.errors.join("; "));
    }
    previewEl.innerHTML = result && result.svg ? result.svg : "";
    var svg = previewEl.querySelector("svg");
    fixSvgIntrinsic(svg);
    bindCanvasWorld(svg, function () { return canvasSvgBounds(svg); });
    showDiagramError("");
    setStatus("Mindmap rendered · " + new Date().toLocaleTimeString());
    restoreMindmapSelection();
    fillMindmapProps();
    applyMindmapSelectionVisual();
  } catch (err) {
    previewEl.innerHTML = "";
    bindCanvasWorld(null, null);
    showDiagramError(err instanceof Error ? err.message : String(err));
    setStatus("Invalid mindmap source", true);
  }
  finishCanvasView(opts);
}

function renderDiagram(opts) {
  opts = opts || {};
  holdDiagramSwap(opts);
  var renderToken = ++diagramRenderToken;
  var body = sourceBodyForKind(diagramSourceEl ? diagramSourceEl.value : "");
  var kind = DrawerStyleLine.bodyKind
    ? DrawerStyleLine.bodyKind(body)
    : (DrawerStyleLine.bodyIsBoard && DrawerStyleLine.bodyIsBoard(body) ? "boxes" : "unknown");
  applyDrawerKind(kind);
  if (kind === "flowchart") return renderFlowchart(opts);
  if (kind === "mindmap") return renderMindmap(opts);
  if (kind === "sketch") return renderSketch(opts);
  if (isDesignKind(kind)) return renderDesignPele(opts);
  if (kind === "mermaid-unsupported") return refuseUnsupportedMermaid(opts);
  emit("syncBoardEditControls");
  previewEl.classList.add('board-preview');
  const text = diagramSourceEl.value.trim(); updateDiagramChars();
  if (!text) { previewEl.innerHTML = ''; bindCanvasWorld(null, null); pinDiagramTitle(); showDiagramError(''); setStatus('No Board source'); clearDrawerBoot(); releaseDiagramSwap(opts); return; }
  BoxesRender.render(text, previewEl).then((rendered) => {
    if (renderToken !== diagramRenderToken) return;
    try {
      var worldRoot = rendered && rendered.root && rendered.root.querySelector
        ? (rendered.root.classList && rendered.root.classList.contains("board-canvas")
          ? rendered.root
          : rendered.root.querySelector(".board-canvas"))
        : null;
      bindCanvasWorld(worldRoot, function () {
        return typeof BoxesRender !== "undefined" && typeof BoxesRender.worldBounds === "function"
          ? BoxesRender.worldBounds(rendered.root)
          : null;
      });
      emit("syncBoardLinkRouteButton"); emit("wireBoardCanvas", rendered.root, rendered.board); emit("wireBoardDrag", rendered.root, rendered.board); emit("applyBoardSelection", rendered.root, rendered.board, true); var retained = Array.from(rendered.root.querySelectorAll("[data-board-key]")).find(function(el) { return el.dataset.boardKey === call("boardDomSelectionKey", diagramSourceEl.dataset.boardSelectionKey); }); if (retained) retained.classList.add("board-selection", "canvas-selected");
      // Repaint the live root after any mode/bootstrap render race.
      if (rendered && rendered.root && rendered.root.isConnected && rendered.frames) rendered.frames.forEach((frame, id) => { const el = rendered.root.querySelector("[data-board-id=\"" + id + "\"]"); if (!el || el.dataset.boardNested === "1") return; el.style.left = frame.x + "px"; el.style.top = frame.y + "px"; el.style.width = frame.w + "px"; var grow = el.dataset.boardType === "note" || el.dataset.boardType === "layout" || el.dataset.boardType === "container"; if (grow) { el.style.minHeight = frame.h + "px"; el.style.height = "auto"; } else { el.style.minHeight = ""; el.style.height = frame.h + "px"; } });
      showDiagramError(''); setStatus(`Board rendered · ${new Date().toLocaleTimeString()}`);
      applyDocumentGround();
      emit("syncBoardStyleChrome", rendered.board);
      emit("applyBoardThemeToPreview");
      if (opts.fit) {
        fitDiagramView();
      } else if (opts.restoreView) {
        applyRestoredDiagramView();
      } else {
        applyTransform();
      }
    } finally {
      pinDiagramTitle();
      // Two frames: let pin/title + item frame rects settle while stage still opacity:0.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { clearDrawerBoot(); });
      });
      releaseDiagramSwap(opts);
    }
  }).catch((err) => {
    if (renderToken !== diagramRenderToken) return;
    pinDiagramTitle();
    clearDrawerBoot();
    releaseDiagramSwap(opts);
    showDiagramError(err instanceof Error ? err.message : String(err)); setStatus('Invalid Board source', true);
  });
}
function scheduleDiagramRender() { clearTimeout(diagramRenderTimer); setDiagramRenderTimer(setTimeout(renderDiagram, 220)); }
function setDiagramSyncUI(state = 'ok') { const pill = $('#diagramSyncPill'); if (!pill) return; const label = state === 'saving' ? 'saving' : state === 'error' ? 'error' : state === 'conflict' ? 'conflict' : 'rev'; pill.className = 'pill ' + (state === 'ok' ? 'ok' : 'warn'); pill.innerHTML = `${label} <b>${diagramLocalRev}</b>`; }
// Cloud saves hit Supabase; debounce them longer than local/URL saves.
function diagramSaveDelay() { return call("cloudDiagramId") ? 3000 : 350; }
function bumpClientRevIfSynced() {
  var server = Number(diagramServerRev);
  var client = Number(diagramLocalRev);
  if (Number.isFinite(server) && server > 0 && server === client) {
    setDiagramLocalRev(server + 1);
    syncSourceDockLabel();
  }
  emit("syncCloudSaveChrome");
}
function scheduleDiagramSave() {
  setDiagramDirty(true);
  bumpClientRevIfSynced();
  clearTimeout(diagramSaveTimer);
  if (call("isShareGuest")) {
    setDiagramSaveTimer(null);
    emit("syncCloudSaveChrome");
    return;
  }
  if (call("cloudPlusDraftActive")) {
    setDiagramSaveTimer(setTimeout(function () {
      void saveDiagramToHash().then(function () {
        if (!call("cloudPlusDraftActive") || !diagramSourceEl) return;
        emit("cloudPlusDraftSet", diagramSourceEl.value, Number(diagramLocalRev) || 1);
      });
    }, diagramSaveDelay()));
    return;
  }
  setDiagramSyncUI('saving');
  setDiagramSaveTimer(setTimeout(() => void saveDiagramToFile(), diagramSaveDelay()));
}
function flushDiagramSave() {
  if (call("isShareGuest")) {
    clearTimeout(diagramSaveTimer);
    setDiagramSaveTimer(null);
    return Promise.resolve();
  }
  if (!diagramDirty && !diagramSaveTimer) return Promise.resolve();
  clearTimeout(diagramSaveTimer);
  setDiagramSaveTimer(null);
  return saveDiagramToFile();
}
if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("pagehide", function() { void flushDiagramSave(); });
if (typeof document !== "undefined" && document.addEventListener) document.addEventListener("visibilitychange", function() {
  if (document.visibilityState === "hidden") void flushDiagramSave();
});
async function saveDiagramToHash(opts) {
  opts = opts || {};
  setDiagramSaveTimer(null);
  var text = stripDocumentMeta(diagramSourceEl.value);
  if (diagramSourceEl && text !== diagramSourceEl.value) diagramSourceEl.value = text;
  const seq = bumpDiagramSaveSeq();
  try {
    if (opts.bump !== false) setDiagramLocalRev((Number(diagramLocalRev) || 0) + 1);
    else if (!(Number(diagramLocalRev) > 0)) setDiagramLocalRev(1);
    const token = await encodeDiagramHash(text, diagramLocalRev);
    if (seq !== diagramSaveSeq) return;
    const next = "#" + token;
    if (location.hash !== next) {
      history.replaceState(null, "", location.pathname + location.search + next);
    }
    setDiagramDirty(false);
    syncSourceDockLabel();
    emit("syncCloudSaveChrome");
    setDiagramSyncUI("ok");
    setStatus("Saved in URL");
  } catch (err) {
    setDiagramSyncUI("error");
    setStatus(err instanceof Error ? err.message : String(err), true);
  }
}
async function saveDiagramToFile() {
  // Clear the timer on every path; a stale id here blocks hashchange/poll loads forever.
  setDiagramSaveTimer(null);
  if (diagramPersistMode() === "hash") {
    if (call("isShareGuest")) {
      return Promise.resolve();
    }
    if (call("cloudDiagramId")) {
      return call("saveDiagramToCloud", { explicit: false });
    }
    return saveDiagramToHash();
  }
  var text = stripDocumentMeta(diagramSourceEl.value);
  if (diagramSourceEl && text !== diagramSourceEl.value) diagramSourceEl.value = text;
  const seq = bumpDiagramSaveSeq(), baseRev = diagramLocalRev;
  try {
    const headers = {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Board-Rev': String(baseRev),
      'X-Board-Via': 'ui',
      'X-Board-Label': 'docker-sbx-board',
    };
    if (liveDiagramId) headers['X-Board-Id'] = liveDiagramId;
    headers['X-Board-Title'] = headerByteString(call("getDiagramTitle", call("cloudOpenDiagramId")));
    const res = await fetch('./board.bmd', { method: 'PUT', headers, body: text });
    if (seq !== diagramSaveSeq) return;
    if (res.status === 409) { const payload = await res.json(); setDiagramLocalRev(Number(payload.version != null ? payload.version : payload.rev) || diagramLocalRev); setDiagramDirty(false); if (typeof payload.source === 'string') { diagramSourceEl.value = stripDocumentMeta(payload.source); renderDiagram(); } setDiagramSyncUI('conflict'); setStatus(`Board version conflict → loaded v ${diagramLocalRev}`, true); return; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setDiagramLocalRev(Number(res.headers.get('X-Board-Rev')) || baseRev + 1); setDiagramDirty(false); setDiagramSyncUI('ok');
    setStatus(`Board saved v ${diagramLocalRev}`);
    try {
      const metaRes = await fetch(`./board.meta.json?ts=${Date.now()}`, { cache: 'no-store' });
      if (metaRes.ok) applyDiagramLiveMeta(await metaRes.json());
    } catch (_e) {}
  } catch (err) { setDiagramSyncUI('error'); setStatus(err instanceof Error ? err.message : String(err), true); }
}
async function loadDiagramPolled() {
  if (diagramPersistMode() === "hash") return;
  if (diagramDirty || diagramSaveTimer) return;
  try {
    const metaRes = await fetch(`./board.meta.json?ts=${Date.now()}`, { cache: 'no-store' }); if (!metaRes.ok) return;
    const meta = await metaRes.json(), remoteRev = Number(meta.version != null ? meta.version : meta.rev) || 0;
    applyDiagramLiveMeta(meta);
    if (remoteRev <= diagramLocalRev) { setDiagramSyncUI('ok'); return; }
    const res = await fetch(`./board.bmd?ts=${Date.now()}`, { cache: 'no-store' }); if (!res.ok) return;
    var text = await res.text();
    text = stripDocumentMeta(text);
    setDiagramLocalRev(Number(res.headers.get('X-Board-Rev')) || remoteRev); setDiagramDirty(false);
    if (diagramSourceEl.value !== text) { diagramSourceEl.value = text; renderDiagram({ fit: false }); setStatus(`Board loaded r${diagramLocalRev}`); }
    setDiagramSyncUI('ok');
  } catch (_) {}
}
function shouldWaitForCreateKind() {
  if (typeof document !== "undefined" && document.documentElement && document.documentElement.dataset.blankStartKind === "1") {
    return true;
  }
  if (!DrawerEarlyHead) return false;
  var ctx = {
    pathname: typeof location !== "undefined" ? location.pathname : "/",
    hash: typeof location !== "undefined" ? location.hash : "",
    search: typeof location !== "undefined" ? location.search : "",
    storage: DrawerEarlyHead.safeStorage(typeof globalThis !== "undefined" ? globalThis : this),
  };
  if (DrawerEarlyHead.isLegalHash(ctx.hash)) return false;
  if (DrawerEarlyHead.shouldBlankStart(ctx)) return true;
  return !!(DrawerEarlyHead.isAuthReturn && DrawerEarlyHead.isAuthReturn(ctx.search));
}

async function bootstrapDiagramFromHash() {
  var raw = String(location.hash || "").replace(/^#/, "");
  if (cloudDiagramIdFromHash(raw)) {
    await call("loadCloudDiagramByHash", raw);
    return;
  }
  if (cloudShareIdFromHash(raw)) {
    await call("loadSharedDiagramByHash", raw);
    return;
  }
  if (cloudShortLinkIdFromHash(raw)) {
    await call("loadShortLinkByHash", raw);
    return;
  }
  if (!raw) {
    emit("setShareView", false);
    emit("setShareEdit", false);
    if (shouldWaitForCreateKind()) {
      if (diagramSourceEl) diagramSourceEl.value = "";
      setDiagramLocalRev(1);
      setDiagramServerRev(0);
      applyDiagramLiveMeta({ id: "", version: 1 });
      setStatus("Choose a type");
      return;
    }
    diagramSourceEl.value = blankHashBoardSource("Untitled");
    setDiagramLocalRev(1);
    setDiagramServerRev(0);
    applyDiagramLiveMeta({ id: "", version: 1 });
    await saveDiagramToHash({ bump: false });
    setStatus("New diagram");
    return;
  }
  try {
    emit("setShareView", false);
    emit("setShareEdit", false);
    var decoded = await decodeDiagramHash(raw);
    var body = stripDocumentMeta(decoded.bmd);
    diagramSourceEl.value = body;
    setDiagramLocalRev(Number(decoded.version) || 1);
    setDiagramServerRev(0);
    applyDiagramLiveMeta({
      id: "",
      version: diagramLocalRev,
    });
    syncSourceDockLabel();
  } catch (err) {
    diagramSourceEl.value = "";
    showDiagramError(err instanceof Error ? err.message : String(err));
    setStatus("Could not read board from URL", true);
  }
}
async function bootstrapDiagram() {
  if (diagramPersistMode() === "hash") {
    await bootstrapDiagramFromHash();
  } else {
    try { const res = await fetch('./board.bmd', { cache: 'no-store' }); if (res.ok) { var loaded = await res.text(); diagramSourceEl.value = stripDocumentMeta(loaded); setDiagramLocalRev(Number(res.headers.get('X-Board-Rev')) || 0); } else diagramSourceEl.value = ''; }
    catch (_) { diagramSourceEl.value = ''; }
    try {
      const metaRes = await fetch(`./board.meta.json?ts=${Date.now()}`, { cache: 'no-store' });
      if (metaRes.ok) applyDiagramLiveMeta(await metaRes.json());
    } catch (_e) {}
  }
  setDiagramDirty(false); updateDiagramChars(); setDiagramSyncUI('ok');
  if (diagramSourceEl.value.trim()) {
    await new Promise(function (resolve) {
      var done = false;
      var finish = function () { if (done) return; done = true; resolve(); };
      try {
        renderDiagram({ fit: false, restoreView: true });
        // Boxes, sketch, and Pele/mindmap each paint a different root.
        var turns = 0;
        (function wait() {
          if (previewHasPaint(previewEl)) return finish();
          if (++turns > 120) return finish();
          requestAnimationFrame(wait);
        })();
      } catch (_e) { finish(); }
    });
  }
}

register("finishCanvasView", finishCanvasView);
register("pinDiagramTitle", pinDiagramTitle);
register("renderDiagram", renderDiagram);
register("scheduleDiagramSave", scheduleDiagramSave);
register("setDiagramSyncUI", setDiagramSyncUI);
register("saveDiagramToHash", saveDiagramToHash);
register("bootstrapDiagramFromHash", bootstrapDiagramFromHash);


export {
  clearDrawerBoot,
  holdDiagramSwap,
  releaseDiagramSwap,
  previewHasPaint,
  pinDiagramTitle,
  sourceBodyForKind,
  applyDrawerKind,
  bindCanvasWorld,
  finishCanvasView,
  renderFlowchart,
  renderDesignPele,
  refuseUnsupportedMermaid,
  renderMindmap,
  renderDiagram,
  scheduleDiagramRender,
  setDiagramSyncUI,
  scheduleDiagramSave,
  flushDiagramSave,
  saveDiagramToHash,
  saveDiagramToFile,
  loadDiagramPolled,
  shouldWaitForCreateKind,
  bootstrapDiagramFromHash,
  bootstrapDiagram,
};

export default {
  renderDiagram,
  scheduleDiagramSave,
  finishCanvasView,
  bootstrapDiagram,
};
