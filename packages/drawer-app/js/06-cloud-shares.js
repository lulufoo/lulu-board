/* drawer-app/06-cloud-shares.js — the boards I shared out (link shares), as data plus per-board actions. */

// boards: owner rows with a share_id; roles: { [shareId]: "view" | "edit" }.
function cloudShareSummaries(boardRows, roles, currentBoardId) {
  var current = String(currentBoardId || "");
  var out = [];
  (boardRows || []).forEach(function (row) {
    if (!row || !row.board_id || !row.share_id) return;
    out.push({
      boardId: row.board_id,
      title: row.title || "",
      shareId: row.share_id,
      role: roles && roles[row.share_id] === "edit" ? "edit" : "view",
      updatedAt: String(row.updated_at || row.created_at || ""),
      isCurrent: !!current && row.board_id === current,
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
  var boards = await cloudClient.from("boards")
    .select("board_id,title,share_id,created_at,updated_at")
    .not("share_id", "is", null);
  if (boards.error) throw boards.error;
  var rows = boards.data || [];
  var roles = {};
  await Promise.all(rows.map(async function (row) {
    var state = await runShareRpc("own_share_state", { p_board_id: row.board_id });
    if (state && state.role) roles[row.share_id] = state.role;
  }));
  var current = typeof cloudBoardId === "function" ? cloudBoardId() : "";
  return cloudShareSummaries(rows, roles, current);
}

// One RPC on one board. Keeps the open board's own share state (status chrome) in step.
async function cloudShareMutate(boardId, name, args, okStatus) {
  try {
    var row = await runShareRpc(name, Object.assign({ p_board_id: boardId }, args || {}));
    if (boardId === cloudBoardId()) {
      if (name === "unshare") { ownerShareRole = "view"; rememberOwnerShareId(""); }
      else if (row) {
        ownerShareRole = row.role === "edit" ? "edit" : "view";
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

// "Share this board": make a link for the open board if it has none, copy it, refresh the list.
async function cloudShareOpenBoard() {
  var boardId = typeof cloudBoardId === "function" ? cloudBoardId() : "";
  if (!boardId || !cloudSession || !cloudSession.user || (typeof isShareGuest === "function" && isShareGuest())) {
    setStatus("Save this board to the cloud to share it", true);
    return;
  }
  var row = null;
  var shares = typeof shellShares !== "undefined" ? shellShares : [];
  var known = shares.filter(function (item) { return item.boardId === boardId; })[0];
  if (known) row = { share_id: known.shareId };
  else row = await cloudShareMutate(boardId, "open_share", null, "Share link ready");
  if (row && row.share_id) await cloudShareCopyLink(row.share_id);
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
