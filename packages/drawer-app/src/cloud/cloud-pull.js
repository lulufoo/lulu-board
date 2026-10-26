/* Cloud layer. Chrome leftover is reached through hooks. */
import { register, emit, call } from '../core/hooks.js';
import { sentryCount } from '../core/sentry-count.js';
import { stripDocumentMeta, diagramTitleFromBody, newGraphId } from '../core/document-meta.js';
import { loadKindTemplateSource } from '../core/kind-template.js';
import {
  cloudDiagramIdFromHash,
  cloudDiagramHash,
  cloudShareIdFromHash,
  cloudShareHash,
  cloudShortLinkIdFromHash,
} from '../core/cloud-route.js';
import {
  cloudClient,
  cloudSession,
  cloudSessionReady,
  cloudLoadSeq,
  cloudSaveSeq,
  cloudSiblingDiagramIds,
  cloudGroupId,
  cloudGroupMembers,
  cloudPlusDraft,
  cloudPlusDraftActive,
  cloudPlusDraftSource,
  cloudPlusDraftRev,
  cloudDiagramCache,
  ownerShareId,
  ownerShareRole,
  ownerIsPublic,
  chromeTipEl,
  chromeTipHideTimer,
  cloudRequestedGroupId,
  cloudTabDragId,
  cloudTabDropAfter,
  cloudTabDropId,
  setCloudClient,
  setCloudSession,
  setCloudSessionReady,
  bumpCloudLoadSeq,
  bumpCloudSaveSeq,
  setCloudSiblingDiagramIds,
  setCloudGroupId,
  setCloudGroupMembers,
  setCloudPlusDraft,
  setCloudPlusDraftActive,
  setCloudPlusDraftSource,
  setCloudPlusDraftRev,
  setCloudDiagramCache,
  setOwnerShareId,
  setOwnerShareRole,
  setOwnerIsPublic,
  setChromeTipEl,
  setChromeTipHideTimer,
  setCloudRequestedGroupId,
  setCloudTabDragId,
  setCloudTabDropAfter,
  setCloudTabDropId,
  cloudDiagramId,
} from './cloud-state.js';
import {
  $,
  diagramSourceEl,
  diagramLocalRev,
  diagramServerRev,
  diagramDirty,
  diagramSaveTimer,
  liveDiagramId,
  shellGroups,
  setStatus,
  showDiagramError,
  updateDiagramChars,
  applyDiagramLiveMeta,
  syncSourceDockLabel,
  setDiagramDirty,
  setDiagramLocalRev,
  setDiagramServerRev,
  setDiagramSaveTimer,
} from '../state/shell-state.js';

import {
  cloudForgetDiagramCache,
  applyCloudDiagramRow,
  cloudCloseAccountMenus,
} from './cloud-sync.js';
import { setDiagramSyncUI } from '../kinds/diagram.js';
import { cloudClearDirtyLeave, bindChromeTip } from './cloud-group-tabs.js';

/* drawer-app/06-cloud-pull.js — green Saved pulls the open board from the cloud */
async function pullDiagramFromCloud() {
  if (!cloudClient || !cloudSession || !cloudSession.user) return false;
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
  var seq = bumpCloudLoadSeq();
  setDiagramSyncUI("saving");
  try {
    var result = await cloudClient.from("graphs")
      .select("graph_id,title,bmd,version,share_id,created_at,updated_at")
      .eq("graph_id", diagramId)
      .maybeSingle();
    if (result.error) throw result.error;
    if (seq !== cloudLoadSeq) return false;
    if (!result.data) throw new Error("Cloud diagram not found");
    emit("cloudClearDirtyLeave");
    cloudForgetDiagramCache([diagramId]);
    applyCloudDiagramRow(result.data);
    emit("renderDiagram", { fit: false, restoreView: true });
    setDiagramSyncUI("ok");
    setStatus("Pulled from cloud");
    emit("showCopyTip", "Pulled from cloud");
    return true;
  } catch (error) {
    if (seq !== cloudLoadSeq) return false;
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


register("pullDiagramFromCloud", pullDiagramFromCloud);

export {
  pullDiagramFromCloud
};
