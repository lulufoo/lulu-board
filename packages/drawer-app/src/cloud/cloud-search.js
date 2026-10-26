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

/* drawer-app/06-cloud-search.js — login search: own boards plus others' public boards. */

function cloudSearchSignedIn() {
  return !!(typeof cloudSession !== "undefined" && cloudSession && cloudSession.user);
}

function cloudSearchSplit(rows) {
  var mine = [];
  var pub = [];
  (rows || []).forEach(function (row) {
    if (!row) return;
    var item = {
      title: row.title || "",
      shareId: row.share_id || "",
      diagramId: row.graph_id || "",
      note: row.category === "public" ? "Public" : "Mine",
    };
    if (row.category === "public") pub.push(item);
    else mine.push(item);
  });
  return { mine: mine, public: pub };
}

async function cloudSearchDiagrams(query) {
  var q = String(query || "").trim();
  if (!q || !cloudSearchSignedIn() || !cloudClient) return { mine: [], public: [] };
  var result = await cloudClient.rpc("search_graphs", { p_query: q });
  if (result.error) throw result.error;
  return cloudSearchSplit(result.data);
}


register("cloudSearchSignedIn", cloudSearchSignedIn);
register("cloudSearchSplit", cloudSearchSplit);
register("cloudSearchDiagrams", cloudSearchDiagrams);

export {
  cloudSearchSignedIn,
  cloudSearchSplit,
  cloudSearchDiagrams
};
