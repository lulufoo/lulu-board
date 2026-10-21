/* drawer-app/06-cloud-groups.js — the signed-in user's groups as plain data (no DOM). */

// rows: boards newest-edited first; memberships: { graph_id, group_id }.
// Each summary: groupId, title (of the most recently edited board), boardCount,
// updatedAt, boardIds, isCurrent, members. Newest-edited group first.
function cloudGroupSummaries(boardRows, memberships, currentBoardId) {
  var groups = groupBoardRowsByGroup(boardRows, memberships);
  var current = String(currentBoardId || "");
  var out = groups.map(function (group) {
    var face = group.members[0];
    var boardIds = group.members.map(function (row) { return row.graph_id; });
    var newest = "";
    group.members.forEach(function (row) {
      var stamp = String(row.updated_at || row.created_at || "");
      if (stamp > newest) newest = stamp;
    });
    return {
      groupId: group.group_id,
      title: face.title || "",
      boardCount: boardIds.length,
      updatedAt: newest,
      boardIds: boardIds,
      faceBoardId: face.graph_id,
      isCurrent: !!current && boardIds.indexOf(current) >= 0,
      members: group.members,
    };
  });
  out.sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0; });
  return out;
}

// Throws on a cloud error. Signed out: [].
async function cloudFetchGroupSummaries() {
  if (!cloudClient || !cloudSession || !cloudSession.user) return [];
  var boards = await cloudClient.from("graphs")
    .select("graph_id,title,created_at,updated_at")
    .order("updated_at", { ascending: false });
  if (boards.error) throw boards.error;
  var members = await cloudClient.from("graphs").select("graph_id,group_id");
  if (members.error) throw members.error;
  var current = typeof cloudVelaId === "function" ? cloudVelaId() : "";
  return cloudGroupSummaries(boards.data || [], members.data || [], current);
}
