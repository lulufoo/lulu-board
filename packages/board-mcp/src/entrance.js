/* board-mcp/entrance.js — who may call /mcp: a user token that Auth confirms and that was issued to the mcp channel */

import { verifyAccessToken } from "./jwt.js";
import { unauthorized } from "./meta.js";

// The only channel this Worker serves. A `web` token belongs to the site, `unknown` to a client nobody registered.
var MCP_CHANNEL = "mcp";

function bearerToken(request) {
  var header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

// { token, identity } to go on, or { response } to send back.
// Every refusal is HTTP 401 with www-authenticate, which is what makes a client sign in again.
export async function authenticate(request, env) {
  var token = bearerToken(request);
  if (!token) return { response: unauthorized(env, request) };
  var identity;
  try {
    identity = await verifyAccessToken(env, token);
  } catch (_error) {
    return { response: unauthorized(env, request) };
  }
  if (identity.channel !== MCP_CHANNEL) return { response: unauthorized(env, request) };
  return { token: token, identity: identity };
}
