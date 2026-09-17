/* drawer-app/06-cloud-sync.js — browser Auth, one latest cloud board per owner */
var cloudClient = null;
var cloudSession = null;
var cloudSessionReady = Promise.resolve(null);
var cloudLoadSeq = 0;
var cloudSaveSeq = 0;

function cloudConfig() {
  var config = globalThis.LuluBoardSupabaseConfig || {};
  var url = String(config.url || "").trim().replace(/\/+$/, "");
  var publishableKey = String(config.publishableKey || "").trim();
  return { url: url, publishableKey: publishableKey };
}

function cloudConfigured() {
  var config = cloudConfig();
  return /^https:\/\//.test(config.url)
    && /^sb_publishable_/.test(config.publishableKey)
    && !!(globalThis.LuluBoardSupabase && globalThis.LuluBoardSupabase.createClient);
}

function cloudBoardId() {
  return typeof cloudBoardIdFromHash === "function"
    ? cloudBoardIdFromHash(typeof location !== "undefined" ? location.hash : "")
    : "";
}

function cloudSetHistoryVisible(visible) {
  var root = document.documentElement;
  root.dataset.cloudHistory = visible ? "on" : "off";
  var heading = document.querySelector("#boardHistory .history-head strong");
  if (heading) heading.textContent = visible ? "Cloud history" : "History";
  var openFile = document.getElementById("btnHistoryOpenFile");
  if (openFile) {
    openFile.title = visible
      ? "Open a board file, then save it to cloud."
      : "Open a board file.";
  }
}

function cloudSetAccountUi() {
  var configured = cloudConfigured();
  var signedIn = !!(cloudSession && cloudSession.user);
  var signIn = document.getElementById("btnBoardSignIn");
  var menu = document.getElementById("boardAuthMenu");
  var account = document.getElementById("boardAccountName");
  var save = document.getElementById("btnBoardSaveCloud");
  var signOut = document.getElementById("btnBoardSignOut");

  if (signIn) {
    signIn.hidden = signedIn;
    signIn.disabled = !configured;
    signIn.title = configured ? "Sign in to sync boards" : "Cloud sync is not configured";
    signIn.setAttribute("aria-expanded", "false");
  }
  if (menu) menu.hidden = true;
  if (account) {
    var user = cloudSession && cloudSession.user;
    var profile = user && user.user_metadata || {};
    account.textContent = signedIn
      ? String(profile.full_name || profile.user_name || user.email || "Signed in")
      : "";
    account.hidden = !signedIn;
  }
  if (save) {
    save.hidden = !signedIn;
    save.disabled = !signedIn;
  }
  if (signOut) signOut.hidden = !signedIn;
  cloudSetHistoryVisible(signedIn);
}

function cloudShowHistoryMessage(message) {
  var list = document.getElementById("boardHistoryList");
  var empty = document.getElementById("boardHistoryEmpty");
  var combo = list && list.closest(".history-combo");
  if (list) list.innerHTML = "";
  if (typeof setHistoryComboFace === "function") setHistoryComboFace(combo, null, "board");
  if (typeof closeHistoryCombo === "function") closeHistoryCombo(combo);
  if (empty) {
    empty.hidden = !message;
    empty.textContent = message || "";
  }
}

function cloudBoardTitle(source) {
  try {
    var doc = splitDocument(source);
    return typeof boardTitleFromBody === "function" ? boardTitleFromBody(doc.body) : "";
  } catch (_e) {
    return "";
  }
}

function cloudSetBoardHash(boardId, replace) {
  if (!boardId || typeof cloudBoardHash !== "function") return;
  var hash = cloudBoardHash(boardId);
  if (location.hash === hash) return;
  if (replace) history.replaceState(null, "", location.pathname + location.search + hash);
  else location.hash = hash;
}

function cloudClearOpenBoard() {
  if (!cloudBoardId() || !boardSourceEl) return;
  boardSourceEl.value = "";
  boardDirty = false;
  boardLocalRev = 0;
  if (typeof updateBoardChars === "function") updateBoardChars();
  if (typeof applyBoardLiveMeta === "function") applyBoardLiveMeta({ id: "", title: "" });
  if (typeof renderBoard === "function") renderBoard({ fit: false });
}

function cloudInit() {
  if (!cloudConfigured()) {
    cloudSetAccountUi();
    return;
  }
  try {
    var config = cloudConfig();
    cloudClient = globalThis.LuluBoardSupabase.createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    });
    cloudClient.auth.onAuthStateChange(function (_event, session) {
      cloudSession = session || null;
      cloudSetAccountUi();
      if (cloudSession) {
        void refreshCloudBoardHistory();
        if (cloudBoardId()) void loadCloudBoardByHash(location.hash);
      }
    });
    cloudSessionReady = cloudClient.auth.getSession().then(function (result) {
      cloudSession = result && result.data ? result.data.session : null;
      cloudSetAccountUi();
      if (cloudSession) void refreshCloudBoardHistory();
      return cloudSession;
    }).catch(function () {
      cloudSession = null;
      cloudSetAccountUi();
      return null;
    });
  } catch (error) {
    cloudClient = null;
    cloudSetAccountUi();
    console.error(error);
  }
}

async function cloudSignIn(provider) {
  if (!cloudClient) {
    setStatus("Cloud sync is not configured", true);
    return;
  }
  var selected = provider === "github" ? "github" : "google";
  var returnTo = location.origin + location.pathname + location.search + location.hash;
  var result = await cloudClient.auth.signInWithOAuth({
    provider: selected,
    options: { redirectTo: returnTo },
  });
  if (result.error) {
    setStatus(result.error.message || "Sign in failed", true);
    return;
  }
}

async function cloudSignOut() {
  if (!cloudClient) return;
  var result = await cloudClient.auth.signOut();
  if (result.error) {
    setStatus(result.error.message || "Sign out failed", true);
    return;
  }
  cloudSession = null;
  cloudClearOpenBoard();
  cloudSetAccountUi();
  cloudShowHistoryMessage("");
  setStatus("Signed out");
}

async function saveBoardToCloud(opts) {
  opts = opts || {};
  if (!cloudClient || !cloudSession || !cloudSession.user) {
    if (opts.explicit) setStatus("Sign in to save to cloud", true);
    return false;
  }
  var source = String(boardSourceEl && boardSourceEl.value || "");
  var doc;
  try {
    doc = splitDocument(source);
  } catch (error) {
    setBoardSyncUI("error");
    setStatus(error instanceof Error ? error.message : String(error), true);
    return false;
  }
  var boardId = doc.meta.id;
  var seq = ++cloudSaveSeq;
  setBoardSyncUI("saving");
  try {
    var result = await cloudClient.from("boards").upsert({
      owner_id: cloudSession.user.id,
      board_id: boardId,
      title: cloudBoardTitle(source) || "Untitled",
      bmd: source,
    }, {
      onConflict: "owner_id,board_id",
    }).select("board_id,title,updated_at").single();
    if (result.error) throw result.error;
    if (seq !== cloudSaveSeq) return false;
    boardDirty = false;
    cloudSetBoardHash(boardId, true);
    if (typeof applyBoardLiveMeta === "function") {
      applyBoardLiveMeta({ id: boardId, title: result.data && result.data.title });
    }
    setBoardSyncUI("ok");
    setStatus("Saved to cloud");
    if (opts.explicit && typeof showCopyTip === "function") showCopyTip("Saved to cloud");
    await refreshCloudBoardHistory();
    return true;
  } catch (error) {
    if (seq !== cloudSaveSeq) return false;
    setBoardSyncUI("error");
    setStatus(error && error.message ? error.message : "Cloud save failed", true);
    return false;
  }
}

async function loadCloudBoardByHash(raw) {
  var boardId = typeof cloudBoardIdFromHash === "function" ? cloudBoardIdFromHash(raw) : "";
  if (!boardId) return false;
  if (!cloudConfigured() || !cloudClient) {
    setStatus("Cloud sync is not configured", true);
    return true;
  }
  await cloudSessionReady;
  if (!cloudSession || !cloudSession.user) {
    cloudClearOpenBoard();
    setStatus("Sign in to open this cloud board", true);
    return true;
  }
  var seq = ++cloudLoadSeq;
  setStatus("Loading cloud board…");
  try {
    var result = await cloudClient.from("boards")
      .select("board_id,title,bmd,created_at,updated_at")
      .eq("board_id", boardId)
      .maybeSingle();
    if (result.error) throw result.error;
    if (seq !== cloudLoadSeq) return true;
    if (!result.data) throw new Error("Cloud board not found");
    var source = String(result.data.bmd || "");
    var doc = splitDocument(source);
    if (doc.meta.id !== boardId) throw new Error("Cloud board ID does not match its source");
    boardSourceEl.value = source;
    boardDirty = false;
    boardLocalRev = Number(doc.meta.version) || 1;
    if (typeof applyBoardLiveMeta === "function") {
      applyBoardLiveMeta({
        id: boardId,
        title: result.data.title || cloudBoardTitle(source),
        version: doc.meta.version,
      });
    }
    if (typeof updateBoardChars === "function") updateBoardChars();
    if (typeof renderBoard === "function") renderBoard({ fit: false, restoreView: true });
    setBoardSyncUI("ok");
    setStatus("Cloud board loaded");
    void refreshCloudBoardHistory();
    return true;
  } catch (error) {
    if (seq !== cloudLoadSeq) return true;
    cloudClearOpenBoard();
    setBoardSyncUI("error");
    setStatus(error && error.message ? error.message : "Cloud board load failed", true);
    return true;
  }
}

async function refreshCloudBoardHistory() {
  if (!cloudClient || !cloudSession || !cloudSession.user) {
    cloudSetHistoryVisible(false);
    return;
  }
  var list = document.getElementById("boardHistoryList");
  var empty = document.getElementById("boardHistoryEmpty");
  var combo = list && list.closest(".history-combo");
  if (!list) return;
  cloudSetHistoryVisible(true);
  if (typeof wireHistoryCombos === "function") wireHistoryCombos();
  try {
    var result = await cloudClient.from("boards")
      .select("board_id,title,created_at,updated_at")
      .order("updated_at", { ascending: false });
    if (result.error) throw result.error;
    var rows = result.data || [];
    if (!rows.length) {
      cloudShowHistoryMessage("No cloud boards yet");
      return;
    }
    if (empty) empty.hidden = true;
    var current = cloudBoardId();
    var activeItem = null;
    var fragment = document.createDocumentFragment();
    rows.forEach(function (row) {
      var item = {
        id: row.board_id,
        title: row.title,
        created_at: row.updated_at || row.created_at,
      };
      var li = document.createElement("li");
      li.className = "history-item";
      li.setAttribute("role", "option");
      li.dataset.historyId = item.id;
      li.dataset.historyTitle = item.title || "Untitled";
      li.dataset.historyKind = "board";
      var active = item.id === current;
      li.classList.toggle("is-active", active);
      li.setAttribute("aria-selected", active ? "true" : "false");
      if (active) activeItem = item;

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
      del.setAttribute("aria-label", "Delete cloud board");
      del.textContent = "×";
      li.appendChild(main);
      li.appendChild(del);
      li.addEventListener("click", function (event) {
        if (event.target === del || del.contains(event.target)) return;
        if (typeof closeHistoryCombo === "function") closeHistoryCombo(combo);
        cloudSetBoardHash(item.id, false);
      });
      del.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        void deleteCloudBoard(item.id);
      });
      fragment.appendChild(li);
    });
    list.innerHTML = "";
    list.appendChild(fragment);
    if (typeof filterHistoryCombo === "function") filterHistoryCombo(combo);
    var faceItem = activeItem || {
      id: rows[0].board_id,
      title: rows[0].title,
      created_at: rows[0].updated_at || rows[0].created_at,
    };
    if (typeof setHistoryComboFace === "function") setHistoryComboFace(combo, faceItem, "board");
  } catch (error) {
    cloudShowHistoryMessage(error && error.message ? error.message : "Cloud history failed");
  }
}

async function deleteCloudBoard(boardId) {
  if (!cloudClient || !cloudSession || !cloudSession.user || !boardId) return;
  if (!window.confirm("Delete cloud board\n" + boardId + "?")) return;
  try {
    var result = await cloudClient.from("boards").delete().eq("board_id", boardId);
    if (result.error) throw result.error;
    if (boardId === cloudBoardId()) {
      history.replaceState(null, "", location.pathname + location.search);
      await bootstrapBoardFromHash();
      if (typeof renderBoard === "function") renderBoard({ fit: false, restoreView: true });
    }
    setStatus("Deleted cloud board");
    await refreshCloudBoardHistory();
  } catch (error) {
    setStatus(error && error.message ? error.message : "Cloud delete failed", true);
  }
}

(function wireCloudAuth() {
  var signIn = document.getElementById("btnBoardSignIn");
  var menu = document.getElementById("boardAuthMenu");
  if (signIn && menu) {
    signIn.addEventListener("click", function () {
      if (signIn.disabled) return;
      var open = !!menu.hidden;
      menu.hidden = !open;
      signIn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  document.querySelectorAll("[data-board-oauth]").forEach(function (button) {
    button.addEventListener("click", function () {
      if (menu) menu.hidden = true;
      if (signIn) signIn.setAttribute("aria-expanded", "false");
      void cloudSignIn(button.dataset.boardOauth);
    });
  });
  var save = document.getElementById("btnBoardSaveCloud");
  if (save) save.addEventListener("click", function () { void saveBoardToCloud({ explicit: true }); });
  var signOut = document.getElementById("btnBoardSignOut");
  if (signOut) signOut.addEventListener("click", function () { void cloudSignOut(); });
  document.addEventListener("click", function (event) {
    if (!menu || menu.hidden) return;
    var account = document.getElementById("boardAccount");
    if (!account || !account.contains(event.target)) {
      menu.hidden = true;
      if (signIn) signIn.setAttribute("aria-expanded", "false");
    }
  });
  cloudInit();
})();
