/* Cloud layer. Chrome leftover is reached through hooks. */
import { register, emit, call } from '../core/hooks.js';
import { sentryCount } from '../core/sentry-count.js';
import { stripDocumentMeta, diagramTitleFromBody, newGraphId } from '../core/document-meta.js';

import {
  cloudDiagramIdFromHash,
  cloudDiagramHash,
  cloudShareIdFromHash,
} from '../core/cloud-route.js';
import {
  cloudClient,
  cloudSession,
  cloudSessionReady,
  cloudLoadSeq,
  cloudSaveSeq,
  cloudGroupId,
  cloudPlusDraftActive,
  cloudDiagramCache,
  setCloudClient,
  setCloudSession,
  setCloudSessionReady,
  bumpCloudLoadSeq,
  bumpCloudSaveSeq,
  setCloudPlusDraft,
  setCloudPlusDraftActive,
  setCloudPlusDraftSource,
  setCloudPlusDraftRev,
  setCloudDiagramCache,
  cloudDiagramId,
} from './cloud-state.js';
import {
  diagramSourceEl,
  diagramLocalRev,
  diagramServerRev,
  diagramDirty,
  liveDiagramId,
  setStatus,
  updateDiagramChars,
  applyDiagramLiveMeta,
  syncSourceDockLabel,
  setDiagramDirty,
  setDiagramLocalRev,
  setDiagramServerRev,
  setShellMineTotal,
  setShellMineCursor,
} from '../state/shell-state.js';
import { setDiagramSyncUI } from '../kinds/diagram.js';

/* drawer-app/06-cloud-sync.js — browser Auth, one latest cloud board per owner */

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
  var id = cloudDiagramId();
  if (!id || !diagramSourceEl) return;
  var prev = cloudCachedDiagramRow(id) || {};
  var source = diagramSourceEl.value;
  cloudRememberDiagramRow({
    graph_id: id,
    title: (cloudDiagramTitle(source) != null ? cloudDiagramTitle(source) : "") || prev.title,
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
    setCloudDiagramCache({});
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
  emit("shellRenderMine", []);
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
  await call("bootstrapDiagramFromHash");
  emit("renderDiagram", { fit: false, restoreView: true });
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
  emit("syncBoardDeleteChrome");
  var signedIn = !!(cloudSession && cloudSession.user);
  if (!signedIn && isLocalDrawerPreview()) {
    cloudSetSaveSignedOut(save);
    status.hidden = true;
    cloudSetActionLabel(status, "");
    return;
  }
  save.classList.remove("is-signed-out");
  var ownCloud = cloudDiagramId();
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
  emit("shellPaintAccount", profile);
  emit("syncShareChrome");
  if (!signedIn) {
    applyLocalSignedInPreview();
    emit("shellRenderMine", []);
  }
}

function cloudDiagramTitle(source) {
  var body = stripDocumentMeta(source);
  return diagramTitleFromBody(body);
}

// The board shown in the editor right now: its cloud id, or "" when it has none
// (local server, #z: hash board, share link, unsaved + draft).
function cloudOpenDiagramId() {
  if (typeof cloudPlusDraftActive !== "undefined" && cloudPlusDraftActive) return "";
  return cloudDiagramId();
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
  if (!diagramId) return;
  var hash = cloudDiagramHash(diagramId);
  if (location.hash === hash) return;
  if (replace) history.replaceState(null, "", location.pathname + location.search + hash);
  else location.hash = hash;
}

function cloudClearOpenDiagram() {
  emit("cloudClearGroupTabs");
  if (!cloudDiagramId() || !diagramSourceEl) return;
  diagramSourceEl.value = "";
  setDiagramDirty(false);
  setDiagramLocalRev(0);
  setDiagramServerRev(0);
  updateDiagramChars();
  applyDiagramLiveMeta({ id: "" });
  emit("renderDiagram", { fit: false });
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
    setCloudClient(globalThis.LuluBoardSupabase.createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    }));
    // Session state only. Auth fires again on tab refocus and token refresh, so
    // it must not reopen a board; opening is the open path's job.
    cloudClient.auth.onAuthStateChange(function (_event, session) {
      setCloudSession(session || null);
      cloudSetAccountUi();
      if (cloudSession && !cloudShareIdFromHash(location.hash)) void cloudRefreshGroups();
    });
    setCloudSessionReady(cloudClient.auth.getSession().then(function (result) {
      setCloudSession(result && result.data ? result.data.session : null);
      cloudSetAccountUi();
      if (cloudSession) void cloudRefreshGroups();
      else cloudOpenSignInFromLanding();
      emit("shellOfferBlankStartKind");
      return cloudSession;
    }).catch(function () {
      setCloudSession(null);
      cloudSetAccountUi();
      return null;
    }));
  } catch (error) {
    setCloudClient(null);
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
  setCloudSession(null);
  var leaveCloud = !!cloudDiagramId();
  cloudForgetDiagramCache();
  emit("cloudClearGroupTabs");
  cloudSetAccountUi();
  if (leaveCloud) {
    history.replaceState(null, "", location.pathname + location.search);
    await call("bootstrapDiagramFromHash");
    emit("renderDiagram", { fit: false, restoreView: true });
  }
  setStatus("Signed out");
}

function cloudRowSource(row, fallback) {
  if (row && row.bmd != null) {
    return stripDocumentMeta(row.bmd);
  }
  return fallback == null ? "" : String(fallback);
}

function applyCloudDiagramRow(row, opts) {
  opts = opts || {};
  var source = cloudRowSource(row, diagramSourceEl ? diagramSourceEl.value : "");
  if (diagramSourceEl) diagramSourceEl.value = source;
  setDiagramDirty(!!(row && row.dirty));
  setDiagramServerRev(Number(row && row.version) || 1);
  if (diagramDirty && Number(row.localRev) > 0) setDiagramLocalRev(Number(row.localRev));
  else setDiagramLocalRev(diagramServerRev);
  applyDiagramLiveMeta({
      id: row && row.graph_id || "",
      version: diagramLocalRev,
    });
  updateDiagramChars();
  syncSourceDockLabel();
  emit("setShareView", false);
  emit("setShareEdit", false);
  emit("rememberOwnerShareId", row && row.share_id);
  if (!opts.skipShare) void call("refreshOwnShareState");
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
  var source = stripDocumentMeta(diagramSourceEl && diagramSourceEl.value);
  if (diagramSourceEl && source !== diagramSourceEl.value) diagramSourceEl.value = source;
  var diagramId = (typeof cloudDiagramId === "function" && cloudDiagramId())
    || (typeof liveDiagramId !== "undefined" ? String(liveDiagramId || "") : "");
  if (cloudPlusDraftActive) diagramId = "";
  var title = cloudDiagramTitle(source) || "Untitled";
  var seq = bumpCloudSaveSeq();
  setDiagramSyncUI("saving");
  try {
    if (!diagramId) {
      diagramId = newGraphId();
      if (!diagramId) throw new Error("Could not mint a board id");
      var joinGroupId = cloudPlusDraftActive && cloudGroupId ? cloudGroupId : null;
      var accessToken = cloudSession.access_token;
      if (!accessToken) throw new Error("Sign in to save to cloud");
      var payload = { bmd: source, diagram_id: diagramId };
      if (joinGroupId) payload.group_id = joinGroupId;
      var response = await fetch("https://api.luluboard.app/graphs", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      var rawText = await response.text();
      var createdBody = rawText ? JSON.parse(rawText) : null;
      if (!response.ok) {
        var fail = createdBody && (createdBody.message || createdBody.error) || ("HTTP " + response.status);
        throw new Error(fail);
      }
      if (seq !== cloudSaveSeq) return false;
      if (!createdBody || !createdBody.diagram_id) throw new Error("Could not create cloud diagram");
      var created = {
        graph_id: createdBody.diagram_id,
        title: createdBody.title || title,
        bmd: createdBody.bmd || source,
        version: createdBody.version,
        updated_at: createdBody.updated_at,
        group_id: createdBody.group_id,
      };
      emit("cloudClearPlusDraftSlot");
      setCloudPlusDraft(false);
      setCloudPlusDraftActive(false);
      setCloudPlusDraftSource("");
      setCloudPlusDraftRev(1);
      applyCloudDiagramRow(created);
      cloudSetDiagramHash(diagramId, true);
      await call("refreshCloudGroupMembers", diagramId);
    } else {
      var expected = Number(diagramServerRev);
      if (!(expected > 0)) expected = 1;
      var updateToken = cloudSession.access_token;
      if (!updateToken) throw new Error("Sign in to save to cloud");
      var updateResponse = await fetch("https://api.luluboard.app/graphs", {
        method: "PATCH",
        headers: {
          Authorization: "Bearer " + updateToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          diagram_id: diagramId,
          bmd: source,
          expected_version: expected,
        }),
      });
      var updateText = await updateResponse.text();
      var updateBody = updateText ? JSON.parse(updateText) : null;
      if (updateResponse.status === 409) {
        if (seq !== cloudSaveSeq) return false;
        var latest = await fetchOwnedGraph(diagramId);
        if (!latest) throw new Error("Cloud diagram not found");
        applyCloudDiagramRow(latest);
        emit("renderDiagram", { fit: false, restoreView: true });
        setDiagramSyncUI("conflict");
        setStatus("Cloud version conflict — reloaded", true);
        return false;
      }
      if (!updateResponse.ok) {
        var updateFail = updateBody && (updateBody.message || updateBody.error) || ("HTTP " + updateResponse.status);
        throw new Error(updateFail);
      }
      if (seq !== cloudSaveSeq) return false;
      if (!updateBody || !updateBody.diagram_id) throw new Error("Could not update cloud diagram");
      applyCloudDiagramRow({
        graph_id: updateBody.diagram_id,
        title: updateBody.title || title,
        bmd: updateBody.bmd || source,
        version: updateBody.version,
        updated_at: updateBody.updated_at,
        group_id: updateBody.group_id,
      });
    }
    // Do not steal the hash back if the user already navigated to another cloud board.
    var openId = cloudDiagramId();
    if (!openId || openId === diagramId) cloudSetDiagramHash(diagramId, true);
    syncCloudSaveChrome();
    setDiagramSyncUI("ok");
    setStatus("Saved to cloud");
    if (opts.explicit) emit("showCopyTip", "Saved to cloud");
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
  emit("setShareView", false);
  emit("setShareEdit", false);
  var diagramId = cloudDiagramIdFromHash(raw);
  if (!diagramId) return false;
  // Fade only when a different board opens. Judge now: applying the row sets liveDiagramId.
  var switching = diagramId !== liveDiagramId;
  var requestedGroupId = call("cloudTakeRequestedGroupId") != null ? call("cloudTakeRequestedGroupId") : "";
  if (cloudPlusDraftActive) emit("cloudParkPlusDraft");
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
  var seq = bumpCloudLoadSeq();
  var known = call("cloudKnownGroupDiagram", diagramId);
  var cached = cloudCachedDiagramRow(diagramId);
  if (cached) {
    if (seq !== cloudLoadSeq) return true;
    setCloudPlusDraftActive(false);
    applyCloudDiagramRow(cached, { skipShare: known });
    if (known) {
      emit("renderCloudGroupTabs");
    } else {
      await call("refreshCloudGroupMembers", diagramId, requestedGroupId);
      if (seq !== cloudLoadSeq) return true;
    }
    emit("renderDiagram", { fit: false, restoreView: true, swap: switching });
    setDiagramSyncUI("ok");
    setStatus("Cloud diagram loaded");
    emit("shellRenderMine");
    return true;
  }
  setStatus("Loading cloud diagram…");
  try {
    var result = await fetchOwnedGraph(diagramId);
    if (seq !== cloudLoadSeq) return true;
    if (!result) throw new Error("Cloud diagram not found");
    setCloudPlusDraftActive(false);
    applyCloudDiagramRow(result, { skipShare: known });
    if (known) {
      emit("renderCloudGroupTabs");
    } else {
      await call("refreshCloudGroupMembers", diagramId, requestedGroupId);
      if (seq !== cloudLoadSeq) return true;
    }
    emit("renderDiagram", { fit: false, restoreView: true, swap: switching });
    setDiagramSyncUI("ok");
    setStatus("Cloud diagram loaded");
    emit("shellRenderMine");
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
    emit("shellRenderMine", []);
    emit("shellRenderShared", []);
    return;
  }
  try {
    var page = await call("cloudFetchGroupSummaries");
    setShellMineTotal(page.total);
    var last = page.groups && page.groups[page.groups.length - 1];
    setShellMineCursor(last && page.groups.length < page.total ? call("cloudMineCursor", last) : null);
    emit("shellRenderMine", page.groups);
    void call("cloudRefreshShares");
  } catch (error) {
    setStatus(error && error.message ? error.message : "Could not load your diagrams", true);
  }
}

async function fetchOwnedGraph(diagramId) {
  var accessToken = cloudSession && cloudSession.access_token;
  if (!accessToken) throw new Error("Sign in to open this cloud diagram");
  var response = await fetch("https://api.luluboard.app/graphs?diagram_id=" + encodeURIComponent(diagramId), {
    headers: { Authorization: "Bearer " + accessToken },
  });
  var text = await response.text();
  var body = text ? JSON.parse(text) : null;
  if (response.status === 404) return null;
  if (!response.ok) {
    var fail = body && (body.message || body.error) || ("HTTP " + response.status);
    throw new Error(fail);
  }
  return body;
}

async function deleteCloudDiagrams(ids) {
  var accessToken = cloudSession && cloudSession.access_token;
  if (!accessToken) throw new Error("Sign in to delete");
  var response = await fetch("https://api.luluboard.app/graphs/delete", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ diagram_ids: ids }),
  });
  var text = await response.text();
  var body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    var fail = body && (body.message || body.error) || ("HTTP " + response.status);
    throw new Error(fail);
  }
  return body;
}

async function deleteCloudGroup(groupId, diagramIds) {
  if (!cloudClient || !cloudSession || !cloudSession.user || !groupId) return;
  var ids = (diagramIds || []).filter(Boolean);
  if (!ids.length) return;
  
  if (!(await call("askConfirm", {
    title: "Delete this group?",
    copy: "All diagrams in the group will be deleted.",
    ok: "Delete",
    cancel: "Cancel",
  }))) return;
  try {
    await deleteCloudDiagrams(ids);
    cloudForgetDiagramCache(ids);
    var openId = cloudDiagramId();
    if (openId && ids.indexOf(openId) >= 0) {
      history.replaceState(null, "", location.pathname + location.search);
      await call("bootstrapDiagramFromHash");
      emit("renderDiagram", { fit: false, restoreView: true });
    }
    await call("refreshCloudGroupMembers", cloudDiagramId());
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
      sentryCount("canvas.account");
      var open = !!menu.hidden;
      cloudCloseAccountMenus();
      menu.hidden = !open;
      signIn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  if (chip && sessionMenu) {
    chip.addEventListener("click", function () {
      sentryCount("canvas.account");
      var open = !!sessionMenu.hidden;
      cloudCloseAccountMenus();
      sessionMenu.hidden = !open;
      chip.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  document.querySelectorAll("[data-shell-oauth]").forEach(function (button) {
    button.addEventListener("click", function () {
      var provider = button.getAttribute("data-shell-oauth");
      var onCanvas = !!(button.closest && button.closest("#shellCanvasAuthMenu"));
      if (provider === "google") sentryCount(onCanvas ? "canvas.auth_google" : "home.auth_google");
      else if (provider === "github") sentryCount(onCanvas ? "canvas.auth_github" : "home.auth_github");
      cloudCloseAccountMenus();
      void cloudSignIn(provider);
    });
  });
  var closeDialog = document.getElementById("btnShellSignInClose");
  var backdrop = document.getElementById("shellSignInBackdrop");
  if (closeDialog) closeDialog.addEventListener("click", function () { void cloudDeclineCloudDiagram(); });
  if (backdrop) backdrop.addEventListener("click", function () { void cloudDeclineCloudDiagram(); });
  var save = document.getElementById("btnShellSaveCloud");
  if (save) {
    emit("bindChromeTip", save, function () { return save.getAttribute("aria-label") || ""; });
  }
  if (save) save.addEventListener("click", function () {
    if (save.classList.contains("is-signed-out")) {
      emit("showCopyTip", "Sign in to save to the cloud");
      return;
    }
    cloudCloseAccountMenus();
    if (call("isShareGuest")) {
      void call("forkSharedDiagram");
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

register("cloudDiagramId", cloudDiagramId);
register("cloudPlusDraftActive", function () { return cloudPlusDraftActive; });
register("cloudPlusDraftSet", function (source, rev) {
  setCloudPlusDraftSource(source);
  setCloudPlusDraftRev(rev);
});

register("syncCloudSaveChrome", syncCloudSaveChrome);
register("cloudOpenDiagramId", cloudOpenDiagramId);
register("getDiagramTitle", getDiagramTitle);
register("saveDiagramToCloud", saveDiagramToCloud);
register("loadCloudDiagramByHash", loadCloudDiagramByHash);

export {
  cloudParkDirtyDiagram,
  cloudForgetDiagramCache,
  cloudConfigured,
  isLocalDrawerPreview,
  cloudCloseAccountMenus,
  syncCloudSaveChrome,
  cloudOpenDiagramId,
  getDiagramTitle,
  cloudSetDiagramHash,
  cloudSignOut,
  cloudRowSource,
  applyCloudDiagramRow,
  groupDiagramRowsByGroup,
  loadSiblingDiagramIds,
  saveDiagramToCloud,
  loadCloudDiagramByHash,
  cloudRefreshGroups,
  deleteCloudGroup,
  deleteCloudDiagrams,
  fetchOwnedGraph,
};
