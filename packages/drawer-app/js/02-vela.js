/* drawer-app/02-vela.js — opened-document host: kind dispatch, render, hash save */

function clearDrawerBoot() {
  document.documentElement.removeAttribute('data-drawer-boot');
}
function pinBoardTitle() {
  var pin = boardTitlePinEl();
  if (pin) { pin.hidden = true; pin.innerHTML = ""; }
  var kind = document.documentElement.dataset.diagramKind || "";
  if (kind && kind !== "board") {
    if (document.title !== "Lulu Vela") document.title = "Lulu Vela";
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
  // Chrome CSS is gated on data-drawer-mode=board. Keep that; kind switches tools/render.
  if (!html.dataset.drawerMode) html.dataset.drawerMode = "board";
  if (typeof syncStyleLayoutSections === "function") syncStyleLayoutSections();
  if (propsEmpty) {
    propsEmpty.textContent = kind === "flowchart"
      ? "Select a group, node, or link"
      : "Select a title, box, or item";
  }
  var flowProps = document.getElementById("flowchartPropsFields");
  if (flowProps && kind !== "flowchart") flowProps.hidden = true;
  var flowDir = document.getElementById("flowchartDirField");
  if (flowDir && kind !== "flowchart") flowDir.hidden = true;
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
  if (typeof pinBoardTitle === "function") pinBoardTitle();
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
  syncMermaidStyleChrome(boardSourceEl ? boardSourceEl.value : "");
  var body = sourceBodyForKind(boardSourceEl.value);
  updateBoardChars();
  if (!body.trim()) {
    previewEl.innerHTML = "";
    bindCanvasWorld(null, null);
    showBoardError("");
    setStatus("No flowchart source");
    finishCanvasView(opts);
    return;
  }
  if (!window.pele || typeof window.pele.render !== "function") {
    previewEl.innerHTML = "";
    bindCanvasWorld(null, null);
    showBoardError("Pele renderer missing");
    setStatus("Pele renderer missing", true);
    finishCanvasView(opts);
    return;
  }
  try {
    var typeStep = 0;
    if (typeof DrawerStyleLine !== "undefined") {
      typeStep = DrawerStyleLine.typeStepFromStyleToken(
        DrawerStyleLine.splitRendererStyle(boardSourceEl ? boardSourceEl.value : "").token
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
    showBoardError("");
    setStatus("Flowchart rendered · " + new Date().toLocaleTimeString());
    if (typeof restoreFlowchartSelection === "function") restoreFlowchartSelection();
  } catch (err) {
    previewEl.innerHTML = "";
    bindCanvasWorld(null, null);
    showBoardError(err instanceof Error ? err.message : String(err));
    setStatus("Invalid flowchart source", true);
  }
  finishCanvasView(opts);
}

function refuseUnsupportedMermaid() {
  syncBoardEditControls();
  previewEl.classList.remove("board-preview");
  previewEl.innerHTML = "";
  bindCanvasWorld(null, null);
  updateBoardChars();
  showBoardError("Only flowchart can be rendered.");
  setStatus("Only flowchart can be rendered.", true);
  finishCanvasView({});
}

function renderBoard(opts) {
  opts = opts || {};
  var body = sourceBodyForKind(boardSourceEl ? boardSourceEl.value : "");
  var kind = (typeof DrawerStyleLine !== "undefined" && DrawerStyleLine.bodyKind)
    ? DrawerStyleLine.bodyKind(body)
    : ((typeof DrawerStyleLine !== "undefined" && DrawerStyleLine.bodyIsBoard && DrawerStyleLine.bodyIsBoard(body)) ? "board" : "unknown");
  applyDrawerKind(kind);
  if (kind === "flowchart") return renderFlowchart(opts);
  if (kind === "mermaid-unsupported") return refuseUnsupportedMermaid();
  syncBoardEditControls();
  previewEl.classList.add('board-preview');
  const text = boardSourceEl.value.trim(); updateBoardChars();
  if (!text) { previewEl.innerHTML = ''; bindCanvasWorld(null, null); if (typeof pinBoardTitle === "function") pinBoardTitle(); showBoardError(''); setStatus('No Board source'); clearDrawerBoot(); return; }
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
      syncBoardLinkRouteButton(); wireBoardCanvas(rendered.root, rendered.board); wireBoardDrag(rendered.root, rendered.board); applyBoardSelection(rendered.root, rendered.board, true); var retained = Array.from(rendered.root.querySelectorAll("[data-board-key]")).find(function(el) { return el.dataset.boardKey === boardDomSelectionKey(boardSourceEl.dataset.boardSelectionKey); }); if (retained) retained.classList.add("board-selection");
      // Repaint the live root after any mode/bootstrap render race.
      if (rendered && rendered.root && rendered.root.isConnected && rendered.frames) rendered.frames.forEach((frame, id) => { const el = rendered.root.querySelector("[data-board-id=\"" + id + "\"]"); if (!el || el.dataset.boardNested === "1") return; el.style.left = frame.x + "px"; el.style.top = frame.y + "px"; el.style.width = frame.w + "px"; var grow = el.dataset.boardType === "note" || el.dataset.boardType === "layout" || el.dataset.boardType === "container"; if (grow) { el.style.minHeight = frame.h + "px"; el.style.height = "auto"; } else { el.style.minHeight = ""; el.style.height = frame.h + "px"; } });
      showBoardError(''); setStatus(`Board rendered · ${new Date().toLocaleTimeString()}`);
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
// Cloud saves hit Supabase; debounce them longer than local/URL saves.
function boardSaveDelay() { return typeof cloudBoardId === "function" && cloudBoardId() ? 3000 : 350; }
function bumpClientRevIfSynced() {
  var server = Number(boardServerRev);
  var client = Number(boardLocalRev);
  if (Number.isFinite(server) && server > 0 && server === client) {
    boardLocalRev = server + 1;
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
      void saveBoardToHash().then(function () {
        if (!cloudPlusDraftActive || !boardSourceEl) return;
        cloudPlusDraftSource = boardSourceEl.value;
        cloudPlusDraftRev = Number(boardLocalRev) || 1;
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
async function saveBoardToHash(opts) {
  opts = opts || {};
  boardSaveTimer = null;
  var text = typeof stripDocumentMeta === "function"
    ? stripDocumentMeta(boardSourceEl.value)
    : boardSourceEl.value;
  if (boardSourceEl && text !== boardSourceEl.value) boardSourceEl.value = text;
  const seq = ++boardSaveSeq;
  try {
    if (opts.bump !== false) boardLocalRev = (Number(boardLocalRev) || 0) + 1;
    else if (!(Number(boardLocalRev) > 0)) boardLocalRev = 1;
    const token = await encodeBoardHash(text, boardLocalRev);
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
    if (typeof cloudBoardId === "function" && cloudBoardId()) {
      return saveBoardToCloud({ explicit: false });
    }
    return saveBoardToHash();
  }
  const text = boardSourceEl.value, seq = ++boardSaveSeq, baseRev = boardLocalRev;
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

async function bootstrapBoardFromHash() {
  var raw = String(location.hash || "").replace(/^#/, "");
  if (typeof cloudBoardIdFromHash === "function" && cloudBoardIdFromHash(raw)) {
    await loadCloudBoardByHash(raw);
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
      if (boardSourceEl) boardSourceEl.value = "";
      boardLocalRev = 1;
      boardServerRev = 0;
      if (typeof applyBoardLiveMeta === "function") applyBoardLiveMeta({ id: "", version: 1 });
      setStatus("Choose a type");
      return;
    }
    boardSourceEl.value = typeof blankHashBoardSource === "function"
      ? blankHashBoardSource("Untitled")
      : "board \"Untitled\"\n";
    boardLocalRev = 1;
    boardServerRev = 0;
    if (typeof applyBoardLiveMeta === "function") {
      applyBoardLiveMeta({ id: "", version: 1 });
    }
    await saveBoardToHash({ bump: false });
    setStatus("New Vela");
    return;
  }
  try {
    if (typeof setShareView === "function") setShareView(false);
    if (typeof setShareEdit === "function") setShareEdit(false);
    var decoded = await decodeBoardHash(raw);
    var body = typeof stripDocumentMeta === "function" ? stripDocumentMeta(decoded.bmd) : decoded.bmd;
    boardSourceEl.value = body;
    boardLocalRev = Number(decoded.version) || 1;
    boardServerRev = 0;
    if (typeof applyBoardLiveMeta === "function") {
      applyBoardLiveMeta({
        id: "",
        version: boardLocalRev,
      });
    }
    if (typeof syncSourceDockLabel === "function") syncSourceDockLabel();
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

