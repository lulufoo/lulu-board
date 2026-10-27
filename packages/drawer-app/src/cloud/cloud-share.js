/* Cloud layer. Chrome leftover is reached through hooks. */
import { register, emit, call } from '../core/hooks.js';

import { stripDocumentMeta } from '../core/document-meta.js';

import { cloudShareIdFromHash } from '../core/cloud-route.js';
import {
  cloudClient,
  cloudSession,
  cloudSessionReady,
  cloudLoadSeq,
  cloudSaveSeq,
  ownerShareId,
  bumpCloudLoadSeq,
  bumpCloudSaveSeq,
  setOwnerShareId,
  setOwnerShareRole,
  setOwnerIsPublic,
  cloudDiagramId,
} from './cloud-state.js';
import {
  diagramSourceEl,
  diagramLocalRev,
  diagramServerRev,
  setStatus,
  showDiagramError,
  updateDiagramChars,
  applyDiagramLiveMeta,
  syncSourceDockLabel,
  setDiagramDirty,
  setDiagramLocalRev,
  setDiagramServerRev,
  setLiveDiagramId,
} from '../state/shell-state.js';

import {
  cloudSetDiagramHash,
  loadCloudDiagramByHash,
  getDiagramTitle,
  cloudOpenDiagramId,
  cloudConfigured,
  cloudRowSource,
  saveDiagramToCloud,
} from './cloud-sync.js';
import { setDiagramSyncUI } from '../kinds/diagram.js';
import { cloudClearGroupTabs } from './cloud-group-tabs.js';

/* drawer-app/06-cloud-share.js — share rpc helpers and guest-share chrome (the share list lives in the left drawer) */

function isShareView() { return document.documentElement.dataset.shareView === "on"; }
function isShareEdit() { return document.documentElement.dataset.shareEdit === "on"; }
function isShareGuest() { return isShareView() || isShareEdit(); }
function setShareEdit(on) {
  if (on) document.documentElement.dataset.shareEdit = "on";
  else delete document.documentElement.dataset.shareEdit;
  syncShareChrome();
  call("syncCloudSaveChrome");
}

function setShareView(on) {
  if (on) document.documentElement.dataset.shareView = "on";
  else delete document.documentElement.dataset.shareView;
  if (diagramSourceEl) diagramSourceEl.readOnly = false;
  if (on) setShareEdit(false);
  syncShareChrome();
  call("syncCloudSaveChrome");
}
function rememberOwnerShareId(shareId) {
  setOwnerShareId(String(shareId || ""));
  if (!ownerShareId) {
    setOwnerShareRole("view");
    setOwnerIsPublic(false);
  }
  if (!isShareView()) syncShareChrome();
}
function shareRpcError(error, fallback) {
  return error && error.message ? error.message : fallback;
}
function applySharedDiagramRow(row) {
  var source = cloudRowSource(row, "");
  if (diagramSourceEl) diagramSourceEl.value = source;
  setDiagramDirty(false);
  setDiagramServerRev(Number(row && row.version) || 1);
  setDiagramLocalRev(diagramServerRev);
  applyDiagramLiveMeta({
      id: "",
      version: diagramLocalRev,
    });
  updateDiagramChars();
  syncSourceDockLabel();
  call("syncCloudSaveChrome");
}
async function loadSharedDiagramByHash(raw) {
  var shareId = cloudShareIdFromHash(raw);
  if (!shareId) return false;
  if (!cloudConfigured() || !cloudClient) {
    setStatus("Cloud sync is not configured", true);
    return true;
  }
  await cloudSessionReady;
  var seq = bumpCloudLoadSeq();
  setStatus("Loading shared diagram…");
  try {
    var result = await cloudClient.rpc("get_shared_graph", { p_share_id: shareId }).maybeSingle();
    if (result.error) throw result.error;
    if (seq !== cloudLoadSeq) return true;
    if (!result.data) throw new Error("Shared diagram not found");
    if (result.data.is_owner && result.data.graph_id) {
      setShareView(false);
      setShareEdit(false);
      rememberOwnerShareId(shareId);
      cloudSetDiagramHash(result.data.graph_id, true);
      await loadCloudDiagramByHash("#b:" + result.data.graph_id);
      return true;
    }
    rememberOwnerShareId("");
    var signedIn = !!(cloudSession && cloudSession.user);
    var canEdit = result.data.access === "edit" && signedIn;
    setShareView(!canEdit);
    setShareEdit(canEdit);
    applySharedDiagramRow(result.data);
    cloudClearGroupTabs();
    showDiagramError("");
    emit("renderDiagram", { fit: false, restoreView: true });
    setDiagramSyncUI("ok");
    setStatus(canEdit ? "Shared diagram · can edit" : "Shared diagram");
    return true;
  } catch (error) {
    if (seq !== cloudLoadSeq) return true;
    setShareView(false);
    setShareEdit(false);
    if (diagramSourceEl) diagramSourceEl.value = "";
    applyDiagramLiveMeta({ id: "" });
    emit("renderDiagram", { fit: false });
    setDiagramSyncUI("error");
    var message = shareRpcError(error, "Shared diagram load failed");
    showDiagramError(message);
    setStatus(message, true);
    return true;
  }
}
async function runShareRpc(name, args) {
  if (!cloudClient || !cloudSession || !cloudSession.user) {
    setStatus("Sign in to share", true);
    return null;
  }
  var result = await cloudClient.rpc(name, args);
  if (result.error) throw result.error;
  var row = Array.isArray(result.data) ? result.data[0] : result.data;
  return row || null;
}
async function refreshOwnShareState() {
  var diagramId = cloudDiagramId();
  if (!diagramId || !cloudClient || !cloudSession || !cloudSession.user) return;
  try {
    var row = await runShareRpc("own_share_state", { p_graph_id: diagramId });
    if (!row) return;
    setOwnerShareRole(row.role === "edit" ? "edit" : "view");
    setOwnerIsPublic(!!row.is_public);
    rememberOwnerShareId(row.share_id || "");
  } catch (_error) {}
}
async function saveSharedDiagram(opts) {
  opts = opts || {};
  var shareId = cloudShareIdFromHash(location.hash);
  if (!shareId || !cloudClient || !cloudSession || !cloudSession.user) {
    if (opts.explicit) setStatus("Sign in to edit this shared diagram", true);
    return false;
  }
  var source = stripDocumentMeta(diagramSourceEl && diagramSourceEl.value);
  if (diagramSourceEl && source !== diagramSourceEl.value) diagramSourceEl.value = source;
  var title = getDiagramTitle(cloudOpenDiagramId());
  var expected = Number(diagramServerRev);
  if (!(expected > 0)) expected = 1;
  var seq = bumpCloudSaveSeq();
  setDiagramSyncUI("saving");
  try {
    var result = await cloudClient.rpc("save_shared_graph", {
      p_share_id: shareId,
      p_title: title,
      p_bmd: source,
      p_expected: expected,
    });
    if (result.error) throw result.error;
    if (seq !== cloudSaveSeq) return false;
    var row = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!row) {
      var latest = await cloudClient.rpc("get_shared_graph", { p_share_id: shareId }).maybeSingle();
      if (latest.error) throw latest.error;
      if (!latest.data) throw new Error("Shared diagram not found");
      applySharedDiagramRow(latest.data);
      emit("renderDiagram", { fit: false, restoreView: true });
      setDiagramSyncUI("conflict");
      setStatus("Shared version conflict — reloaded", true);
      return false;
    }
    applySharedDiagramRow(row);
    setDiagramSyncUI("ok");
    setStatus("Saved shared diagram");
    return true;
  } catch (error) {
    if (seq !== cloudSaveSeq) return false;
    setDiagramSyncUI("error");
    setStatus(shareRpcError(error, "Shared save failed"), true);
    return false;
  }
}

async function forkSharedDiagram() {
  if (!cloudClient || !cloudSession || !cloudSession.user) {
    setStatus("Sign in to save a copy", true);
    return false;
  }
  var wasView = isShareView();
  var wasEdit = isShareEdit();
  setShareView(false);
  setShareEdit(false);
  setLiveDiagramId("");
  var saved = await saveDiagramToCloud({ explicit: true });
  if (!saved) {
    if (wasEdit) setShareEdit(true);
    else if (wasView) setShareView(true);
  }
  return saved;
}

function syncSharedOriginal() {
  return saveSharedDiagram({ explicit: true });
}

function syncShareChrome() {
  var saveCopy = document.getElementById("btnShellSaveCopy");
  var shareSync = document.getElementById("btnShareSync");
  var signedIn = !!(typeof cloudSession !== "undefined" && cloudSession && cloudSession.user);
  if (saveCopy) saveCopy.hidden = true;
  if (shareSync) shareSync.hidden = !(signedIn && isShareEdit());
  emit("shellSyncShareButton");
}

function onShareClick(id, fn) {
  var el = document.getElementById(id);
  if (el) el.addEventListener("click", fn);
}

onShareClick("btnShellSaveCopy", function () { void forkSharedDiagram(); });
onShareClick("btnShareSync", function () { void syncSharedOriginal(); });
syncShareChrome();

register("isShareGuest", isShareGuest);
register("setShareEdit", setShareEdit);
register("setShareView", setShareView);
// 跨层：kinds/diagram.js 要调它，kinds 不能 import cloud，所以必须登记；
// cloud-sync.js 也是经由它来调用。
register("loadSharedDiagramByHash", loadSharedDiagramByHash);
// 层内反转：cloud-sync.js 是 cloud 内部的底层（其余 cloud 文件都 import 它），
// 不能 import 回这里，否则成环；所以用 hooks 登记，由 sync 调用。
register("rememberOwnerShareId", rememberOwnerShareId);
register("refreshOwnShareState", refreshOwnShareState);
register("forkSharedDiagram", forkSharedDiagram);
register("syncShareChrome", syncShareChrome);

export {
  isShareGuest,
  setShareEdit,
  setShareView,
  rememberOwnerShareId,
  shareRpcError,
  runShareRpc,
};
