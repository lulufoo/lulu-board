/* drawer-app/06-cloud-delete.js — delete the open board from the Source panel */
function cloudDeleteVisible() {
  if (typeof isShareGuest === "function" && isShareGuest()) return false;
  if (!cloudSession || !cloudSession.user) return false;
  return !!(cloudPlusDraftActive || cloudVelaId());
}

function syncBoardDeleteChrome() {
  var btn = document.getElementById("btnBoardDeleteCloud");
  if (btn) btn.hidden = !cloudDeleteVisible();
}

function cloudNextBoardAfterDelete(boardId) {
  var ids = cloudGroupMembers.map(function (row) { return row.graph_id; });
  var rest = ids.filter(function (id) { return id !== boardId; });
  if (!rest.length) return "";
  return rest[Math.min(ids.indexOf(boardId), rest.length - 1)];
}

function cloudDropPlusDraft() {
  var last = cloudGroupMembers.length ? cloudGroupMembers[cloudGroupMembers.length - 1].graph_id : "";
  cloudClearDirtyLeave();
  cloudClearPlusDraftSlot();
  if (last) cloudOpenBoardById(last);
  else renderCloudGroupTabs();
  syncCloudSaveChrome();
  return true;
}

async function cloudDeleteSavedVela() {
  var boardId = cloudVelaId();
  if (!cloudClient || !boardId) return false;
  var confirmed = await askConfirm({
    title: "Delete this diagram?",
    copy: "This board will be deleted from the cloud.",
    ok: "Delete",
    cancel: "Cancel",
  });
  if (!confirmed) return false;
  var nextId = cloudNextBoardAfterDelete(boardId);
  cloudClearDirtyLeave();
  try {
    var board = await cloudClient.from("graphs").delete().eq("graph_id", boardId);
    if (board.error) throw board.error;
    cloudForgetBoardCache([boardId]);
    if (nextId) {
      cloudGroupMembers = cloudGroupMembers.filter(function (row) { return row.graph_id !== boardId; });
      cloudOpenBoardById(nextId);
    } else {
      history.replaceState(null, "", location.pathname + location.search);
      await bootstrapVelaFromHash();
      if (typeof renderVela === "function") renderVela({ fit: false, restoreView: true });
      cloudClearGroupTabs();
    }
    setStatus("Deleted board");
    await cloudRefreshGroups();
    return true;
  } catch (error) {
    setStatus(error && error.message ? error.message : "Cloud delete failed", true);
    return false;
  }
}

async function cloudDeleteCurrentBoard() {
  if (!cloudDeleteVisible()) return false;
  if (cloudPlusDraftActive) return cloudDropPlusDraft();
  return cloudDeleteSavedVela();
}

(function wireCloudDelete() {
  var btn = document.getElementById("btnBoardDeleteCloud");
  if (!btn) return;
  btn.addEventListener("click", function () { void cloudDeleteCurrentBoard(); });
})();
