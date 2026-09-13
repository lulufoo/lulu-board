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
function closeHistoryCombo(combo) {
  if (!combo) return;
  combo.classList.remove("is-open");
  var btn = combo.querySelector(".history-combo-btn");
  var list = combo.querySelector(".history-list");
  if (btn) btn.setAttribute("aria-expanded", "false");
  if (list) list.hidden = true;
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
  var list = combo.querySelector(".history-list");
  if (btn) btn.setAttribute("aria-expanded", "true");
  if (list) list.hidden = false;
  var active = list && list.querySelector(".history-item.is-active");
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

