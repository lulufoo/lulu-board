/* drawer-app/06-cloud-shares.js — the boards I shared out (link shares), as data plus per-board actions. */

// boards: owner rows with a share_id; roles: { [shareId]: "view" | "edit" }.
function cloudShareSummaries(boardRows, roles, currentBoardId, publics) {
  var current = String(currentBoardId || "");
  var out = [];
  (boardRows || []).forEach(function (row) {
    if (!row || !row.graph_id || !row.share_id) return;
    out.push({
      boardId: row.graph_id,
      title: row.title || "",
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
  if (!shareId || typeof cloudShareHash !== "function") return "";
  return location.origin + location.pathname + location.search + cloudShareHash(shareId);
}

// Throws on a cloud error. Signed out: [].
async function cloudFetchOwnShares() {
  if (!cloudClient || !cloudSession || !cloudSession.user) return [];
  var boards = await cloudClient.from("graphs")
    .select("graph_id,title,share_id,created_at,updated_at")
    .not("share_id", "is", null);
  if (boards.error) throw boards.error;
  var rows = boards.data || [];
  var roles = {};
  var publics = {};
  await Promise.all(rows.map(async function (row) {
    var state = await runShareRpc("own_share_state", { p_graph_id: row.graph_id });
    if (state && state.role) roles[row.share_id] = state.role;
    if (state && state.is_public) publics[row.share_id] = true;
  }));
  var current = typeof cloudVelaId === "function" ? cloudVelaId() : "";
  return cloudShareSummaries(rows, roles, current, publics);
}

// One RPC on one board. Keeps the open board's own share state (status chrome) in step.
async function cloudShareMutate(boardId, name, args, okStatus) {
  try {
    var row = await runShareRpc(name, Object.assign({ p_graph_id: boardId }, args || {}));
    if (boardId === cloudVelaId()) {
      if (name === "unshare") { ownerShareRole = "view"; ownerIsPublic = false; rememberOwnerShareId(""); }
      else if (row) {
        ownerShareRole = row.role === "edit" ? "edit" : "view";
        ownerIsPublic = !!row.is_public;
        rememberOwnerShareId(row.share_id);
      }
    }
    if (okStatus) setStatus(okStatus);
    if (typeof cloudRefreshShares === "function") await cloudRefreshShares();
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
    if (typeof showCopyTip === "function") showCopyTip("Share link copied");
    else setStatus("Share link copied");
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
  if (typeof shellRenderShared === "function") shellRenderShared(shares);
}
