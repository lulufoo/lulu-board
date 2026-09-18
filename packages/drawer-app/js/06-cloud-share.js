/* drawer-app/06-cloud-share.js — share rpc, read-only view, owner panel */
var ownerShareId = "";

function isShareView() {
  return document.documentElement.dataset.shareView === "on";
}

function setShareView(on) {
  if (on) document.documentElement.dataset.shareView = "on";
  else delete document.documentElement.dataset.shareView;
  if (boardSourceEl) boardSourceEl.readOnly = !!on;
  if (on && typeof currentDockTab === "function" && typeof openDock === "function") {
    var tab = currentDockTab();
    if (tab === "props" || tab === "layout" || tab === "style") openDock("");
  }
  syncShareChrome();
}

function rememberOwnerShareId(shareId) {
  ownerShareId = String(shareId || "");
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
      rememberOwnerShareId(shareId);
      if (typeof cloudSetBoardHash === "function") cloudSetBoardHash(result.data.board_id, true);
      if (typeof loadCloudBoardByHash === "function") {
        await loadCloudBoardByHash("#b:" + result.data.board_id);
      }
      return true;
    }
    applySharedBoardRow(result.data);
    rememberOwnerShareId("");
    setShareView(true);
    if (typeof showBoardError === "function") showBoardError("");
    if (typeof renderBoard === "function") renderBoard({ fit: false, restoreView: true });
    setBoardSyncUI("ok");
    setStatus("Shared board");
    return true;
  } catch (error) {
    if (seq !== cloudLoadSeq) return true;
    setShareView(false);
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

async function runShareRpc(name, boardId) {
  if (!cloudClient || !cloudSession || !cloudSession.user) {
    setStatus("Sign in to share", true);
    return null;
  }
  var result = await cloudClient.rpc(name, { p_board_id: boardId });
  if (result.error) throw result.error;
  var row = Array.isArray(result.data) ? result.data[0] : result.data;
  return row || null;
}

async function openBoardShare() {
  var boardId = typeof cloudBoardId === "function" ? cloudBoardId() : "";
  if (!boardId) return;
  try {
    var row = await runShareRpc("open_share", boardId);
    if (!row) return;
    rememberOwnerShareId(row.share_id);
    applyShareVersion(row);
    setStatus("Share link ready");
  } catch (error) {
    setStatus(shareRpcError(error, "Share failed"), true);
  }
}

async function rotateBoardShare() {
  var boardId = typeof cloudBoardId === "function" ? cloudBoardId() : "";
  if (!boardId) return;
  try {
    var row = await runShareRpc("rotate_share", boardId);
    if (!row) return;
    rememberOwnerShareId(row.share_id);
    applyShareVersion(row);
    setStatus("Share link replaced");
  } catch (error) {
    setStatus(shareRpcError(error, "Could not replace share link"), true);
  }
}

async function closeBoardShare() {
  var boardId = typeof cloudBoardId === "function" ? cloudBoardId() : "";
  if (!boardId) return;
  try {
    var row = await runShareRpc("unshare", boardId);
    rememberOwnerShareId("");
    applyShareVersion(row);
    setStatus("Stopped sharing");
  } catch (error) {
    setStatus(shareRpcError(error, "Could not stop sharing"), true);
  }
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

async function forkSharedBoard() {
  if (!cloudClient || !cloudSession || !cloudSession.user) {
    setStatus("Sign in to save a copy", true);
    return;
  }
  setShareView(false);
  liveBoardId = "";
  var saved = await saveBoardToCloud({ explicit: true });
  if (!saved) setShareView(true);
}

function syncShareChrome() {
  var share = document.getElementById("boardShare");
  var state = document.getElementById("boardShareState");
  var openBtn = document.getElementById("btnBoardShareOpen");
  var copyBtn = document.getElementById("btnBoardShareCopy");
  var rotateBtn = document.getElementById("btnBoardShareRotate");
  var closeBtn = document.getElementById("btnBoardShareClose");
  var saveCopy = document.getElementById("btnBoardSaveCopy");
  var signedIn = !!(typeof cloudSession !== "undefined" && cloudSession && cloudSession.user);
  var ownCloud = typeof cloudBoardId === "function" && !!cloudBoardId();
  var viewing = isShareView();
  if (share) share.hidden = !signedIn || !ownCloud || viewing;
  if (state) state.textContent = ownerShareId ? "Link is on" : "Not shared";
  if (openBtn) openBtn.hidden = !!ownerShareId;
  if (copyBtn) copyBtn.hidden = !ownerShareId;
  if (rotateBtn) rotateBtn.hidden = !ownerShareId;
  if (closeBtn) closeBtn.hidden = !ownerShareId;
  if (saveCopy) saveCopy.hidden = !viewing || !signedIn;
}

function closeShareMenu() {
  var btn = document.getElementById("btnBoardShare");
  var menu = document.getElementById("boardShareMenu");
  if (menu) menu.hidden = true;
  if (btn) btn.setAttribute("aria-expanded", "false");
}

(function wireBoardShare() {
  var btn = document.getElementById("btnBoardShare");
  var menu = document.getElementById("boardShareMenu");
  if (btn && menu) {
    btn.addEventListener("click", function () {
      var open = !!menu.hidden;
      if (typeof cloudCloseAccountMenus === "function") cloudCloseAccountMenus();
      menu.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  var openBtn = document.getElementById("btnBoardShareOpen");
  if (openBtn) openBtn.addEventListener("click", function () { void openBoardShare(); });
  var copyBtn = document.getElementById("btnBoardShareCopy");
  if (copyBtn) copyBtn.addEventListener("click", function () { void copyBoardShareLink(); });
  var rotateBtn = document.getElementById("btnBoardShareRotate");
  if (rotateBtn) rotateBtn.addEventListener("click", function () { void rotateBoardShare(); });
  var closeBtn = document.getElementById("btnBoardShareClose");
  if (closeBtn) closeBtn.addEventListener("click", function () { void closeBoardShare(); });
  var saveCopy = document.getElementById("btnBoardSaveCopy");
  if (saveCopy) saveCopy.addEventListener("click", function () { void forkSharedBoard(); });
  document.addEventListener("click", function (event) {
    var wrap = document.getElementById("boardShare");
    if (!wrap || wrap.contains(event.target)) return;
    closeShareMenu();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeShareMenu();
  });
  syncShareChrome();
})();
