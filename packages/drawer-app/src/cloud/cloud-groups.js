/* Cloud layer. Chrome leftover is reached through hooks. */
import { register, emit } from '../core/hooks.js';

import { stripDocumentMeta, diagramTitleFromBody } from '../core/document-meta.js';

import {
  cloudClient,
  cloudSession,
  cloudDiagramId,
} from './cloud-state.js';
import {
  shellGroups,
  shellMineCursor,
  setShellMineTotal,
  setShellMineCursor,
} from '../state/shell-state.js';

import { groupDiagramRowsByGroup } from './cloud-sync.js';

/* drawer-app/06-cloud-groups.js — the signed-in user's groups as plain data (no DOM). */

function displayTitleFromBmd(bmd) {
  var body = stripDocumentMeta(bmd);
  var title = diagramTitleFromBody(body);
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
  var current = cloudDiagramId();
  return cloudMinePageFromRows(result.data || [], current);
}

async function cloudLoadMoreMineGroups() {
  if (!shellMineCursor) return;
  var page = await cloudFetchGroupSummaries(shellMineCursor);
  setShellMineTotal(page.total);
  var merged = (shellGroups || []).concat(page.groups || []);
  var last = page.groups && page.groups[page.groups.length - 1];
  setShellMineCursor(last && merged.length < page.total ? cloudMineCursor(last) : null);
  emit("shellRenderMine", merged);
}

// 层内反转：cloud-sync.js 是 cloud 内部的底层（其余 cloud 文件都 import 它），
// 不能 import 回这里，否则成环；所以用 hooks 登记，由 sync 调用。
register("cloudMineCursor", cloudMineCursor);
register("cloudFetchGroupSummaries", cloudFetchGroupSummaries);

export { cloudLoadMoreMineGroups, displayTitleFromBmd };
