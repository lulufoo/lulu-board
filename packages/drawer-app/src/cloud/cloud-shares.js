/* Cloud layer. Chrome leftover is reached through hooks. */
import { register, emit } from '../core/hooks.js';

import { cloudShareHash } from '../core/cloud-route.js';
import {
  cloudClient,
  cloudSession,
  setOwnerShareRole,
  setOwnerIsPublic,
  cloudDiagramId,
} from './cloud-state.js';
import { setStatus } from '../state/shell-state.js';

import { rememberOwnerShareId, shareRpcError } from './cloud-share.js';
import { displayTitleFromBmd } from './cloud-groups.js';

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
  var accessToken = cloudSession && cloudSession.access_token;
  if (!accessToken) return [];
  var response = await fetch("https://api.luluboard.app/shares/outgoing", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  var text = await response.text();
  var body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    var fail = body && (body.message || body.error) || ("HTTP " + response.status);
    throw new Error(fail);
  }
  var current = cloudDiagramId();
  return (Array.isArray(body) ? body : []).map(function (row) {
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

// One share setting on one board. The Worker calls the SQL function.
var SHARE_SETTING_ROUTES = {
  open_share: "/shares/open",
  rotate_share: "/shares/rotate",
  unshare: "/shares/unshare",
  set_share_role: "/shares/role",
};
async function cloudShareMutate(diagramId, name, args, okStatus) {
  try {
    var path = SHARE_SETTING_ROUTES[name];
    if (!path) throw new Error("unknown share action");
    var accessToken = cloudSession && cloudSession.access_token;
    if (!accessToken) throw new Error("Sign in to share");
    var payload = { diagram_id: diagramId };
    if (args && args.p_role) payload.role = args.p_role;
    if (args && args.p_principal) payload.principal = args.p_principal;
    var response = await fetch("https://api.luluboard.app" + path, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    var text = await response.text();
    var row = text ? JSON.parse(text) : null;
    if (!response.ok) {
      var fail = row && (row.message || row.error) || ("HTTP " + response.status);
      throw new Error(fail);
    }
    if (diagramId === cloudDiagramId()) {
      if (name === "unshare") { setOwnerShareRole("view"); setOwnerIsPublic(false); rememberOwnerShareId(""); }
      else if (row) {
        setOwnerShareRole(row.role === "edit" ? "edit" : "view");
        setOwnerIsPublic(!!row.is_public);
        rememberOwnerShareId(row.share_id);
      }
    }
    if (okStatus) setStatus(okStatus);
    await cloudRefreshShares();
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

// 层内反转：cloud-sync.js 是 cloud 内部的底层（其余 cloud 文件都 import 它），
// 不能 import 回这里，否则成环；所以用 hooks 登记，由 sync 调用。
register("cloudRefreshShares", cloudRefreshShares);

export {
  cloudShareLinkFor,
  cloudShareMutate,
  cloudShareCopyLink,
};
