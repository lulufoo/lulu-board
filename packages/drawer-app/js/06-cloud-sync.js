/* drawer-app/06-cloud-sync.js — browser Auth, one latest cloud board per owner */
var cloudClient = null;
var cloudSession = null;
var cloudSessionReady = Promise.resolve(null);
var cloudLoadSeq = 0;
var cloudSaveSeq = 0;
var cloudSiblingBoardIds = [];
var cloudGroupId = "";
var cloudGroupMembers = [];
var cloudPlusDraft = false;
var cloudPlusDraftActive = false;
var cloudPlusDraftSource = "";
var cloudPlusDraftRev = 1;
var cloudBoardCache = {};

function cloudCachePut(store, row) {
  if (!store || !row || !row.board_id) return null;
  store[row.board_id] = {
    board_id: String(row.board_id),
    title: String(row.title || ""),
    bmd: row.bmd == null ? "" : String(row.bmd),
    version: Number(row.version) > 0 ? Number(row.version) : 1,
    share_id: String(row.share_id || ""),
    created_at: String(row.created_at || ""),
    updated_at: String(row.updated_at || ""),
    dirty: !!row.dirty,
    localRev: Number(row.localRev) > 0 ? Number(row.localRev) : 0,
  };
  return store[row.board_id];
}

function cloudCacheGet(store, boardId) {
  var id = String(boardId || "");
  return id && store && store[id] ? store[id] : null;
}

function cloudRememberBoardRow(row) {
  return cloudCachePut(cloudBoardCache, row);
}

function cloudCachedBoardRow(boardId) {
  return cloudCacheGet(cloudBoardCache, boardId);
}

function cloudParkDirtyBoard() {
  var id = typeof cloudBoardId === "function" ? cloudBoardId() : "";
  if (!id || !boardSourceEl) return;
  var prev = cloudCachedBoardRow(id) || {};
  var source = boardSourceEl.value;
  cloudRememberBoardRow({
    board_id: id,
    title: (typeof cloudBoardTitle === "function" ? cloudBoardTitle(source) : "") || prev.title,
    bmd: source,
    version: Number(prev.version || boardServerRev) || 1,
    share_id: prev.share_id,
    created_at: prev.created_at,
    updated_at: prev.updated_at,
    dirty: true,
    localRev: Number(boardLocalRev) || 1,
  });
}

function cloudForgetBoardCache(ids) {
  if (!ids) {
    cloudBoardCache = {};
    return;
  }
  (ids || []).forEach(function (id) {
    if (id) delete cloudBoardCache[id];
  });
}

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

function isLocalDrawerPreview() {
  var host = location.hostname;
  return host === "127.0.0.1" || host === "localhost";
}

function paintLocalHistoryPreview() {
  var list = document.getElementById("boardHistoryList");
  var empty = document.getElementById("boardHistoryEmpty");
  var combo = list && list.closest(".history-combo");
  if (!list || !combo) return;
  if (typeof wireHistoryCombos === "function") wireHistoryCombos();
  var titles = [
    "Alpha Route", "Beta Notes", "Gamma Map", "Delta Spec",
    "Epsilon Draft", "Zeta Review", "Eta Plan", "Selected Board",
    "Theta Board", "Iota Sketch", "Kappa Outline", "Lambda Copy"
  ];
  var active = 7;
  list.innerHTML = "";
  titles.forEach(function (title, index) {
    var li = document.createElement("li");
    li.className = "history-item";
    li.setAttribute("role", "option");
    li.dataset.historyTitle = title;
    li.dataset.historyKind = "board";
    li.classList.toggle("is-active", index === active);
    li.setAttribute("aria-selected", index === active ? "true" : "false");
    var main = document.createElement("div");
    main.className = "history-item-main";
    var top = document.createElement("div");
    top.className = "history-item-top";
    var name = document.createElement("span");
    name.className = "history-item-title";
    name.textContent = title;
    top.appendChild(name);
    main.appendChild(top);
    li.appendChild(main);
    list.appendChild(li);
  });
  if (empty) empty.hidden = true;
  if (typeof setHistoryComboFace === "function") {
    setHistoryComboFace(combo, { title: titles[active] }, "board");
  }
}

function applyLocalSignedInPreview() {
  if (!isLocalDrawerPreview()) return;
  if (cloudSession && cloudSession.user) return;
  cloudHideSignInDialog();
  var signIn = document.getElementById("btnBoardSignIn");
  var session = document.getElementById("boardSession");
  var save = document.getElementById("btnBoardSaveCloud");
  var status = document.getElementById("boardCloudStatus");
  var chip = document.getElementById("btnBoardAccount");
  var initialsEl = document.getElementById("boardAccountInitials");
  var img = document.getElementById("boardAccountAvatarImg");
  if (signIn) signIn.hidden = true;
  if (session) session.hidden = false;
  if (status) {
    status.hidden = true;
    status.title = "";
  }
  if (save) {
    save.hidden = false;
    save.disabled = false;
    save.title = "Not saved";
  }
  if (chip) chip.title = "Local preview";
  if (initialsEl) {
    initialsEl.textContent = "";
    initialsEl.hidden = true;
  }
  if (img) {
    img.removeAttribute("src");
    img.hidden = true;
  }
  cloudSetHistoryVisible(true);
  var list = document.getElementById("boardHistoryList");
  if (!list || !list.children.length) paintLocalHistoryPreview();
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

function cloudSignInDialogOpen() {
  var dialog = cloudSignInDialog();
  return !!(dialog && !dialog.hidden);
}

async function cloudDeclineCloudBoard() {
  cloudHideSignInDialog();
  if (!cloudBoardId()) return;
  history.replaceState(null, "", location.pathname + location.search);
  if (typeof bootstrapBoardFromHash === "function") await bootstrapBoardFromHash();
  if (typeof renderBoard === "function") renderBoard({ fit: false, restoreView: true });
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
    return { hidden: false, pending: false, current: true, label: "Saved", title: "Synced" };
  }
  return { hidden: false, pending: true, current: false, label: "Saved", title: "Not saved" };
}

function cloudSaveUncreated(signedIn, boardId) {
  return !!(signedIn && !String(boardId || "").trim());
}

function syncCloudSaveChrome() {
  var save = document.getElementById("btnBoardSaveCloud");
  var status = document.getElementById("boardCloudStatus");
  if (!save || !status) return;
  var signedIn = !!(cloudSession && cloudSession.user);
  if (!signedIn && isLocalDrawerPreview()) {
    save.hidden = false;
    save.disabled = false;
    save.title = "Not saved";
    status.hidden = true;
    status.title = "";
    return;
  }
  var ownCloud = typeof cloudBoardId === "function" ? cloudBoardId() : "";
  if (!ownCloud && typeof liveBoardId !== "undefined") ownCloud = String(liveBoardId || "");
  if (cloudPlusDraftActive) ownCloud = "";
  if (cloudSaveUncreated(signedIn, ownCloud)) {
    save.hidden = false;
    save.disabled = false;
    save.title = "Not created";
    save.classList.add("is-uncreated");
    status.hidden = true;
    status.title = "";
    return;
  }
  save.classList.remove("is-uncreated");
  var copy = cloudSaveButtonCopy(signedIn, cloudVersionsAligned(boardServerRev, boardLocalRev));
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
  var sessionName = document.getElementById("boardSessionName");
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
  if (sessionName) sessionName.textContent = profile ? profile.name : "";
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
  if (!signedIn) applyLocalSignedInPreview();
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
  if (typeof cloudClearGroupTabs === "function") cloudClearGroupTabs();
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
  cloudForgetBoardCache();
  if (typeof cloudClearGroupTabs === "function") cloudClearGroupTabs();
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

function applyCloudBoardRow(row, opts) {
  opts = opts || {};
  var source = cloudRowSource(row, boardSourceEl ? boardSourceEl.value : "");
  if (boardSourceEl) boardSourceEl.value = source;
  boardDirty = !!(row && row.dirty);
  boardServerRev = Number(row && row.version) || 1;
  if (boardDirty && Number(row.localRev) > 0) boardLocalRev = Number(row.localRev);
  else boardLocalRev = boardServerRev;
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
  if (!opts.skipShare && typeof refreshOwnShareState === "function") void refreshOwnShareState();
  cloudRememberBoardRow({
    board_id: row && row.board_id,
    title: (row && row.title) || cloudBoardTitle(source),
    bmd: source,
    version: boardServerRev,
    share_id: row && row.share_id,
    created_at: row && row.created_at,
    updated_at: row && row.updated_at,
    dirty: boardDirty,
    localRev: boardLocalRev,
  });
  syncCloudSaveChrome();
}

function groupBoardRowsByGroup(boardRows, memberships) {
  var groupOf = {};
  (memberships || []).forEach(function (row) {
    if (!row || !row.board_id || !row.group_id) return;
    groupOf[row.board_id] = row.group_id;
  });
  var groups = [];
  var seen = {};
  (boardRows || []).forEach(function (row) {
    if (!row || !row.board_id) return;
    var groupId = groupOf[row.board_id];
    if (!groupId) return;
    var group = seen[groupId];
    if (!group) {
      group = { group_id: groupId, members: [] };
      seen[groupId] = group;
      groups.push(group);
    }
    group.members.push(row);
  });
  return groups;
}

function loadSiblingBoardIds(boardId, memberships) {
  var id = String(boardId || "");
  var groupId = "";
  (memberships || []).forEach(function (row) {
    if (row && row.board_id === id) groupId = row.group_id;
  });
  if (!groupId) return [];
  var siblings = [];
  (memberships || []).forEach(function (row) {
    if (row && row.group_id === groupId && row.board_id && row.board_id !== id) {
      siblings.push(row.board_id);
    }
  });
  return siblings;
}

async function saveBoardToCloud(opts) {
  opts = opts || {};
  if (!cloudClient || !cloudSession || !cloudSession.user) {
    if (opts.explicit) setStatus("Sign in to save to cloud", true);
    return false;
  }
  if (cloudPlusDraftActive && !opts.explicit) {
    setBoardSyncUI("ok");
    syncCloudSaveChrome();
    return false;
  }
  var source = typeof stripDocumentMeta === "function"
    ? stripDocumentMeta(boardSourceEl && boardSourceEl.value)
    : String(boardSourceEl && boardSourceEl.value || "");
  if (boardSourceEl && source !== boardSourceEl.value) boardSourceEl.value = source;
  var boardId = (typeof cloudBoardId === "function" && cloudBoardId())
    || (typeof liveBoardId !== "undefined" ? String(liveBoardId || "") : "");
  if (cloudPlusDraftActive) boardId = "";
  var title = cloudBoardTitle(source) || "Untitled";
  var seq = ++cloudSaveSeq;
  setBoardSyncUI("saving");
  try {
    var result;
    if (!boardId) {
      boardId = typeof newBoardId === "function" ? newBoardId() : "";
      if (!boardId) throw new Error("Could not mint a board id");
      var joinGroupId = cloudPlusDraftActive && cloudGroupId ? cloudGroupId : null;
      result = await cloudClient.rpc("create_owned_board_with_group", {
        p_board_id: boardId,
        p_title: title,
        p_bmd: source,
        p_group_id: joinGroupId,
      });
      if (result.error) throw result.error;
      if (seq !== cloudSaveSeq) return false;
      var created = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!created) throw new Error("Could not create cloud board");
      if (typeof cloudClearPlusDraftSlot === "function") cloudClearPlusDraftSlot();
      else {
        cloudPlusDraft = false;
        cloudPlusDraftActive = false;
        cloudPlusDraftSource = "";
        cloudPlusDraftRev = 1;
      }
      applyCloudBoardRow(created);
      cloudSetBoardHash(boardId, true);
      if (typeof refreshCloudGroupMembers === "function") await refreshCloudGroupMembers(boardId);
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
    syncCloudSaveChrome();
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
  if (typeof cloudParkPlusDraft === "function" && cloudPlusDraftActive) cloudParkPlusDraft();
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
  var known = typeof cloudKnownGroupBoard === "function" && cloudKnownGroupBoard(boardId);
  var cached = cloudCachedBoardRow(boardId);
  if (cached) {
    if (seq !== cloudLoadSeq) return true;
    cloudPlusDraftActive = false;
    applyCloudBoardRow(cached, { skipShare: known });
    if (known) {
      if (typeof renderCloudGroupTabs === "function") renderCloudGroupTabs();
    } else if (typeof refreshCloudGroupMembers === "function") {
      await refreshCloudGroupMembers(boardId);
      if (seq !== cloudLoadSeq) return true;
    }
    if (typeof renderBoard === "function") renderBoard({ fit: false, restoreView: true });
    setBoardSyncUI("ok");
    setStatus("Cloud board loaded");
    if (!known) void refreshCloudBoardHistory();
    return true;
  }
  setStatus("Loading cloud board…");
  try {
    var result = await cloudClient.from("boards")
      .select("board_id,title,bmd,version,share_id,created_at,updated_at")
      .eq("board_id", boardId)
      .maybeSingle();
    if (result.error) throw result.error;
    if (seq !== cloudLoadSeq) return true;
    if (!result.data) throw new Error("Cloud board not found");
    cloudPlusDraftActive = false;
    applyCloudBoardRow(result.data, { skipShare: known });
    if (known) {
      if (typeof renderCloudGroupTabs === "function") renderCloudGroupTabs();
    } else if (typeof refreshCloudGroupMembers === "function") {
      await refreshCloudGroupMembers(boardId);
      if (seq !== cloudLoadSeq) return true;
    }
    if (typeof renderBoard === "function") renderBoard({ fit: false, restoreView: true });
    setBoardSyncUI("ok");
    setStatus("Cloud board loaded");
    if (!known) void refreshCloudBoardHistory();
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
    if (isLocalDrawerPreview()) applyLocalSignedInPreview();
    else cloudSetHistoryVisible(false);
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
    var memberResult = await cloudClient.from("group_members")
      .select("board_id,group_id");
    if (memberResult.error) throw memberResult.error;
    var rows = result.data || [];
    var groups = groupBoardRowsByGroup(rows, memberResult.data || []);
    if (!groups.length) {
      cloudShowHistoryMessage("No cloud boards yet");
      return;
    }
    if (empty) empty.hidden = true;
    var current = cloudBoardId();
    var activeItem = null;
    var fragment = document.createDocumentFragment();
    groups.forEach(function (group) {
      var faceRow = group.members[0];
      if (!faceRow) return;
      var boardIds = group.members.map(function (row) { return row.board_id; });
      var inGroup = boardIds.indexOf(current) >= 0;
      var item = {
        id: faceRow.board_id,
        title: faceRow.title,
        created_at: faceRow.updated_at || faceRow.created_at,
      };
      var li = document.createElement("li");
      li.className = "history-item";
      li.setAttribute("role", "option");
      li.dataset.historyId = item.id;
      li.dataset.historyTitle = item.title || "Untitled";
      li.dataset.historyKind = "board";
      li.dataset.historyGroupId = group.group_id;
      li.classList.toggle("is-active", inGroup);
      li.setAttribute("aria-selected", inGroup ? "true" : "false");
      if (inGroup) activeItem = item;

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
      del.setAttribute("aria-label", "Delete group");
      del.textContent = "×";
      li.appendChild(main);
      li.appendChild(del);
      li.addEventListener("click", function (event) {
        if (event.target === del || del.contains(event.target)) return;
        if (typeof closeHistoryCombo === "function") closeHistoryCombo(combo);
        if (inGroup) return;
        if (typeof cloudSwitchToBoard === "function") void cloudSwitchToBoard(item.id);
        else cloudSetBoardHash(item.id, false);
      });
      del.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        void deleteCloudGroup(group.group_id, boardIds);
      });
      fragment.appendChild(li);
    });
    list.innerHTML = "";
    list.appendChild(fragment);
    if (typeof filterHistoryCombo === "function") filterHistoryCombo(combo);
    var faceRow = groups[0].members[0];
    var faceItem = activeItem || {
      id: faceRow.board_id,
      title: faceRow.title,
      created_at: faceRow.updated_at || faceRow.created_at,
    };
    if (typeof setHistoryComboFace === "function") setHistoryComboFace(combo, faceItem, "board");
  } catch (error) {
    cloudShowHistoryMessage(error && error.message ? error.message : "Cloud history failed");
  }
}

async function deleteCloudGroup(groupId, boardIds) {
  if (!cloudClient || !cloudSession || !cloudSession.user || !groupId) return;
  var ids = (boardIds || []).filter(Boolean);
  if (!ids.length) return;
  if (typeof boardAskConfirm !== "function") return;
  if (!(await boardAskConfirm({
    title: "Delete this group?",
    copy: "All boards in the group will be deleted.",
    ok: "Delete",
    cancel: "Cancel",
  }))) return;
  try {
    var boards = await cloudClient.from("boards").delete().in("board_id", ids);
    if (boards.error) throw boards.error;
    cloudForgetBoardCache(ids);
    var group = await cloudClient.from("groups").delete().eq("group_id", groupId);
    if (group.error) throw group.error;
    var openId = cloudBoardId();
    if (openId && ids.indexOf(openId) >= 0) {
      history.replaceState(null, "", location.pathname + location.search);
      await bootstrapBoardFromHash();
      if (typeof renderBoard === "function") renderBoard({ fit: false, restoreView: true });
    }
    if (typeof refreshCloudGroupMembers === "function") {
      await refreshCloudGroupMembers(cloudBoardId());
    }
    setStatus("Deleted group");
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
  if (closeDialog) closeDialog.addEventListener("click", function () { void cloudDeclineCloudBoard(); });
  if (backdrop) backdrop.addEventListener("click", function () { void cloudDeclineCloudBoard(); });
  var save = document.getElementById("btnBoardSaveCloud");
  if (save) save.addEventListener("click", function () {
    cloudCloseAccountMenus();
    if (typeof isShareGuest === "function" && isShareGuest() && typeof forkSharedBoard === "function") {
      void forkSharedBoard();
      return;
    }
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
      if (cloudSignInDialogOpen()) void cloudDeclineCloudBoard();
      else cloudHideSignInDialog();
      cloudCloseAccountMenus();
    }
  });
  cloudInit();
})();
