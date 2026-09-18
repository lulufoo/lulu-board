/* board-mcp/boards.js — PostgREST board reads and writes with CAS */

const BOARD_ID_RE = /^b_[0-9a-f]{8}$/;

export function boardTitleFromBody(body) {
  var hit = /^\s*board\s+"([^"]*)"/.exec(String(body || ""));
  return hit ? hit[1] : "";
}

export function newBoardId(bytes) {
  var raw = bytes || new Uint8Array(4);
  if (!bytes && globalThis.crypto && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(raw);
  }
  var hex = "";
  for (var i = 0; i < raw.length; i += 1) hex += ("0" + raw[i].toString(16)).slice(-2);
  return "b_" + hex;
}

export function assertBoardId(boardId) {
  var id = String(boardId || "").trim();
  if (!BOARD_ID_RE.test(id)) throw new Error("invalid board id");
  return id;
}

function rowPublic(row) {
  if (!row) return null;
  return {
    board_id: row.board_id,
    title: row.title || "",
    bmd: row.bmd || "",
    version: Number(row.version) || 1,
    updated_at: row.updated_at || "",
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

export async function getBoard(env, token, boardId) {
  var id = assertBoardId(boardId);
  var rows = await restJson(
    env,
    token,
    "/rest/v1/boards?board_id=eq." + encodeURIComponent(id) + "&select=board_id,title,bmd,version,updated_at"
  );
  if (!rows || !rows[0]) throw new Error("Cloud board not found");
  return rowPublic(rows[0]);
}

export async function createBoard(env, token, userId, bmd, boardId) {
  var source = String(bmd || "");
  if (!source.trim()) throw new Error("board source must not be empty");
  var id = boardId ? assertBoardId(boardId) : newBoardId();
  var rows = await restJson(env, token, "/rest/v1/boards", {
    method: "POST",
    body: JSON.stringify({
      owner_id: userId,
      board_id: id,
      title: boardTitleFromBody(source) || "Untitled",
      bmd: source,
    }),
  });
  var row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) throw new Error("create failed");
  return rowPublic(row);
}

export async function saveBoard(env, token, boardId, bmd, expectedVersion) {
  var id = assertBoardId(boardId);
  var source = String(bmd || "");
  if (!source.trim()) throw new Error("board source must not be empty");
  var expected = Number(expectedVersion);
  if (!(expected > 0)) expected = 1;
  var rows = await restJson(
    env,
    token,
    "/rest/v1/boards?board_id=eq." + encodeURIComponent(id) + "&version=eq." + encodeURIComponent(String(expected)),
    {
      method: "PATCH",
      body: JSON.stringify({
        title: boardTitleFromBody(source) || "Untitled",
        bmd: source,
      }),
    }
  );
  if (rows && rows[0]) return { conflict: false, row: rowPublic(rows[0]) };
  var latest = await getBoard(env, token, id);
  return { conflict: true, row: latest };
}
