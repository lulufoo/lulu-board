/* drawer-app/06-cloud-share.js — share rpc, access role, dock panel */
var ownerShareId = "";
var ownerShareRole = "view";

function isShareView() { return document.documentElement.dataset.shareView === "on"; }
function isShareEdit() { return document.documentElement.dataset.shareEdit === "on"; }
function shareGuestHint(signedIn, foreign) {
  if (!signedIn) return "Sign in and save this board to share.";
  return foreign ? "Only the owner can share this board." : "Save this board to share.";
}
function setShareEdit(on) {
  if (on) document.documentElement.dataset.shareEdit = "on";
  else delete document.documentElement.dataset.shareEdit;
}

function setShareView(on) {
  if (on) document.documentElement.dataset.shareView = "on";
  else delete document.documentElement.dataset.shareView;
  if (boardSourceEl) boardSourceEl.readOnly = !!on;
  if (on && typeof currentDockTab === "function" && typeof openDock === "function") {
    var tab = currentDockTab();
    if (tab === "props" || tab === "layout" || tab === "style" || tab === "share") openDock("");
  }
  if (on) setShareEdit(false);
  syncShareChrome();
}
function rememberOwnerShareId(shareId) {
  ownerShareId = String(shareId || "");
  if (!ownerShareId) ownerShareRole = "view";
  if (!isShareView()) syncShareChrome();
}
function currentShareUrl() {
  if (!ownerShareId || typeof cloudShareHash !== "function") return "";
  return location.origin + location.pathname + location.search + cloudShareHash(ownerShareId);
}
function shareRpcError(error, fallback) {
  return error && error.message ? error.message : fallback;
}
function applySharedBoardRow(row) {
  var source = typeof cloudRowSource === "function"
    ? cloudRowSource(row, "")
    : String(row && row.bmd || "");
  if (boardSourceEl) boardSourceEl.value = source;
  boardDirty = false;
  boardServerRev = Number(row && row.version) || 1;
  boardLocalRev = boardServerRev;
  if (typeof applyBoardLiveMeta === "function") {
    applyBoardLiveMeta({
      id: "",
      title: (row && row.title) || (typeof cloudBoardTitle === "function" ? cloudBoardTitle(source) : ""),
      version: boardLocalRev,
    });
  }
  if (typeof updateBoardChars === "function") updateBoardChars();
  if (typeof syncSourceDockLabel === "function") syncSourceDockLabel();
  if (typeof syncCloudSaveChrome === "function") syncCloudSaveChrome();
}
function applyShareVersion(row) {
  if (!row || row.version == null) return;
  boardServerRev = Number(row.version) || boardServerRev;
  boardLocalRev = boardServerRev;
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
    applySharedBoardRow(result.data);
    rememberOwnerShareId("");
    var signedIn = !!(cloudSession && cloudSession.user);
    var canEdit = result.data.access === "edit" && signedIn;
    setShareView(!canEdit);
    setShareEdit(canEdit);
    if (typeof showBoardError === "function") showBoardError("");
    if (typeof renderBoard === "function") renderBoard({ fit: false, restoreView: true });
    setBoardSyncUI("ok");
    setStatus(canEdit ? "Shared board · can edit" : "Shared board");
    return true;
  } catch (error) {
    if (seq !== cloudLoadSeq) return true;
    setShareView(false);
    setShareEdit(false);
    if (boardSourceEl) boardSourceEl.value = "";
    if (typeof applyBoardLiveMeta === "function") applyBoardLiveMeta({ id: "", title: "" });
    if (typeof renderBoard === "function") renderBoard({ fit: false });
    setBoardSyncUI("error");
    var message = shareRpcError(error, "Shared board load failed");
    if (typeof showBoardError === "function") showBoardError(message);
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
    rememberOwnerShareId(row.share_id || "");
  } catch (_error) {}
}
async function mutateOwnShare(name, args, after) {
  var boardId = typeof cloudBoardId === "function" ? cloudBoardId() : "";
  if (!boardId) return;
  try {
    var row = await runShareRpc(name, Object.assign({ p_board_id: boardId }, args || {}));
    if (!row && name !== "unshare") return;
    if (after) await after(row);
    applyShareVersion(row);
  } catch (error) {
    setStatus(shareRpcError(error, "Share failed"), true);
  }
}

function openBoardShare() {
  return mutateOwnShare("open_share", null, function (row) {
    ownerShareRole = "view";
    rememberOwnerShareId(row.share_id);
    setStatus("Share link ready");
  });
}

function setBoardShareRole(role) {
  return mutateOwnShare("set_share_role", { p_role: role }, function (row) {
    ownerShareRole = row.role === "edit" ? "edit" : "view";
    rememberOwnerShareId(row.share_id);
    setStatus(ownerShareRole === "edit" ? "Link can edit" : "Link is view only");
  });
}

function rotateBoardShare() {
  return mutateOwnShare("rotate_share", null, function (row) {
    rememberOwnerShareId(row.share_id);
    setStatus("Share link replaced");
    return refreshOwnShareState();
  });
}

function closeBoardShare() {
  return mutateOwnShare("unshare", null, function () {
    ownerShareRole = "view";
    rememberOwnerShareId("");
    setStatus("Stopped sharing");
  });
}

async function copyBoardShareLink() {
  var url = currentShareUrl();
  if (!url) {
    await openBoardShare();
    url = currentShareUrl();
  }
  if (!url) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
    }
    if (typeof showCopyTip === "function") showCopyTip("Share link copied");
    else setStatus("Share link copied");
  } catch (error) {
    setStatus(shareRpcError(error, "Could not copy link"), true);
  }
}

async function saveSharedBoard(opts) {
  opts = opts || {};
  var shareId = typeof cloudShareIdFromHash === "function" ? cloudShareIdFromHash(location.hash) : "";
  if (!shareId || !cloudClient || !cloudSession || !cloudSession.user) {
    if (opts.explicit) setStatus("Sign in to edit this shared board", true);
    return false;
  }
  var source = typeof stripDocumentMeta === "function"
    ? stripDocumentMeta(boardSourceEl && boardSourceEl.value)
    : String(boardSourceEl && boardSourceEl.value || "");
  if (boardSourceEl && source !== boardSourceEl.value) boardSourceEl.value = source;
  var title = (typeof cloudBoardTitle === "function" ? cloudBoardTitle(source) : "") || "Untitled";
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
      if (typeof renderBoard === "function") renderBoard({ fit: false, restoreView: true });
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
    return;
  }
  setShareView(false);
  setShareEdit(false);
  liveBoardId = "";
  var saved = await saveBoardToCloud({ explicit: true });
  if (!saved) setShareView(true);
}

function syncShareChrome() {
  var signedOut = document.getElementById("shareSignedOut");
  var owner = document.getElementById("shareOwner");
  var createBtn = document.getElementById("btnShareCreate");
  var copyBtn = document.getElementById("btnShareCopy");
  var rotateBtn = document.getElementById("btnShareRotate");
  var stopBtn = document.getElementById("btnShareStop");
  var viewBtn = document.getElementById("btnShareRoleView");
  var editBtn = document.getElementById("btnShareRoleEdit");
  var saveCopy = document.getElementById("btnBoardSaveCopy");
  var signedIn = !!(typeof cloudSession !== "undefined" && cloudSession && cloudSession.user);
  var ownCloud = typeof cloudBoardId === "function" && !!cloudBoardId();
  var viewing = isShareView();
  var showOwner = signedIn && ownCloud && !viewing && !isShareEdit();
  if (signedOut) {
    signedOut.hidden = showOwner;
    if (!showOwner) signedOut.textContent = shareGuestHint(signedIn, viewing || isShareEdit());
  }
  if (owner) owner.hidden = !showOwner;
  if (createBtn) createBtn.hidden = !!ownerShareId;
  if (copyBtn) copyBtn.hidden = !ownerShareId;
  if (rotateBtn) rotateBtn.hidden = !ownerShareId;
  if (stopBtn) stopBtn.hidden = !ownerShareId;
  if (viewBtn) viewBtn.setAttribute("aria-pressed", ownerShareRole !== "edit" ? "true" : "false");
  if (editBtn) editBtn.setAttribute("aria-pressed", ownerShareRole === "edit" ? "true" : "false");
  if (saveCopy) saveCopy.hidden = !(viewing || isShareEdit()) || !signedIn;
}

function closeShareMenu() {}
function onShareClick(id, fn) {
  var el = document.getElementById(id);
  if (el) el.addEventListener("click", fn);
}

onShareClick("btnShareCreate", function () { void openBoardShare(); });
onShareClick("btnShareCopy", function () { void copyBoardShareLink(); });
onShareClick("btnShareRotate", function () { void rotateBoardShare(); });
onShareClick("btnShareStop", function () { void closeBoardShare(); });
onShareClick("btnShareRoleView", function () { void setBoardShareRole("view"); });
onShareClick("btnShareRoleEdit", function () { void setBoardShareRole("edit"); });
onShareClick("btnBoardSaveCopy", function () { void forkSharedBoard(); });
syncShareChrome();
