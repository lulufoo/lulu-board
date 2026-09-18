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
}

function cloudSafeAvatarUrl(raw) {
  try {
    var url = new URL(String(raw || ""));
    if (url.protocol !== "https:") return "";
    var host = String(url.hostname || "").toLowerCase();
    if (host === "avatars.githubusercontent.com" || host === "googleusercontent.com" || host.slice(-22) === ".googleusercontent.com") {
      return url.href;
    }
    return "";
  } catch (_e) {
    return "";
  }
}

function cloudAccountProfile(user) {
  var profile = user && user.user_metadata || {};
  var email = String((user && user.email) || profile.email || "").trim();
  var name = String(profile.full_name || profile.name || profile.user_name || profile.preferred_username || "").trim();
  if (!name) name = email ? email.split("@")[0] : "Signed in";
  var parts = name.split(/\s+/).filter(Boolean);
  var initials = parts.slice(0, 2).map(function (part) { return part.charAt(0); }).join("").toUpperCase();
  return {
    name: name,
    email: email,
    avatarUrl: cloudSafeAvatarUrl(profile.avatar_url || profile.picture || ""),
    initials: initials || "?",
  };
}

function cloudSignInDialog() {
  return document.getElementById("boardSignInDialog");
}

function cloudShowSignInDialog() {
  var dialog = cloudSignInDialog();
  if (!dialog) return;
  dialog.hidden = false;
  var first = dialog.querySelector("[data-board-oauth]");
  if (first && typeof first.focus === "function") first.focus();
}

function cloudHideSignInDialog() {
  var dialog = cloudSignInDialog();
  if (dialog) dialog.hidden = true;
}

function cloudCloseAccountMenus() {
  var signIn = document.getElementById("btnBoardSignIn");
  var authMenu = document.getElementById("boardAuthMenu");
  var chip = document.getElementById("btnBoardAccount");
  var sessionMenu = document.getElementById("boardSessionMenu");
  if (authMenu) authMenu.hidden = true;
  if (signIn) signIn.setAttribute("aria-expanded", "false");
  if (sessionMenu) sessionMenu.hidden = true;
  if (chip) chip.setAttribute("aria-expanded", "false");
  if (typeof closeShareMenu === "function") closeShareMenu();
}

function cloudVersionsAligned(serverRev, clientRev) {
  var server = Number(serverRev);
  var client = Number(clientRev);
  return Number.isFinite(server) && Number.isFinite(client) && server > 0 && server === client;
}

function cloudSaveButtonCopy(signedIn, aligned) {
  if (!signedIn) {
    return { hidden: true, pending: false, current: false, label: "Saved", title: "" };
  }
  if (aligned) {
    return { hidden: false, pending: false, current: true, label: "Saved", title: "Already saved to the cloud" };
  }
  return { hidden: false, pending: true, current: false, label: "Saved", title: "Save this board to the cloud" };
}

function syncCloudSaveChrome() {
  var save = document.getElementById("btnBoardSaveCloud");
  var status = document.getElementById("boardCloudStatus");
  if (!save || !status) return;
  var copy = cloudSaveButtonCopy(
    !!(cloudSession && cloudSession.user),
    cloudVersionsAligned(boardServerRev, boardLocalRev)
  );
  save.hidden = !copy.pending;
  save.disabled = !copy.pending;
  save.title = copy.pending ? copy.title : "";
  status.hidden = !copy.current;
  status.title = copy.current ? copy.title : "";
}

function cloudSetAccountUi() {
  var configured = cloudConfigured();
  var signedIn = !!(cloudSession && cloudSession.user);
  var signIn = document.getElementById("btnBoardSignIn");
  var session = document.getElementById("boardSession");
  var chip = document.getElementById("btnBoardAccount");
  var nameEl = document.getElementById("boardAccountName");
  var emailEl = document.getElementById("boardSessionEmail");
  var img = document.getElementById("boardAccountAvatarImg");
  var initialsEl = document.getElementById("boardAccountInitials");
  var profile = signedIn ? cloudAccountProfile(cloudSession.user) : null;

  cloudCloseAccountMenus();
  if (signedIn) cloudHideSignInDialog();
  if (signIn) {
    signIn.hidden = signedIn;
    signIn.disabled = !configured;
    signIn.title = configured ? "Sign in to sync boards" : "Cloud sync is not configured";
  }
  syncCloudSaveChrome();
  if (session) session.hidden = !signedIn;
  if (nameEl) nameEl.textContent = profile ? profile.name : "";
  if (emailEl) emailEl.textContent = profile && profile.email && profile.email !== profile.name ? profile.email : "";
  if (chip) chip.title = profile ? (profile.email || profile.name) : "";
  if (initialsEl) {
    initialsEl.textContent = profile ? profile.initials : "";
    initialsEl.hidden = !!(profile && profile.avatarUrl);
  }
  if (img) {
    img.onload = function () {
      img.hidden = false;
      if (initialsEl) initialsEl.hidden = true;
    };
    img.onerror = function () {
      img.removeAttribute("src");
      img.hidden = true;
      if (initialsEl) initialsEl.hidden = false;
    };
    if (profile && profile.avatarUrl) img.src = profile.avatarUrl;
    else {
      img.removeAttribute("src");
      img.hidden = true;
    }
  }
  cloudSetHistoryVisible(signedIn);
  if (typeof syncShareChrome === "function") syncShareChrome();
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
  var body = typeof stripDocumentMeta === "function" ? stripDocumentMeta(source) : String(source || "");
  return typeof boardTitleFromBody === "function" ? boardTitleFromBody(body) : "";
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
  boardServerRev = 0;
  if (typeof updateBoardChars === "function") updateBoardChars();
  if (typeof applyBoardLiveMeta === "function") applyBoardLiveMeta({ id: "", title: "" });
  if (typeof renderBoard === "function") renderBoard({ fit: false });
  syncCloudSaveChrome();
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
      if (typeof cloudShareIdFromHash === "function" && cloudShareIdFromHash(location.hash)) {
        if (typeof loadSharedBoardByHash === "function") void loadSharedBoardByHash(location.hash);
      } else if (cloudSession) {
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
  var leaveCloud = !!cloudBoardId();
  cloudSetAccountUi();
  cloudShowHistoryMessage("");
  if (leaveCloud) {
    history.replaceState(null, "", location.pathname + location.search);
    if (typeof bootstrapBoardFromHash === "function") await bootstrapBoardFromHash();
    if (typeof renderBoard === "function") renderBoard({ fit: false, restoreView: true });
  }
  setStatus("Signed out");
}

function cloudRowSource(row, fallback) {
  if (row && row.bmd != null) {
    return typeof stripDocumentMeta === "function" ? stripDocumentMeta(row.bmd) : String(row.bmd);
  }
  return fallback == null ? "" : String(fallback);
}

function applyCloudBoardRow(row) {
  var source = cloudRowSource(row, boardSourceEl ? boardSourceEl.value : "");
  if (boardSourceEl) boardSourceEl.value = source;
  boardDirty = false;
  boardServerRev = Number(row && row.version) || 1;
  boardLocalRev = boardServerRev;
  if (typeof applyBoardLiveMeta === "function") {
    applyBoardLiveMeta({
      id: row && row.board_id || "",
      title: (row && row.title) || cloudBoardTitle(source),
      version: boardLocalRev,
    });
  }
  if (typeof updateBoardChars === "function") updateBoardChars();
  if (typeof syncSourceDockLabel === "function") syncSourceDockLabel();
  if (typeof setShareView === "function") setShareView(false);
  if (typeof setShareEdit === "function") setShareEdit(false);
  if (typeof rememberOwnerShareId === "function") rememberOwnerShareId(row && row.share_id);
  if (typeof refreshOwnShareState === "function") void refreshOwnShareState();
  syncCloudSaveChrome();
}

async function saveBoardToCloud(opts) {
  opts = opts || {};
  if (!cloudClient || !cloudSession || !cloudSession.user) {
    if (opts.explicit) setStatus("Sign in to save to cloud", true);
    return false;
  }
  var source = typeof stripDocumentMeta === "function"
    ? stripDocumentMeta(boardSourceEl && boardSourceEl.value)
    : String(boardSourceEl && boardSourceEl.value || "");
  if (boardSourceEl && source !== boardSourceEl.value) boardSourceEl.value = source;
  var boardId = (typeof cloudBoardId === "function" && cloudBoardId())
    || (typeof liveBoardId !== "undefined" ? String(liveBoardId || "") : "");
  var title = cloudBoardTitle(source) || "Untitled";
  var seq = ++cloudSaveSeq;
  setBoardSyncUI("saving");
  try {
    var result;
    if (!boardId) {
      boardId = typeof newBoardId === "function" ? newBoardId() : "";
      if (!boardId) throw new Error("Could not mint a board id");
      result = await cloudClient.from("boards").insert({
        owner_id: cloudSession.user.id,
        board_id: boardId,
        title: title,
        bmd: source,
      }).select("board_id,title,bmd,version,share_id,updated_at").single();
      if (result.error) throw result.error;
      if (seq !== cloudSaveSeq) return false;
      applyCloudBoardRow(result.data);
    } else {
      var expected = Number(boardServerRev);
      if (!(expected > 0)) expected = 1;
      result = await cloudClient.from("boards").update({
        title: title,
        bmd: source,
      }).eq("board_id", boardId).eq("version", expected).select("board_id,title,bmd,version,share_id,updated_at");
      if (result.error) throw result.error;
      if (seq !== cloudSaveSeq) return false;
      var rows = result.data || [];
      if (!rows.length) {
        var latest = await cloudClient.from("boards")
          .select("board_id,title,bmd,version,share_id,updated_at")
          .eq("board_id", boardId)
          .maybeSingle();
        if (latest.error) throw latest.error;
        if (!latest.data) throw new Error("Cloud board not found");
        applyCloudBoardRow(latest.data);
        if (typeof renderBoard === "function") renderBoard({ fit: false, restoreView: true });
        setBoardSyncUI("conflict");
        setStatus("Cloud version conflict — reloaded", true);
        return false;
      }
      applyCloudBoardRow(rows[0]);
    }
    // Do not steal the hash back if the user already navigated to another cloud board.
    var openId = cloudBoardId();
    if (!openId || openId === boardId) cloudSetBoardHash(boardId, true);
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
  if (typeof setShareView === "function") setShareView(false);
  if (typeof setShareEdit === "function") setShareEdit(false);
  var boardId = typeof cloudBoardIdFromHash === "function" ? cloudBoardIdFromHash(raw) : "";
  if (!boardId) return false;
  if (!cloudConfigured() || !cloudClient) {
    setStatus("Cloud sync is not configured", true);
    return true;
  }
  await cloudSessionReady;
  if (!cloudSession || !cloudSession.user) {
    cloudClearOpenBoard();
    cloudShowSignInDialog();
    setStatus("Sign in to open this cloud board", true);
    return true;
  }
  var seq = ++cloudLoadSeq;
  setStatus("Loading cloud board…");
  try {
    var result = await cloudClient.from("boards")
      .select("board_id,title,bmd,version,share_id,created_at,updated_at")
      .eq("board_id", boardId)
      .maybeSingle();
    if (result.error) throw result.error;
    if (seq !== cloudLoadSeq) return true;
    if (!result.data) throw new Error("Cloud board not found");
    applyCloudBoardRow(result.data);
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
  var chip = document.getElementById("btnBoardAccount");
  var sessionMenu = document.getElementById("boardSessionMenu");
  if (signIn && menu) {
    signIn.addEventListener("click", function () {
      if (signIn.disabled) return;
      var open = !!menu.hidden;
      cloudCloseAccountMenus();
      menu.hidden = !open;
      signIn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  if (chip && sessionMenu) {
    chip.addEventListener("click", function () {
      var open = !!sessionMenu.hidden;
      cloudCloseAccountMenus();
      sessionMenu.hidden = !open;
      chip.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  document.querySelectorAll("[data-board-oauth]").forEach(function (button) {
    button.addEventListener("click", function () {
      cloudCloseAccountMenus();
      void cloudSignIn(button.dataset.boardOauth);
    });
  });
  var closeDialog = document.getElementById("btnBoardSignInClose");
  var backdrop = document.getElementById("boardSignInBackdrop");
  if (closeDialog) closeDialog.addEventListener("click", cloudHideSignInDialog);
  if (backdrop) backdrop.addEventListener("click", cloudHideSignInDialog);
  var save = document.getElementById("btnBoardSaveCloud");
  if (save) save.addEventListener("click", function () {
    cloudCloseAccountMenus();
    void saveBoardToCloud({ explicit: true });
  });
  var signOut = document.getElementById("btnBoardSignOut");
  if (signOut) signOut.addEventListener("click", function () {
    cloudCloseAccountMenus();
    void cloudSignOut();
  });
  document.addEventListener("click", function (event) {
    var account = document.getElementById("boardAccount");
    if (!account || account.contains(event.target)) return;
    cloudCloseAccountMenus();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      cloudHideSignInDialog();
      cloudCloseAccountMenus();
    }
  });
  cloudInit();
})();
