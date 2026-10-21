/* drawer-app/02-vela.js — opened-document host: kind dispatch, render, hash save */

function clearDrawerBoot() {
  document.documentElement.removeAttribute('data-drawer-boot');
}
function pinVelaTitle() {
  var pin = boardTitlePinEl();
  if (pin) { pin.hidden = true; pin.innerHTML = ""; }
  var kind = document.documentElement.dataset.diagramKind || "";
  if (kind && kind !== "board") {
    if (document.title !== "Lulu Vela") document.title = "Lulu Vela";
    return;
  }
  var title = "";
  try {
    title = String((BoardRender.parse(velaSourceEl.value) || {}).title || "").trim();
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
  html.dataset.diagramKind = kind === "empty" ? "" : String(kind || "");
  // Chrome CSS is gated on data-drawer-mode=vela. Keep that; kind switches tools/render.
  if (!html.dataset.drawerMode) html.dataset.drawerMode = "vela";
  if (typeof setTypeUI === "function") setTypeUI();
  else if (typeof syncStyleLayoutSections === "function") syncStyleLayoutSections();
  if (propsEmpty) {
    propsEmpty.textContent = kind === "flowchart"
      ? "Select a group, node, or link"
      : "Select a title, box, or item";
  }
  var flowProps = document.getElementById("flowchartPropsFields");
  if (flowProps && kind !== "flowchart") flowProps.hidden = true;
  var flowDir = document.getElementById("flowchartDirField");
  if (flowDir && kind !== "flowchart") flowDir.hidden = true;
  var flowTitle = document.getElementById("flowchartDocTitleField");
  if (flowTitle && kind !== "flowchart") flowTitle.hidden = true;
}

function fixSvgIntrinsic(svg) {
  if (!svg) return;
  var vb = String(svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
    svg.setAttribute("width", String(Math.ceil(vb[2])));
    svg.setAttribute("height", String(Math.ceil(vb[3])));
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
    if (typeof fitBoardView === "function") fitBoardView();
    else if (typeof applyTransform === "function") applyTransform();
  } else if (opts.restoreView) {
    if (typeof applyRestoredBoardView === "function") applyRestoredBoardView();
    else if (typeof applyTransform === "function") applyTransform();
  } else if (typeof applyTransform === "function") {
    applyTransform();
  }
  if (typeof pinVelaTitle === "function") pinVelaTitle();
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { clearDrawerBoot(); });
  });
}

function syncMermaidStyleChrome(body) {
  if (typeof DrawerStyleLine === "undefined") return;
  var styled = DrawerStyleLine.splitRendererStyle(body);
  var theme = DrawerStyleLine.themeFromStyleToken(styled.token);
  var step = DrawerStyleLine.typeStepFromStyleToken(styled.token);
  if (typeof applyDiagramTheme === "function") {
    applyDiagramTheme(theme, { persist: false, skipRender: true });
  } else if (typeof applyPeleThemeVars === "function") {
    applyPeleThemeVars(theme);
  }
  if (typeof applyBoardTypeStep === "function") applyBoardTypeStep(step, false, false);
}

function renderFlowchart(opts) {
  opts = opts || {};
  syncBoardEditControls();
  previewEl.classList.remove("board-preview");
  syncMermaidStyleChrome(velaSourceEl ? velaSourceEl.value : "");
  var body = sourceBodyForKind(velaSourceEl.value);
  updateVelaChars();
  if (!body.trim()) {
    previewEl.innerHTML = "";
    bindCanvasWorld(null, null);
    showVelaError("");
    setStatus("No flowchart source");
    finishCanvasView(opts);
    return;
  }
  if (!window.pele || typeof window.pele.render !== "function") {
    previewEl.innerHTML = "";
    bindCanvasWorld(null, null);
    showVelaError("Pele renderer missing");
    setStatus("Pele renderer missing", true);
    finishCanvasView(opts);
    return;
  }
  try {
    var typeStep = 0;
    if (typeof DrawerStyleLine !== "undefined") {
      typeStep = DrawerStyleLine.typeStepFromStyleToken(
        DrawerStyleLine.splitRendererStyle(velaSourceEl ? velaSourceEl.value : "").token
      );
    }
    var peleFont = typeof FlowchartTypeScale !== "undefined"
      ? FlowchartTypeScale.px("default", typeStep)
      : 16;
    var result = window.pele.render(body.trim(), {
      fontFamily: '"SF Pro Text", "SF Pro Display", Inter, system-ui, -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", sans-serif',
      fontSize: peleFont,
      autoDirection: false,
      responsive: false,
    });
    previewEl.innerHTML = result && result.svg ? result.svg : "";
    var svg = previewEl.querySelector("svg");
    fixSvgIntrinsic(svg);
    bindCanvasWorld(svg, function () { return canvasSvgBounds(svg); });
    if (typeof FlowchartShapes !== "undefined") FlowchartShapes.polishFlowchartNodeShapes(previewEl);
    if (typeof FlowchartTypeScale !== "undefined") FlowchartTypeScale.applyToRoot(previewEl, typeStep);
    showVelaError("");
    setStatus("Flowchart rendered · " + new Date().toLocaleTimeString());
    if (typeof restoreFlowchartSelection === "function") restoreFlowchartSelection();
  } catch (err) {
    previewEl.innerHTML = "";
    bindCanvasWorld(null, null);
    showVelaError(err instanceof Error ? err.message : String(err));
    setStatus("Invalid flowchart source", true);
  }
  finishCanvasView(opts);
}

function refuseUnsupportedMermaid() {
  syncBoardEditControls();
  previewEl.classList.remove("board-preview");
  previewEl.innerHTML = "";
  bindCanvasWorld(null, null);
  updateVelaChars();
  showVelaError("Only flowchart and mindmap can be rendered.");
  setStatus("Only flowchart and mindmap can be rendered.", true);
  finishCanvasView({});
}

function renderMindmap(opts) {
  opts = opts || {};
  syncBoardEditControls();
  previewEl.classList.remove("board-preview");
  syncMermaidStyleChrome(velaSourceEl ? velaSourceEl.value : "");
  var body = sourceBodyForKind(velaSourceEl.value);
  updateVelaChars();
  if (!body.trim()) {
    previewEl.innerHTML = "";
    bindCanvasWorld(null, null);
    showVelaError("");
    setStatus("No mindmap source");
    finishCanvasView(opts);
    return;
  }
  if (typeof MindmapEdit === "undefined" || typeof MindmapEdit.render !== "function") {
    previewEl.innerHTML = "";
    bindCanvasWorld(null, null);
    showVelaError("Mindmap renderer missing");
    setStatus("Mindmap renderer missing", true);
    finishCanvasView(opts);
    return;
  }
  try {
    var theme = "default";
    if (typeof DrawerStyleLine !== "undefined") {
      theme = DrawerStyleLine.themeFromStyleToken(
        DrawerStyleLine.splitRendererStyle(velaSourceEl ? velaSourceEl.value : "").token
      ) || "default";
    }
    var result = MindmapEdit.render(body, { layout: "radial", theme: theme, id: "mm" });
    if (result && result.errors && result.errors.length && !result.svg) {
      throw new Error(result.errors.join("; "));
    }
    previewEl.innerHTML = result && result.svg ? result.svg : "";
    var svg = previewEl.querySelector("svg");
    fixSvgIntrinsic(svg);
    bindCanvasWorld(svg, function () { return canvasSvgBounds(svg); });
    showVelaError("");
    setStatus("Mindmap rendered · " + new Date().toLocaleTimeString());
  } catch (err) {
    previewEl.innerHTML = "";
    bindCanvasWorld(null, null);
    showVelaError(err instanceof Error ? err.message : String(err));
    setStatus("Invalid mindmap source", true);
  }
  finishCanvasView(opts);
}

function renderVela(opts) {
  opts = opts || {};
  var body = sourceBodyForKind(velaSourceEl ? velaSourceEl.value : "");
  var kind = (typeof DrawerStyleLine !== "undefined" && DrawerStyleLine.bodyKind)
    ? DrawerStyleLine.bodyKind(body)
    : ((typeof DrawerStyleLine !== "undefined" && DrawerStyleLine.bodyIsBoard && DrawerStyleLine.bodyIsBoard(body)) ? "board" : "unknown");
  applyDrawerKind(kind);
  if (kind === "flowchart") return renderFlowchart(opts);
  if (kind === "mindmap") return renderMindmap(opts);
  if (kind === "mermaid-unsupported") return refuseUnsupportedMermaid();
  syncBoardEditControls();
  previewEl.classList.add('board-preview');
  const text = velaSourceEl.value.trim(); updateVelaChars();
  if (!text) { previewEl.innerHTML = ''; bindCanvasWorld(null, null); if (typeof pinVelaTitle === "function") pinVelaTitle(); showVelaError(''); setStatus('No Board source'); clearDrawerBoot(); return; }
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
      syncBoardLinkRouteButton(); wireBoardCanvas(rendered.root, rendered.board); wireBoardDrag(rendered.root, rendered.board); applyBoardSelection(rendered.root, rendered.board, true); var retained = Array.from(rendered.root.querySelectorAll("[data-board-key]")).find(function(el) { return el.dataset.boardKey === boardDomSelectionKey(velaSourceEl.dataset.boardSelectionKey); }); if (retained) retained.classList.add("board-selection", "canvas-selected");
      // Repaint the live root after any mode/bootstrap render race.
      if (rendered && rendered.root && rendered.root.isConnected && rendered.frames) rendered.frames.forEach((frame, id) => { const el = rendered.root.querySelector("[data-board-id=\"" + id + "\"]"); if (!el || el.dataset.boardNested === "1") return; el.style.left = frame.x + "px"; el.style.top = frame.y + "px"; el.style.width = frame.w + "px"; var grow = el.dataset.boardType === "note" || el.dataset.boardType === "layout" || el.dataset.boardType === "container"; if (grow) { el.style.minHeight = frame.h + "px"; el.style.height = "auto"; } else { el.style.minHeight = ""; el.style.height = frame.h + "px"; } });
      showVelaError(''); setStatus(`Board rendered · ${new Date().toLocaleTimeString()}`);
      syncBoardStyleChrome(rendered.board);
      applyBoardThemeToPreview();
      if (opts.fit) {
        fitBoardView();
      } else if (opts.restoreView) {
        applyRestoredBoardView();
      } else {
        applyTransform();
      }
    } finally {
      pinVelaTitle();
      // Two frames: let pin/title + item frame rects settle while stage still opacity:0.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { clearDrawerBoot(); });
      });
    }
  }).catch((err) => {
    pinVelaTitle();
    clearDrawerBoot();
    showVelaError(err instanceof Error ? err.message : String(err)); setStatus('Invalid Board source', true);
  });
}
function scheduleVelaRender() { clearTimeout(boardRenderTimer); boardRenderTimer = setTimeout(renderVela, 220); }
function setBoardSyncUI(state = 'ok') { const pill = $('#boardSyncPill'); if (!pill) return; const label = state === 'saving' ? 'saving' : state === 'error' ? 'error' : state === 'conflict' ? 'conflict' : 'rev'; pill.className = 'pill ' + (state === 'ok' ? 'ok' : 'warn'); pill.innerHTML = `${label} <b>${velaLocalRev}</b>`; }
// Cloud saves hit Supabase; debounce them longer than local/URL saves.
function boardSaveDelay() { return typeof cloudVelaId === "function" && cloudVelaId() ? 3000 : 350; }
function bumpClientRevIfSynced() {
  var server = Number(boardServerRev);
  var client = Number(velaLocalRev);
  if (Number.isFinite(server) && server > 0 && server === client) {
    velaLocalRev = server + 1;
    if (typeof syncSourceDockLabel === "function") syncSourceDockLabel();
  }
  if (typeof syncCloudSaveChrome === "function") syncCloudSaveChrome();
}
function scheduleBoardSave() {
  boardDirty = true;
  bumpClientRevIfSynced();
  clearTimeout(boardSaveTimer);
  if (typeof isShareGuest === "function" && isShareGuest()) {
    boardSaveTimer = null;
    if (typeof syncCloudSaveChrome === "function") syncCloudSaveChrome();
    return;
  }
  if (typeof cloudPlusDraftActive !== "undefined" && cloudPlusDraftActive) {
    boardSaveTimer = setTimeout(function () {
      void saveVelaToHash().then(function () {
        if (!cloudPlusDraftActive || !velaSourceEl) return;
        cloudPlusDraftSource = velaSourceEl.value;
        cloudPlusDraftRev = Number(velaLocalRev) || 1;
      });
    }, boardSaveDelay());
    return;
  }
  setBoardSyncUI('saving');
  boardSaveTimer = setTimeout(() => void saveBoardToFile(), boardSaveDelay());
}
function flushBoardSave() {
  if (typeof isShareGuest === "function" && isShareGuest()) {
    clearTimeout(boardSaveTimer);
    boardSaveTimer = null;
    return Promise.resolve();
  }
  if (!boardDirty && !boardSaveTimer) return Promise.resolve();
  clearTimeout(boardSaveTimer);
  boardSaveTimer = null;
  return saveBoardToFile();
}
window.addEventListener("pagehide", function() { void flushBoardSave(); });
document.addEventListener("visibilitychange", function() {
  if (document.visibilityState === "hidden") void flushBoardSave();
});
async function saveVelaToHash(opts) {
  opts = opts || {};
  boardSaveTimer = null;
  var text = typeof stripDocumentMeta === "function"
    ? stripDocumentMeta(velaSourceEl.value)
    : velaSourceEl.value;
  if (velaSourceEl && text !== velaSourceEl.value) velaSourceEl.value = text;
  const seq = ++boardSaveSeq;
  try {
    if (opts.bump !== false) velaLocalRev = (Number(velaLocalRev) || 0) + 1;
    else if (!(Number(velaLocalRev) > 0)) velaLocalRev = 1;
    const token = await encodeBoardHash(text, velaLocalRev);
    if (seq !== boardSaveSeq) return;
    const next = "#" + token;
    if (location.hash !== next) {
      history.replaceState(null, "", location.pathname + location.search + next);
    }
    boardDirty = false;
    if (typeof syncSourceDockLabel === "function") syncSourceDockLabel();
    if (typeof syncCloudSaveChrome === "function") syncCloudSaveChrome();
    setBoardSyncUI("ok");
    setStatus("Saved in URL");
  } catch (err) {
    setBoardSyncUI("error");
    setStatus(err instanceof Error ? err.message : String(err), true);
  }
}
async function saveBoardToFile() {
  // Clear the timer on every path; a stale id here blocks hashchange/poll loads forever.
  boardSaveTimer = null;
  if (typeof boardPersistMode === "function" && boardPersistMode() === "hash") {
    if (typeof isShareGuest === "function" && isShareGuest()) {
      return Promise.resolve();
    }
    if (typeof cloudVelaId === "function" && cloudVelaId()) {
      return saveVelaToCloud({ explicit: false });
    }
    return saveVelaToHash();
  }
  var text = typeof stripDocumentMeta === "function"
    ? stripDocumentMeta(velaSourceEl.value)
    : velaSourceEl.value;
  if (velaSourceEl && text !== velaSourceEl.value) velaSourceEl.value = text;
  const seq = ++boardSaveSeq, baseRev = velaLocalRev;
  try {
    const headers = {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Board-Rev': String(baseRev),
      'X-Board-Via': 'ui',
      'X-Board-Label': 'docker-sbx-board',
    };
    if (typeof liveBoardId !== 'undefined' && liveBoardId) headers['X-Board-Id'] = liveBoardId;
    if (typeof getBoardTitle === 'function') headers['X-Board-Title'] = headerByteString(getBoardTitle(cloudOpenBoardId()));
    const res = await fetch('./board.bmd', { method: 'PUT', headers, body: text });
    if (seq !== boardSaveSeq) return;
    if (res.status === 409) { const payload = await res.json(); velaLocalRev = Number(payload.version != null ? payload.version : payload.rev) || velaLocalRev; boardDirty = false; if (typeof payload.source === 'string') { velaSourceEl.value = typeof stripDocumentMeta === "function" ? stripDocumentMeta(payload.source) : payload.source; renderVela(); } setBoardSyncUI('conflict'); setStatus(`Board version conflict → loaded v ${velaLocalRev}`, true); return; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    velaLocalRev = Number(res.headers.get('X-Board-Rev')) || baseRev + 1; boardDirty = false; setBoardSyncUI('ok');
    setStatus(`Board saved v ${velaLocalRev}`);
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
    if (remoteRev <= velaLocalRev) { setBoardSyncUI('ok'); return; }
    const res = await fetch(`./board.bmd?ts=${Date.now()}`, { cache: 'no-store' }); if (!res.ok) return;
    var text = await res.text();
    if (typeof stripDocumentMeta === "function") text = stripDocumentMeta(text);
    velaLocalRev = Number(res.headers.get('X-Board-Rev')) || remoteRev; boardDirty = false;
    if (velaSourceEl.value !== text) { velaSourceEl.value = text; renderVela({ fit: false }); setStatus(`Board loaded r${velaLocalRev}`); }
    setBoardSyncUI('ok');
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

async function bootstrapVelaFromHash() {
  var raw = String(location.hash || "").replace(/^#/, "");
  if (typeof cloudBoardIdFromHash === "function" && cloudBoardIdFromHash(raw)) {
    await loadCloudVelaByHash(raw);
    return;
  }
  if (typeof cloudShareIdFromHash === "function" && cloudShareIdFromHash(raw)) {
    if (typeof loadSharedBoardByHash === "function") {
      await loadSharedBoardByHash(raw);
      return;
    }
  }
  if (!raw) {
    if (typeof setShareView === "function") setShareView(false);
    if (typeof setShareEdit === "function") setShareEdit(false);
    if (typeof shouldWaitForCreateKind === "function" && shouldWaitForCreateKind()) {
      if (velaSourceEl) velaSourceEl.value = "";
      velaLocalRev = 1;
      boardServerRev = 0;
      if (typeof applyBoardLiveMeta === "function") applyBoardLiveMeta({ id: "", version: 1 });
      setStatus("Choose a type");
      return;
    }
    velaSourceEl.value = typeof blankHashBoardSource === "function"
      ? blankHashBoardSource("Untitled")
      : "board \"Untitled\"\n";
    velaLocalRev = 1;
    boardServerRev = 0;
    if (typeof applyBoardLiveMeta === "function") {
      applyBoardLiveMeta({ id: "", version: 1 });
    }
    await saveVelaToHash({ bump: false });
    setStatus("New Vela");
    return;
  }
  try {
    if (typeof setShareView === "function") setShareView(false);
    if (typeof setShareEdit === "function") setShareEdit(false);
    var decoded = await decodeBoardHash(raw);
    var body = typeof stripDocumentMeta === "function" ? stripDocumentMeta(decoded.bmd) : decoded.bmd;
    velaSourceEl.value = body;
    velaLocalRev = Number(decoded.version) || 1;
    boardServerRev = 0;
    if (typeof applyBoardLiveMeta === "function") {
      applyBoardLiveMeta({
        id: "",
        version: velaLocalRev,
      });
    }
    if (typeof syncSourceDockLabel === "function") syncSourceDockLabel();
  } catch (err) {
    velaSourceEl.value = "";
    if (typeof showVelaError === "function") {
      showVelaError(err instanceof Error ? err.message : String(err));
    }
    setStatus("Could not read board from URL", true);
  }
}
async function bootstrapVela() {
  if (typeof boardPersistMode === "function" && boardPersistMode() === "hash") {
    await bootstrapVelaFromHash();
  } else {
    try { const res = await fetch('./board.bmd', { cache: 'no-store' }); if (res.ok) { var loaded = await res.text(); velaSourceEl.value = typeof stripDocumentMeta === "function" ? stripDocumentMeta(loaded) : loaded; velaLocalRev = Number(res.headers.get('X-Board-Rev')) || 0; } else velaSourceEl.value = ''; }
    catch (_) { velaSourceEl.value = ''; }
    try {
      const metaRes = await fetch(`./board.meta.json?ts=${Date.now()}`, { cache: 'no-store' });
      if (metaRes.ok && typeof applyBoardLiveMeta === 'function') applyBoardLiveMeta(await metaRes.json());
    } catch (_e) {}
  }
  boardDirty = false; updateVelaChars(); setBoardSyncUI('ok');
  if (velaSourceEl.value.trim()) {
    await new Promise(function (resolve) {
      var done = false;
      var finish = function () { if (done) return; done = true; resolve(); };
      try {
        renderVela({ fit: false, restoreView: true });
        // renderVela is async via promise; wait for board-render or timeout
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

