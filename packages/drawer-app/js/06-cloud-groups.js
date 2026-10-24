/* drawer-app/06-cloud-groups.js — the signed-in user's groups as plain data (no DOM). */

function displayTitleFromBmd(bmd) {
  var body = typeof stripDocumentMeta === "function" ? stripDocumentMeta(bmd) : String(bmd || "");
  var title = typeof diagramTitleFromBody === "function" ? diagramTitleFromBody(body) : "";
  return title || "";
}

// rows: boards newest-edited first; memberships: { graph_id, group_id }.
// Each summary: groupId, title (parsed from the face board's bmd), diagramCount,
// updatedAt, diagramIds, isCurrent, members. Newest-edited group first.
function cloudGroupSummaries(diagramRows, memberships, currentDiagramId) {
  var groups = groupDiagramRowsByGroup(diagramRows, memberships);
  var current = String(currentDiagramId || "");
  var out = groups.map(function (group) {
    var face = group.members[0];
    var diagramIds = group.members.map(function (row) { return row.graph_id; });
    var newest = "";
    group.members.forEach(function (row) {
      var stamp = String(row.updated_at || row.created_at || "");
      if (stamp > newest) newest = stamp;
    });
    return {
      groupId: group.group_id,
      title: displayTitleFromBmd(face.bmd),
      diagramCount: diagramIds.length,
      updatedAt: newest,
      diagramIds: diagramIds,
      faceDiagramId: face.graph_id,
      isCurrent: !!current && diagramIds.indexOf(current) >= 0,
      members: group.members,
    };
  });
  out.sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0; });
  return out;
}

function cloudMineCursor(group) {
  if (!group || !group.groupId || !group.updatedAt) return null;
  return { updatedAt: group.updatedAt, groupId: group.groupId };
}

function cloudMinePageFromRows(rows, currentDiagramId) {
  var current = String(currentDiagramId || "");
  var groups = [];
  var byId = {};
  var total = 0;
  (rows || []).forEach(function (row) {
    if (!row || !row.group_id) return;
    if (row.total != null) total = Number(row.total) || 0;
    var group = byId[row.group_id];
    if (!group) {
      group = {
        groupId: row.group_id,
        title: row.face_title || "",
        updatedAt: String(row.group_updated_at || ""),
        faceDiagramId: row.face_graph_id || "",
        diagramIds: [],
        members: [],
        diagramCount: 0,
        isCurrent: false,
      };
      byId[row.group_id] = group;
      groups.push(group);
    }
    if (!row.graph_id) return;
    group.diagramIds.push(row.graph_id);
    group.members.push({
      graph_id: row.graph_id,
      group_id: row.group_id,
      title: row.title || "",
      sort_order: row.sort_order,
    });
    group.diagramCount = group.diagramIds.length;
    if (current && row.graph_id === current) group.isCurrent = true;
  });
  return { groups: groups, total: total };
}

// Throws on a cloud error. Signed out: empty page.
async function cloudFetchGroupSummaries(cursor) {
  if (!cloudClient || !cloudSession || !cloudSession.user) return { groups: [], total: 0 };
  var args = {};
  if (cursor && cursor.updatedAt && cursor.groupId) {
    args.p_before = cursor.updatedAt;
    args.p_before_group_id = cursor.groupId;
  }
  var result = await cloudClient.rpc("list_mine_groups", args);
  if (result.error) throw result.error;
  var current = typeof cloudDiagramId === "function" ? cloudDiagramId() : "";
  return cloudMinePageFromRows(result.data || [], current);
}

async function cloudLoadMoreMineGroups() {
  if (!shellMineCursor) return;
  var page = await cloudFetchGroupSummaries(shellMineCursor);
  shellMineTotal = page.total;
  var merged = (shellGroups || []).concat(page.groups || []);
  var last = page.groups && page.groups[page.groups.length - 1];
  shellMineCursor = last && merged.length < page.total ? cloudMineCursor(last) : null;
  if (typeof shellRenderMine === "function") shellRenderMine(merged);
}
