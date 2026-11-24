/* Cloud layer. Chrome leftover is reached through hooks. */
import { emit, call } from '../core/hooks.js';

import {
  cloudClient,
  cloudSession,
  cloudDiagramReady,
  setCloudDiagramReady,
  completeCloudDiagramView,
  cloudLoadSeq,
  cloudPlusDraftActive,
  bumpCloudLoadSeq,
  cloudDiagramId,
} from './cloud-state.js';
import {
  diagramDirty,
  setStatus,
} from '../state/shell-state.js';

import {
  cloudForgetDiagramCache,
  applyCloudDiagramRow,
  cloudCloseAccountMenus,
  fetchOwnedGraph,
} from './cloud-sync.js';
import { setDiagramSyncUI } from '../kinds/diagram.js';
import { cloudClearDirtyLeave, bindChromeTip } from './cloud-group-tabs.js';

/* drawer-app/06-cloud-pull.js — green Saved pulls the open board from the cloud */
async function pullDiagramFromCloud() {
  if (!cloudClient || !cloudSession || !cloudSession.user) return false;
  if (!cloudDiagramReady) return false;
  if (call("isShareGuest")) return false;
  var diagramId = cloudDiagramId();
  if (!diagramId || cloudPlusDraftActive) return false;
  if (diagramDirty) {
    var ok = await call("askConfirm", {
      title: "Replace local edits?",
      copy: "The diagram will be reloaded from the cloud.",
      ok: "Pull",
      cancel: "Cancel",
    });
    if (!ok) return false;
  }
  if (!cloudDiagramReady) return false;
  var wasReady = cloudDiagramReady;
  var seq = bumpCloudLoadSeq();
  setDiagramSyncUI("saving");
  try {
    var result = await fetchOwnedGraph(diagramId);
    if (seq !== cloudLoadSeq) return false;
    if (!result) throw new Error("Cloud diagram not found");
    cloudClearDirtyLeave();
    cloudForgetDiagramCache([diagramId]);
    applyCloudDiagramRow(result, { loaded: true });
    emit("renderDiagram", { fit: false, restoreView: true });
    completeCloudDiagramView(seq);
    setDiagramSyncUI("ok");
    setStatus("Pulled from cloud");
    emit("showCopyTip", "Pulled from cloud");
    return true;
  } catch (error) {
    if (seq !== cloudLoadSeq) return false;
    setCloudDiagramReady(wasReady);
    setDiagramSyncUI("error");
    setStatus(error && error.message ? error.message : "Cloud pull failed", true);
    return false;
  }
}

(function wireCloudPull() {
  var status = document.getElementById("shellCloudStatus");
  if (!status) return;
  bindChromeTip(status, function () { return status.getAttribute("aria-label") || ""; });
  status.addEventListener("click", function () {
    cloudCloseAccountMenus();
    void pullDiagramFromCloud();
  });
})();

