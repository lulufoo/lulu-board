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
      boardId: row.board_id || "",
      note: row.category === "public" ? "Public" : "Mine",
    };
    if (row.category === "public") pub.push(item);
    else mine.push(item);
  });
  return { mine: mine, public: pub };
}

async function cloudSearchBoards(query) {
  var q = String(query || "").trim();
  if (!q || !cloudSearchSignedIn() || !cloudClient) return { mine: [], public: [] };
  var result = await cloudClient.rpc("search_boards", { p_query: q });
  if (result.error) throw result.error;
  return cloudSearchSplit(result.data);
}
