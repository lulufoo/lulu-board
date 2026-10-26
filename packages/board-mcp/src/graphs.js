/* board-mcp/graphs.js — PostgREST graph reads and writes with CAS */

import {
  assertGraphId,
  boardTitleFromBody,
  newGraphId,
  stripPersistedMeta,
} from "../../board-core/document-format.js";

export { assertGraphId, boardTitleFromBody, newGraphId, stripPersistedMeta };

const GROUP_ID_RE = /^g_[0-9a-f]{8}$/;
const GRAPH_PUBLIC_SELECT = "graph_id,title,bmd,version,updated_at,group_id";

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

function restHeaders(env, token) {
  return {
    apikey: env.SUPABASE_PUBLISHABLE_KEY,
    Authorization: "Bearer " + token,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

async function restJson(env, token, path, init) {
  var res = await fetch(env.SUPABASE_URL + path, Object.assign({
    headers: restHeaders(env, token),
  }, init || {}));
  var text = await res.text();
  var body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    var msg = body && (body.message || body.error_description || body.error) || ("HTTP " + res.status);
    throw new Error(msg);
  }
  return body;
}

export async function getGraph(env, token, graphId) {
  var id = assertGraphId(graphId);
  var rows = await restJson(
    env,
    token,
    "/rest/v1/graphs?graph_id=eq." + encodeURIComponent(id) + "&select=" + GRAPH_PUBLIC_SELECT
  );
  if (!rows || !rows[0]) throw new Error("Cloud board not found");
  return rowPublic(rows[0]);
}

export async function createGraph(env, token, userId, bmd, graphId, groupId) {
  var source = stripPersistedMeta(bmd);
  if (!source.trim()) throw new Error("board source must not be empty");
  var id = graphId ? assertGraphId(graphId) : newGraphId();
  var ownedGroup = groupId ? assertGroupId(groupId) : null;
  var rows = await restJson(env, token, "/rest/v1/rpc/create_owned_graph_with_group", {
    method: "POST",
    body: JSON.stringify({
      p_graph_id: id,
      p_title: boardTitleFromBody(source) || "Untitled",
      p_bmd: source,
      p_group_id: ownedGroup,
    }),
  });
  var row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) throw new Error("create failed");
  return rowPublic(row);
}

export async function saveGraph(env, token, graphId, bmd, expectedVersion) {
  var id = assertGraphId(graphId);
  var source = stripPersistedMeta(bmd);
  if (!source.trim()) throw new Error("board source must not be empty");
  var expected = Number(expectedVersion);
  if (!(expected > 0)) expected = 1;
  var rows = await restJson(
    env,
    token,
    "/rest/v1/graphs?graph_id=eq." + encodeURIComponent(id) + "&version=eq." + encodeURIComponent(String(expected)) + "&select=" + GRAPH_PUBLIC_SELECT,
    {
      method: "PATCH",
      body: JSON.stringify({
        title: boardTitleFromBody(source) || "Untitled",
        bmd: source,
      }),
    }
  );
  if (rows && rows[0]) return { conflict: false, row: rowPublic(rows[0]) };
  var latest = await getGraph(env, token, id);
  return { conflict: true, row: latest };
}
