/* drawer-app/06-cloud-sync.js — browser Auth, one latest cloud board per owner */
var cloudClient = null;
var cloudSession = null;
var cloudSessionReady = Promise.resolve(null);
var cloudLoadSeq = 0;
var cloudSaveSeq = 0;
var cloudSiblingDiagramIds = [];
var cloudGroupId = "";
var cloudGroupMembers = [];
var cloudPlusDraft = false;
var cloudPlusDraftActive = false;
var cloudPlusDraftSource = "";
var cloudPlusDraftRev = 1;
var cloudDiagramCache = {};

function cloudCachePut(store, row) {
  if (!store || !row || !row.graph_id) return null;
  store[row.graph_id] = {
    graph_id: String(row.graph_id),
    title: String(row.title || ""),
    bmd: row.bmd == null ? "" : String(row.bmd),
    version: Number(row.version) > 0 ? Number(row.version) : 1,
    share_id: String(row.share_id || ""),
    created_at: String(row.created_at || ""),
    updated_at: String(row.updated_at || ""),
    dirty: !!row.dirty,
    localRev: Number(row.localRev) > 0 ? Number(row.localRev) : 0,
  };
  return store[row.graph_id];
}

function cloudCacheGet(store, diagramId) {
  var id = String(diagramId || "");
  return id && store && store[id] ? store[id] : null;
}

function cloudRememberDiagramRow(row) {
  return cloudCachePut(cloudDiagramCache, row);
}

function cloudCachedDiagramRow(diagramId) {
  return cloudCacheGet(cloudDiagramCache, diagramId);
}

function cloudParkDirtyDiagram() {
  var id = typeof cloudDiagramId === "function" ? cloudDiagramId() : "";
  if (!id || !diagramSourceEl) return;
  var prev = cloudCachedDiagramRow(id) || {};
  var source = diagramSourceEl.value;
  cloudRememberDiagramRow({
    graph_id: id,
    title: (typeof cloudDiagramTitle === "function" ? cloudDiagramTitle(source) : "") || prev.title,
    bmd: source,
    version: Number(prev.version || diagramServerRev) || 1,
    share_id: prev.share_id,
    created_at: prev.created_at,
    updated_at: prev.updated_at,
    dirty: true,
    localRev: Number(diagramLocalRev) || 1,
  });
}

function cloudForgetDiagramCache(ids) {
  if (!ids) {
    cloudDiagramCache = {};
    return;
  }
  (ids || []).forEach(function (id) {
    if (id) delete cloudDiagramCache[id];
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

function cloudDiagramId() {
  return typeof cloudDiagramIdFromHash === "function"
    ? cloudDiagramIdFromHash(typeof location !== "undefined" ? location.hash : "")
    : "";
}

function isLocalDrawerPreview() {
  var host = location.hostname;
  return host === "127.0.0.1" || host === "localhost";
}

function applyLocalSignedInPreview() {
  if (!isLocalDrawerPreview()) return;
  if (cloudSession && cloudSession.user) return;
  cloudHideSignInDialog();
  var signIn = document.getElementById("btnShellSignIn");
  var session = document.getElementById("shellSession");
  var save = document.getElementById("btnShellSaveCloud");
  var status = document.getElementById("shellCloudStatus");
  var chip = document.getElementById("btnShellSession");
  var initialsEl = document.getElementById("shellSessionInitials");
  var img = document.getElementById("shellSessionAvatarImg");
  if (signIn) signIn.hidden = true;
  if (session) session.hidden = false;
  if (status) status.hidden = true;
  if (save) cloudSetSaveSignedOut(save);
  if (chip) chip.title = "Local preview";
  if (initialsEl) {
    initialsEl.textContent = "";
    initialsEl.hidden = true;
  }
  if (img) {
    img.removeAttribute("src");
    img.hidden = true;
  }
  if (typeof shellRenderMine === "function") shellRenderMine([]);
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
  return document.getElementById("shellSignInDialog");
}

function cloudShowSignInDialog() {
  var dialog = cloudSignInDialog();
  if (!dialog) return;
  dialog.hidden = false;
  var first = dialog.querySelector("[data-shell-oauth]");
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

async function cloudDeclineCloudDiagram() {
  cloudHideSignInDialog();
  if (!cloudDiagramId()) return;
  history.replaceState(null, "", location.pathname + location.search);
  if (typeof bootstrapDiagramFromHash === "function") await bootstrapDiagramFromHash();
  if (typeof renderDiagram === "function") renderDiagram({ fit: false, restoreView: true });
}

function cloudCloseAccountMenus() {
  var signIn = document.getElementById("btnShellSignIn");
  var authMenu = document.getElementById("shellCanvasAuthMenu");
  var chip = document.getElementById("btnShellSession");
  var sessionMenu = document.getElementById("shellSessionMenu");
  if (authMenu) authMenu.hidden = true;
  if (signIn) signIn.setAttribute("aria-expanded", "false");
  if (sessionMenu) sessionMenu.hidden = true;
  if (chip) chip.setAttribute("aria-expanded", "false");
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
    return { hidden: false, pending: false, current: true, label: "Saved", title: "Sync" };
  }
  return { hidden: false, pending: true, current: false, label: "Saved", title: "Save" };
}

function cloudSaveUncreated(signedIn, diagramId) {
  return !!(signedIn && !String(diagramId || "").trim());
}

// Hover tip and aria-label say what a click does (LB-376).
function cloudSetActionLabel(el, text) {
  el.removeAttribute("title");
  if (text) el.setAttribute("aria-label", text);
  else el.removeAttribute("aria-label");
}

// Local preview, signed out: a faded button whose click only explains.
function cloudSetSaveSignedOut(save) {
  save.hidden = false;
  save.disabled = false;
  save.classList.remove("is-uncreated");
  save.classList.add("is-signed-out");
  cloudSetActionLabel(save, "Sign in to save");
}

function syncCloudSaveChrome() {
  var save = document.getElementById("btnShellSaveCloud");
  var status = document.getElementById("shellCloudStatus");
  if (!save || !status) return;
  if (typeof syncBoardDeleteChrome === "function") syncBoardDeleteChrome();
  var signedIn = !!(cloudSession && cloudSession.user);
  if (!signedIn && isLocalDrawerPreview()) {
    cloudSetSaveSignedOut(save);
    status.hidden = true;
    cloudSetActionLabel(status, "");
    return;
  }
  save.classList.remove("is-signed-out");
  var ownCloud = typeof cloudDiagramId === "function" ? cloudDiagramId() : "";
  if (!ownCloud && typeof liveDiagramId !== "undefined") ownCloud = String(liveDiagramId || "");
  if (cloudPlusDraftActive) ownCloud = "";
  if (cloudSaveUncreated(signedIn, ownCloud)) {
    save.hidden = false;
    save.disabled = false;
    cloudSetActionLabel(save, "Create");
    save.classList.add("is-uncreated");
    status.hidden = true;
    cloudSetActionLabel(status, "");
    return;
  }
  save.classList.remove("is-uncreated");
  var copy = cloudSaveButtonCopy(signedIn, cloudVersionsAligned(diagramServerRev, diagramLocalRev));
  save.hidden = !copy.pending;
  save.disabled = !copy.pending;
  cloudSetActionLabel(save, copy.pending ? copy.title : "");
  status.hidden = !copy.current;
  cloudSetActionLabel(status, copy.current ? copy.title : "");
}

function cloudSetAccountUi() {
  var configured = cloudConfigured();
  var signedIn = !!(cloudSession && cloudSession.user);
  var signIn = document.getElementById("btnShellSignIn");
  var session = document.getElementById("shellSession");
  var chip = document.getElementById("btnShellSession");
  var nameEl = document.getElementById("shellSessionName");
  var sessionName = document.getElementById("shellSessionLabel");
  var emailEl = document.getElementById("shellSessionEmail");
  var img = document.getElementById("shellSessionAvatarImg");
  var initialsEl = document.getElementById("shellSessionInitials");
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
  if (typeof shellPaintAccount === "function") shellPaintAccount(profile);
  if (typeof syncShareChrome === "function") syncShareChrome();
  if (!signedIn) {
    applyLocalSignedInPreview();
    if (typeof shellRenderMine === "function") shellRenderMine([]);
  }
}

function cloudDiagramTitle(source) {
  var body = typeof stripDocumentMeta === "function" ? stripDocumentMeta(source) : String(source || "");
  return typeof diagramTitleFromBody === "function" ? diagramTitleFromBody(body) : "";
}

// The board shown in the editor right now: its cloud id, or "" when it has none
// (local server, #z: hash board, share link, unsaved + draft).
function cloudOpenDiagramId() {
  if (typeof cloudPlusDraftActive !== "undefined" && cloudPlusDraftActive) return "";
  return typeof cloudDiagramId === "function" ? cloudDiagramId() : "";
}

// SSOT for a board's display title: in-memory md first (the open board's live
// source, then the cached bmd), else the queried boards.title, else Untitled.
// An empty id means the open board without a cloud id: read the editor md.
function getDiagramTitle(diagramId, queriedTitle) {
  var id = String(diagramId || "");
  var source = null;
  var editor = typeof diagramSourceEl !== "undefined" && diagramSourceEl ? diagramSourceEl : null;
  if (editor && (!id || id === cloudOpenDiagramId())) {
    source = editor.value;
  } else {
    var cached = cloudCachedDiagramRow(id);
    if (cached && cached.bmd) source = cached.bmd;
  }
  var title = source != null ? cloudDiagramTitle(source) : String(queriedTitle || "");
  return title.trim() || "Untitled";
}

function cloudSetDiagramHash(diagramId, replace) {
  if (!diagramId || typeof cloudDiagramHash !== "function") return;
  var hash = cloudDiagramHash(diagramId);
  if (location.hash === hash) return;
  if (replace) history.replaceState(null, "", location.pathname + location.search + hash);
  else location.hash = hash;
}

function cloudClearOpenDiagram() {
  if (typeof cloudClearGroupTabs === "function") cloudClearGroupTabs();
  if (!cloudDiagramId() || !diagramSourceEl) return;
  diagramSourceEl.value = "";
  diagramDirty = false;
  diagramLocalRev = 0;
  diagramServerRev = 0;
  if (typeof updateDiagramChars === "function") updateDiagramChars();
  if (typeof applyDiagramLiveMeta === "function") applyDiagramLiveMeta({ id: "" });
  if (typeof renderDiagram === "function") renderDiagram({ fit: false });
  syncCloudSaveChrome();
}

// /landing sign-in buttons set this one-shot flag ("github" or "menu"), then open a blank board.
function cloudOpenSignInFromLanding() {
  var flag = "lulu-board:open-sign-in";
  var intent = "";
  try {
    intent = sessionStorage.getItem(flag) || "";
    if (intent) sessionStorage.removeItem(flag);
  } catch (_e) {
    return;
  }
  if (intent === "github") {
    void cloudSignIn("github");
    return;
  }
  var signIn = document.getElementById("btnShellSignIn");
  if (intent && signIn && !signIn.hidden && !signIn.disabled) signIn.click();
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
        if (typeof loadSharedDiagramByHash === "function") void loadSharedDiagramByHash(location.hash);
      } else if (cloudSession) {
        void cloudRefreshGroups();
        if (cloudDiagramId()) void loadCloudDiagramByHash(location.hash);
      }
    });
    cloudSessionReady = cloudClient.auth.getSession().then(function (result) {
      cloudSession = result && result.data ? result.data.session : null;
      cloudSetAccountUi();
      if (cloudSession) void cloudRefreshGroups();
      else cloudOpenSignInFromLanding();
      if (typeof shellOfferBlankStartKind === "function") shellOfferBlankStartKind();
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
  // Always land on /?ws=1 after OAuth (LB-356); do not return to the pre-login URL.
  // Supabase PKCE appends ?code= (or &code=) onto redirectTo for detectSessionInUrl.
  var returnTo = location.origin + "/?ws=1";
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
  var leaveCloud = !!cloudDiagramId();
  cloudForgetDiagramCache();
  if (typeof cloudClearGroupTabs === "function") cloudClearGroupTabs();
  cloudSetAccountUi();
  if (leaveCloud) {
    history.replaceState(null, "", location.pathname + location.search);
    if (typeof bootstrapDiagramFromHash === "function") await bootstrapDiagramFromHash();
    if (typeof renderDiagram === "function") renderDiagram({ fit: false, restoreView: true });
  }
  setStatus("Signed out");
}

function cloudRowSource(row, fallback) {
  if (row && row.bmd != null) {
    return typeof stripDocumentMeta === "function" ? stripDocumentMeta(row.bmd) : String(row.bmd);
  }
  return fallback == null ? "" : String(fallback);
}

function applyCloudDiagramRow(row, opts) {
  opts = opts || {};
  var source = cloudRowSource(row, diagramSourceEl ? diagramSourceEl.value : "");
  if (diagramSourceEl) diagramSourceEl.value = source;
  diagramDirty = !!(row && row.dirty);
  diagramServerRev = Number(row && row.version) || 1;
  if (diagramDirty && Number(row.localRev) > 0) diagramLocalRev = Number(row.localRev);
  else diagramLocalRev = diagramServerRev;
  if (typeof applyDiagramLiveMeta === "function") {
    applyDiagramLiveMeta({
      id: row && row.graph_id || "",
      version: diagramLocalRev,
    });
  }
  if (typeof updateDiagramChars === "function") updateDiagramChars();
  if (typeof syncSourceDockLabel === "function") syncSourceDockLabel();
  if (typeof setShareView === "function") setShareView(false);
  if (typeof setShareEdit === "function") setShareEdit(false);
  if (typeof rememberOwnerShareId === "function") rememberOwnerShareId(row && row.share_id);
  if (!opts.skipShare && typeof refreshOwnShareState === "function") void refreshOwnShareState();
  cloudRememberDiagramRow({
    graph_id: row && row.graph_id,
    title: (row && row.title) || cloudDiagramTitle(source),
    bmd: source,
    version: diagramServerRev,
    share_id: row && row.share_id,
    created_at: row && row.created_at,
    updated_at: row && row.updated_at,
    dirty: diagramDirty,
    localRev: diagramLocalRev,
  });
  syncCloudSaveChrome();
}

function groupDiagramRowsByGroup(diagramRows, memberships) {
  var groupOf = {};
  (memberships || []).forEach(function (row) {
    if (!row || !row.graph_id || !row.group_id) return;
    groupOf[row.graph_id] = row.group_id;
  });
  var groups = [];
  var seen = {};
  (diagramRows || []).forEach(function (row) {
    if (!row || !row.graph_id) return;
    var groupId = groupOf[row.graph_id];
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

function loadSiblingDiagramIds(diagramId, memberships) {
  var id = String(diagramId || "");
  var groupId = "";
  (memberships || []).forEach(function (row) {
    if (row && row.graph_id === id) groupId = row.group_id;
  });
  if (!groupId) return [];
  var siblings = [];
  (memberships || []).forEach(function (row) {
    if (row && row.group_id === groupId && row.graph_id && row.graph_id !== id) {
      siblings.push(row.graph_id);
    }
  });
  return siblings;
}

async function saveDiagramToCloud(opts) {
  opts = opts || {};
  if (!cloudClient || !cloudSession || !cloudSession.user) {
    if (opts.explicit) setStatus("Sign in to save to cloud", true);
    return false;
  }
  if (cloudPlusDraftActive && !opts.explicit) {
    setDiagramSyncUI("ok");
    syncCloudSaveChrome();
    return false;
  }
  var source = typeof stripDocumentMeta === "function"
    ? stripDocumentMeta(diagramSourceEl && diagramSourceEl.value)
    : String(diagramSourceEl && diagramSourceEl.value || "");
  if (diagramSourceEl && source !== diagramSourceEl.value) diagramSourceEl.value = source;
  var diagramId = (typeof cloudDiagramId === "function" && cloudDiagramId())
    || (typeof liveDiagramId !== "undefined" ? String(liveDiagramId || "") : "");
  if (cloudPlusDraftActive) diagramId = "";
  var title = cloudDiagramTitle(source) || "Untitled";
  var seq = ++cloudSaveSeq;
  setDiagramSyncUI("saving");
  try {
    var result;
    if (!diagramId) {
      diagramId = typeof newGraphId === "function" ? newGraphId() : "";
      if (!diagramId) throw new Error("Could not mint a board id");
      var joinGroupId = cloudPlusDraftActive && cloudGroupId ? cloudGroupId : null;
      result = await cloudClient.rpc("create_owned_graph_with_group", {
        p_graph_id: diagramId,
        p_title: title,
        p_bmd: source,
        p_group_id: joinGroupId,
      });
      if (result.error) throw result.error;
      if (seq !== cloudSaveSeq) return false;
      var created = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!created) throw new Error("Could not create cloud diagram");
      if (typeof cloudClearPlusDraftSlot === "function") cloudClearPlusDraftSlot();
      else {
        cloudPlusDraft = false;
        cloudPlusDraftActive = false;
        cloudPlusDraftSource = "";
        cloudPlusDraftRev = 1;
      }
      applyCloudDiagramRow(created);
      cloudSetDiagramHash(diagramId, true);
      if (typeof refreshCloudGroupMembers === "function") await refreshCloudGroupMembers(diagramId);
    } else {
      var expected = Number(diagramServerRev);
      if (!(expected > 0)) expected = 1;
      result = await cloudClient.from("graphs").update({
        title: title,
        bmd: source,
      }).eq("graph_id", diagramId).eq("version", expected).select("graph_id,title,bmd,version,share_id,updated_at");
      if (result.error) throw result.error;
      if (seq !== cloudSaveSeq) return false;
      var rows = result.data || [];
      if (!rows.length) {
        var latest = await cloudClient.from("graphs")
          .select("graph_id,title,bmd,version,share_id,updated_at")
          .eq("graph_id", diagramId)
          .maybeSingle();
        if (latest.error) throw latest.error;
        if (!latest.data) throw new Error("Cloud diagram not found");
        applyCloudDiagramRow(latest.data);
        if (typeof renderDiagram === "function") renderDiagram({ fit: false, restoreView: true });
        setDiagramSyncUI("conflict");
        setStatus("Cloud version conflict — reloaded", true);
        return false;
      }
      applyCloudDiagramRow(rows[0]);
    }
    // Do not steal the hash back if the user already navigated to another cloud board.
    var openId = cloudDiagramId();
    if (!openId || openId === diagramId) cloudSetDiagramHash(diagramId, true);
    syncCloudSaveChrome();
    setDiagramSyncUI("ok");
    setStatus("Saved to cloud");
    if (opts.explicit && typeof showCopyTip === "function") showCopyTip("Saved to cloud");
    await cloudRefreshGroups();
    return true;
  } catch (error) {
    if (seq !== cloudSaveSeq) return false;
    setDiagramSyncUI("error");
    setStatus(error && error.message ? error.message : "Cloud save failed", true);
    return false;
  }
}

async function loadCloudDiagramByHash(raw) {
  if (typeof setShareView === "function") setShareView(false);
  if (typeof setShareEdit === "function") setShareEdit(false);
  var diagramId = typeof cloudDiagramIdFromHash === "function" ? cloudDiagramIdFromHash(raw) : "";
  if (!diagramId) return false;
  var requestedGroupId = typeof cloudTakeRequestedGroupId === "function" ? cloudTakeRequestedGroupId() : "";
  if (typeof cloudParkPlusDraft === "function" && cloudPlusDraftActive) cloudParkPlusDraft();
  if (!cloudConfigured() || !cloudClient) {
    setStatus("Cloud sync is not configured", true);
    return true;
  }
  await cloudSessionReady;
  if (!cloudSession || !cloudSession.user) {
    cloudClearOpenDiagram();
    cloudShowSignInDialog();
    setStatus("Sign in to open this cloud diagram", true);
    return true;
  }
  var seq = ++cloudLoadSeq;
  var known = typeof cloudKnownGroupDiagram === "function" && cloudKnownGroupDiagram(diagramId);
  var cached = cloudCachedDiagramRow(diagramId);
  if (cached) {
    if (seq !== cloudLoadSeq) return true;
    cloudPlusDraftActive = false;
    applyCloudDiagramRow(cached, { skipShare: known });
    if (known) {
      if (typeof renderCloudGroupTabs === "function") renderCloudGroupTabs();
    } else if (typeof refreshCloudGroupMembers === "function") {
      await refreshCloudGroupMembers(diagramId, requestedGroupId);
      if (seq !== cloudLoadSeq) return true;
    }
    if (typeof renderDiagram === "function") renderDiagram({ fit: false, restoreView: true });
    setDiagramSyncUI("ok");
    setStatus("Cloud diagram loaded");
    return true;
  }
  setStatus("Loading cloud diagram…");
  try {
    var result = await cloudClient.from("graphs")
      .select("graph_id,title,bmd,version,share_id,created_at,updated_at")
      .eq("graph_id", diagramId)
      .maybeSingle();
    if (result.error) throw result.error;
    if (seq !== cloudLoadSeq) return true;
    if (!result.data) throw new Error("Cloud diagram not found");
    cloudPlusDraftActive = false;
    applyCloudDiagramRow(result.data, { skipShare: known });
    if (known) {
      if (typeof renderCloudGroupTabs === "function") renderCloudGroupTabs();
    } else if (typeof refreshCloudGroupMembers === "function") {
      await refreshCloudGroupMembers(diagramId, requestedGroupId);
      if (seq !== cloudLoadSeq) return true;
    }
    if (typeof renderDiagram === "function") renderDiagram({ fit: false, restoreView: true });
    setDiagramSyncUI("ok");
    setStatus("Cloud diagram loaded");
    return true;
  } catch (error) {
    if (seq !== cloudLoadSeq) return true;
    cloudClearOpenDiagram();
    setDiagramSyncUI("error");
    setStatus(error && error.message ? error.message : "Cloud diagram load failed", true);
    return true;
  }
}

// Refresh the drawer's Mine list from the cloud. Signed out: empty (or sample rows in the local preview).
async function cloudRefreshGroups() {
  if (!cloudClient || !cloudSession || !cloudSession.user) {
    if (isLocalDrawerPreview()) applyLocalSignedInPreview();
    if (typeof shellRenderMine === "function") shellRenderMine([]);
    if (typeof shellRenderShared === "function") shellRenderShared([]);
    return;
  }
  try {
    var groups = await cloudFetchGroupSummaries();
    if (typeof shellRenderMine === "function") shellRenderMine(groups);
    if (typeof cloudRefreshShares === "function") void cloudRefreshShares();
  } catch (error) {
    setStatus(error && error.message ? error.message : "Could not load your diagrams", true);
  }
}

async function deleteCloudGroup(groupId, diagramIds) {
  if (!cloudClient || !cloudSession || !cloudSession.user || !groupId) return;
  var ids = (diagramIds || []).filter(Boolean);
  if (!ids.length) return;
  if (typeof askConfirm !== "function") return;
  if (!(await askConfirm({
    title: "Delete this group?",
    copy: "All diagrams in the group will be deleted.",
    ok: "Delete",
    cancel: "Cancel",
  }))) return;
  try {
    var boards = await cloudClient.from("graphs").delete().in("graph_id", ids);
    if (boards.error) throw boards.error;
    cloudForgetDiagramCache(ids);
    var openId = cloudDiagramId();
    if (openId && ids.indexOf(openId) >= 0) {
      history.replaceState(null, "", location.pathname + location.search);
      await bootstrapDiagramFromHash();
      if (typeof renderDiagram === "function") renderDiagram({ fit: false, restoreView: true });
    }
    if (typeof refreshCloudGroupMembers === "function") {
      await refreshCloudGroupMembers(cloudDiagramId());
    }
    setStatus("Deleted group");
    await cloudRefreshGroups();
  } catch (error) {
    setStatus(error && error.message ? error.message : "Cloud delete failed", true);
  }
}

(function wireCloudAuth() {
  var signIn = document.getElementById("btnShellSignIn");
  var menu = document.getElementById("shellCanvasAuthMenu");
  var chip = document.getElementById("btnShellSession");
  var sessionMenu = document.getElementById("shellSessionMenu");
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
  document.querySelectorAll("[data-shell-oauth]").forEach(function (button) {
    button.addEventListener("click", function () {
      cloudCloseAccountMenus();
      void cloudSignIn(button.dataset.boardOauth);
    });
  });
  var closeDialog = document.getElementById("btnShellSignInClose");
  var backdrop = document.getElementById("shellSignInBackdrop");
  if (closeDialog) closeDialog.addEventListener("click", function () { void cloudDeclineCloudDiagram(); });
  if (backdrop) backdrop.addEventListener("click", function () { void cloudDeclineCloudDiagram(); });
  var save = document.getElementById("btnShellSaveCloud");
  if (save && typeof bindChromeTip === "function") {
    bindChromeTip(save, function () { return save.getAttribute("aria-label") || ""; });
  }
  if (save) save.addEventListener("click", function () {
    if (save.classList.contains("is-signed-out")) {
      if (typeof showCopyTip === "function") showCopyTip("Sign in to save to the cloud");
      return;
    }
    cloudCloseAccountMenus();
    if (typeof isShareGuest === "function" && isShareGuest() && typeof forkSharedDiagram === "function") {
      void forkSharedDiagram();
      return;
    }
    void saveDiagramToCloud({ explicit: true });
  });
  var signOut = document.getElementById("btnShellSessionOut");
  if (signOut) signOut.addEventListener("click", function () {
    cloudCloseAccountMenus();
    void cloudSignOut();
  });
  document.addEventListener("click", function (event) {
    var account = document.getElementById("shellAccount");
    if (!account || account.contains(event.target)) return;
    cloudCloseAccountMenus();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      if (cloudSignInDialogOpen()) void cloudDeclineCloudDiagram();
      else cloudHideSignInDialog();
      cloudCloseAccountMenus();
    }
  });
  cloudInit();
})();
