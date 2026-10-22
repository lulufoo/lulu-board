/* drawer-app/06-cloud-delete.js — delete the open board from the Source panel */
function cloudDeleteVisible() {
  if (typeof isShareGuest === "function" && isShareGuest()) return false;
  if (!cloudSession || !cloudSession.user) return false;
  return !!(cloudPlusDraftActive || cloudDiagramId());
}

function syncBoardDeleteChrome() {
  var btn = document.getElementById("btnDiagramDeleteCloud");
  if (btn) btn.hidden = !cloudDeleteVisible();
}

function cloudNextDiagramAfterDelete(diagramId) {
  var ids = cloudGroupMembers.map(function (row) { return row.graph_id; });
  var rest = ids.filter(function (id) { return id !== diagramId; });
  if (!rest.length) return "";
  return rest[Math.min(ids.indexOf(diagramId), rest.length - 1)];
}

function cloudDropPlusDraft() {
  var last = cloudGroupMembers.length ? cloudGroupMembers[cloudGroupMembers.length - 1].graph_id : "";
  cloudClearDirtyLeave();
  cloudClearPlusDraftSlot();
  if (last) cloudOpenDiagramById(last);
  else renderCloudGroupTabs();
  syncCloudSaveChrome();
  return true;
}

async function cloudDeleteSavedDiagram() {
  var diagramId = cloudDiagramId();
  if (!cloudClient || !diagramId) return false;
  var confirmed = await askConfirm({
    title: "Delete this diagram?",
    copy: "This diagram will be deleted from the cloud.",
    ok: "Delete",
    cancel: "Cancel",
  });
  if (!confirmed) return false;
  var nextId = cloudNextDiagramAfterDelete(diagramId);
  cloudClearDirtyLeave();
  try {
    var board = await cloudClient.from("graphs").delete().eq("graph_id", diagramId);
    if (board.error) throw board.error;
    cloudForgetDiagramCache([diagramId]);
    if (nextId) {
      cloudGroupMembers = cloudGroupMembers.filter(function (row) { return row.graph_id !== diagramId; });
      cloudOpenDiagramById(nextId);
    } else {
      history.replaceState(null, "", location.pathname + location.search);
      await bootstrapDiagramFromHash();
      if (typeof renderDiagram === "function") renderDiagram({ fit: false, restoreView: true });
      cloudClearGroupTabs();
    }
    setStatus("Deleted diagram");
    await cloudRefreshGroups();
    return true;
  } catch (error) {
    setStatus(error && error.message ? error.message : "Cloud delete failed", true);
    return false;
  }
}

async function cloudDeleteCurrentDiagram() {
  if (!cloudDeleteVisible()) return false;
  if (cloudPlusDraftActive) return cloudDropPlusDraft();
  return cloudDeleteSavedDiagram();
}

(function wireCloudDelete() {
  var btn = document.getElementById("btnDiagramDeleteCloud");
  if (!btn) return;
  btn.addEventListener("click", function () { void cloudDeleteCurrentDiagram(); });
})();
