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
  var date = new Date(s);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleString(undefined, {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
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
  if (typeof boardPersistMode === "function" && boardPersistMode() === "hash") {
    if (typeof refreshCloudBoardHistory === "function") return refreshCloudBoardHistory();
    return;
  }
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

