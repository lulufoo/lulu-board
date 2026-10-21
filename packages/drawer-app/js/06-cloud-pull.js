/* drawer-app/06-cloud-pull.js — green Saved pulls the open board from the cloud */
async function pullBoardFromCloud() {
  if (!cloudClient || !cloudSession || !cloudSession.user) return false;
  if (typeof isShareGuest === "function" && isShareGuest()) return false;
  var boardId = cloudBoardId();
  if (!boardId || cloudPlusDraftActive) return false;
  if (boardDirty && typeof boardAskConfirm === "function") {
    var ok = await boardAskConfirm({
      title: "Replace local edits?",
      copy: "The board will be reloaded from the cloud.",
      ok: "Pull",
      cancel: "Cancel",
    });
    if (!ok) return false;
  }
  var seq = ++cloudLoadSeq;
  setBoardSyncUI("saving");
  try {
    var result = await cloudClient.from("boards")
      .select("board_id,title,bmd,version,share_id,created_at,updated_at")
      .eq("board_id", boardId)
      .maybeSingle();
    if (result.error) throw result.error;
    if (seq !== cloudLoadSeq) return false;
    if (!result.data) throw new Error("Cloud board not found");
    if (typeof cloudClearDirtyLeave === "function") cloudClearDirtyLeave();
    cloudForgetBoardCache([boardId]);
    applyCloudBoardRow(result.data);
    if (typeof renderVela === "function") renderVela({ fit: false, restoreView: true });
    setBoardSyncUI("ok");
    setStatus("Pulled from cloud");
    if (typeof showCopyTip === "function") showCopyTip("Pulled from cloud");
    return true;
  } catch (error) {
    if (seq !== cloudLoadSeq) return false;
    setBoardSyncUI("error");
    setStatus(error && error.message ? error.message : "Cloud pull failed", true);
    return false;
  }
}

(function wireCloudPull() {
  var status = document.getElementById("boardCloudStatus");
  if (!status) return;
  if (typeof bindChromeTip === "function") {
    bindChromeTip(status, function () { return status.getAttribute("aria-label") || ""; });
  }
  status.addEventListener("click", function () {
    cloudCloseAccountMenus();
    void pullBoardFromCloud();
  });
})();
