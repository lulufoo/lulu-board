/* board-mcp/graphs.js — board API graph reads and writes */

import {
  assertGraphId,
  boardTitleFromBody,
  newGraphId,
  stripPersistedMeta,
} from "../../board-core/document-format.js";

export { assertGraphId, boardTitleFromBody, newGraphId, stripPersistedMeta };

const GROUP_ID_RE = /^g_[0-9a-f]{8}$/;

export function newGroupId(bytes) {
  var raw = bytes || new Uint8Array(4);
  if (!bytes && globalThis.crypto && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(raw);
  }
  var hex = "";
  for (var i = 0; i < raw.length; i += 1) hex += ("0" + raw[i].toString(16)).slice(-2);
  return "g_" + hex;
}

export function assertGroupId(groupId) {
  var id = String(groupId || "").trim();
  if (!GROUP_ID_RE.test(id)) throw new Error("invalid group id");
  return id;
}

function rowPublic(row) {
  if (!row) return null;
  var raw = row.group_id;
  if (!String(raw || "").trim()) throw new Error("missing group id");
  return {
    graph_id: row.graph_id,
    title: row.title || "",
    bmd: row.bmd || "",
    version: Number(row.version) || 1,
    updated_at: row.updated_at || "",
    group_id: assertGroupId(raw),
  };
}

function sortRank(value) {
  var n = Number(value);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

function groupFromShells(queriedId, rows) {
  var id = assertGraphId(queriedId);
  var groupId = "";
  var found = false;
  var pending = [];
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    if (!row || !row.graph_id) return;
    var diagramId;
    try { diagramId = assertGraphId(row.graph_id); }
    catch (_error) { return; }
    var rawGroup = String(row.group_id || "").trim();
    if (diagramId === id) {
      found = true;
      groupId = rawGroup;
    }
    pending.push({
      diagram_id: diagramId,
      title: row.title || "",
      sort_order: sortRank(row.sort_order),
      group_id: rawGroup,
    });
  });
  if (!found) throw new Error("Cloud board not found");
  if (!groupId) throw new Error("missing group id");
  groupId = assertGroupId(groupId);
  var members = pending.filter(function (row) {
    return row.group_id === groupId;
  }).map(function (row) {
    return {
      diagram_id: row.diagram_id,
      title: row.title,
      sort_order: row.sort_order,
    };
  });
  members.sort(function (a, b) {
    if (a.sort_order !== b.sort_order) return a.sort_order < b.sort_order ? -1 : 1;
    return a.diagram_id < b.diagram_id ? -1 : a.diagram_id > b.diagram_id ? 1 : 0;
  });
  return { group_id: groupId, members: members };
}

export async function getGroup(env, token, graphId) {
  var id = assertGraphId(graphId);
  var res = await fetch("https://api.luluboard.app/groups/shells", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ diagram_id: id }),
  });
  var text = await res.text();
  var body = text ? JSON.parse(text) : null;
  if (res.status === 404 || body == null) throw new Error("Cloud board not found");
  if (!res.ok) {
    var msg = body && (body.message || body.error) || ("HTTP " + res.status);
    throw new Error(msg);
  }
  return groupFromShells(id, body);
}

export async function getGraph(env, token, graphId) {
  var id = assertGraphId(graphId);
  var res = await fetch("https://api.luluboard.app/graphs?diagram_id=" + encodeURIComponent(id), {
    headers: { Authorization: "Bearer " + token },
  });
  var text = await res.text();
  var body = text ? JSON.parse(text) : null;
  if (res.status === 404 || !body) throw new Error("Cloud board not found");
  if (!res.ok) {
    var msg = body && (body.message || body.error) || ("HTTP " + res.status);
    throw new Error(msg);
  }
  return rowPublic(body);
}

export async function createGraph(env, token, userId, bmd, graphId, groupId) {
  var source = stripPersistedMeta(bmd);
  if (!source.trim()) throw new Error("board source must not be empty");
  var id = graphId ? assertGraphId(graphId) : newGraphId();
  var ownedGroup = groupId ? assertGroupId(groupId) : null;
  var payload = { bmd: source, diagram_id: id };
  if (ownedGroup) payload.group_id = ownedGroup;
  var res = await fetch("https://api.luluboard.app/graphs", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  var text = await res.text();
  var body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    var msg = body && (body.message || body.error) || ("HTTP " + res.status);
    throw new Error(msg);
  }
  if (!body || !body.diagram_id) throw new Error("create failed");
  return rowPublic({
    graph_id: body.diagram_id,
    title: body.title,
    bmd: body.bmd,
    version: body.version,
    updated_at: body.updated_at,
    group_id: body.group_id,
  });
}

export async function saveGraph(env, token, graphId, bmd, expectedVersion) {
  var id = assertGraphId(graphId);
  var source = stripPersistedMeta(bmd);
  if (!source.trim()) throw new Error("board source must not be empty");
  var expected = Number(expectedVersion);
  if (!(expected > 0)) expected = 1;
  var res = await fetch("https://api.luluboard.app/graphs", {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      diagram_id: id,
      bmd: source,
      expected_version: expected,
    }),
  });
  var text = await res.text();
  var body = text ? JSON.parse(text) : null;
  if (res.status === 409) {
    var latest = await getGraph(env, token, id);
    return { conflict: true, row: latest };
  }
  if (!res.ok) {
    var msg = body && (body.message || body.error) || ("HTTP " + res.status);
    throw new Error(msg);
  }
  if (!body || !body.diagram_id) throw new Error("save failed");
  return {
    conflict: false,
    row: rowPublic({
      graph_id: body.diagram_id,
      title: body.title,
      bmd: body.bmd,
      version: body.version,
      updated_at: body.updated_at,
      group_id: body.group_id,
    }),
  };
}

export async function searchDiagrams(env, token, query) {
  var q = String(query || "").trim();
  if (!q) throw new Error("query required");
  var res = await fetch("https://api.luluboard.app/search", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: q }),
  });
  var text = await res.text();
  var body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    var msg = body && (body.message || body.error) || ("HTTP " + res.status);
    throw new Error(msg);
  }
  var hits = [];
  (Array.isArray(body) ? body : []).forEach(function (row) {
    if (!row || row.category !== "mine") return;
    try {
      hits.push({ graph_id: assertGraphId(row.graph_id), title: row.title || "" });
    } catch (_error) { return; }
  });
  return hits;
}
