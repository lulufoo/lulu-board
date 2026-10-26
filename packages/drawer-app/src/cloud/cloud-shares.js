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

import { rememberOwnerShareId } from './cloud-share.js';

/* drawer-app/06-cloud-shares.js — the boards I shared out (link shares), as data plus per-board actions. */

// boards: owner rows with a share_id; roles: { [shareId]: "view" | "edit" }.
function cloudShareSummaries(diagramRows, roles, currentDiagramId, publics) {
  var current = String(currentDiagramId || "");
  var out = [];
  (diagramRows || []).forEach(function (row) {
    if (!row || !row.graph_id || !row.share_id) return;
    out.push({
      diagramId: row.graph_id,
      title: displayTitleFromBmd(row.bmd),
      shareId: row.share_id,
      role: roles && roles[row.share_id] === "edit" ? "edit" : "view",
      isPublic: !!(publics && publics[row.share_id]),
      updatedAt: String(row.updated_at || row.created_at || ""),
      isCurrent: !!current && row.graph_id === current,
    });
  });
  out.sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0; });
  return out;
}

function cloudShareLinkFor(shareId) {
  if (!shareId) return "";
  return location.origin + location.pathname + location.search + cloudShareHash(shareId);
}

// Throws on a cloud error. Signed out: [].
async function cloudFetchOwnShares() {
  if (!cloudClient || !cloudSession || !cloudSession.user) return [];
  var result = await cloudClient.rpc("list_outgoing_shares");
  if (result.error) throw result.error;
  var current = cloudDiagramId();
  return (result.data || []).map(function (row) {
    return {
      diagramId: row.graph_id,
      title: row.title || "",
      shareId: row.share_id,
      role: row.role === "edit" ? "edit" : "view",
      isPublic: !!row.is_public,
      updatedAt: String(row.updated_at || ""),
      isCurrent: !!current && row.graph_id === current,
      total: Number(row.total) || 0,
    };
  });
}

// One RPC on one board. Keeps the open board's own share state (status chrome) in step.
async function cloudShareMutate(diagramId, name, args, okStatus) {
  try {
    var row = await runShareRpc(name, Object.assign({ p_graph_id: diagramId }, args || {}));
    if (diagramId === cloudDiagramId()) {
      if (name === "unshare") { setOwnerShareRole("view"); setOwnerIsPublic(false); rememberOwnerShareId(""); }
      else if (row) {
        setOwnerShareRole(row.role === "edit" ? "edit" : "view");
        setOwnerIsPublic(!!row.is_public);
        rememberOwnerShareId(row.share_id);
      }
    }
    if (okStatus) setStatus(okStatus);
    await call("cloudRefreshShares");
    return row;
  } catch (error) {
    setStatus(shareRpcError(error, "Share failed"), true);
    return null;
  }
}

async function cloudShareCopyLink(shareId) {
  var url = cloudShareLinkFor(shareId);
  if (!url) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(url);
    emit("showCopyTip", "Share link copied");
    setStatus("Share link copied");
  } catch (error) {
    setStatus(shareRpcError(error, "Could not copy link"), true);
  }
}

async function cloudRefreshShares() {
  var shares = [];
  try {
    shares = await cloudFetchOwnShares();
  } catch (error) {
    setStatus(error && error.message ? error.message : "Could not load your shares", true);
    return;
  }
  emit("shellRenderShared", shares);
}


register("cloudShareSummaries", cloudShareSummaries);
register("cloudShareLinkFor", cloudShareLinkFor);
register("cloudFetchOwnShares", cloudFetchOwnShares);
register("cloudShareMutate", cloudShareMutate);
register("cloudShareCopyLink", cloudShareCopyLink);
register("cloudRefreshShares", cloudRefreshShares);

export {
  cloudShareSummaries,
  cloudShareLinkFor,
  cloudFetchOwnShares,
  cloudShareMutate,
  cloudShareCopyLink,
  cloudRefreshShares
};
