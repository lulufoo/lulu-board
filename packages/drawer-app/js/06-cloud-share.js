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
  if (velaSourceEl) velaSourceEl.readOnly = false;
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
function applySharedBoardRow(row) {
  var source = typeof cloudRowSource === "function"
    ? cloudRowSource(row, "")
    : String(row && row.bmd || "");
  if (velaSourceEl) velaSourceEl.value = source;
  boardDirty = false;
  boardServerRev = Number(row && row.version) || 1;
  velaLocalRev = boardServerRev;
  if (typeof applyBoardLiveMeta === "function") {
    applyBoardLiveMeta({
      id: "",
      version: velaLocalRev,
    });
  }
  if (typeof updateVelaChars === "function") updateVelaChars();
  if (typeof syncSourceDockLabel === "function") syncSourceDockLabel();
  if (typeof syncCloudSaveChrome === "function") syncCloudSaveChrome();
}
function applyShareVersion(row) {
  if (!row || row.version == null) return;
  boardServerRev = Number(row.version) || boardServerRev;
  velaLocalRev = boardServerRev;
  if (typeof syncCloudSaveChrome === "function") syncCloudSaveChrome();
}
async function loadSharedBoardByHash(raw) {
  var shareId = typeof cloudShareIdFromHash === "function" ? cloudShareIdFromHash(raw) : "";
  if (!shareId) return false;
  if (typeof cloudConfigured !== "function" || !cloudConfigured() || !cloudClient) {
    setStatus("Cloud sync is not configured", true);
    return true;
  }
  await cloudSessionReady;
  var seq = ++cloudLoadSeq;
  setStatus("Loading shared board…");
  try {
    var result = await cloudClient.rpc("get_shared_board", { p_share_id: shareId }).maybeSingle();
    if (result.error) throw result.error;
    if (seq !== cloudLoadSeq) return true;
    if (!result.data) throw new Error("Shared board not found");
    if (result.data.is_owner && result.data.board_id) {
      setShareView(false);
      setShareEdit(false);
      rememberOwnerShareId(shareId);
      if (typeof cloudSetBoardHash === "function") cloudSetBoardHash(result.data.board_id, true);
      if (typeof loadCloudBoardByHash === "function") {
        await loadCloudBoardByHash("#b:" + result.data.board_id);
      }
      return true;
    }
    rememberOwnerShareId("");
    var signedIn = !!(cloudSession && cloudSession.user);
    var canEdit = result.data.access === "edit" && signedIn;
    setShareView(!canEdit);
    setShareEdit(canEdit);
    applySharedBoardRow(result.data);
    if (typeof cloudClearGroupTabs === "function") cloudClearGroupTabs();
    if (typeof showVelaError === "function") showVelaError("");
    if (typeof renderVela === "function") renderVela({ fit: false, restoreView: true });
    setBoardSyncUI("ok");
    setStatus(canEdit ? "Shared board · can edit" : "Shared board");
    return true;
  } catch (error) {
    if (seq !== cloudLoadSeq) return true;
    setShareView(false);
    setShareEdit(false);
    if (velaSourceEl) velaSourceEl.value = "";
    if (typeof applyBoardLiveMeta === "function") applyBoardLiveMeta({ id: "" });
    if (typeof renderVela === "function") renderVela({ fit: false });
    setBoardSyncUI("error");
    var message = shareRpcError(error, "Shared board load failed");
    if (typeof showVelaError === "function") showVelaError(message);
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
  var boardId = typeof cloudBoardId === "function" ? cloudBoardId() : "";
  if (!boardId || !cloudClient || !cloudSession || !cloudSession.user) return;
  try {
    var row = await runShareRpc("own_share_state", { p_board_id: boardId });
    if (!row) return;
    ownerShareRole = row.role === "edit" ? "edit" : "view";
    ownerIsPublic = !!row.is_public;
    rememberOwnerShareId(row.share_id || "");
  } catch (_error) {}
}
async function saveSharedBoard(opts) {
  opts = opts || {};
  var shareId = typeof cloudShareIdFromHash === "function" ? cloudShareIdFromHash(location.hash) : "";
  if (!shareId || !cloudClient || !cloudSession || !cloudSession.user) {
    if (opts.explicit) setStatus("Sign in to edit this shared board", true);
    return false;
  }
  var source = typeof stripDocumentMeta === "function"
    ? stripDocumentMeta(velaSourceEl && velaSourceEl.value)
    : String(velaSourceEl && velaSourceEl.value || "");
  if (velaSourceEl && source !== velaSourceEl.value) velaSourceEl.value = source;
  var title = getBoardTitle(cloudOpenBoardId());
  var expected = Number(boardServerRev);
  if (!(expected > 0)) expected = 1;
  var seq = ++cloudSaveSeq;
  setBoardSyncUI("saving");
  try {
    var result = await cloudClient.rpc("save_shared_board", {
      p_share_id: shareId,
      p_title: title,
      p_bmd: source,
      p_expected: expected,
    });
    if (result.error) throw result.error;
    if (seq !== cloudSaveSeq) return false;
    var row = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!row) {
      var latest = await cloudClient.rpc("get_shared_board", { p_share_id: shareId }).maybeSingle();
      if (latest.error) throw latest.error;
      if (!latest.data) throw new Error("Shared board not found");
      applySharedBoardRow(latest.data);
      if (typeof renderVela === "function") renderVela({ fit: false, restoreView: true });
      setBoardSyncUI("conflict");
      setStatus("Shared version conflict — reloaded", true);
      return false;
    }
    applySharedBoardRow(row);
    setBoardSyncUI("ok");
    setStatus("Saved shared board");
    return true;
  } catch (error) {
    if (seq !== cloudSaveSeq) return false;
    setBoardSyncUI("error");
    setStatus(shareRpcError(error, "Shared save failed"), true);
    return false;
  }
}

async function forkSharedBoard() {
  if (!cloudClient || !cloudSession || !cloudSession.user) {
    setStatus("Sign in to save a copy", true);
    return false;
  }
  var wasView = isShareView();
  var wasEdit = isShareEdit();
  setShareView(false);
  setShareEdit(false);
  liveBoardId = "";
  var saved = await saveBoardToCloud({ explicit: true });
  if (!saved) {
    if (wasEdit) setShareEdit(true);
    else if (wasView) setShareView(true);
  }
  return saved;
}

function syncSharedOriginal() {
  return saveSharedBoard({ explicit: true });
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

onShareClick("btnShellSaveCopy", function () { void forkSharedBoard(); });
onShareClick("btnShareSync", function () { void syncSharedOriginal(); });
syncShareChrome();
