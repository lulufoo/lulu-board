/* drawer-app/06-cloud-share.js — share rpc helpers and guest-share chrome (the share list lives in the left drawer) */
var ownerShareId = "";
var ownerShareRole = "view";
var ownerIsPublic = false;

function isShareView() { return document.documentElement.dataset.shareView === "on"; }
function isShareEdit() { return document.documentElement.dataset.shareEdit === "on"; }
function isShareGuest() { return isShareView() || isShareEdit(); }
function setShareEdit(on) {
  if (on) document.documentElement.dataset.shareEdit = "on";
  else delete document.documentElement.dataset.shareEdit;
  syncShareChrome();
  if (typeof syncCloudSaveChrome === "function") syncCloudSaveChrome();
}

function setShareView(on) {
  if (on) document.documentElement.dataset.shareView = "on";
  else delete document.documentElement.dataset.shareView;
  if (diagramSourceEl) diagramSourceEl.readOnly = false;
  if (on) setShareEdit(false);
  syncShareChrome();
  if (typeof syncCloudSaveChrome === "function") syncCloudSaveChrome();
}
function rememberOwnerShareId(shareId) {
  ownerShareId = String(shareId || "");
  if (!ownerShareId) {
    ownerShareRole = "view";
    ownerIsPublic = false;
  }
  if (!isShareView()) syncShareChrome();
}
function shareRpcError(error, fallback) {
  return error && error.message ? error.message : fallback;
}
function applySharedDiagramRow(row) {
  var source = typeof cloudRowSource === "function"
    ? cloudRowSource(row, "")
    : String(row && row.bmd || "");
  if (diagramSourceEl) diagramSourceEl.value = source;
  diagramDirty = false;
  diagramServerRev = Number(row && row.version) || 1;
  diagramLocalRev = diagramServerRev;
  if (typeof applyDiagramLiveMeta === "function") {
    applyDiagramLiveMeta({
      id: "",
      version: diagramLocalRev,
    });
  }
  if (typeof updateDiagramChars === "function") updateDiagramChars();
  if (typeof syncSourceDockLabel === "function") syncSourceDockLabel();
  if (typeof syncCloudSaveChrome === "function") syncCloudSaveChrome();
}
async function loadSharedDiagramByHash(raw) {
  var shareId = typeof cloudShareIdFromHash === "function" ? cloudShareIdFromHash(raw) : "";
  if (!shareId) return false;
  if (typeof cloudConfigured !== "function" || !cloudConfigured() || !cloudClient) {
    setStatus("Cloud sync is not configured", true);
    return true;
  }
  await cloudSessionReady;
  var seq = ++cloudLoadSeq;
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
      if (typeof cloudSetDiagramHash === "function") cloudSetDiagramHash(result.data.graph_id, true);
      if (typeof loadCloudDiagramByHash === "function") {
        await loadCloudDiagramByHash("#b:" + result.data.graph_id);
      }
      return true;
    }
    rememberOwnerShareId("");
    var signedIn = !!(cloudSession && cloudSession.user);
    var canEdit = result.data.access === "edit" && signedIn;
    setShareView(!canEdit);
    setShareEdit(canEdit);
    applySharedDiagramRow(result.data);
    if (typeof cloudClearGroupTabs === "function") cloudClearGroupTabs();
    if (typeof showDiagramError === "function") showDiagramError("");
    if (typeof renderDiagram === "function") renderDiagram({ fit: false, restoreView: true });
    setDiagramSyncUI("ok");
    setStatus(canEdit ? "Shared diagram · can edit" : "Shared diagram");
    return true;
  } catch (error) {
    if (seq !== cloudLoadSeq) return true;
    setShareView(false);
    setShareEdit(false);
    if (diagramSourceEl) diagramSourceEl.value = "";
    if (typeof applyDiagramLiveMeta === "function") applyDiagramLiveMeta({ id: "" });
    if (typeof renderDiagram === "function") renderDiagram({ fit: false });
    setDiagramSyncUI("error");
    var message = shareRpcError(error, "Shared diagram load failed");
    if (typeof showDiagramError === "function") showDiagramError(message);
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
  var diagramId = typeof cloudDiagramId === "function" ? cloudDiagramId() : "";
  if (!diagramId || !cloudClient || !cloudSession || !cloudSession.user) return;
  try {
    var row = await runShareRpc("own_share_state", { p_graph_id: diagramId });
    if (!row) return;
    ownerShareRole = row.role === "edit" ? "edit" : "view";
    ownerIsPublic = !!row.is_public;
    rememberOwnerShareId(row.share_id || "");
  } catch (_error) {}
}
async function saveSharedDiagram(opts) {
  opts = opts || {};
  var shareId = typeof cloudShareIdFromHash === "function" ? cloudShareIdFromHash(location.hash) : "";
  if (!shareId || !cloudClient || !cloudSession || !cloudSession.user) {
    if (opts.explicit) setStatus("Sign in to edit this shared diagram", true);
    return false;
  }
  var source = typeof stripDocumentMeta === "function"
    ? stripDocumentMeta(diagramSourceEl && diagramSourceEl.value)
    : String(diagramSourceEl && diagramSourceEl.value || "");
  if (diagramSourceEl && source !== diagramSourceEl.value) diagramSourceEl.value = source;
  var title = getDiagramTitle(cloudOpenDiagramId());
  var expected = Number(diagramServerRev);
  if (!(expected > 0)) expected = 1;
  var seq = ++cloudSaveSeq;
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
      if (typeof renderDiagram === "function") renderDiagram({ fit: false, restoreView: true });
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
  liveDiagramId = "";
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
  if (typeof shellSyncShareButton === "function") shellSyncShareButton();
}

function onShareClick(id, fn) {
  var el = document.getElementById(id);
  if (el) el.addEventListener("click", fn);
}

onShareClick("btnShellSaveCopy", function () { void forkSharedDiagram(); });
onShareClick("btnShareSync", function () { void syncSharedOriginal(); });
syncShareChrome();
