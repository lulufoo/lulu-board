/* drawer-app/02-diagram.js — opened-document host: kind dispatch, render, hash save */

function clearDrawerBoot() {
  document.documentElement.removeAttribute('data-drawer-boot');
}
function pinDiagramTitle() {
  var pin = boardTitlePinEl();
  if (pin) { pin.hidden = true; pin.innerHTML = ""; }
  var kind = document.documentElement.dataset.kind || "";
  if (kind && kind !== "board") {
    if (document.title !== "Lulu Vela") document.title = "Lulu Vela";
    return;
  }
  var title = "";
  try {
    title = String((BoardRender.parse(diagramSourceEl.value) || {}).title || "").trim();
  } catch (_) {}
  if (!title) {
    var heading = previewEl && previewEl.querySelector(".board-title-node h2, .board-html-header h2");
    title = heading ? String(heading.textContent || "").trim() : "";
  }
  var next = title || "Lulu Vela";
  if (document.title !== next) document.title = next;
}

function sourceBodyForKind(text) {
  var raw = String(text == null ? "" : text);
  if (typeof stripDocumentMeta === "function") {
    try { raw = stripDocumentMeta(raw); } catch (_e) {}
  }
  if (typeof DrawerStyleLine !== "undefined" && DrawerStyleLine.splitRendererStyle) {
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
  if (typeof setKindUI === "function") setKindUI();
  else if (typeof syncStyleLayoutSections === "function") syncStyleLayoutSections();
  if (propsEmpty) {
    propsEmpty.textContent = kind === "flowchart"
      ? "Select a group, node, or link"
      : (kind === "mindmap" ? "Select a topic" : "Select a title, box, or item");
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
  if (typeof Canvas !== "undefined" && typeof Canvas.setWorld === "function") {
    Canvas.setWorld(rootEl || null, boundsFn || null);
  }
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

function finishCanvasView(opts) {
  opts = opts || {};
  if (opts.fit) {
    if (typeof fitDiagramView === "function") fitDiagramView();
    else if (typeof applyTransform === "function") applyTransform();
  } else if (opts.restoreView) {
    if (typeof applyRestoredDiagramView === "function") applyRestoredDiagramView();
    else if (typeof applyTransform === "function") applyTransform();
  } else if (typeof applyTransform === "function") {
    applyTransform();
  }
  if (typeof pinDiagramTitle === "function") pinDiagramTitle();
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { clearDrawerBoot(); });
  });
}

function syncMermaidStyleChrome(body) {
  if (typeof DrawerStyleLine === "undefined") return;
  var styled = DrawerStyleLine.splitRendererStyle(body);
  var theme = DrawerStyleLine.themeFromStyleToken(styled.token);
  var step = DrawerStyleLine.typeStepFromStyleToken(styled.token);
  if (typeof applyKindTheme === "function") {
    applyKindTheme(theme, { persist: false, skipRender: true });
  } else if (typeof applyPeleThemeVars === "function") {
    applyPeleThemeVars(theme);
  }
  if (typeof applyBoardTypeStep === "function") applyBoardTypeStep(step, false, false);
}

var PELE_FONT_STACK = '"SF Pro Text", "SF Pro Display", Inter, system-ui, -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", sans-serif';

function isDesignKind(kind) {
  return typeof DrawerStyleLine !== "undefined" && typeof DrawerStyleLine.isDesignKind === "function"
    ? DrawerStyleLine.isDesignKind(kind)
    : false;
}

function paintPeleSvg(opts, paint) {
  opts = opts || {};
  paint = paint || {};
  var label = paint.label || "diagram";
  syncBoardEditControls();
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
    if (typeof DrawerStyleLine !== "undefined") {
      typeStep = DrawerStyleLine.typeStepFromStyleToken(
        DrawerStyleLine.splitRendererStyle(diagramSourceEl ? diagramSourceEl.value : "").token
      );
    }
    var peleFont = typeof FlowchartTypeScale !== "undefined"
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
    if (typeof DrawerPeleTheme !== "undefined" && typeof DrawerPeleTheme.polishBoxes === "function") {
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
      if (typeof FlowchartShapes !== "undefined") FlowchartShapes.polishFlowchartNodeShapes(previewEl);
      if (typeof FlowchartTypeScale !== "undefined") FlowchartTypeScale.applyToRoot(previewEl, typeStep);
      if (typeof restoreFlowchartSelection === "function") restoreFlowchartSelection();
    },
  });
}

function renderDesignPele(opts) {
  paintPeleSvg(opts, { label: "diagram" });
  if (typeof fillDesignProps === "function") fillDesignProps();
}

function refuseUnsupportedMermaid() {
  syncBoardEditControls();
  previewEl.classList.remove("board-preview");
  previewEl.innerHTML = "";
  bindCanvasWorld(null, null);
  updateDiagramChars();
  showDiagramError("This diagram type cannot be rendered.");
  setStatus("This diagram type cannot be rendered.", true);
  finishCanvasView({});
}

function renderMindmap(opts) {
  opts = opts || {};
  syncBoardEditControls();
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
  if (typeof MindmapEdit === "undefined" || typeof MindmapEdit.render !== "function") {
    previewEl.innerHTML = "";
    bindCanvasWorld(null, null);
    showDiagramError("Mindmap renderer missing");
    setStatus("Mindmap renderer missing", true);
    finishCanvasView(opts);
    return;
  }
  try {
    var theme = "default";
    if (typeof DrawerStyleLine !== "undefined") {
      theme = DrawerStyleLine.themeFromStyleToken(
        DrawerStyleLine.splitRendererStyle(diagramSourceEl ? diagramSourceEl.value : "").token
      ) || "default";
    }
    var layout = typeof currentMindmapLayout === "function" ? currentMindmapLayout() : "radial";
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
    if (typeof restoreMindmapSelection === "function") restoreMindmapSelection();
    if (typeof fillMindmapProps === "function") fillMindmapProps();
    else if (typeof syncMindmapButtons === "function") syncMindmapButtons();
    if (typeof applyMindmapSelectionVisual === "function") applyMindmapSelectionVisual();
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
  var body = sourceBodyForKind(diagramSourceEl ? diagramSourceEl.value : "");
  var kind = (typeof DrawerStyleLine !== "undefined" && DrawerStyleLine.bodyKind)
    ? DrawerStyleLine.bodyKind(body)
    : ((typeof DrawerStyleLine !== "undefined" && DrawerStyleLine.bodyIsBoard && DrawerStyleLine.bodyIsBoard(body)) ? "board" : "unknown");
  applyDrawerKind(kind);
  if (kind === "flowchart") return renderFlowchart(opts);
  if (kind === "mindmap") return renderMindmap(opts);
  if (isDesignKind(kind)) return renderDesignPele(opts);
  if (kind === "mermaid-unsupported") return refuseUnsupportedMermaid();
  syncBoardEditControls();
  previewEl.classList.add('board-preview');
  const text = diagramSourceEl.value.trim(); updateDiagramChars();
  if (!text) { previewEl.innerHTML = ''; bindCanvasWorld(null, null); if (typeof pinDiagramTitle === "function") pinDiagramTitle(); showDiagramError(''); setStatus('No Board source'); clearDrawerBoot(); return; }
  BoardRender.render(text, previewEl).then((rendered) => {
    try {
      var worldRoot = rendered && rendered.root && rendered.root.querySelector
        ? (rendered.root.classList && rendered.root.classList.contains("board-canvas")
          ? rendered.root
          : rendered.root.querySelector(".board-canvas"))
        : null;
      bindCanvasWorld(worldRoot, function () {
        return typeof BoardRender !== "undefined" && typeof BoardRender.worldBounds === "function"
          ? BoardRender.worldBounds(rendered.root)
          : null;
      });
      syncBoardLinkRouteButton(); wireBoardCanvas(rendered.root, rendered.board); wireBoardDrag(rendered.root, rendered.board); applyBoardSelection(rendered.root, rendered.board, true); var retained = Array.from(rendered.root.querySelectorAll("[data-board-key]")).find(function(el) { return el.dataset.boardKey === boardDomSelectionKey(diagramSourceEl.dataset.boardSelectionKey); }); if (retained) retained.classList.add("board-selection", "canvas-selected");
      // Repaint the live root after any mode/bootstrap render race.
      if (rendered && rendered.root && rendered.root.isConnected && rendered.frames) rendered.frames.forEach((frame, id) => { const el = rendered.root.querySelector("[data-board-id=\"" + id + "\"]"); if (!el || el.dataset.boardNested === "1") return; el.style.left = frame.x + "px"; el.style.top = frame.y + "px"; el.style.width = frame.w + "px"; var grow = el.dataset.boardType === "note" || el.dataset.boardType === "layout" || el.dataset.boardType === "container"; if (grow) { el.style.minHeight = frame.h + "px"; el.style.height = "auto"; } else { el.style.minHeight = ""; el.style.height = frame.h + "px"; } });
      showDiagramError(''); setStatus(`Board rendered · ${new Date().toLocaleTimeString()}`);
      syncBoardStyleChrome(rendered.board);
      applyBoardThemeToPreview();
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
    }
  }).catch((err) => {
    pinDiagramTitle();
    clearDrawerBoot();
    showDiagramError(err instanceof Error ? err.message : String(err)); setStatus('Invalid Board source', true);
  });
}
function scheduleDiagramRender() { clearTimeout(diagramRenderTimer); diagramRenderTimer = setTimeout(renderDiagram, 220); }
function setDiagramSyncUI(state = 'ok') { const pill = $('#diagramSyncPill'); if (!pill) return; const label = state === 'saving' ? 'saving' : state === 'error' ? 'error' : state === 'conflict' ? 'conflict' : 'rev'; pill.className = 'pill ' + (state === 'ok' ? 'ok' : 'warn'); pill.innerHTML = `${label} <b>${diagramLocalRev}</b>`; }
// Cloud saves hit Supabase; debounce them longer than local/URL saves.
function diagramSaveDelay() { return typeof cloudDiagramId === "function" && cloudDiagramId() ? 3000 : 350; }
function bumpClientRevIfSynced() {
  var server = Number(diagramServerRev);
  var client = Number(diagramLocalRev);
  if (Number.isFinite(server) && server > 0 && server === client) {
    diagramLocalRev = server + 1;
    if (typeof syncSourceDockLabel === "function") syncSourceDockLabel();
  }
  if (typeof syncCloudSaveChrome === "function") syncCloudSaveChrome();
}
function scheduleDiagramSave() {
  diagramDirty = true;
  bumpClientRevIfSynced();
  clearTimeout(diagramSaveTimer);
  if (typeof isShareGuest === "function" && isShareGuest()) {
    diagramSaveTimer = null;
    if (typeof syncCloudSaveChrome === "function") syncCloudSaveChrome();
    return;
  }
  if (typeof cloudPlusDraftActive !== "undefined" && cloudPlusDraftActive) {
    diagramSaveTimer = setTimeout(function () {
      void saveDiagramToHash().then(function () {
        if (!cloudPlusDraftActive || !diagramSourceEl) return;
        cloudPlusDraftSource = diagramSourceEl.value;
        cloudPlusDraftRev = Number(diagramLocalRev) || 1;
      });
    }, diagramSaveDelay());
    return;
  }
  setDiagramSyncUI('saving');
  diagramSaveTimer = setTimeout(() => void saveDiagramToFile(), diagramSaveDelay());
}
function flushDiagramSave() {
  if (typeof isShareGuest === "function" && isShareGuest()) {
    clearTimeout(diagramSaveTimer);
    diagramSaveTimer = null;
    return Promise.resolve();
  }
  if (!diagramDirty && !diagramSaveTimer) return Promise.resolve();
  clearTimeout(diagramSaveTimer);
  diagramSaveTimer = null;
  return saveDiagramToFile();
}
window.addEventListener("pagehide", function() { void flushDiagramSave(); });
document.addEventListener("visibilitychange", function() {
  if (document.visibilityState === "hidden") void flushDiagramSave();
});
async function saveDiagramToHash(opts) {
  opts = opts || {};
  diagramSaveTimer = null;
  var text = typeof stripDocumentMeta === "function"
    ? stripDocumentMeta(diagramSourceEl.value)
    : diagramSourceEl.value;
  if (diagramSourceEl && text !== diagramSourceEl.value) diagramSourceEl.value = text;
  const seq = ++diagramSaveSeq;
  try {
    if (opts.bump !== false) diagramLocalRev = (Number(diagramLocalRev) || 0) + 1;
    else if (!(Number(diagramLocalRev) > 0)) diagramLocalRev = 1;
    const token = await encodeDiagramHash(text, diagramLocalRev);
    if (seq !== diagramSaveSeq) return;
    const next = "#" + token;
    if (location.hash !== next) {
      history.replaceState(null, "", location.pathname + location.search + next);
    }
    diagramDirty = false;
    if (typeof syncSourceDockLabel === "function") syncSourceDockLabel();
    if (typeof syncCloudSaveChrome === "function") syncCloudSaveChrome();
    setDiagramSyncUI("ok");
    setStatus("Saved in URL");
  } catch (err) {
    setDiagramSyncUI("error");
    setStatus(err instanceof Error ? err.message : String(err), true);
  }
}
async function saveDiagramToFile() {
  // Clear the timer on every path; a stale id here blocks hashchange/poll loads forever.
  diagramSaveTimer = null;
  if (typeof diagramPersistMode === "function" && diagramPersistMode() === "hash") {
    if (typeof isShareGuest === "function" && isShareGuest()) {
      return Promise.resolve();
    }
    if (typeof cloudDiagramId === "function" && cloudDiagramId()) {
      return saveDiagramToCloud({ explicit: false });
    }
    return saveDiagramToHash();
  }
  var text = typeof stripDocumentMeta === "function"
    ? stripDocumentMeta(diagramSourceEl.value)
    : diagramSourceEl.value;
  if (diagramSourceEl && text !== diagramSourceEl.value) diagramSourceEl.value = text;
  const seq = ++diagramSaveSeq, baseRev = diagramLocalRev;
  try {
    const headers = {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Board-Rev': String(baseRev),
      'X-Board-Via': 'ui',
      'X-Board-Label': 'docker-sbx-board',
    };
    if (typeof liveDiagramId !== 'undefined' && liveDiagramId) headers['X-Board-Id'] = liveDiagramId;
    if (typeof getDiagramTitle === 'function') headers['X-Board-Title'] = headerByteString(getDiagramTitle(cloudOpenDiagramId()));
    const res = await fetch('./board.bmd', { method: 'PUT', headers, body: text });
    if (seq !== diagramSaveSeq) return;
    if (res.status === 409) { const payload = await res.json(); diagramLocalRev = Number(payload.version != null ? payload.version : payload.rev) || diagramLocalRev; diagramDirty = false; if (typeof payload.source === 'string') { diagramSourceEl.value = typeof stripDocumentMeta === "function" ? stripDocumentMeta(payload.source) : payload.source; renderDiagram(); } setDiagramSyncUI('conflict'); setStatus(`Board version conflict → loaded v ${diagramLocalRev}`, true); return; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    diagramLocalRev = Number(res.headers.get('X-Board-Rev')) || baseRev + 1; diagramDirty = false; setDiagramSyncUI('ok');
    setStatus(`Board saved v ${diagramLocalRev}`);
    try {
      const metaRes = await fetch(`./board.meta.json?ts=${Date.now()}`, { cache: 'no-store' });
      if (metaRes.ok && typeof applyDiagramLiveMeta === 'function') applyDiagramLiveMeta(await metaRes.json());
    } catch (_e) {}
  } catch (err) { setDiagramSyncUI('error'); setStatus(err instanceof Error ? err.message : String(err), true); }
}
async function loadDiagramPolled() {
  if (typeof diagramPersistMode === "function" && diagramPersistMode() === "hash") return;
  if (diagramDirty || diagramSaveTimer) return;
  try {
    const metaRes = await fetch(`./board.meta.json?ts=${Date.now()}`, { cache: 'no-store' }); if (!metaRes.ok) return;
    const meta = await metaRes.json(), remoteRev = Number(meta.version != null ? meta.version : meta.rev) || 0;
    if (typeof applyDiagramLiveMeta === 'function') applyDiagramLiveMeta(meta);
    if (remoteRev <= diagramLocalRev) { setDiagramSyncUI('ok'); return; }
    const res = await fetch(`./board.bmd?ts=${Date.now()}`, { cache: 'no-store' }); if (!res.ok) return;
    var text = await res.text();
    if (typeof stripDocumentMeta === "function") text = stripDocumentMeta(text);
    diagramLocalRev = Number(res.headers.get('X-Board-Rev')) || remoteRev; diagramDirty = false;
    if (diagramSourceEl.value !== text) { diagramSourceEl.value = text; renderDiagram({ fit: false }); setStatus(`Board loaded r${diagramLocalRev}`); }
    setDiagramSyncUI('ok');
  } catch (_) {}
}
function shouldWaitForCreateKind() {
  if (typeof document !== "undefined" && document.documentElement && document.documentElement.dataset.blankStartKind === "1") {
    return true;
  }
  if (typeof DrawerEarlyHead === "undefined") return false;
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
  if (typeof cloudDiagramIdFromHash === "function" && cloudDiagramIdFromHash(raw)) {
    await loadCloudDiagramByHash(raw);
    return;
  }
  if (typeof cloudShareIdFromHash === "function" && cloudShareIdFromHash(raw)) {
    if (typeof loadSharedDiagramByHash === "function") {
      await loadSharedDiagramByHash(raw);
      return;
    }
  }
  if (!raw) {
    if (typeof setShareView === "function") setShareView(false);
    if (typeof setShareEdit === "function") setShareEdit(false);
    if (typeof shouldWaitForCreateKind === "function" && shouldWaitForCreateKind()) {
      if (diagramSourceEl) diagramSourceEl.value = "";
      diagramLocalRev = 1;
      diagramServerRev = 0;
      if (typeof applyDiagramLiveMeta === "function") applyDiagramLiveMeta({ id: "", version: 1 });
      setStatus("Choose a type");
      return;
    }
    diagramSourceEl.value = typeof blankHashBoardSource === "function"
      ? blankHashBoardSource("Untitled")
      : "board \"Untitled\"\n";
    diagramLocalRev = 1;
    diagramServerRev = 0;
    if (typeof applyDiagramLiveMeta === "function") {
      applyDiagramLiveMeta({ id: "", version: 1 });
    }
    await saveDiagramToHash({ bump: false });
    setStatus("New diagram");
    return;
  }
  try {
    if (typeof setShareView === "function") setShareView(false);
    if (typeof setShareEdit === "function") setShareEdit(false);
    var decoded = await decodeDiagramHash(raw);
    var body = typeof stripDocumentMeta === "function" ? stripDocumentMeta(decoded.bmd) : decoded.bmd;
    diagramSourceEl.value = body;
    diagramLocalRev = Number(decoded.version) || 1;
    diagramServerRev = 0;
    if (typeof applyDiagramLiveMeta === "function") {
      applyDiagramLiveMeta({
        id: "",
        version: diagramLocalRev,
      });
    }
    if (typeof syncSourceDockLabel === "function") syncSourceDockLabel();
  } catch (err) {
    diagramSourceEl.value = "";
    if (typeof showDiagramError === "function") {
      showDiagramError(err instanceof Error ? err.message : String(err));
    }
    setStatus("Could not read board from URL", true);
  }
}
async function bootstrapDiagram() {
  if (typeof diagramPersistMode === "function" && diagramPersistMode() === "hash") {
    await bootstrapDiagramFromHash();
  } else {
    try { const res = await fetch('./board.bmd', { cache: 'no-store' }); if (res.ok) { var loaded = await res.text(); diagramSourceEl.value = typeof stripDocumentMeta === "function" ? stripDocumentMeta(loaded) : loaded; diagramLocalRev = Number(res.headers.get('X-Board-Rev')) || 0; } else diagramSourceEl.value = ''; }
    catch (_) { diagramSourceEl.value = ''; }
    try {
      const metaRes = await fetch(`./board.meta.json?ts=${Date.now()}`, { cache: 'no-store' });
      if (metaRes.ok && typeof applyDiagramLiveMeta === 'function') applyDiagramLiveMeta(await metaRes.json());
    } catch (_e) {}
  }
  diagramDirty = false; updateDiagramChars(); setDiagramSyncUI('ok');
  if (diagramSourceEl.value.trim()) {
    await new Promise(function (resolve) {
      var done = false;
      var finish = function () { if (done) return; done = true; resolve(); };
      try {
        renderDiagram({ fit: false, restoreView: true });
        // renderDiagram is async via promise; wait for board-render or timeout
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

